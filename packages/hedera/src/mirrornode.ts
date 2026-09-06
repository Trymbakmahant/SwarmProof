/**
 * Hedera Mirror Node REST client (read-only, public — no credentials).
 *
 * SwarmProof uses it for three things, all "extra points" on the Hedera track:
 *   - verifyPayment: confirm a direct HBAR/HTS transfer to the gateway
 *   - proof checks: re-read anchored audit messages straight from the chain
 *   - agent identity: look up HCS-14 identity messages registered in a topic
 */

/** Mirror node REST resource shapes (minimal, duck-typed). */
interface TransferRowLike {
  account?: string;
  amount?: number;
  is_approval?: boolean;
}

interface TokenTransferRowLike {
  token_id?: string;
  account?: string;
  amount?: number;
}

export class MirrorNodeClient {
  constructor(
    private readonly baseUrl = "https://testnet.mirrornode.hedera.com",
    private readonly timeoutMs = 10_000,
  ) {}

  private async get<T>(path: string): Promise<T | undefined> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/v1${path}`, { signal: controller.signal });
      if (res.status === 404) return undefined;
      if (!res.ok) throw new Error(`mirror node GET ${path} -> ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** "0.0.1234@1699999999.123456789" → "0.0.1234-1699999999-123456789" */
  static normalizeTransactionId(txId: string): string {
    return txId.replace("@", "-").replace(/(\d)\.(\d+)$/, "$1-$2");
  }

  async getTransaction(txId: string): Promise<unknown | undefined> {
    const res = await this.get<{ transactions?: unknown[] }>(
      `/transactions/${encodeURIComponent(MirrorNodeClient.normalizeTransactionId(txId))}`,
    );
    return res?.transactions?.[0];
  }

  /**
   * Verify a transfer credited `payTo` with at least `amountTinybars` units of
   * `asset` (HBAR when "0.0.0", else an HTS token id). Direct-payment path.
   */
  async verifyTransfer(input: {
    transactionId: string;
    payTo: string;
    amountTinybars: string;
    asset?: string;
  }): Promise<{ verified: boolean; payer?: string; message?: string }> {
    const tx = await this.getTransaction(input.transactionId);
    if (!tx) return { verified: false, message: "transaction not found on mirror node" };

    const record = tx as {
      result?: string;
      transfers?: TransferRowLike[];
      token_transfers?: TokenTransferRowLike[];
    };
    if (record.result !== "SUCCESS") {
      return { verified: false, message: `transaction result is ${record.result ?? "unknown"}` };
    }

    const asset = input.asset ?? "0.0.0";
    const needed = BigInt(input.amountTinybars);
    let payeeAmount = 0n;
    let negativeAccount: string | undefined;

    if (asset === "0.0.0") {
      for (const t of record.transfers ?? []) {
        if (!t.account || t.amount === undefined) continue;
        if (t.account === input.payTo) payeeAmount += BigInt(t.amount);
        if (t.amount < 0 && !negativeAccount) negativeAccount = t.account;
      }
    } else {
      for (const t of record.token_transfers ?? []) {
        if (t.token_id === asset && t.account === input.payTo && t.amount !== undefined) {
          payeeAmount += BigInt(t.amount);
        }
        if (t.token_id === asset && t.amount !== undefined && t.amount < 0 && !negativeAccount) {
          negativeAccount = t.account;
        }
      }
    }

    if (payeeAmount < needed) {
      return {
        verified: false,
        message: `payee credited ${payeeAmount} ${asset === "0.0.0" ? "tinybars" : asset}, needed ${needed}`,
      };
    }
    return { verified: true, payer: negativeAccount, message: `credited ${payeeAmount} units of ${asset}` };
  }

  /** Raw HCS messages on a topic (message field is base64). */
  async getTopicMessages(topicId: string, limit = 20): Promise<Array<{ consensus_timestamp: string; message: string; sequence_number: number }>> {
    const res = await this.get<{ messages?: Array<{ consensus_timestamp: string; message: string; sequence_number: number }> }>(
      `/topics/${topicId}/messages?limit=${limit}`,
    );
    return res?.messages ?? [];
  }

  /** Decode base64 HCS message payloads to parsed JSON. */
  async getDecodedTopicMessages(topicId: string, limit = 20): Promise<Array<Record<string, unknown> & { consensus_timestamp: string }>> {
    const messages = await this.getTopicMessages(topicId, limit);
    const out: Array<Record<string, unknown> & { consensus_timestamp: string }> = [];
    for (const m of messages) {
      try {
        const parsed = JSON.parse(Buffer.from(m.message, "base64").toString("utf8")) as Record<string, unknown>;
        out.push({ ...parsed, consensus_timestamp: m.consensus_timestamp });
      } catch {
        /* skip non-JSON messages */
      }
    }
    return out;
  }

  /** Find an anchored SwarmProof audit message by auditId (or reportHash). */
  async findAuditAnchor(topicId: string, match: { auditId?: string; reportHash?: string }): Promise<
    | { found: boolean; message?: Record<string, unknown> & { consensus_timestamp: string } }
    | undefined
  > {
    const messages = await this.getDecodedTopicMessages(topicId, 50);
    const hit = messages.find((m) => {
      if (m.type !== "swarmproof.audit") return false;
      if (match.auditId && m.auditId === match.auditId) return true;
      if (match.reportHash && m.reportHash === match.reportHash) return true;
      return false;
    });
    return { found: Boolean(hit), message: hit };
  }

  async accountInfo(accountId: string): Promise<unknown | undefined> {
    return this.get(`/accounts/${encodeURIComponent(accountId)}`);
  }
}