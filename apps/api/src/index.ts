import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  createSpecialistAgents,
  SecurityTaskSchema,
  type SecurityTask,
} from "@swarmproof/agents";
import {
  AuditOrchestrator,
  DEFAULT_SPECIALIST_WEIGHTS,
} from "@swarmproof/swarm";
import { createVerifier } from "@swarmproof/verification";
import { createAuditProofClient } from "@swarmproof/hedera";
import {
  PaymentGateway,
  createPaymentProvider,
  DEFAULT_PAYMENT_SHARES,
  type PaymentRequirement,
  type PaymentVerification,
  type RecipientShare,
} from "@swarmproof/payments";

/* ------------------------------------------------------------------ */
/* Wiring (all injectable via env; zero-config local runs use mocks)   */
/* ------------------------------------------------------------------ */

const env = process.env;
const providers = {
  hedera: createAuditProofClient(env),
  payment: createPaymentProvider({
    x402FacilitatorUrl: env.X402_FACILITATOR_URL,
    x402Network: env.X402_NETWORK,
    apiToken: env.X402_API_TOKEN,
  }),
};

const specialists = createSpecialistAgents();
const orchestrator = new AuditOrchestrator({
  specialists,
  verification: createVerifier("mock"),
  proofClient: providers.hedera,
  weights: DEFAULT_SPECIALIST_WEIGHTS,
});

const gateway = new PaymentGateway(providers.payment, env.PAYMENT_NETWORK ?? "hedera:testnet");
const gatewayShare =
  Number(env.SWARMPROOF_GATEWAY_SHARE ?? "0.1");

const constants = {
  total: env.SWARMPROOF_DEFAULT_TOTAL ?? "1.00",
  currency: env.SWARMPROOF_CURRENCY ?? "USD",
  gatewayAddress: env.SWARMPROOF_GATEWAY_ADDRESS ?? "0x6666666666666666666666666666666666666666",
  verificationAddress: env.SWARMPROOF_VERIFICATION_ADDRESS ?? "0x7777777777777777777777777777777777777777",
};

/* ------------------------------------------------------------------ */
/* Audit store (in-memory for MVP; swap for a DB behind methods)       */
/* ------------------------------------------------------------------ */

type AuditStatus = "payment-required" | "running" | "done" | "failed" | "unpaid";

interface AuditRecord {
  id: string;
  task: SecurityTask;
  status: AuditStatus;
  payment?: PaymentRequirement;
  paymentStatus?: PaymentVerification;
  report?: unknown;
  reportHash?: string;
  proof?: { auditId: string; reportHash: string; hcsTopicId: string; transactionId: string; consensusTimestamp: string; verified: boolean };
  findings?: unknown;
  verification?: unknown;
  error?: string;
  createdAt: string;
}

const audits = new Map<string, AuditRecord>();

/* ------------------------------------------------------------------ */
/* App (+ helpers)                                                     */
/* ------------------------------------------------------------------ */

function buildShares(extra?: Array<{ agentId: string; share: number }>): RecipientShare[] {
  const base: RecipientShare[] = DEFAULT_PAYMENT_SHARES.map((s) => {
    const agent = Object.values(specialists).find((a) => a.identity.agentId === s.agentId);
    const fallback =
      s.agentId === "swarmproof-gateway" ? constants.gatewayAddress : s.agentId === "verification-agent" ? constants.verificationAddress : "0x0000";
    const address = agent?.identity.paymentAddress ?? fallback;
    return { agentId: s.agentId, address, share: s.share };
  }).map((s) => ({ agentId: s.agentId as string, address: s.address, share: s.share }));
  for (const e of extra ?? []) {
    const i = base.findIndex((b) => b.agentId === e.agentId);
    const entry = base[i];
    if (entry) base[i] = { ...entry, share: e.share };
  }
  return base;
}

async function runAudit(record: AuditRecord): Promise<void> {
  record.status = "running";
  try {
    const result = await orchestrator.run(record.id, record.task);
    record.report = result.report;
    record.reportHash = result.reportHash;
    record.proof = result.proof;
    record.findings = result.consensus.findings;
    record.verification = result.verification;
    record.status = "done";
  } catch (err) {
    record.status = "failed";
    record.error = (err as Error).message;
  }
}

async function createAudit(body: { contractName: string; source: string; compiler?: string; address?: string; network?: string; total?: string; currency?: string }): Promise<AuditRecord> {
  const task = SecurityTaskSchema.parse({
    contractName: body.contractName,
    source: body.source,
    compiler: body.compiler,
    address: body.address,
    network: body.network ?? "ethereum",
  });
  const id = `audit_${Date.now()}`;
  const record: AuditRecord = { id, task, status: "payment-required", createdAt: new Date().toISOString() };
  audits.set(id, record);
  record.payment = await gateway.createRequirement({
    auditId: id,
    total: body.total ?? constants.total,
    currency: body.currency ?? constants.currency,
    shares: buildShares([{ agentId: "swarmproof-gateway", share: gatewayShare }]),
  });
  return record;
}

