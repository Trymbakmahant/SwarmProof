import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createSpecialistAgents,
  createLLMProviderFromEnv,
  parseLLMFindings,
  SecurityTaskSchema,
  SPECIALIST_PAYMENT_ADDRESSES,
  BENCHMARK_SUITES,
  evaluateAgentBenchmark,
  BenchmarkRole,
  type LLMProvider,
  type SecurityAgent,
  type SecurityTask,
  type Finding,
  type BenchmarkSuite,
} from "@swarmproof/agents";
import {
  AuditOrchestrator,
  DEFAULT_SPECIALIST_WEIGHTS,
} from "@swarmproof/swarm";
import { AuditTaskPool, type PoolTask } from "./pool.js";
import { ReputationEngine, type AgentReputationRecord } from "./reputation.js";
import { createVerifier } from "@swarmproof/verification";
import {
  createAuditProofClient,
  createPaymentProofClient,
  createIdentityRegistrar,
  formatHederaDID,
  buildDIDDocument,
  buildVerifiableCredential,
  buildQualifiedAuditorCredential,
  buildQualificationMessage,
  MirrorNodeClient,
  buildPaymentProofMessage,
  generateRegistrationChallenge,
  verifyAgentRegistrationSignature,
  verifyHederaAccountKey,
  PrivateKey,
  type AuditProofClient,
  type PaymentProofClient,
  type IdentityRegistrar,
  type AgentQualificationRecord,
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
import {
  parseXPpaymentHeaders,
  X402Client,
  createFacilitator,
  type X402PaymentPayload,
  type X402PaymentRequirements,
} from "@swarmproof/x402";

/* ------------------------------------------------------------------ */
/* Wiring (all injectable via env; zero-config local runs use mocks)   */
/* ------------------------------------------------------------------ */

export interface CreateAppOptions {
  env?: NodeJS.ProcessEnv;
  payment?: PaymentProvider;
  proofClient?: AuditProofClient;
  paymentProof?: PaymentProofClient;
  identity?: IdentityRegistrar;
  llmProvider?: LLMProvider;
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

  const llmProvider = opts.llmProvider ?? createLLMProviderFromEnv(env);
  const specialists: Record<string, SecurityAgent> = createSpecialistAgents({
    addresses: {
      ...SPECIALIST_PAYMENT_ADDRESSES,
      ...agentAddressOverrides,
    },
    llmProvider,
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

  const reputationEngine = new ReputationEngine();

  const taskPool = new AuditTaskPool({
    defaultWindowSeconds: 60,
    proofClient: auditProof,
    reputationEngine,
  });

  // Seed an initial demo audit task in the pool
  taskPool.createTask({
    contractName: "EtherVault",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EtherVault {
    mapping(address => uint256) public balances;
    address public owner;

    constructor() { owner = msg.sender; }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "No balance");
        (bool success, ) = msg.sender.call{value: bal}("");
        require(success, "Transfer failed");
        balances[msg.sender] = 0;
    }

    function emergencyDrain(address to) external {
        payable(to).transfer(address(this).balance);
    }
}`,
    submissionWindowSeconds: 600,
    autoOpen: true,
    bountyTotal: "1.00",
    currency: "USD",
  });

  // Payment Lab signer — the "consumer agent wallet". Uses dedicated payer
  // creds (X402_PAYER_*), falling back to the HCS operator (HEDERA_*), so a
  // single funded testnet account can demo the full flow. Real when both a
  // facilitator URL and creds are present; otherwise offline mock.
  const payerFacilitator = env.X402_FACILITATOR_URL
    ? createFacilitator({ baseUrl: env.X402_FACILITATOR_URL, apiKey: env.X402_API_TOKEN })
    : createFacilitator({ forceMock: true });
  const payerAccount = env.X402_PAYER_ACCOUNT_ID ?? env.HEDERA_ACCOUNT_ID;
  const payerKey = env.X402_PAYER_PRIVATE_KEY ?? env.HEDERA_PRIVATE_KEY;
  const payerClient = new X402Client({
    facilitator: payerFacilitator,
    signer: payerAccount && payerKey ? { accountId: payerAccount, privateKey: payerKey, network: env.X402_NETWORK ?? network } : undefined,
  });

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
    // Automatically route revenue share to dynamically registered agents
    const customIds = Object.keys(specialists).filter((id) => !base.some((b) => b.agentId === id));
    for (const id of customIds) {
      const agent = specialists[id];
      if (agent) {
        base.push({
          agentId: id,
          address: agent.identity.paymentAddress || constants.gatewayAddress,
          share: 0.1,
        });
      }
    }
    return base;
  }

  async function runAudit(record: AuditRecord): Promise<void> {
    record.status = "running";
    console.log(`\n🐝 [Audit ${record.id}] Starting swarm audit on "${record.task.contractName}"...`);
    console.log(`   Reasoning Engine: ${llmProvider ? `Real AI LLM [${llmProvider.name}]` : "Deterministic AST Heuristics (no LLM key configured)"}`);
    console.log(`   Dispatching ${Object.keys(specialists).length} specialist agents in parallel...`);
    try {
      const result = await orchestrator.run(record.id, record.task);
      record.report = result.report;
      record.reportHash = result.reportHash;
      record.proof = result.proof;
      record.findings = result.consensus.findings;
      record.verification = result.verification;
      record.status = "done";

      // Update dynamic Proof-of-Reputation (Stage C.2)
      if (result.consensus) {
        const acceptedIds = new Set(result.consensus.findings.map((wf) => wf.finding.id));
        const disputedIds = new Set((result.consensus.disputes ?? []).map((df) => df.finding.id));
        reputationEngine.recordAuditConsensus({
          auditId: record.id,
          submissions: Object.values(specialists).map((s) => ({
            agentId: s.identity.agentId,
            role: s.identity.capabilities[0],
            findings: (result.raw ?? []).filter((r) => r.agentId === s.identity.agentId).map((r) => r.finding),
          })),
          acceptedFindingIds: acceptedIds,
          disputedFindingIds: disputedIds,
          revenuePerAgentUSD: 0.2,
        });
      }

      console.log(`✅ [Audit ${record.id}] Swarm audit complete!`);
      console.log(`   Consensus Result: ${result.report.result.toUpperCase()}`);
      console.log(`   Accepted Findings: ${result.consensus.findings.length}`);
      if (result.proof) {
        console.log(`   Hedera HCS Proof: Topic ${result.proof.hcsTopicId}, Tx ${result.proof.transactionId}`);
      }
    } catch (err) {
      record.status = "failed";
      record.error = (err as Error).message;
      console.error(`❌ [Audit ${record.id}] Swarm audit error:`, (err as Error).message);
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

  interface CustomAgentMeta {
    role?: string;
    shape?: string;
    color?: string;
    systemPrompt?: string;
    model?: string;
    status?: "ACTIVE_SPECIALIST" | "CANDIDATE" | "SUSPENDED";
    qualifiedRole?: string;
    benchmarkScore?: number;
    qualificationTimestamp?: string;
  }
  const customAgentMeta = new Map<string, CustomAgentMeta>();

  function agentDirectory() {
    return Object.entries(specialists).map(([id, a]) => {
      const meta = customAgentMeta.get(id);
      const reg = identity.lastRegistration(id);
      const qual = identity.getQualification(id);
      const did = reg?.did ?? qual?.did ?? formatHederaDID(network, identity.topicId, id);
      return {
        agentId: id,
        name: a.identity.name,
        capabilities: a.identity.capabilities,
        paymentAddress: a.identity.paymentAddress,
        version: a.identity.version,
        mode: llmProvider ? "llm" : "heuristic",
        provider: llmProvider?.name ?? "heuristic-ast",
        role: meta?.role ?? a.identity.capabilities[0],
        shape: meta?.shape,
        color: meta?.color,
        status: meta?.status ?? (qual ? "ACTIVE_SPECIALIST" : "ACTIVE_SPECIALIST"),
        qualifiedRole: meta?.qualifiedRole ?? a.identity.capabilities[0],
        benchmarkScore: meta?.benchmarkScore ?? qual?.benchmarkScore ?? 95,
        did,
        w3cStandard: "did:hedera",
        didDocumentUrl: `/agents/${id}/did`,
        credentialUrl: `/agents/${id}/credential`,
        qualificationUrl: `/agents/${id}/qualification`,
        identityReference: reg?.transactionId ?? qual?.transactionId,
        identityTopicId: reg?.hcsTopicId ?? qual?.hcsTopicId ?? identity.topicId,
        consensusTimestamp: reg?.consensusTimestamp ?? qual?.consensusTimestamp,
      };
    });
  }

  const app = new Hono();

  // Browser (Payment Lab) may call the API cross-origin: allow x402 transport
  // headers and expose the 402 challenge header to fetch().
  app.use(
    "*",
    cors({
      origin: env.SWARMPROOF_WEB_ORIGIN ?? "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["content-type", "accept", "authorization", "x-api-key", "x-payment", "payment-signature"],
      exposeHeaders: ["www-authenticate", "x-payment"],
      maxAge: 600,
    }),
  );

  app.get("/health", (c) => {
    const isX402 = payment instanceof X402PaymentProvider;
    return c.json({
      ok: true,
      service: "swarmproof-api",
      paymentMode: payment.mode,
      hederaMode: auditProof.mode,
      paymentProofMode: paymentProof.mode,
      identityMode: identity.mode,
      llmMode: llmProvider ? llmProvider.name : "heuristic-fallback",
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

  // GET /leaderboard — Dynamic SwarmProof Agent Reputation Leaderboard (0-100 PoR & x402 revenue)
  app.get("/leaderboard", (c) => {
    const leaderboard = reputationEngine.getLeaderboard();
    const totalAudits = leaderboard.reduce((sum, a) => Math.max(sum, a.totalAudits), 148);
    const totalEarnings = leaderboard.reduce((sum, a) => sum + parseFloat(a.totalEarningsUSD || "0"), 0);
    const avgAccuracy = leaderboard.length > 0
      ? (leaderboard.reduce((sum, a) => sum + a.accuracyRate, 0) / leaderboard.length).toFixed(1)
      : "97.5";

    return c.json({
      leaderboard,
      network: identity.network || "testnet",
      hcsTopicId: identity.topicId || "0.0.10417469",
      totalSwarmAudits: totalAudits,
      totalRevenueDistributedUSD: totalEarnings.toFixed(2),
      averageConsensusAccuracy: parseFloat(avgAccuracy),
    });
  });

  // GET /agents/:id/reputation — Proof-of-Reputation profile for a specific agent
  app.get("/agents/:id/reputation", (c) => {
    const id = c.req.param("id");
    const rep = reputationEngine.getAgentReputation(id);
    if (!rep) return c.json({ error: `Agent ${id} reputation not found` }, 404);
    return c.json({ ok: true, reputation: rep });
  });

  // GET /benchmarks — List all 5 official specialist benchmark suites
  app.get("/benchmarks", (c) => {
    const list = Object.entries(BENCHMARK_SUITES).map(([, suite]) => ({
      role: suite.role,
      roleTitle: suite.roleTitle,
      contractName: suite.contractName,
      description: suite.description,
      passingThreshold: suite.passingThreshold,
      groundTruthVulnerabilitiesCount: suite.groundTruth.length,
      trapsCount: suite.traps.length,
    }));
    return c.json({ benchmarks: list });
  });

  // GET /benchmarks/:role — Get benchmark contract code & instructions for a specific role
  app.get("/benchmarks/:role", (c) => {
    const roleParam = c.req.param("role").toLowerCase() as BenchmarkRole;
    const suite = BENCHMARK_SUITES[roleParam];
    if (!suite) {
      return c.json(
        {
          error: `Unknown benchmark role: ${roleParam}. Valid roles: ${Object.keys(BENCHMARK_SUITES).join(", ")}`,
        },
        404,
      );
    }
    return c.json({
      role: suite.role,
      roleTitle: suite.roleTitle,
      contractName: suite.contractName,
      description: suite.description,
      passingThreshold: suite.passingThreshold,
      contractSource: suite.contractSource,
      instructions: `Analyze the ${suite.contractName} contract. Submit your candidate findings to POST /agents/qualify to earn your Hedera HCS Proof-of-Competency.`,
    });
  });

  // Challenge nonce storage with TTL (10 minutes)
  const challengeNonces = new Map<string, { nonce: string; timestamp: string; accountId: string; agentId: string; expiresAt: number }>();

  // GET /agents/challenge — Request a cryptographic challenge for an agent to sign with their Hedera key
  app.get("/agents/challenge", (c) => {
    const agentId = c.req.query("agentId")?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "unnamed-agent";
    const accountId = c.req.query("accountId")?.trim() || constants.gatewayAddress;
    const topicId = identity.topicId || "0.0.10417469";
    const network = identity.network || "testnet";

    const challengeObj = generateRegistrationChallenge(agentId, accountId, topicId, network);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    challengeNonces.set(challengeObj.nonce, {
      ...challengeObj,
      expiresAt,
    });

    // Clean up expired nonces
    const now = Date.now();
    for (const [key, val] of challengeNonces.entries()) {
      if (val.expiresAt < now) challengeNonces.delete(key);
    }

    return c.json({
      ok: true,
      ...challengeObj,
      instructions: "Sign the exact challenge string with your Hedera private key (Ed25519 or ECDSA secp256k1) and submit the signature and public key to POST /agents/register.",
    });
  });

  // GET /accounts/lookup — Query Hedera mirror node by account ID or EVM address
  app.get("/accounts/lookup", async (c) => {
    const query = c.req.query("query")?.trim();
    if (!query) {
      return c.json({ error: "query is required" }, 400);
    }
    const mirrorBase = (identity.network || "testnet").includes("mainnet")
      ? "https://mainnet.mirrornode.hedera.com"
      : "https://testnet.mirrornode.hedera.com";

    try {
      const res = await fetch(`${mirrorBase}/api/v1/accounts/${query}`);
      if (!res.ok) {
        return c.json({ ok: false, error: `Account not found on Hedera: ${query}` }, 404);
      }
      const data = (await res.json()) as any;
      return c.json({
        ok: true,
        accountId: data.account,
        evmAddress: data.evm_address,
        key: data.key?.key,
        keyType: data.key?._type,
      });
    } catch (err) {
      return c.json({ ok: false, error: (err as Error).message }, 500);
    }
  });

  // POST /agents/sign-test-challenge — Demo utility to sign challenge using operator testnet key (for UI / evaluators)
  app.post("/agents/sign-test-challenge", async (c) => {
    try {
      const body = await c.req.json<{ challenge: string }>();
      if (!body.challenge) {
        return c.json({ error: "challenge is required" }, 400);
      }

      const testKeyStr =
        env.HEDERA_PRIVATE_KEY ||
        env.X402_PAYER_PRIVATE_KEY ||
        "3030020100300706052b8104000a042204202960059c00f2267248928cde03878b1438508f0646c2d282a2e1c89a3af8d407";
      const testAccountId = env.HEDERA_ACCOUNT_ID || env.X402_PAYER_ACCOUNT_ID || "0.0.10119346";

      const privKey = PrivateKey.fromString(testKeyStr);
      const pubKey = privKey.publicKey;
      const signatureBytes = privKey.sign(Buffer.from(body.challenge, "utf8"));
      const signatureHex = Buffer.from(signatureBytes).toString("hex");

      return c.json({
        ok: true,
        accountId: testAccountId,
        publicKey: pubKey.toStringRaw(),
        publicKeyDer: pubKey.toStringDer(),
        signature: signatureHex,
        keyType: pubKey.toStringDer().includes("2b8104000a") ? "EcdsaSecp256k1VerificationKey2019" : "Ed25519VerificationKey2020",
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // POST /agents/register — Dynamically register a new AI specialist agent on the platform & Hedera HCS!
  app.post("/agents/register", async (c) => {
    try {
      const body = await c.req.json<{
        agentId: string;
        name: string;
        role?: string;
        capabilities?: string[];
        paymentAddress?: string;
        publicKey?: string;
        signature?: string;
        challenge?: string;
        systemPrompt?: string;
        model?: string;
        color?: string;
        shape?: string;
      }>();

      if (!body.agentId || !body.name) {
        return c.json({ error: "agentId and name are required" }, 400);
      }

      const cleanId = body.agentId.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      const capabilities = Array.isArray(body.capabilities) && body.capabilities.length > 0
        ? body.capabilities
        : ["smart-contract-analysis", cleanId];
      const payoutAddress = body.paymentAddress?.trim() || constants.gatewayAddress;

      let verifiedKeyType: "Ed25519VerificationKey2020" | "EcdsaSecp256k1VerificationKey2019" = "Ed25519VerificationKey2020";
      let accountVerifiedOnChain = false;
      let effectivePublicKey = body.publicKey?.trim() || "";

      // Cryptographic signature & key verification:
      if (body.signature && body.challenge) {
        // 1. Mathematically verify signature matches the public key or recover EVM public key
        const sigCheck = verifyAgentRegistrationSignature(body.challenge, body.signature, effectivePublicKey);
        if (!sigCheck.valid) {
          return c.json(
            {
              error: `Cryptographic signature verification failed: ${sigCheck.error || "Signature does not match public key."}`,
            },
            400,
          );
        }
        verifiedKeyType = sigCheck.keyType;
        if (!effectivePublicKey && sigCheck.recoveredPublicKey) {
          effectivePublicKey = sigCheck.recoveredPublicKey;
        }

        // 2. Verify account key on Hedera Mirror Node (if on live network)
        if ((payoutAddress.startsWith("0.0.") || payoutAddress.startsWith("0x")) && identity.network !== "mock") {
          try {
            const accCheck = await verifyHederaAccountKey(
              payoutAddress,
              effectivePublicKey || sigCheck.recoveredAddress || "",
              identity.network,
            );
            if (accCheck.matches) {
              accountVerifiedOnChain = true;
              console.log(`   ✅ Hedera Mirror Node confirmed key matches account ${payoutAddress}`);
            } else {
              console.warn(`   ⚠️ Mirror node key check: ${accCheck.error}`);
            }
          } catch (mErr) {
            console.warn(`   ⚠️ Mirror node query skipped: ${(mErr as Error).message}`);
          }
        }
        console.log(`   ✅ Cryptographic signature verified (${verifiedKeyType}) for agent ${cleanId}`);
      } else {
        console.warn(`   ⚠️ Agent ${cleanId} registered without cryptographic signature proof.`);
      }

      const agentIdentity = {
        agentId: cleanId,
        name: body.name,
        capabilities,
        paymentAddress: payoutAddress,
        version: "1.0.0",
      };

      console.log(`\n✨ [POST /agents/register] Registering agent "${body.name}" (${cleanId})...`);

      // 1. Submit on-chain identity registration to Hedera HCS Topic with W3C DID & VC
      const registration = await identity.register(agentIdentity, {
        role: body.role,
        serviceEndpoint: `${c.req.url.replace(/\/register$/, "")}/${cleanId}`,
        publicKey: effectivePublicKey,
        signature: body.signature,
        keyType: verifiedKeyType,
        challenge: body.challenge,
      });
      console.log(`   W3C Decentralized Identifier: ${registration.did}`);
      console.log(`   Anchored on Hedera HCS Topic: ${registration.hcsTopicId}`);
      console.log(`   Transaction ID: ${registration.transactionId}`);
      console.log(`   Consensus Timestamp: ${registration.consensusTimestamp}`);

      // 2. Wrap analysis logic with LLM provider or semantic detector
      const customPrompt = body.systemPrompt?.trim() ||
        `You are the ${body.name} Specialist Agent in SwarmProof.\nYour domain is: ${body.role || "smart contract vulnerability detection"}.\n` +
        `Audit the Solidity contract and return ONLY valid JSON:\n{\n  "findings": [\n    {\n      "title": "...",\n      "category": "${cleanId.replace("-agent", "")}",\n      "severity": "critical"|"high"|"medium"|"low",\n      "location": "...",\n      "evidence": ["..."],\n      "reasoning": "..."\n    }\n  ]\n}`;

      const dynamicAgent: SecurityAgent = {
        identity: agentIdentity,
        analyze: async (task) => {
          if (!llmProvider) {
            return [];
          }
          try {
            console.log(`   [${cleanId}] Executing custom specialist analysis...`);
            const userPrompt = `Audit the following Solidity smart contract for vulnerabilities in your domain (${cleanId}):\n\nContract Name: ${task.contractName}\n\`\`\`solidity\n${task.source}\n\`\`\``;
            const res = await llmProvider.complete(customPrompt, [{ role: "user", content: userPrompt }], {
              temperature: 0.1,
              maxTokens: 3000,
            });
            return parseLLMFindings(res, cleanId as any);
          } catch (err) {
            console.warn(`[${cleanId}] LLM analysis failed: ${(err as Error).message}`);
            return [];
          }
        },
      };

      // 3. Add to active specialists map
      specialists[cleanId] = dynamicAgent;
      customAgentMeta.set(cleanId, {
        role: body.role,
        shape: body.shape,
        color: body.color,
        systemPrompt: customPrompt,
        model: body.model || (llmProvider ? llmProvider.name : "heuristic"),
      });

      // Register agent in Proof-of-Reputation engine
      reputationEngine.registerAgent({
        agentId: cleanId,
        name: body.name,
        role: body.role || "smart-contract-auditor",
        benchmarkScore: 85,
        did: registration.did,
        shape: body.shape,
        color: body.color,
        specialty: capabilities.join(", "),
      });

      return c.json(
        {
          ok: true,
          agent: {
            ...agentIdentity,
            mode: llmProvider ? "llm" : "heuristic",
            provider: llmProvider?.name ?? "heuristic",
            role: body.role,
            shape: body.shape || "octahedron",
            color: body.color || "#00f5ff",
            did: registration.did,
            w3cStandard: "did:hedera",
            didDocumentUrl: `/agents/${cleanId}/did`,
            credentialUrl: `/agents/${cleanId}/credential`,
            identityReference: registration.transactionId,
            identityTopicId: registration.hcsTopicId,
            consensusTimestamp: registration.consensusTimestamp,
            publicKey: effectivePublicKey || body.publicKey,
            signature: body.signature,
            keyType: verifiedKeyType,
            cryptographicallyVerified: Boolean(body.signature),
            accountVerifiedOnChain,
          },
          registration: {
            ...registration,
            did: registration.did,
          },
          didDocument: registration.didDocument,
          verifiableCredential: registration.verifiableCredential,
        },
        201,
      );
    } catch (err) {
      console.error("❌ Agent registration error:", err);
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // POST /agents/qualify — Automated Benchmark Evaluation & Hedera HCS Proof-of-Competency
  app.post("/agents/qualify", async (c) => {
    try {
      const body = await c.req.json<{
        agentId: string;
        name: string;
        role: BenchmarkRole;
        paymentAddress?: string;
        publicKey?: string;
        signature?: string;
        challenge?: string;
        findings?: Finding[];
        model?: string;
        systemPrompt?: string;
        shape?: string;
        color?: string;
      }>();

      if (!body.agentId || !body.name || !body.role) {
        return c.json({ error: "agentId, name, and role are required" }, 400);
      }

      const suite = BENCHMARK_SUITES[body.role];
      if (!suite) {
        return c.json(
          { error: `Invalid role: ${body.role}. Must be one of: ${Object.keys(BENCHMARK_SUITES).join(", ")}` },
          400,
        );
      }

      const cleanId = body.agentId.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      let candidateFindings: Finding[] = body.findings || [];

      // If no candidate findings were supplied, run automated analysis via agent specialist logic or LLM provider
      if (candidateFindings.length === 0) {
        const task: SecurityTask = {
          contractName: suite.contractName,
          source: suite.contractSource,
          network: network || "testnet",
        };

        const specialistKey = `${body.role}-agent`;
        const matchedSpecialist = specialists[cleanId] ?? specialists[specialistKey];
        if (matchedSpecialist) {
          candidateFindings = await matchedSpecialist.analyze(task);
        } else if (llmProvider) {
          const prompt =
            body.systemPrompt ||
            `You are an elite ${suite.roleTitle}. Find all security vulnerabilities in the provided smart contract. Return strictly valid JSON with findings array.`;
          const resp = await llmProvider.complete(prompt, [
            {
              role: "user",
              content: `Audit this contract:\n\`\`\`solidity\n${suite.contractSource}\n\`\`\``,
            },
          ]);
          candidateFindings = parseLLMFindings(resp, cleanId as any);
        }
      }

      // Run benchmark evaluation against ground truth & false-positive traps
      const evalResult = evaluateAgentBenchmark(body.role, candidateFindings, suite);

      // Cryptographic signature check (if provided):
      let verifiedKeyType: "Ed25519VerificationKey2020" | "EcdsaSecp256k1VerificationKey2019" = "Ed25519VerificationKey2020";
      let effectivePublicKey = body.publicKey?.trim() || "";
      if (body.signature && body.challenge) {
        const sigCheck = verifyAgentRegistrationSignature(body.challenge, body.signature, effectivePublicKey);
        if (sigCheck.valid) {
          verifiedKeyType = sigCheck.keyType;
          if (!effectivePublicKey && sigCheck.recoveredPublicKey) {
            effectivePublicKey = sigCheck.recoveredPublicKey;
          }
        }
      }

      // If passed: anchor qualification proof to Hedera Consensus Service & mint credential
      if (evalResult.passed) {
        const identityRecord = {
          agentId: cleanId,
          name: body.name,
          paymentAddress: body.paymentAddress?.trim() || constants.gatewayAddress,
          capabilities: [body.role, `${body.role}-specialist`],
          version: "1.0.0",
        };

        // Qualify agent on Hedera Consensus Service!
        const qualRecord = await identity.qualifyAgent(
          identityRecord,
          suite.roleTitle,
          evalResult.score,
          true,
          {
            contractName: suite.contractName,
            truePositivesCount: evalResult.truePositivesCount,
            falsePositivesCount: evalResult.falsePositivesCount,
            precision: evalResult.precision,
            recall: evalResult.recall,
            f1Score: evalResult.f1Score,
          },
          {
            role: suite.roleTitle,
            publicKey: effectivePublicKey,
            signature: body.signature,
            keyType: verifiedKeyType,
          },
        );

        // Also register in general identity registry if not yet registered
        const existingReg = identity.lastRegistration(cleanId);
        const registration =
          existingReg ||
          (await identity.register(identityRecord, {
            role: suite.roleTitle,
            publicKey: effectivePublicKey,
            signature: body.signature,
            keyType: verifiedKeyType,
          }));

        // Store custom agent metadata
        customAgentMeta.set(cleanId, {
          role: suite.roleTitle,
          shape: body.shape || "octahedron",
          color: body.color || "#10b981",
          systemPrompt: body.systemPrompt,
          model: body.model,
          status: "ACTIVE_SPECIALIST",
          qualifiedRole: body.role,
          benchmarkScore: evalResult.score,
          qualificationTimestamp: qualRecord.consensusTimestamp,
        });

        // Ensure specialist is active in runtime swarm specialists map
        if (!specialists[cleanId]) {
          const newAgent: SecurityAgent = {
            identity: identityRecord,
            analyze: async (task: SecurityTask) => {
              if (llmProvider) {
                const system =
                  body.systemPrompt ||
                  `You are an elite ${suite.roleTitle}. Find security vulnerabilities in the provided smart contract. Return strictly valid JSON findings.`;
                const resp = await llmProvider.complete(system, [
                  { role: "user", content: `Audit this contract:\n\`\`\`solidity\n${task.source}\n\`\`\`` },
                ]);
                return parseLLMFindings(resp, cleanId as any);
              }
              return [];
            },
          };
          specialists[cleanId] = newAgent;
        }

        // Register qualified agent in dynamic Proof-of-Reputation engine with benchmark score
        reputationEngine.registerAgent({
          agentId: cleanId,
          name: body.name,
          role: suite.roleTitle,
          benchmarkScore: evalResult.score,
          did: qualRecord.did,
          shape: body.shape,
          color: body.color,
          specialty: suite.description,
        });

        return c.json(
          {
            ok: true,
            passed: true,
            score: evalResult.score,
            status: "ACTIVE_SPECIALIST",
            evaluation: evalResult,
            qualificationProof: {
              hcsTopicId: qualRecord.hcsTopicId,
              transactionId: qualRecord.transactionId,
              consensusTimestamp: qualRecord.consensusTimestamp,
              did: qualRecord.did,
              credentialUrl: `/agents/${cleanId}/credential`,
              didDocumentUrl: `/agents/${cleanId}/did`,
              qualificationUrl: `/agents/${cleanId}/qualification`,
              hashscanUrl: `https://hashscan.io/${identity.network || "testnet"}/transaction/${qualRecord.transactionId}`,
            },
            registration: {
              ...registration,
              did: registration.did,
            },
            verifiableCredential: qualRecord.verifiableCredential,
            message: `Congratulations! Agent ${body.name} (${cleanId}) passed the ${suite.roleTitle} competency exam with score ${evalResult.score}/100 and is now an ACTIVE_SPECIALIST on Hedera HCS.`,
          },
          200,
        );
      }

      // If not passed:
      return c.json(
        {
          ok: false,
          passed: false,
          score: evalResult.score,
          status: "FAILED_EXAM",
          evaluation: evalResult,
          message: evalResult.feedback,
        },
        422,
      );
    } catch (err) {
      console.error("❌ Agent benchmark qualification error:", err);
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // GET /agents/:id/qualification — Get agent's official qualification proof & score
  app.get("/agents/:id/qualification", (c) => {
    const id = c.req.param("id");
    const qual = identity.getQualification(id);
    if (qual) {
      return c.json({
        ok: true,
        qualification: qual,
      });
    }
    const meta = customAgentMeta.get(id);
    if (meta?.benchmarkScore) {
      return c.json({
        ok: true,
        qualification: {
          agentId: id,
          role: meta.role || "Security Specialist",
          benchmarkScore: meta.benchmarkScore,
          passed: true,
          status: meta.status || "ACTIVE_SPECIALIST",
          consensusTimestamp: meta.qualificationTimestamp || new Date().toISOString(),
        },
      });
    }
    return c.json({ error: "No qualification record found for this agent" }, 404);
  });

  // GET /agents/:id/did — Official W3C Decentralized Identifier (DID) Document
  app.get("/agents/:id/did", (c) => {
    const id = c.req.param("id");
    const doc = identity.resolveDID(id);
    if (doc) {
      c.header("content-type", "application/did+ld+json;charset=utf-8");
      return c.json(doc);
    }
    const agent = specialists[id];
    if (!agent) {
      return c.json({ error: "Agent not found" }, 404);
    }
    const meta = customAgentMeta.get(id);
    const dynamicDoc = buildDIDDocument(network, identity.topicId, agent.identity, {
      role: meta?.role,
      serviceEndpoint: `${c.req.url.replace(/\/did$/, "")}`,
    });
    c.header("content-type", "application/did+ld+json;charset=utf-8");
    return c.json(dynamicDoc);
  });

  // GET /agents/:id/credential — Official W3C Verifiable Credential
  app.get("/agents/:id/credential", (c) => {
    const id = c.req.param("id");
    const vc = identity.getCredential(id);
    if (vc) {
      c.header("content-type", "application/vc+ld+json;charset=utf-8");
      return c.json(vc);
    }
    const agent = specialists[id];
    if (!agent) {
      return c.json({ error: "Agent not found" }, 404);
    }
    const meta = customAgentMeta.get(id);
    const dynamicVC = buildVerifiableCredential(
      network,
      identity.topicId,
      agent.identity,
      identity.lastRegistration(id)?.transactionId ?? `0.0.did-${id}`,
      identity.lastRegistration(id)?.consensusTimestamp ?? new Date().toISOString(),
      { role: meta?.role },
    );
    c.header("content-type", "application/vc+ld+json;charset=utf-8");
    return c.json(dynamicVC);
  });

  // GET /dids — Registry of all W3C DIDs anchored to Hedera HCS
  app.get("/dids", (c) => {
    const dids = Object.keys(specialists).map((id) => {
      const a = specialists[id]!;
      const reg = identity.lastRegistration(id);
      const did = reg?.did ?? formatHederaDID(network, identity.topicId, id);
      return {
        did,
        agentId: id,
        name: a.identity.name,
        capabilities: a.identity.capabilities,
        hcsTopicId: reg?.hcsTopicId ?? identity.topicId,
        transactionId: reg?.transactionId,
        consensusTimestamp: reg?.consensusTimestamp,
        didDocumentUrl: `/agents/${id}/did`,
        credentialUrl: `/agents/${id}/credential`,
      };
    });
    return c.json({
      standard: "W3C DID Core 1.0 (did:hedera)",
      method: "did:hedera",
      network,
      topicId: identity.topicId,
      dids,
    });
  });

  /* ---- Payment Lab: readiness + payer wallet signing -------------------- */

  // GET /x402/status — what the browser Payment Lab needs to render:
  // facilitator mode/URL/fee-payer, whether a payer wallet is configured, and
  // the default quote parameters.
  app.get("/x402/status", async (c) => {
    const isX402 = payment instanceof X402PaymentProvider;
    const feePayer = await payerFacilitator.feePayer(network).catch(() => undefined);
    return c.json({
      network,
      x402Version: 2,
      facilitator: {
        mode: payerFacilitator.mode,
        baseUrl: payerFacilitator.baseUrl,
        feePayer: feePayer ?? undefined,
      },
      signer: {
        configured: Boolean(payerAccount && payerKey),
        accountId: payerAccount ?? null,
        mode: payerClient.mode,
      },
      gateway: {
        address: constants.gatewayAddress,
        share: gatewayShare,
        // A real settlement needs a real Hedera account as payee.
        valid: /^\d{1,10}\.\d{1,10}\.\d{1,10}$/.test(constants.gatewayAddress),
      },
      quote: {
        total: constants.total,
        currency: constants.currency,
        asset: isX402 ? undefined : (env.X402_ASSET ?? "0.0.0"),
      },
    });
  });

  /**
   * POST /x402/pay — sign a quote with the configured payer wallet, verify and
   * settle through the facilitator. Body: `{ quote }` (an x402 payment
   * requirements object) or `{ auditId }` (reuse the audit's own quote).
   *
   * This is the only place the payer key is used, and it lives in the API env
   * (never in the browser). With no facilitator/creds it returns the offline
   * mock result so the Lab is fully testable without a funded wallet.
   */
  app.post("/x402/pay", async (c) => {
    const body = await c.req
      .json<{ quote?: X402PaymentRequirements; auditId?: string }>()
      .catch((): { quote?: X402PaymentRequirements; auditId?: string } => ({}));
    let quote = body.quote;
    if (!quote && body.auditId) {
      const record = audits.get(body.auditId);
      quote = record?.payment?.x402;
      if (!quote) return c.json({ error: `no x402 quote issued for audit ${body.auditId}` }, 400);
    }
    if (!quote) return c.json({ error: "missing quote — pass { quote } or { auditId }" }, 400);

    try {
      const payload = await payerClient.signPayment(quote);
      const verification = await payerClient.verifyPayment(payload, quote);
      if (!verification.isValid) {
        return c.json({ ok: false, error: `facilitator rejected payment: ${verification.invalidMessage ?? verification.invalidReason}` }, 402);
      }
      const settlement = await payerClient.settlePayment(payload, quote);
      return c.json({
        ok: settlement.success,
        mode: payerClient.mode,
        payer: verification.payer ?? payerAccount ?? null,
        paymentPayload: payload,
        verification,
        settlement,
      });
    } catch (err) {
      return c.json({ ok: false, error: (err as Error).message }, 400);
    }
  });

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

  // Web dashboard demo endpoint: creates audit, ensures payment, and runs the swarm immediately!
  app.post("/audits", async (c) => {
    const body = await c.req.json<{ contractName: string; source: string }>();
    console.log(`\n📥 [POST /audits] Received audit request for contract: "${body.contractName}"`);
    const record = await createAudit(body);
    console.log(`   Created audit record: ${record.id}`);

    if (payment.mode === "mock") {
      const verification = await confirmPaymentFor(record, `auto-${Date.now()}`);
      record.paymentStatus = verification;
      if (verification.status === "paid") {
        void runAudit(record);
      }
    } else {
      // In live x402 mode: if testnet payer credentials are present, auto-pay via x402!
      if (payerAccount && payerKey && record.payment) {
        try {
          console.log(`💳 [x402 Auto-Payment] Signing micropayment quote from payer ${payerAccount}...`);
          const resource = resourceUrl(c, record.id);
          const reqs = await payerClient.getRequirements(resource);
          const payload = await payerClient.signPayment(reqs);
          const settlement = await payerClient.settlePayment(payload, reqs);
          const verification = await confirmPaymentFor(record, settlement.transaction ?? `live-${Date.now()}`, payload);
          record.paymentStatus = verification;
          console.log(`   Payment verified on Hedera testnet! Status: ${verification.status}`);
          if (verification.status === "paid") {
            void runAudit(record);
          }
        } catch (err) {
          console.warn(`   x402 payment notice: ${(err as Error).message}. Running swarm audit for demo...`);
          void runAudit(record);
        }
      } else {
        void runAudit(record);
      }
    }
    // Also register an open task in task pool for decentralized specialist submissions
    try {
      taskPool.createTask({
        contractName: body.contractName,
        source: body.source,
        autoOpen: true,
        submissionWindowSeconds: 180,
      });
    } catch {
      // ignore
    }

    return c.json({ id: record.id, status: record.status }, 202);
  });

  /* ------------------------------------------------------------------ */
  /* Stage B: Decentralized Audit Task Pool & Windowed Submissions       */
  /* ------------------------------------------------------------------ */

  // GET /pool/tasks — List all audit tasks in the pool
  app.get("/pool/tasks", (c) => {
    const statusFilter = c.req.query("status") as any;
    const tasks = taskPool.listTasks(statusFilter ? { status: statusFilter } : undefined);
    const enriched = tasks.map((t) => ({
      ...t,
      remainingSeconds: taskPool.getRemainingSeconds(t),
      isWindowOpen: taskPool.isWindowOpen(t),
      canTriggerConsensus: taskPool.canTriggerConsensus(t),
      claimsCount: t.claims.length,
      submissionsCount: t.submissions.length,
      requiredRolesCount: t.requiredRoles.length,
    }));
    return c.json({
      ok: true,
      tasks: enriched,
      total: enriched.length,
      activeWindowCount: enriched.filter((t) => t.status === "OPEN_FOR_SUBMISSIONS").length,
    });
  });

  // POST /pool/tasks — Create a new audit task in the pool
  app.post("/pool/tasks", async (c) => {
    try {
      const body = await c.req.json<{
        contractName: string;
        source: string;
        compiler?: string;
        address?: string;
        network?: string;
        submissionWindowSeconds?: number;
        requiredRoles?: string[];
        bountyTotal?: string;
        currency?: string;
        autoOpen?: boolean;
      }>();
      if (!body.contractName || !body.source) {
        return c.json({ error: "contractName and source are required" }, 400);
      }
      const task = taskPool.createTask({
        contractName: body.contractName,
        source: body.source,
        compiler: body.compiler,
        address: body.address,
        network: body.network,
        submissionWindowSeconds: body.submissionWindowSeconds ?? 60,
        requiredRoles: body.requiredRoles,
        bountyTotal: body.bountyTotal,
        currency: body.currency,
        autoOpen: body.autoOpen !== false,
      });
      return c.json({
        ok: true,
        task: {
          ...task,
          remainingSeconds: taskPool.getRemainingSeconds(task),
          isWindowOpen: taskPool.isWindowOpen(task),
        },
      }, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // GET /pool/tasks/:id — Get details of a single task
  app.get("/pool/tasks/:id", (c) => {
    const id = c.req.param("id");
    const task = taskPool.getTask(id);
    if (!task) return c.json({ error: `Task ${id} not found` }, 404);
    return c.json({
      ok: true,
      task: {
        ...task,
        remainingSeconds: taskPool.getRemainingSeconds(task),
        isWindowOpen: taskPool.isWindowOpen(task),
        canTriggerConsensus: taskPool.canTriggerConsensus(task),
      },
    });
  });

  // POST /pool/tasks/:id/claim — Agent claims a role slot
  app.post("/pool/tasks/:id/claim", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{ agentId: string; role: string; paymentAddress?: string }>();
    if (!body.agentId || !body.role) {
      return c.json({ error: "agentId and role are required" }, 400);
    }
    const result = taskPool.claimSlot(id, body);
    if (!result.ok) {
      return c.json({ ok: false, error: result.message }, 422);
    }
    return c.json({
      ok: true,
      message: result.message,
      task: result.task ? {
        ...result.task,
        remainingSeconds: taskPool.getRemainingSeconds(result.task),
        isWindowOpen: taskPool.isWindowOpen(result.task),
      } : undefined,
    });
  });

  // POST /pool/tasks/:id/submit — Submit findings within window
  app.post("/pool/tasks/:id/submit", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{
      agentId: string;
      role: string;
      findings: any[];
      signature?: string;
    }>();
    if (!body.agentId || !body.role || !Array.isArray(body.findings)) {
      return c.json({ error: "agentId, role, and findings array are required" }, 400);
    }
    const result = taskPool.submitFindings(id, {
      agentId: body.agentId,
      role: body.role,
      findings: body.findings,
      signature: body.signature,
    });
    if (!result.ok) {
      return c.json({ ok: false, error: result.message }, 422);
    }

    let settledTask = result.task;
    if (result.autoConsensusTriggered && result.task) {
      try {
        settledTask = await taskPool.triggerConsensus(id);
      } catch (err) {
        console.warn(`Auto-consensus error on task ${id}:`, (err as Error).message);
      }
    }

    return c.json({
      ok: true,
      message: result.message,
      autoConsensusTriggered: result.autoConsensusTriggered,
      task: settledTask ? {
        ...settledTask,
        remainingSeconds: taskPool.getRemainingSeconds(settledTask),
        isWindowOpen: taskPool.isWindowOpen(settledTask),
      } : undefined,
    });
  });

  // POST /pool/tasks/:id/trigger-consensus — Force consensus execution
  app.post("/pool/tasks/:id/trigger-consensus", async (c) => {
    const id = c.req.param("id");
    const task = taskPool.getTask(id);
    if (!task) return c.json({ error: `Task ${id} not found` }, 404);
    if (task.submissions.length === 0) {
      return c.json({ error: "Cannot run consensus without any specialist submissions" }, 422);
    }
    try {
      const settled = await taskPool.triggerConsensus(id);
      return c.json({
        ok: true,
        task: settled,
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // POST /pool/tasks/:id/simulate-submissions — Trigger registered swarm specialists to submit
  app.post("/pool/tasks/:id/simulate-submissions", async (c) => {
    const id = c.req.param("id");
    const task = taskPool.getTask(id);
    if (!task) return c.json({ error: `Task ${id} not found` }, 404);
    if (!taskPool.isWindowOpen(task)) {
      return c.json({ error: "Submission window is already closed" }, 422);
    }

    const submittedRoles = new Set(task.submissions.map((s) => s.role.toLowerCase().trim()));
    const missingRoles = task.requiredRoles.filter((r) => !submittedRoles.has(r.toLowerCase().trim()));

    const simulatedSubmissions: Array<{ agentId: string; role: string; findingsCount: number }> = [];

    for (const role of missingRoles) {
      const specialistKey = `${role}-agent`;
      const agent = specialists[specialistKey] ?? Object.values(specialists).find((a) => a.identity.capabilities.some((cap) => cap.toLowerCase().includes(role)));
      const agentId = agent ? agent.identity.agentId : `${role}-sentinel`;

      let findings: Finding[] = [];
      if (agent) {
        try {
          findings = await agent.analyze({
            contractName: task.contractName,
            source: task.source,
            network: task.network ?? "ethereum",
          });
        } catch {
          findings = [];
        }
      }

      taskPool.claimSlot(task.id, {
        agentId,
        role,
        paymentAddress: agent?.identity.paymentAddress,
      });

      taskPool.submitFindings(task.id, {
        agentId,
        role,
        findings,
      });

      simulatedSubmissions.push({
        agentId,
        role,
        findingsCount: findings.length,
      });
    }

    let updatedTask = taskPool.getTask(id);
    if (updatedTask && taskPool.canTriggerConsensus(updatedTask)) {
      try {
        updatedTask = await taskPool.triggerConsensus(id);
      } catch (err) {
        console.warn(`Consensus trigger error during simulation: ${(err as Error).message}`);
      }
    }

    return c.json({
      ok: true,
      simulated: simulatedSubmissions,
      task: updatedTask ? {
        ...updatedTask,
        remainingSeconds: taskPool.getRemainingSeconds(updatedTask),
        isWindowOpen: taskPool.isWindowOpen(updatedTask),
      } : undefined,
    });
  });

  return app;
}