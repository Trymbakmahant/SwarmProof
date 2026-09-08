import { createHash, createHmac } from "node:crypto";
import { parseHederaPrivateKey } from "./topic.js";

export type { AgentIdentity, AgentIdentitySchema } from "@swarmproof/agents";
export type { AgentRole } from "@swarmproof/agents";

/**
 * Deterministic serialization & hashing for tamper-evident audit proofs.
 * The hash is computed over a stable (sorted-key, compact) JSON so that
 * identical reports always produce identical hashes regardless of key order.
 */
export function deterministicStringify(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        out[k] = sort((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Small, deterministic HCS message that anchors an audit (never the full report). */
export interface AuditProofMessage {
  type: "swarmproof.audit";
  version: "1";
  auditId: string;
  reportHash: string;
  result: "verified" | "unverified";
  findingCount: number;
  timestamp: string;
}

export function buildAuditProofMessage(input: {
  auditId: string;
  reportHash: string;
  result: "verified" | "unverified";
  findingCount: number;
  timestamp?: string;
}): AuditProofMessage {
  return {
    type: "swarmproof.audit",
    version: "1",
    auditId: input.auditId,
    reportHash: input.reportHash,
    result: input.result,
    findingCount: input.findingCount,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

/** Receipt returned by the ledger after anchoring. */
export interface AuditProofReceipt {
  auditId: string;
  reportHash: string;
  hcsTopicId: string;
  transactionId: string;
  consensusTimestamp: string;
  verified: boolean;
}

/** Tamper-evidence verifier: SHA256(currentReport) must equal the anchored hash. */
export interface AuditProofVerifier {
  verifyReport(reportToCheck: unknown, proof: { reportHash: string }): Promise<{
    verified: boolean;
    currentHash: string;
    anchoredHash: string;
  }>;
}

/** HCS anchoring client (mock + real implementations behind this interface). */
export interface AuditProofClient {
  readonly mode: "mock" | "hedera";
  anchorProof(message: AuditProofMessage): Promise<AuditProofReceipt>;
}

/* ------------------------------------------------------------------ */
/* Mock — fully offline, stores receipts in memory                     */
/* ------------------------------------------------------------------ */

export class MockAuditProofClient implements AuditProofClient, AuditProofVerifier {
  readonly mode = "mock" as const;
  readonly topicId: string;
  private receipts = new Map<string, AuditProofReceipt>();
  private seq = 0;

  constructor(topicId = "0.0.mock-topic") {
    this.topicId = topicId;
  }

  async anchorProof(message: AuditProofMessage): Promise<AuditProofReceipt> {
    this.seq += 1;
    const receipt: AuditProofReceipt = {
      auditId: message.auditId,
      reportHash: message.reportHash,
      hcsTopicId: this.topicId,
      transactionId: `0.0.trx-${this.seq}-${Date.now()}`,
      consensusTimestamp: new Date().toISOString(),
      verified: true,
    };
    this.receipts.set(message.auditId, receipt);
    return receipt;
  }

  getReceipt(auditId: string): AuditProofReceipt | undefined {
    return this.receipts.get(auditId);
  }

  async verifyReport(reportToCheck: unknown, proof: { reportHash: string }): Promise<{
    verified: boolean;
    currentHash: string;
    anchoredHash: string;
  }> {
    const currentHash = sha256Hex(deterministicStringify(reportToCheck));
    return {
      verified: currentHash === proof.reportHash,
      currentHash,
      anchoredHash: proof.reportHash,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Real — Hedera testnet via @hashgraph/sdk (env-gated, lazy-loads)    */
/* ------------------------------------------------------------------ */

export interface HederaConfig {
  network: string;
  accountId: string;
  privateKey: string;
  topicId: string;
}

export class HederaAuditProofClient implements AuditProofClient, AuditProofVerifier {
  readonly mode = "hedera" as const;
  private sdk: typeof import("@hashgraph/sdk") | null = null;
  private receiptCache = new Map<string, AuditProofReceipt>();

  constructor(
    private readonly config: HederaConfig,
    private readonly submitDelayMs = 2000, // HCS consensus finality is not instant
  ) {}

  private async sdkLoader(): Promise<typeof import("@hashgraph/sdk")> {
    if (!this.sdk) {
      if (!this.config.accountId || !this.config.privateKey || !this.config.topicId) {
        throw new Error(
          "HederaAuditProofClient: HEDERA_ACCOUNT_ID / HEDERA_PRIVATE_KEY / HEDERA_TOPIC_ID required. Run with mock mode locally.",
        );
      }
      this.sdk = await import("@hashgraph/sdk");
    }
    return this.sdk;
  }

  async anchorProof(message: AuditProofMessage): Promise<AuditProofReceipt> {
    const sdk = await this.sdkLoader();
    const { Client, PrivateKey, AccountId, TopicId, TopicMessageSubmitTransaction } = sdk;

    const client = Client.forName(this.config.network);
    client.setOperator(AccountId.fromString(this.config.accountId), parseHederaPrivateKey(this.config.privateKey, PrivateKey));

    const tx = await new TopicMessageSubmitTransaction({
      topicId: TopicId.fromString(this.config.topicId),
      message: JSON.stringify(message),
    }).execute(client);

    const receipt = await tx.getReceipt(client); // waits for consensus (hence the delay option)
    const record = await tx.getRecord(client);
    const consensusTimestamp = new Date(Number(record.consensusTimestamp) * 1e3).toISOString();

    const result: AuditProofReceipt = {
      auditId: message.auditId,
      reportHash: message.reportHash,
      hcsTopicId: this.config.topicId,
      transactionId: tx.transactionId.toString(),
      consensusTimestamp,
      verified: true,
    };
    this.receiptCache.set(message.auditId, result);
    void receipt;
    return result;
  }

  getReceipt(auditId: string): AuditProofReceipt | undefined {
    return this.receiptCache.get(auditId);
  }

  async verifyReport(reportToCheck: unknown, proof: { reportHash: string }): Promise<{
    verified: boolean;
    currentHash: string;
    anchoredHash: string;
  }> {
    const currentHash = sha256Hex(deterministicStringify(reportToCheck));
    return { verified: currentHash === proof.reportHash, currentHash, anchoredHash: proof.reportHash };
  }
}

/** Read HCS config from env — no hardcoded credentials anywhere. */
export function hederaConfigFromEnv(env: NodeJS.ProcessEnv = process.env): HederaConfig {
  return {
    network: env.HEDERA_NETWORK ?? "testnet",
    accountId: env.HEDERA_ACCOUNT_ID ?? "",
    privateKey: env.HEDERA_PRIVATE_KEY ?? "",
    topicId: env.HEDERA_TOPIC_ID ?? "",
  };
}

/** Pick mock or real based on env presence — runnable locally with zero config. */
export function createAuditProofClient(env: NodeJS.ProcessEnv = process.env): AuditProofClient {
  if (env.HEDERA_ACCOUNT_ID && env.HEDERA_PRIVATE_KEY && env.HEDERA_TOPIC_ID) {
    return new HederaAuditProofClient(hederaConfigFromEnv(env));
  }
  return new MockAuditProofClient();
}

/** HMAC helper reserved for future signed-agent messages (HCS-14 / A2A). */
export function hmacSha256(key: string, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}