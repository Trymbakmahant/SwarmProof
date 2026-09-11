import { describe, it, expect } from "vitest";
import { createApp } from "../apps/api/src/app";

describe("x402 Advance Escrow & Multi-Agent Payout Distribution (Stage D)", () => {
  const app = createApp({
    env: {
      X402_NETWORK: "testnet",
      SWARMPROOF_GATEWAY_SHARE: "0.1",
      X402_TINYBARS_PER_USD: "1000000",
    },
    payment: {
      mode: "mock",
      async createRequirement() {
        return {
          paymentId: "mock-pay-escrow",
          total: "1.50",
          currency: "USD",
          network: "testnet",
          recipients: [],
        };
      },
      async verifyPayment() {
        return { status: "paid", paymentId: "mock-pay-escrow", auditId: "mock" };
      },
      async settlePayment() {
        return { transaction: "0.0.mock-trx-settle", status: "settled" };
      },
      isPaid() {
        return true;
      },
    },
  });

  let taskId: string;

  it("D.1: POST /pool/tasks with requireEscrow returns 402 challenge with x402 quote", async () => {
    const res = await app.request("/pool/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractName: "FlashLoanEscrowVault",
        source: "contract FlashLoanEscrowVault { function flashLoan() external {} }",
        submissionWindowSeconds: 60,
        bountyTotal: "2.00",
        currency: "USD",
        requireEscrow: true,
      }),
    });

    expect(res.status).toBe(402);
    expect(res.headers.get("www-authenticate")).toContain("X402 resource=");

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.status).toBe("PENDING_ESCROW");
    expect(data.taskId).toBeDefined();
    expect(data.x402Quote).toBeDefined();
    expect(data.x402Quote.total).toBe("2.00");
    expect(data.x402Quote.currency).toBe("USD");
    expect(data.task.status).toBe("PENDING_ESCROW");
    expect(data.task.escrowStatus).toBe("unpaid");

    taskId = data.taskId;
  });

  it("D.1: GET /pool/tasks/:id/quote returns 402 with exact payment requirements", async () => {
    const res = await app.request(`/pool/tasks/${taskId}/quote`);
    expect(res.status).toBe(402);
    expect(res.headers.get("www-authenticate")).toContain("X402 resource=");

    const quote = await res.json();
    expect(quote.x402Version).toBe(2);
    expect(quote.scheme).toBe("exact");
    expect(quote.total).toBe("2.00");
    expect(quote.currency).toBe("USD");
    expect(quote.taskId).toBe(taskId);
    expect(quote.recipient).toBeDefined();
  });

  it("D.1: POST /pool/tasks/:id/escrow authorizes escrow and opens submission window", async () => {
    const escrowRes = await app.request(`/pool/tasks/${taskId}/escrow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: "0.0.client-escrow-tx-99",
        payerAddress: "0.0.10119346",
      }),
    });

    expect(escrowRes.status).toBe(200);
    const data = await escrowRes.json();
    expect(data.ok).toBe(true);
    expect(data.message).toContain("x402 escrow confirmed");
    expect(data.task.status).toBe("OPEN_FOR_SUBMISSIONS");
    expect(data.task.escrowStatus).toBe("escrowed");
    expect(data.task.remainingSeconds).toBeGreaterThan(0);
    expect(data.task.isWindowOpen).toBe(true);
  });

  it("D.2: Agents submit findings, consensus triggers, and multi-agent payouts are streamed", async () => {
    // 1. Submit Agent 1 (Reentrancy)
    await app.request(`/pool/tasks/${taskId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "agent-reentrancy-alpha",
        role: "reentrancy",
        findings: [
          {
            id: "vuln-flash-reentrancy",
            title: "FlashLoan Reentrancy state update before callback",
            category: "reentrancy",
            severity: "critical",
            location: "flashLoan():L14",
            evidence: ["External call before balance update"],
            status: "proposed",
          },
        ],
      }),
    });

    // 2. Submit Agent 2 (Access Control)
    await app.request(`/pool/tasks/${taskId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "agent-access-beta",
        role: "access-control",
        findings: [
          {
            id: "vuln-flash-reentrancy",
            title: "Corroborated reentrancy in loan transfer",
            category: "reentrancy",
            severity: "critical",
            location: "flashLoan():L14",
            evidence: ["Corroborated unchecked token return"],
            status: "proposed",
          },
        ],
      }),
    });

    // 3. Trigger consensus
    const consensusRes = await app.request(`/pool/tasks/${taskId}/trigger-consensus`, {
      method: "POST",
    });

    expect(consensusRes.status).toBe(200);
    const consensusData = await consensusRes.json();
    expect(consensusData.ok).toBe(true);
    expect(consensusData.task.status).toBe("SETTLED");
    expect(consensusData.task.escrowStatus).toBe("distributed");

    // 4. Verify Multi-Agent Payout Records
    const payouts = consensusData.task.payouts;
    expect(payouts).toBeDefined();
    expect(payouts.length).toBe(2);

    // Total bounty: $2.00 USD (2,000,000 tinybars)
    // 10% gateway fee = $0.20
    // 90% agent pool = $1.80 ($0.90 per agent, 900,000 tinybars each)
    const agentAlpha = payouts.find((p: any) => p.agentId === "agent-reentrancy-alpha");
    const agentBeta = payouts.find((p: any) => p.agentId === "agent-access-beta");

    expect(agentAlpha).toBeDefined();
    expect(agentAlpha.amountUSD).toBe("0.90");
    expect(agentAlpha.amountTinybars).toBe(900000);
    expect(agentAlpha.status).toBe("settled");
    expect(agentAlpha.transactionId).toBeDefined();

    expect(agentBeta).toBeDefined();
    expect(agentBeta.amountUSD).toBe("0.90");
    expect(agentBeta.amountTinybars).toBe(900000);
    expect(agentBeta.status).toBe("settled");
  });

  it("D.2 & D.3: GET /pool/tasks/:id/settlement delivers complete settlement receipt", async () => {
    const res = await app.request(`/pool/tasks/${taskId}/settlement`);
    expect(res.status).toBe(200);

    const settlement = await res.json();
    expect(settlement.ok).toBe(true);
    expect(settlement.taskId).toBe(taskId);
    expect(settlement.status).toBe("SETTLED");
    expect(settlement.escrowStatus).toBe("distributed");
    expect(settlement.bountyTotal).toBe("2.00");
    expect(settlement.currency).toBe("USD");

    // Settlement Receipt Breakdown
    const receipt = settlement.settlementReceipt;
    expect(receipt).toBeDefined();
    expect(receipt.totalBounty).toBe("2.00");
    expect(receipt.gatewayFeeUSD).toBe("0.20"); // 10%
    expect(receipt.agentDistributionUSD).toBe("1.80"); // 90%
    expect(receipt.payoutCount).toBe(2);
    expect(receipt.gatewayAddress).toBe("0.0.10417474");
    expect(receipt.totalTinybars).toBe(2000000);

    // Payout records
    expect(settlement.payouts).toHaveLength(2);
    expect(settlement.payouts[0].status).toBe("settled");
  });

  it("D.2: Leaderboard reflects revenue distributed from settled audit", async () => {
    const res = await app.request("/leaderboard");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(parseFloat(data.totalRevenueDistributedUSD)).toBeGreaterThanOrEqual(1.80);
  });
});
