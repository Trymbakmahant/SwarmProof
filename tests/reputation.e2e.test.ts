import { describe, it, expect } from "vitest";
import { createApp } from "../apps/api/src/app";

describe("Dynamic Proof-of-Reputation & Leaderboard E2E (Stage C.2)", () => {
  const app = createApp({
    env: {
      X402_NETWORK: "testnet",
      SWARMPROOF_GATEWAY_SHARE: "0.1",
    },
    payment: {
      mode: "mock",
      async createRequirement() {
        return { paymentId: "mock-pay-rep", total: "1.00", currency: "USD", network: "testnet", recipients: [] };
      },
      async verifyPayment() {
        return { status: "paid", paymentId: "mock-pay-rep", auditId: "mock" };
      },
      async settlePayment() {
        return { transaction: "0.0.mock-trx", status: "settled" };
      },
      isPaid() {
        return true;
      },
    },
  });

  it("GET /leaderboard returns dynamic sorted leaderboard", async () => {
    const res = await app.request("/leaderboard");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.leaderboard).toBeInstanceOf(Array);
    expect(data.leaderboard.length).toBeGreaterThanOrEqual(6);

    // Verify sorted descending by reputationScore
    const scores = data.leaderboard.map((a: any) => a.reputationScore);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }

    // Verify properties
    const topAgent = data.leaderboard[0];
    expect(topAgent).toHaveProperty("agentId");
    expect(topAgent).toHaveProperty("reputationScore");
    expect(topAgent).toHaveProperty("tier");
    expect(topAgent).toHaveProperty("accuracyRate");
    expect(topAgent).toHaveProperty("totalAudits");
  });

  it("GET /agents/:id/reputation returns specific agent reputation profile", async () => {
    const res = await app.request("/agents/reentrancy-agent/reputation");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.reputation.agentId).toBe("reentrancy-agent");
    expect(data.reputation.reputationScore).toBeGreaterThanOrEqual(90);
    expect(data.reputation.tier).toBe("ELITE_SENTINEL");
  });

  it("dynamically updates agent reputation and audit counts upon pool consensus execution", async () => {
    // 1. Check initial audits & score of reentrancy-agent
    const initialRes = await app.request("/agents/reentrancy-agent/reputation");
    const initialData = await initialRes.json();
    const initialAudits = initialData.reputation.totalAudits;

    // 2. Create task
    const createRes = await app.request("/pool/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractName: "RepVault",
        source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract RepVault {
    mapping(address => uint256) public balances;
    function deposit() external payable { balances[msg.sender] += msg.value; }
    function withdraw() external {
        uint256 b = balances[msg.sender];
        (bool s, ) = msg.sender.call{value: b}("");
        require(s);
        balances[msg.sender] = 0;
    }
}`,
        submissionWindowSeconds: 60,
      }),
    });
    const { task } = await createRes.json();

    // 3. Reentrancy-agent submits valid finding
    await app.request(`/pool/tasks/${task.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "reentrancy-agent",
        role: "reentrancy",
        findings: [
          {
            id: "reentrancy::withdraw",
            title: "Reentrancy flaw",
            category: "reentrancy",
            severity: "critical",
            location: "withdraw()",
            evidence: ["state change after external call"],
            status: "proposed",
          },
        ],
      }),
    });

    // 4. Trigger consensus
    const consensusRes = await app.request(`/pool/tasks/${task.id}/trigger-consensus`, {
      method: "POST",
    });
    expect(consensusRes.status).toBe(200);

    // 5. Verify reentrancy-agent reputation updated
    const updatedRes = await app.request("/agents/reentrancy-agent/reputation");
    const updatedData = await updatedRes.json();
    expect(updatedData.reputation.totalAudits).toBe(initialAudits + 1);
    expect(updatedData.reputation.acceptedFindingsCount).toBeGreaterThan(0);
  });
});
