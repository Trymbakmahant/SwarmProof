/**
 * Shared machinery for HCS message submission (any message type) using the
 * Hedera JS SDK. Mirrors the pattern in proof.ts but reusable across the
 * payment-trail and HCS-14 identity modules.
 */

export interface TopicSubmitConfig {
  network: string; // "testnet" | "mainnet" | "previewnet"
  accountId: string;
  privateKey: string;
  topicId: string;
}

export interface TopicSubmission {
  transactionId: string;
  consensusTimestamp: string;
}

export function topicConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TopicSubmitConfig {
  return {
    network: env.HEDERA_NETWORK ?? "testnet",
    accountId: env.HEDERA_ACCOUNT_ID ?? "",
    privateKey: env.HEDERA_PRIVATE_KEY ?? "",
    topicId: env.HEDERA_TOPIC_ID ?? "",
  };
}

export function hasTopicCredentials(config: TopicSubmitConfig): boolean {
  return Boolean(config.accountId && config.privateKey && config.topicId);
}

/** Submit a JSON-stringified message to an HCS topic. Wait-for-consensus aware. */
export class HederaTopicClient {
  constructor(
    private readonly config: TopicSubmitConfig,
    private readonly submitDelayMs = 2000, // consensus finality is not instant
  ) {}

  async submit(message: string): Promise<TopicSubmission> {
    if (!hasTopicCredentials(this.config)) {
      throw new Error("HederaTopicClient: HEDERA_ACCOUNT_ID / HEDERA_PRIVATE_KEY / HEDERA_TOPIC_ID required");
    }
    const sdk = await import("@hashgraph/sdk");
    const { Client, PrivateKey, AccountId, TopicId, TopicMessageSubmitTransaction } = sdk;

    const client = Client.forName(this.config.network);
    client.setOperator(AccountId.fromString(this.config.accountId), PrivateKey.fromString(this.config.privateKey));

    const tx = await new TopicMessageSubmitTransaction({
      topicId: TopicId.fromString(this.config.topicId),
      message,
    }).execute(client);

    await tx.getReceipt(client); // wait for consensus
    const record = await tx.getRecord(client);
    const consensusTimestamp = new Date(Number(record.consensusTimestamp) * 1e3).toISOString();
    return { transactionId: tx.transactionId.toString(), consensusTimestamp };
  }
}