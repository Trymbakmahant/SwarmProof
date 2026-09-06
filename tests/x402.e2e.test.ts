import { describe, expect, it } from "vitest";
import { createApp } from "@swarmproof/api/app";
import {
  X402Client,
  createFacilitator,
  fromXPaymentHeader,
  type X402HttpResponse,
} from "@swarmproof/x402";
import type { X402Fetch } from "@swarmproof/x402";

/**
 * End-to-end x402 gate: an agent buys a SwarmProof audit the way it would buy
 * any x402-gated API — no API key, no subscription — settled through the
 * (mock) Blocky402 facilitator. Everything runs in-process, fully offline.
 */

const CONTRACT = {
  contractName: "ReentrancyVault",
  source: "contract ReentrancyVault { function withdraw() public { } }",
};

/** Fetch adapter: route X402Client HTTP calls into the in-memory Hono app. */
function x402Fetcher(app: ReturnType<typeof createApp>): X402Fetch {
  return async (url, init) => {
    const res = await app.request(url, { method: init.method, headers: init.headers, body: init.body });
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON */
    }
    const headers = new Map<string, string>();
    res.headers.forEach((v, k) => headers.set(k.toLowerCase(), v));
    return {
      status: res.status,
      ok: res.ok,
      data,
      text,
      header: (name: string) => headers.get(name.toLowerCase()),
    } satisfies X402HttpResponse;
  };
}

