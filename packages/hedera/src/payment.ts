import { HederaTopicClient, topicConfigFromEnv, hasTopicCredentials, type TopicSubmitConfig } from "./topic.js";

/**
 * HCS payment audit trail — the "verifiable payment audit trails on HCS"
 * extra point. A compact allocation record is anchored after every settled
 * audit, so anyone can replay who was paid for which audit, when.
 */

export interface PaymentProofRecipient {
  agentId: string;
  address: string;
  amount: string;
}

export interface PaymentProofMessage {
  type: "swarmproof.payment";
  version: "1";
  auditId: string;
  paymentId: string;
  total: string;
  currency: string;
  payer?: string;
  transactionReference?: string;
  network: string;
  asset: string;
  status: "paid" | "underpaid" | "invalid";
  recipients: PaymentProofRecipient[];
  timestamp: string;
}

export function buildPaymentProofMessage(input: Omit<PaymentProofMessage, "type" | "version" | "timestamp"> & { timestamp?: string }): PaymentProofMessage {
  return {
    type: "swarmproof.payment",
    version: "1",
    ...input,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

export interface PaymentProofReceipt {
  auditId: string;
  paymentId: string;
  hcsTopicId: string;
  transactionId: string;
  consensusTimestamp: string;
  verified: boolean;
}

export interface PaymentProofClient {
  readonly mode: "mock" | "hedera";
  readonly topicId: string;
  anchorPayment(message: PaymentProofMessage): Promise<PaymentProofReceipt>;
  getReceipt(paymentId: string): PaymentProofReceipt | undefined;
}

export class MockPaymentProofClient implements PaymentProofClient {
  readonly mode = "mock" as const;
  readonly topicId: string;
  private receipts = new Map<string, PaymentProofReceipt>();
  private seq = 0;

  constructor(topicId = "0.0.mock-payment-topic") {
    this.topicId = topicId;
  }

  async anchorPayment(message: PaymentProofMessage): Promise<PaymentProofReceipt> {
    this.seq += 1;
    const receipt: PaymentProofReceipt = {
      auditId: message.auditId,
      paymentId: message.paymentId,
      hcsTopicId: this.topicId,
      transactionId: `0.0.paytrx-${this.seq}-${Date.now()}`,
      consensusTimestamp: new Date().toISOString(),
      verified: true,
    };
    this.receipts.set(message.paymentId, receipt);
    return receipt;
  }

  getReceipt(paymentId: string): PaymentProofReceipt | undefined {
    return this.receipts.get(paymentId);
  }
}

export class HederaPaymentProofClient implements PaymentProofClient {
  readonly mode = "hedera" as const;
  readonly topicId: string;
  private receipts = new Map<string, PaymentProofReceipt>();

  constructor(private readonly config: TopicSubmitConfig, private readonly submitDelayMs = 2000) {
    this.topicId = config.topicId;
  }

  async anchorPayment(message: PaymentProofMessage): Promise<PaymentProofReceipt> {
    const topic = new HederaTopicClient(this.config, this.submitDelayMs);
    const submitted = await topic.submit(JSON.stringify(message));
    const receipt: PaymentProofReceipt = {
      auditId: message.auditId,
      paymentId: message.paymentId,
      hcsTopicId: this.topicId,
      transactionId: submitted.transactionId,
      consensusTimestamp: submitted.consensusTimestamp,
      verified: true,
    };
    this.receipts.set(message.paymentId, receipt);
    return receipt;
  }

  getReceipt(paymentId: string): PaymentProofReceipt | undefined {
    return this.receipts.get(paymentId);
  }
}

/** Mock when no credentials; real Hedera otherwise (same rule as proof.ts). */
export function createPaymentProofClient(env: NodeJS.ProcessEnv = process.env): PaymentProofClient {
  const config = topicConfigFromEnv(env);
  if (hasTopicCredentials(config)) return new HederaPaymentProofClient(config);
  return new MockPaymentProofClient();
}