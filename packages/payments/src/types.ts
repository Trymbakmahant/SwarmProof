import { z } from "zod";

/** One payee in the single job payment. Amounts are decimal string units of `currency`. */
export const PaymentRecipientSchema = z.object({
  agentId: z.string().min(1),
  address: z.string().min(4), // EVM address, Hedera account id, or fungible-token route
  amount: z.string(), // validated as positive decimal elsewhere
});
export type PaymentRecipient = z.infer<typeof PaymentRecipientSchema>;

/** The single payment covering an entire SwarmProof job (split across recipients). */
export const SwarmPaymentSchema = z.object({
  paymentId: z.string().min(1),
  auditId: z.string().min(1),
  total: z.string(),
  currency: z.string().min(1),
  recipients: z.array(PaymentRecipientSchema),
});
export type SwarmPayment = z.infer<typeof SwarmPaymentSchema>;

/** What the client sees BEFORE paying: amount, recipients, network, payment id. */
export type PaymentRequirement = SwarmPayment & { network: string };

export const PaymentStatusSchema = z.enum([
  "pending",
  "paid",
  "underpaid",
  "failed",
  "invalid",
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export interface PaymentVerification {
  paymentId: string;
  auditId: string;
  status: PaymentStatus;
  paidAmount?: string;
  paidAt?: string;
  transactionReference?: string;
  message?: string;
}

/** Allocation input: who gets paid, and their share of the total. */
export interface RecipientShare {
  agentId: string;
  address: string;
  share: number; // fraction of total, e.g. 0.15
}

/**
 * Payment provider seam. Swap mock ⇄ real x402 by implementation — nothing
 * else in SwarmProof knows about the transport.
 */
export interface PaymentProvider {
  readonly mode: "mock" | "x402";
  createRequirement(input: {
    auditId: string;
    total: string;
    currency: string;
    recipients: PaymentRecipient[];
    network: string;
  }): Promise<PaymentRequirement>;
  /** Confirm the requirement was paid (reference is provider-specific, e.g. a tx id). */
  verifyPayment(requirement: PaymentRequirement, reference?: string): Promise<PaymentVerification>;
  /** Demo convenience: perform the payment client-side (mock only; x402 never pays). */
  pay(requirement: PaymentRequirement): Promise<PaymentVerification>;
}