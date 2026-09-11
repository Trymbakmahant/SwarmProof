import { describe, it, expect } from "vitest";
import { createApp } from "../apps/api/src/app";

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

  it("POST /pool/tasks creates a new open audit task in the pool", async () => {
    const res = await app.request("/pool/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractName: "StakingPool",
        source: "contract StakingPool { function stake() external {} }",
        submissionWindowSeconds: 45,
        bountyTotal: "2.50",
        currency: "USD",
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.task.contractName).toBe("StakingPool");
    expect(data.task.status).toBe("OPEN_FOR_SUBMISSIONS");
    expect(data.task.submissionWindowSeconds).toBe(45);
    expect(data.task.remainingSeconds).toBeGreaterThan(0);
    expect(data.task.isWindowOpen).toBe(true);
  });

  it("POST /pool/tasks/:id/claim allows agent to claim a qualified role slot", async () => {
    // 1. Create task
    const createRes = await app.request("/pool/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractName: "LendingVault",
        source: "contract LendingVault { function borrow() external {} }",
        submissionWindowSeconds: 100,
      }),
    });
    const { task } = await createRes.json();

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

  it("POST /pool/tasks/:id/submit accepts findings from agent within active window", async () => {
    // 1. Create task
    const createRes = await app.request("/pool/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractName: "GovTimelock",
        source: "contract GovTimelock { function execute() external {} }",
        submissionWindowSeconds: 100,
      }),
    });
    const { task } = await createRes.json();

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

  it("POST /pool/tasks/:id/simulate-submissions swarms remaining slots and settles consensus", async () => {
    // 1. Create task
    const createRes = await app.request("/pool/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });
    const { task } = await createRes.json();

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
});
