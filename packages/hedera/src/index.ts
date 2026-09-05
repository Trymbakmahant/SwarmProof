/**
 * Hedera adapters. Real SDK wiring lands in M5 (hedera-local-node + @hashgraph/sdk).
 * The interfaces below are the contract the rest of SwarmProof depends on.
 */

export interface TopicMessage {
  sequenceNumber: number;
  consensusTimestamp: string;
  runningHash: string;
  content: string; // JSON payload
}

export interface ReportAnchor {
  runId: string;
  topicId: string;
  consensusTimestamp: string;
  contentHash: string;
}

export interface TokenTransfer {
  tokenId: string;
  amount: number; // tinybars / HTS units
  from: string;
  to: string;
}

export interface HederaClient {
  readonly network: "mock" | "testnet" | "local";
  /* Consensus Service */
  submitReport(topicId: string, reportJson: string): Promise<ReportAnchor>;
  subscribeTopic(topicId: string, onMessage: (m: TopicMessage) => void): Promise<() => void>;
  /* Token Service (HTS) */
  escrow(tokenId: string, escrowAccount: string, amount: number): Promise<TokenTransfer>;
  payout(tokenId: string, fromEscrow: string, to: string, amount: number): Promise<TokenTransfer>;
}

/** In-memory implementation for tests and the offline demo. */
export class MockHederaClient implements HederaClient {
  readonly network = "mock" as const;
  private seq = 0;

  async submitReport(topicId: string, reportJson: string): Promise<ReportAnchor> {
    this.seq += 1;
    return {
      runId: JSON.parse(reportJson).runId ?? "unknown",
      topicId,
      consensusTimestamp: new Date().toISOString(),
      contentHash: `sha256:${Buffer.from(reportJson).toString("base64").slice(0, 24)}`,
    };
  }

  async subscribeTopic(
    _topicId: string,
    _onMessage: (m: TopicMessage) => void,
  ): Promise<() => void> {
    return () => undefined;
  }

  async escrow(tokenId: string, escrowAccount: string, amount: number): Promise<TokenTransfer> {
    return { tokenId, amount, from: "payer", to: escrowAccount };
  }

  async payout(
    tokenId: string,
    fromEscrow: string,
    to: string,
    amount: number,
  ): Promise<TokenTransfer> {
    return { tokenId, amount, from: fromEscrow, to };
  }
}