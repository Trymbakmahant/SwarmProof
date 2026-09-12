import { describe, it, expect } from "vitest";
import { createApp } from "../apps/api/src/app";

describe("The Graph Protocol Intelligence & Reputation E2E", () => {
  const app = createApp({
    env: {
      X402_NETWORK: "testnet",
      SWARMPROOF_GATEWAY_SHARE: "0.1",
    },
    payment: {
      mode: "mock",
      async createRequirement() {
        return { paymentId: "mock-pay-graph", total: "1.00", currency: "USD", network: "testnet", recipients: [] };
      },
      async verifyPayment() {
        return { status: "paid", paymentId: "mock-pay-graph", auditId: "mock" };
      },
      async settlePayment() {
        return { transaction: "0.0.mock-trx", status: "settled" };
      },
      isPaid() {
        return true;
      },
    },
  });

  it("GET /leaderboard returns decentralized The Graph indexing metadata", async () => {
    const res = await app.request("/leaderboard?source=the-graph");
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.leaderboard).toBeInstanceOf(Array);
    expect(json.theGraphIndexing).toBeDefined();
    expect(json.theGraphIndexing.status).toBe("synced");
    expect(json.theGraphIndexing.dataProvider).toBe("The Graph Decentralized Network");
    expect(json.theGraphIndexing.subgraphId).toBeDefined();
  });

  it("GET /graph/telemetry returns live on-chain protocol context & TVL", async () => {
    const res = await app.request("/graph/telemetry?contract=UniswapV3Pool");
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.telemetry).toBeDefined();
    expect(json.telemetry.protocolName).toBe("UniswapV3Pool");
    expect(json.telemetry.tvlUsd).toBeGreaterThan(0);
    expect(json.telemetry.riskSignals).toBeInstanceOf(Array);
    expect(json.telemetry.riskSignals.length).toBeGreaterThan(0);
  });

  it("POST /graph/query supports autonomous agent queries with x402 payment headers", async () => {
    const res = await app.request("/graph/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT": "x402-agent-micropayment-authorization-hash",
      },
      body: JSON.stringify({
        query: "{ pools(first: 1) { id } }",
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(true);
    expect(json.x402Paid).toBe(true);
    expect(json.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("GET /graph/agents returns all indexed agents on The Graph with schemaEntity", async () => {
    const res = await app.request("/graph/agents");
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.subgraph).toBeDefined();
    expect(json.subgraph.name).toBe("swarmproof-reputation");
    expect(json.agents).toBeInstanceOf(Array);
    expect(json.agents.length).toBeGreaterThan(0);
    expect(json.agents[0].schemaEntity).toBe("AgentIdentity");
    expect(json.agents[0].reputationScore).toBeDefined();
  });

  it("GET /graph/activity returns recent query traces and x402 micropayments", async () => {
    const res = await app.request("/graph/activity");
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.subgraphs).toBeInstanceOf(Array);
    expect(json.recentQueries).toBeInstanceOf(Array);
    expect(json.recentQueries.length).toBeGreaterThan(0);
    expect(json.activityRows).toBeInstanceOf(Array);
    expect(json.activityRows.length).toBeGreaterThan(0);
    expect(json.recentQueries[0].x402PaymentHeader).toBeDefined();
  });

  it("POST /graph/activity/record persists a live query into the activity log", async () => {
    const res = await app.request("/graph/activity/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queryExpression: "MATCH (a:Agent)-[:DETECTS]->(v:Vuln {type: 'Reentrancy'})",
        agents: "A1, A5",
        latencyMs: 12,
        consensusState: "Anchored (HCS)",
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(true);
    expect(json.record.queryExpression).toBe("MATCH (a:Agent)-[:DETECTS]->(v:Vuln {type: 'Reentrancy'})");
    expect(json.record.agents).toBe("A1, A5");
    expect(json.record.consensusState).toBe("Anchored (HCS)");
  });
});

