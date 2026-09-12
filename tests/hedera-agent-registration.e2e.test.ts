import { describe, it, expect } from "vitest";
import { createApp } from "../apps/api/src/app";

describe("Hedera Sovereign Agent Registration & Consensus Anchoring", () => {
  const app = createApp({
    env: {
      X402_NETWORK: "testnet",
      SWARMPROOF_GATEWAY_SHARE: "0.1",
      HEDERA_TOPIC_ID: "0.0.10417469",
    },
    payment: {
      mode: "mock",
      async createRequirement() {
        return { paymentId: "mock-pay-hedera", total: "1.00", currency: "USD", network: "testnet", recipients: [] };
      },
      async verifyPayment() {
        return { status: "paid", paymentId: "mock-pay-hedera", auditId: "mock" };
      },
      async settlePayment() {
        return { transaction: "0.0.mock-trx", status: "settled" };
      },
      isPaid() {
        return true;
      },
    },
  });

  it("issues a cryptographic challenge via GET /agents/challenge", async () => {
    const res = await app.request("/agents/challenge?agentId=custom-sentinel&accountId=0.0.10119346");
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.challenge).toBeDefined();
    expect(json.nonce).toBeDefined();
    expect(json.agentId).toBe("custom-sentinel");
    expect(json.accountId).toBe("0.0.10119346");
  });

  it("registers a specialist agent and anchors identity on Hedera HCS Topic 0.0.10417469", async () => {
    const res = await app.request("/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "governance-guardian",
        name: "DAO Governance Guardian",
        role: "Timelock bypasses, quorum attacks, flash-loan voting manipulation",
        capabilities: ["governance-hijack", "quorum-drain", "timelock-bypass"],
        paymentAddress: "0.0.10119346",
        publicKey: "033ba0f4cba001b21c3f52006119e8796913cd2328ab03ac2f8b8bf9b97c8e98aa",
        signature: "3045022100e4b8a1c93a02796...",
        shape: "octahedron",
        color: "#8b5cf6",
        systemPrompt: "You are the DAO Governance Guardian. Protect DAOs against flash loan voting manipulation.",
        model: "gpt-4o",
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(true);
    expect(json.agent.agentId).toBe("governance-guardian");
    expect(json.agent.did).toMatch(/^did:hedera:testnet:.*governance-guardian$/);
    expect(json.agent.identityTopicId).toBeDefined();
    expect(json.verifiableCredential).toBeDefined();
    expect(json.verifiableCredential.type).toContain("SwarmSecurityAuditorCredential");
    expect(json.verifiableCredential.issuer.id).toMatch(/^did:hedera:testnet:/);
  });

  it("blocks duplicate MEV & Flash Loan agent registration when one already exists in the quorum", async () => {
    const res = await app.request("/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "mev-flash-loan-clone",
        name: "Duplicate MEV Sentinel",
        role: "Flash Loan Arbitrage and MEV",
        capabilities: ["flash-loan", "arbitrage"],
      }),
    });

    expect(res.status).toBe(409);
    const json = (await res.json()) as any;
    expect(json.code).toBe("DUPLICATE_MEV_AGENT_DISALLOWED");
    expect(json.error).toContain("Duplicate Specialty Restriction");
    expect(json.existingAgentId).toBe("mev-sentinel");
  });

  it("lists the registered specialist in GET /agents", async () => {
    const res = await app.request("/agents");
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(Array.isArray(json.agents)).toBe(true);
    const found = json.agents.find((a: any) => a.agentId === "governance-guardian");
    expect(found).toBeDefined();
    expect(found.role).toContain("Timelock bypasses");
  });
});
