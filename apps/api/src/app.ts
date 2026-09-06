import { Hono } from "hono";
import {
  createSpecialistAgents,
  SecurityTaskSchema,
  SPECIALIST_PAYMENT_ADDRESSES,
  type SecurityTask,
} from "@swarmproof/agents";
import {
  AuditOrchestrator,
  DEFAULT_SPECIALIST_WEIGHTS,
} from "@swarmproof/swarm";
import { createVerifier } from "@swarmproof/verification";
import {
  createAuditProofClient,
  createPaymentProofClient,
  createIdentityRegistrar,
  MirrorNodeClient,
  buildPaymentProofMessage,
  type AuditProofClient,
  type PaymentProofClient,
  type IdentityRegistrar,
} from "@swarmproof/hedera";
import {
  PaymentGateway,
  createPaymentProvider,
  DEFAULT_PAYMENT_SHARES,
  X402PaymentProvider,
  type PaymentProvider,
  type PaymentRequirement,
  type PaymentVerification,
  type RecipientShare,
} from "@swarmproof/payments";
import { parseXPpaymentHeaders, type X402PaymentPayload } from "@swarmproof/x402";

/* ------------------------------------------------------------------ */
/* Wiring (all injectable via env; zero-config local runs use mocks)   */
/* ------------------------------------------------------------------ */

export interface CreateAppOptions {
  env?: NodeJS.ProcessEnv;
  payment?: PaymentProvider;
  proofClient?: AuditProofClient;
  paymentProof?: PaymentProofClient;
  identity?: IdentityRegistrar;
}

