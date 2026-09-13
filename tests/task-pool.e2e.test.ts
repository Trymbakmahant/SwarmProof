import { describe, it, expect } from "vitest";
import { createApp } from "../apps/api/src/app";
import { createTaskWithRealX402Escrow, hasFundedPayer, payerAccountId, payerPrivateKey } from "./helpers/live-x402";

describe("Audit Task Pool Endpoints E2E (Stage B.2 & B.3)", () => {
  const app = createApp({
    env: {
      X402_NETWORK: "testnet",
      SWARMPROOF_GATEWAY_SHARE: "0.1",
    },
    payment: {
      mode: "mock",
      async createRequirement() {
        return {
          paymentId: "mock-pay-pool",
          total: "1.00",
          currency: "USD",
          network: "testnet",
          recipients: [],
        };
      },
      async verifyPayment() {
        return { status: "paid", paymentId: "mock-pay-pool", auditId: "mock" };
      },
      async settlePayment() {
        return { transaction: "0.0.mock-trx", status: "settled" };
      },
      isPaid() {
        return true;
      },
    },
  });

  it("GET /pool/tasks returns the task list with seeded task and remainingSeconds", async () => {
    const res = await app.request("/pool/tasks");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(data.tasks[0]).toHaveProperty("id");
    expect(data.tasks[0]).toHaveProperty("contractName");
    expect(data.tasks[0]).toHaveProperty("status");
    expect(data.tasks[0]).toHaveProperty("remainingSeconds");
    expect(data.tasks[0]).toHaveProperty("isWindowOpen");
  });

  it.runIf(hasFundedPayer)("POST /pool/tasks creates a new open audit task in the pool", async () => {
    const task = await createTaskWithRealX402Escrow(app, {
      contractName: "StakingPool",
      source: "contract StakingPool { function stake() external {} }",
      submissionWindowSeconds: 45,
      bountyTotal: "2.50",
      currency: "USD",
    });

    expect(task.contractName).toBe("StakingPool");
    expect(task.status).toBe("OPEN_FOR_SUBMISSIONS");
    expect(task.submissionWindowSeconds).toBe(45);
    expect(task.remainingSeconds).toBeGreaterThan(0);
    expect(task.isWindowOpen).toBe(true);
    expect(task.escrowReceipt.transactionId).toBeTruthy();
    expect(task.escrowReceipt.hashscanUrl).toContain(task.escrowReceipt.transactionId);
  });

  it.runIf(hasFundedPayer)("POST /pool/tasks/:id/claim allows agent to claim a qualified role slot", async () => {
    // 1. Create task with real on-chain x402 escrow
    const task = await createTaskWithRealX402Escrow(app, {
      contractName: "LendingVault",
      source: "contract LendingVault { function borrow() external {} }",
      submissionWindowSeconds: 100,
    });

    // 2. Claim role slot
    const claimRes = await app.request(`/pool/tasks/${task.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "reentrancy-specialist-01",
        role: "reentrancy",
        paymentAddress: "0.0.10119346",
      }),
    });

    expect(claimRes.status).toBe(200);
    const claimData = await claimRes.json();
    expect(claimData.ok).toBe(true);
    expect(claimData.task.claims).toHaveLength(1);
    expect(claimData.task.claims[0].agentId).toBe("reentrancy-specialist-01");
  });

  it.runIf(hasFundedPayer)("POST /pool/tasks/:id/submit accepts findings from agent within active window", async () => {
    // 1. Create task with real on-chain x402 escrow
    const task = await createTaskWithRealX402Escrow(app, {
      contractName: "GovTimelock",
      source: "contract GovTimelock { function execute() external {} }",
      submissionWindowSeconds: 100,
    });

    // 2. Submit findings
    const subRes = await app.request(`/pool/tasks/${task.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "access-sentinel-01",
        role: "access-control",
        findings: [
          {
            id: "f_gov_1",
            title: "Missing proposer check",
            category: "access-control",
            severity: "high",
            location: "execute()",
            evidence: ["Missing require(msg.sender == proposer)"],
            status: "proposed",
          },
        ],
      }),
    });

    expect(subRes.status).toBe(200);
    const subData = await subRes.json();
    expect(subData.ok).toBe(true);
    expect(subData.task.submissions).toHaveLength(1);
    expect(subData.task.submissions[0].agentId).toBe("access-sentinel-01");
  });

  it.runIf(hasFundedPayer)("POST /pool/tasks/:id/simulate-submissions swarms remaining slots and settles consensus", async () => {
    // 1. Create task with real on-chain x402 escrow
    const task = await createTaskWithRealX402Escrow(app, {
      contractName: "DeFiVault",
      source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract DeFiVault {
    mapping(address => uint256) public balances;
    function deposit() external payable { balances[msg.sender] += msg.value; }
    function withdraw() external {
        uint256 b = balances[msg.sender];
        (bool s, ) = msg.sender.call{value: b}("");
        require(s);
        balances[msg.sender] = 0;
    }
}`,
      submissionWindowSeconds: 120,
    });

    // 2. Simulate autonomous specialist swarm
    const simRes = await app.request(`/pool/tasks/${task.id}/simulate-submissions`, {
      method: "POST",
    });

    expect(simRes.status).toBe(200);
    const simData = await simRes.json();
    expect(simData.ok).toBe(true);
    expect(simData.simulated.length).toBeGreaterThanOrEqual(1);

    // 3. Verify task reached settled state with consensus report and Hedera proof
    expect(simData.task.status).toBe("SETTLED");
    expect(simData.task.consensusReport).toBeDefined();
    expect(simData.task.proofReceipt).toBeDefined();
    expect(simData.task.proofReceipt.hcsTopicId).toMatch(/0\.0\.(10417469|mock-topic)/);
    expect(simData.task.score).toBeGreaterThanOrEqual(0);
    expect(simData.task.score).toBeLessThanOrEqual(100);
  });

  it.runIf(hasFundedPayer)("GET /pool/tasks/pull allows agents to query pending open tasks", async () => {
    // 1. Create task with real on-chain x402 escrow
    const task = await createTaskWithRealX402Escrow(app, {
      contractName: "PullTestContract",
      source: "contract PullTestContract {}",
      submissionWindowSeconds: 120,
    });

    // 2. Pull with role filter
    const pullRes = await app.request(`/pool/tasks/pull?agentId=reentrancy-agent&role=reentrancy`);
    expect(pullRes.status).toBe(200);
    const pullData = await pullRes.json();
    expect(pullData.ok).toBe(true);
    expect(pullData.agentId).toBe("reentrancy-agent");
    expect(pullData.role).toBe("reentrancy");
    expect(pullData.tasks.some((t: any) => t.id === task.id)).toBe(true);
  });

  it.runIf(hasFundedPayer)("POST /pool/tasks/:id/run-swarm coordinates dual agents across all 5 specialties (10 agents) from start to end", async () => {
    // 1. Create open task with real on-chain x402 escrow
    const task = await createTaskWithRealX402Escrow(app, {
      contractName: "MultiAgentVault",
      source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract MultiAgentVault {
    mapping(address => uint256) public balances;
    function deposit() external payable { balances[msg.sender] += msg.value; }
    function withdraw() external {
        uint256 b = balances[msg.sender];
        (bool s, ) = msg.sender.call{value: b}("");
        require(s);
        balances[msg.sender] = 0;
    }
}`,
      submissionWindowSeconds: 120,
      bountyTotal: "1.00",
    });

    // 2. Run dual-swarm autonomous pull & audit
    const runRes = await app.request(`/pool/tasks/${task.id}/run-swarm`, {
      method: "POST",
    });
    expect(runRes.status).toBe(200);
    const runData = await runRes.json();

    expect(runData.ok).toBe(true);
    expect(runData.auditId).toBe(task.id);
    expect(runData.agentsParticipated).toBe(10);
    expect(runData.agents).toEqual(
      expect.arrayContaining([
        "reentrancy-agent",
        "reentrancy-sentinel",
        "access-control-agent",
        "access-sentinel",
        "business-logic-agent",
        "invariant-agent",
        "economic-agent",
        "mev-sentinel",
        "static-agent",
        "bytecode-verifier",
      ]),
    );

    // 3. Status settled and anchored on Hedera HCS
    expect(runData.task.status).toBe("SETTLED");
    expect(runData.task.consensusReport).toBeDefined();
    expect(runData.task.proofReceipt).toBeDefined();
    expect(runData.task.proofReceipt.hcsTopicId).toMatch(/0\.0\.(10417469|mock-topic)/);
    expect(runData.task.payouts.length).toBeGreaterThan(0);
  });

  it.runIf(hasFundedPayer)("POST /pool/run-swarm-audit creates task and completes full dual-swarm audit in one request", async () => {
    const res = await app.request("/pool/run-swarm-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractName: "OneClickAudit",
        source: `contract OneClickAudit {
          function test() external {}
        }`,
        bountyTotal: "1.00",
        payerAccountId,
        payerPrivateKey,
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.agentsParticipated).toBe(10);
    expect(data.task.status).toBe("SETTLED");
    expect(data.task.proofReceipt).toBeDefined();
    expect(data.task.escrowReceipt.transactionId).toBeTruthy();
  });
});