async function waitForStatus(app: ReturnType<typeof createApp>, auditId: string, tries = 40): Promise<{ status: string; paymentStatus?: string; paymentProof?: unknown }> {
  for (let i = 0; i < tries; i++) {
    const res = await app.request(`/audits/${auditId}/status`);
    const body = (await res.json()) as { status: string; paymentStatus?: string; paymentProof?: unknown };
    if (body.status === "done" || body.status === "failed") return body;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("audit did not finish in time");
}

describe("x402 payment gate (offline e2e)", () => {
  it("serves the quote and rejects a buyer without payment (402 + WWW-Authenticate)", async () => {
    const app = createApp({ env: {} });

    const res = await app.request("/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(CONTRACT),
    });
    expect(res.status).toBe(402);
    const challenge = res.headers.get("www-authenticate");
    expect(challenge).toMatch(/X402 resource="[^"]*\/x402\/audits\/audit_/);

    const body = (await res.json()) as { auditId: string; x402Resource: string; payment: { x402?: unknown } };
    expect(body.payment.x402).toBeTruthy();

    // Quote endpoint (Accept: application/x402+json) serves the canonical requirements.
    const quoteRes = await app.request(body.x402Resource, { headers: { accept: "application/x402+json" } });
    expect(quoteRes.status).toBe(200);
    const envelope = (await quoteRes.json()) as { x402Version: number; accepts: [{ amount: string; payTo: string; extra?: { auditId: string; feePayer: string } }] };
    expect(envelope.x402Version).toBe(2);
    expect(envelope.accepts[0]?.amount).toBeTruthy();
    expect(envelope.accepts[0]?.payTo).toBeTruthy();
    expect(envelope.accepts[0]?.extra?.auditId).toBe(body.auditId);
    expect(envelope.accepts[0]?.extra?.feePayer).toBeTruthy();
  });

  it("agent buys an audit: 402 → quote → sign → facilitator verify/settle → X-PAYMENT redeem → HCS proof", async () => {
    const app = createApp({ env: {} });
    const agent = new X402Client({ facilitator: createFacilitator({ forceMock: true }) }, x402Fetcher(app));
    expect(agent.mode).toBe("mock");

    // 1) Gated POST /audit → 402 + resource URL.
    const discovered = await agent.discover("/audit", { method: "POST", body: CONTRACT });
    expect(discovered.response.status).toBe(402);
    expect(discovered.x402Resource).toMatch(/\/x402\/audits\/audit_/);

    // 2) Quote.
    const requirements = await agent.getRequirements(discovered.x402Resource!);
    expect(requirements.scheme).toBe("exact");
    expect(requirements.network).toBe("hedera:testnet");
    expect(requirements.extra?.auditId).toMatch(/^audit_/);

    // 3) Sign.
    const payload = await agent.signPayment(requirements);
    expect(payload.accepted.amount).toBe(requirements.amount);

    // 4) Facilitator verify + settle.
    const verification = await agent.verifyPayment(payload);
    expect(verification.isValid).toBe(true);
    const settlement = await agent.settlePayment(payload);
    expect(settlement.success).toBe(true);

    // 5) Redeem by replaying POST /audit with X-PAYMENT.
    const redemption = await agent.buy("/audit", { method: "POST", body: CONTRACT });
    expect(redemption.response.status).toBe(201);
    const auditId = (redemption.response.data as { auditId: string }).auditId;
    expect(auditId).toMatch(/^audit_/);

    // 6) Swarm runs to completion, anchored on HCS, with an HCS payment trail.
    const final = await waitForStatus(app, auditId);
    expect(final.status).toBe("done");
    expect(final.paymentStatus).toBe("paid");
    expect(final.paymentProof).toBeTruthy();

    const proof = (await (await app.request(`/audits/${auditId}/proof`)).json()) as { verified: boolean; reportHash: string; hcsTopicId: string; transactionId: string };
    expect(proof.verified).toBe(true);
    expect(proof.reportHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a stale/garbage X-PAYMENT header and cross-audit payments", async () => {
    const app = createApp({ env: {} });
    // Create a requirement first.
    const created = await app.request("/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(CONTRACT),
    });
    const { auditId } = (await created.json()) as { auditId: string };

    // Garbage payload → rejected (fresh 402 challenge).
    const stale = await app.request("/audit", {
      method: "POST",
      headers: { "content-type": "application/json", "x-payment": "AAAA" },
      body: JSON.stringify(CONTRACT),
    });
    expect(stale.status).toBe(402);

    // A quote for a DIFFERENT audit, presented here → server-side mismatch.
    const agent = new X402Client({ facilitator: createFacilitator({ forceMock: true }) }, x402Fetcher(app));
    const other = await agent.discover("/audit", { method: "POST", body: CONTRACT });
    const otherAuditId = other.x402Resource!.split("/").pop()!;
    const quote = await agent.getRequirements(other.x402Resource!);
    const payload = await agent.signPayment(quote);
    const xPayment = Buffer.from(JSON.stringify(payload)).toString("base64");

    const directly = await app.request(`/x402/audits/${auditId}`, { headers: { "x-payment": xPayment } });
    expect(directly.status).toBe(402);
    const body = (await directly.json()) as { auditId: string; payment: { status: string } };
    expect(body.auditId).toBe(auditId);
    expect(body.payment.status).toBe("invalid");
    expect(fromXPaymentHeader(xPayment)?.accepted.extra?.auditId).not.toBe(auditId);

    // Same for the wallet pay endpoint.
    const payRes = await app.request(`/audits/${auditId}/pay`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-payment": xPayment },
      body: JSON.stringify({}),
    });
    expect(payRes.status).toBe(402);

    // Its own audit stays unpaid and uncontaminated.
    expect(otherAuditId).not.toBe(auditId);
    const otherStatus = await (await app.request(`/audits/${otherAuditId}/status`)).json();
    expect((otherStatus as { paymentStatus: string }).paymentStatus).toBe("pending");
  });

  it("notes underpayment when the quoted amount is below the server minimum", async () => {
    const app = createApp({ env: {} });
    const agent = new X402Client({ facilitator: createFacilitator({ forceMock: true }) }, x402Fetcher(app));
    const discovered = await agent.discover("/audit", { method: "POST", body: CONTRACT });
    const quote = await agent.getRequirements(discovered.x402Resource!);
    // Attacker signs for a smaller amount than the server quote requires.
    const tampered = await agent.signPayment({ ...quote, amount: "1" });
    const redemption = await agent.redeem("/audit", tampered, { method: "POST", body: CONTRACT });
    expect(redemption.status).toBe(402);
    const body = redemption.data as { payment: { status: string } };
    expect(body.payment.status).toBe("invalid");
  });
});