export function createApp(opts: CreateAppOptions = {}): Hono {
  const env = opts.env ?? process.env;

  // Optional per-agent payout address overrides (JSON in .env).
  let agentAddressOverrides: Record<string, string> = {};
  if (env.SWARMPROOF_AGENT_ADDRESSES) {
    try {
      agentAddressOverrides = JSON.parse(env.SWARMPROOF_AGENT_ADDRESSES) as Record<string, string>;
    } catch {
      console.warn("SWARMPROOF_AGENT_ADDRESSES is not valid JSON — ignoring");
    }
  }

  const network = env.PAYMENT_NETWORK ?? "hedera:testnet";
  const mirrorNode = new MirrorNodeClient(
    network === "hedera:mainnet" ? "https://mainnet.mirrornode.hedera.com" : "https://testnet.mirrornode.hedera.com",
  );

  const payment: PaymentProvider =
    opts.payment ??
    createPaymentProvider({
      x402FacilitatorUrl: env.X402_FACILITATOR_URL,
      x402Network: env.X402_NETWORK,
      apiToken: env.X402_API_TOKEN,
      tinybarsPerUSD: env.X402_TINYBARS_PER_USD,
      asset: env.X402_ASSET, // HTS asset id → token settlement path
      verifyOnChain: (input) =>
        mirrorNode
          .verifyTransfer({ transactionId: input.transactionId, payTo: input.payTo, amountTinybars: input.amountTinybars, asset: input.asset })
          .then((r) => ({ verified: r.verified, payer: r.payer, message: r.message })),
    });

  const specialists = createSpecialistAgents({
    ...SPECIALIST_PAYMENT_ADDRESSES,
    ...agentAddressOverrides,
  });
  const orchestrator = new AuditOrchestrator({
    specialists,
    verification: createVerifier("mock"),
    proofClient: opts.proofClient ?? createAuditProofClient(env),
    weights: DEFAULT_SPECIALIST_WEIGHTS,
  });
  const auditProof: AuditProofClient = opts.proofClient ?? createAuditProofClient(env);

  const gateway = new PaymentGateway(payment, network);
  const paymentProof: PaymentProofClient = opts.paymentProof ?? createPaymentProofClient(env);
  const identity: IdentityRegistrar = opts.identity ?? createIdentityRegistrar(env);

  // HCS-14-style identity registration for every specialist (mock offline).
  for (const agent of Object.values(specialists)) {
    void identity.register(agent.identity).catch((err) => console.warn(`identity register ${agent.identity.agentId}: ${(err as Error).message}`));
  }

  const gatewayShare = Number(env.SWARMPROOF_GATEWAY_SHARE ?? "0.1");
  const constants = {
    total: env.SWARMPROOF_DEFAULT_TOTAL ?? "1.00",
    currency: env.SWARMPROOF_CURRENCY ?? "USD",
    network,
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
    paymentProofReceipt?: { paymentId: string; transactionId: string; consensusTimestamp: string };
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
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

  /** Confirm a payment (idempotent per audit) and anchor the HCS payment trail. */
  async function confirmPaymentFor(record: AuditRecord, reference?: string, payload?: X402PaymentPayload): Promise<PaymentVerification> {
    let verification: PaymentVerification;
    if (gateway.isPaid(record.id)) {
      verification = record.paymentStatus ?? { paymentId: record.payment?.paymentId ?? "?", auditId: record.id, status: "paid" };
    } else {
      verification = await gateway.confirmPayment(record.id, reference, payload);
      record.paymentStatus = verification;
      if (verification.status === "paid" && record.payment) {
        try {
          const msg = buildPaymentProofMessage({
            auditId: record.id,
            paymentId: record.payment.paymentId,
            total: record.payment.total,
            currency: record.payment.currency,
            transactionReference: verification.transactionReference,
            network: record.payment.network,
            asset: (record.payment as { x402?: { asset?: string } }).x402?.asset ?? "0.0.0",
            status: "paid",
            recipients: record.payment.recipients.map((r) => ({ agentId: r.agentId, address: r.address, amount: r.amount })),
          });
          const receipt = await paymentProof.anchorPayment(msg);
          record.paymentProofReceipt = { paymentId: receipt.paymentId, transactionId: receipt.transactionId, consensusTimestamp: receipt.consensusTimestamp };
        } catch (err) {
          console.warn(`payment proof anchor failed: ${(err as Error).message}`);
        }
      }
    }
    return verification;
  }

  /** Extract the signed x402 payload from the standard transport headers. */
  function payloadFromRequest(c: { req: { header(name: string): string | undefined } }): X402PaymentPayload | null {
    return parseXPpaymentHeaders({
      "x-payment": c.req.header("x-payment"),
      "payment-signature": c.req.header("payment-signature"),
    });
  }

  /** x402 resource URL for an audit (absolute). */
  function resourceUrl(c: { req: { url: string } }, auditId: string): string {
    return new URL(`/x402/audits/${auditId}`, c.req.url).toString();
  }

  function agentDirectory() {
    return Object.entries(specialists).map(([id, a]) => ({
      agentId: id,
      name: a.identity.name,
      capabilities: a.identity.capabilities,
      paymentAddress: a.identity.paymentAddress,
      version: a.identity.version,
      identityReference: identity.lastRegistration(id)?.transactionId,
      identityTopicId: identity.lastRegistration(id)?.hcsTopicId,
    }));
  }

  const app = new Hono();

  app.get("/health", (c) => {
    const isX402 = payment instanceof X402PaymentProvider;
    return c.json({
      ok: true,
      service: "swarmproof-api",
      paymentMode: payment.mode,
      hederaMode: auditProof.mode,
      paymentProofMode: paymentProof.mode,
      identityMode: identity.mode,
      x402: {
        network: constants.network,
        facilitatorMode: isX402 ? payment.facilitatorClient.mode : "mock",
        facilitatorUrl: isX402 ? payment.facilitatorClient.baseUrl : "mock://",
      },
    });
  });

  /* ---- Agent directory + x402 service discovery ----------------------- */

  // GET /supported — x402-style capability + agent discovery for consumer agents.
  app.get("/supported", async (c) => {
    const isX402 = payment instanceof X402PaymentProvider;
    const feePayer = isX402 ? await payment.feePayer().catch(() => undefined) : undefined;
    const asset = isX402 ? undefined : (env.X402_ASSET ?? "0.0.0");
    return c.json({
      x402Version: 2,
      service: {
        id: "swarmproof",
        name: "SwarmProof — decentralized swarm auditing",
        description: "Pay-per-audit smart-contract security auditing by a swarm of adversarial AI agents, anchored on Hedera.",
      },
      kinds: [
        {
          scheme: "exact",
          network: constants.network,
          x402Version: 2,
          asset: asset ?? "0.0.0",
          extra: feePayer ? { feePayer } : undefined,
        },
      ],
      services: [
        {
          id: "swarmproof-audit",
          name: "Smart-contract audit (pay per audit)",
          description: "Submit a contract, pay one exact HBAR/HTS payment, receive a consensus report anchored on HCS.",
          pricing: { total: constants.total, currency: constants.currency },
          x402Resource: "{origin}/x402/audits/{auditId}", // templated; see POST /audit for a concrete one
          tags: ["security", "audit", "agents", "hedera"],
        },
      ],
      agents: agentDirectory(),
    });
  });

  app.get("/agents", (c) => c.json({ agents: agentDirectory() }));

  /* ---- Audit flow per spec ---------------------------------------------- */

  // POST /audit — x402-gated resource:
  //  - no payment presented      → 402 + WWW-Authenticate: X402 resource="…"
  //    (the body also carries the friendly payment requirement)
  //  - X-PAYMENT presented       → verify, run the swarm, return the audit id.
  interface AuditBody {
    contractName: string;
    source: string;
    compiler?: string;
    address?: string;
    network?: string;
    total?: string;
    currency?: string;
    reference?: string;
  }
  app.post("/audit", async (c) => {
    const body = await c.req.json<AuditBody>().catch((): Partial<AuditBody> => ({}));
    const payload = payloadFromRequest(c);

    // Replay after payment: the payload binds to the audit id it paid for.
    if (payload) {
      const auditId = typeof payload.accepted.extra?.auditId === "string" ? payload.accepted.extra.auditId : undefined;
      const record = auditId ? audits.get(auditId) : undefined;
      if (!record) return c.json({ error: "payment payload references an unknown audit" }, 400);
      const verification = await confirmPaymentFor(record, body.reference, payload);
      if (verification.status === "paid") {
        void runAudit(record);
        return c.json({ auditId: record.id, status: "running", payment: verification }, 201);
      }
      return c.json({ auditId: record.id, status: `payment-${verification.status}`, payment: verification }, 402);
    }

    // Fresh request: create the job and issue a 402 challenge.
    try {
      const record = await createAudit(body as AuditBody);
      const resource = resourceUrl(c, record.id);
      return c.json(
        { auditId: record.id, status: record.status, payment: record.payment, x402Resource: resource },
        402,
        { "WWW-Authenticate": `X402 resource="${resource}"` },
      );
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // GET /x402/audits/:id — the x402 resource endpoint.
  //   Accept: application/x402+json → the payment quote (v2 envelope)
  //   with X-PAYMENT               → payment accepted / rejected
  //   otherwise                    → 402 challenge (self-referential)
  app.get("/x402/audits/:id", async (c) => {
    const record = audits.get(c.req.param("id"));
    if (!record) return c.json({ error: "not found" }, 404);
    const resource = resourceUrl(c, record.id);
    const payload = payloadFromRequest(c);

    const quote = record.payment?.x402;
    if (payload) {
      const verification = await confirmPaymentFor(record, undefined, payload);
      const accepted = verification.status === "paid";
      return c.json(
        { auditId: record.id, status: accepted ? "accepted" : `payment-${verification.status}`, payment: verification },
        accepted ? 200 : 402,
        accepted ? {} : { "WWW-Authenticate": `X402 resource="${resource}"` },
      );
    }

    const acceptsX402Json = (c.req.header("accept") ?? "").includes("application/x402+json");
    if (acceptsX402Json) {
      if (!quote) return c.json({ x402Version: 2, error: "no payment requirement issued for this audit", accepts: [] }, 500);
      return c.json(
        {
          x402Version: 2,
          resource: {
            url: resource,
            serviceName: "swarmproof-audit",
            description: `Smart-contract audit ${record.id} — pay per audit, no subscription.`,
            tags: ["security", "audit", "hedera"],
          },
          accepts: [quote],
        },
        200,
        { "content-type": "application/x402+json" },
      );
    }

    return c.json(
      { x402Version: 2, error: "payment required", resource: { url: resource } },
      402,
      { "WWW-Authenticate": `X402 resource="${resource}"` },
    );
  });

  // POST /audits/:id/pay — wallet/dashboard path: confirm one payment, then the swarm runs.
  app.post("/audits/:id/pay", async (c) => {
    const record = audits.get(c.req.param("id"));
    if (!record) return c.json({ error: "not found" }, 404);
    try {
      const body = (await c.req.json<{ reference?: string }>().catch(() => ({}))) as { reference?: string };
      const payload = payloadFromRequest(c);
      let reference = body.reference;
      if (!reference && payment.mode === "mock" && !payload) reference = `client-paid-${Date.now()}`;
      const verification = await confirmPaymentFor(record, reference, payload ?? undefined);
      record.paymentStatus = verification;
      if (verification.status === "paid") {
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
      paymentProof: r.paymentProofReceipt ?? null,
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
    const finding = Array.isArray(r.findings)
      ? (r.findings as Array<{ id: string; finding?: { id: string } }>).find((f) => f.finding?.id === findingId || f.id === findingId)
      : undefined;
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
    if (payment.mode === "mock") {
      const verification = await confirmPaymentFor(record, `auto-${Date.now()}`);
      record.paymentStatus = verification;
      if (verification.status === "paid") void runAudit(record);
    }
    return c.json({ id: record.id, status: record.status }, 202);
  });

  return app;
}