const app = new Hono();

app.get("/health", (c) =>
  c.json({ ok: true, service: "swarmproof-api", paymentMode: providers.payment.mode, hederaMode: providers.hedera.mode }),
);

/* ---- Agent directory ------------------------------------------------- */

app.get("/agents", (c) => {
  const agents = Object.entries(specialists).map(([id, a]) => ({
    agentId: id,
    name: a.identity.name,
    capabilities: a.identity.capabilities,
    paymentAddress: a.identity.paymentAddress,
    version: a.identity.version,
  }));
  return c.json({ agents });
});

/* ---- Audit flow per spec ---------------------------------------------- */

// POST /audit — create job, compute payment requirement BEFORE user pays.
app.post("/audit", async (c) => {
  try {
    const body = await c.req.json<{ contractName: string; source: string; compiler?: string; address?: string; network?: string; total?: string; currency?: string }>();
    const record = await createAudit(body);
    return c.json(
      {
        auditId: record.id,
        status: record.status,
        payment: record.payment, // { paymentId, total, currency, recipients, network }
      },
      201,
    );
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// POST /audits/:id/pay — client confirms ONE payment, then the swarm runs.
app.post("/audits/:id/pay", async (c) => {
  const record = audits.get(c.req.param("id"));
  if (!record) return c.json({ error: "not found" }, 404);
  try {
    let reference = (await c.req.json<{ reference?: string }>().catch(() => ({ reference: undefined }))).reference;
    if (!reference && providers.payment.mode === "mock") reference = `client-paid-${Date.now()}`;
    const verification = await gateway.confirmPayment(record.id, reference);
    record.paymentStatus = verification;
    if (verification.status === "paid") {
      // Fire and forget; status flips to running/done.
      void runAudit(record);
      return c.json({ auditId: record.id, status: "running", payment: verification }, 202);
    }
    return c.json({ auditId: record.id, status: "payment-" + verification.status, payment: verification }, 402);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/* ---- Status / findings / proof ---------------------------------------- */

app.get("/audits/:id/status", (c) => {
  const r = audits.get(c.req.param("id"));
  if (!r) return c.json({ error: "not found" }, 404);
  return c.json({
    auditId: r.id,
    status: r.status,
    paymentStatus: r.paymentStatus?.status ?? "pending",
    findingCount: Array.isArray(r.findings) ? r.findings.length : 0,
  });
});

app.get("/audits/:id/findings", (c) => {
  const r = audits.get(c.req.param("id"));
  if (!r) return c.json({ error: "not found" }, 404);
  return c.json({ auditId: r.id, findings: r.findings ?? [], verification: r.verification ?? [] });
});

app.get("/audits/:id/proof", (c) => {
  const r = audits.get(c.req.param("id"));
  if (!r) return c.json({ error: "not found" }, 404);
  if (!r.proof) return c.json({ auditId: r.id, verified: false, error: "no proof anchored yet" }, 404);
  return c.json({ ...r.proof, reportHash: r.proof.reportHash, verified: r.proof.verified });
});

// POST /audits/:id/verify — reproduce one finding on demand.
app.post("/audits/:id/verify", async (c) => {
  const r = audits.get(c.req.param("id"));
  if (!r) return c.json({ error: "not found" }, 404);
  const { findingId } = await c.req.json<{ findingId: string }>();
  const finding = Array.isArray(r.findings) ? (r.findings as Array<{ id: string; finding?: { id: string } }>).find((f) => f.finding?.id === findingId || f.id === findingId) : undefined;
  if (!finding) return c.json({ error: "finding not found" }, 404);
  const result = await createVerifier("mock").verify({ findingId, tool: "mock", contractPath: r.task.contractName, commandArgs: [] });
  return c.json(result);
});

/* ---- Full record (web-compat) ------------------------------------------ */

app.get("/audits/:id", (c) => {
  const r = audits.get(c.req.param("id"));
  if (!r) return c.json({ error: "not found" }, 404);
  return c.json(r);
});

// Legacy alias for the web dashboard demo: auto-pay (mock) and run immediately.
app.post("/audits", async (c) => {
  const record = await createAudit(await c.req.json<{ contractName: string; source: string }>());
  if (providers.payment.mode === "mock") {
    const verification = await gateway.confirmPayment(record.id, `auto-${Date.now()}`);
    record.paymentStatus = verification;
    if (verification.status === "paid") void runAudit(record);
  }
  return c.json({ id: record.id, status: record.status }, 202);
});

/* ------------------------------------------------------------------ */

const port = Number(env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`@swarmproof/api listening on http://localhost:${info.port}`);
  console.log(`  payment provider : ${providers.payment.mode}${providers.payment.mode === "x402" ? ` @ ${env.X402_FACILITATOR_URL}` : " (offline)"}`);
  console.log(`  hedera HCS       : ${providers.hedera.mode}${providers.hedera.mode === "hedera" ? ` @ ${env.HEDERA_TOPIC_ID}` : " (offline mock)"}`);
});