import type { PaymentProvider, PaymentRequirement, PaymentVerification, PaymentRecipient } from "../types.js";

/**
 * In-memory mock x402 provider. Fully offline: creates requirements, tracks
 * paid payment ids (duplicate detection), and pays exactly the total on demand
 * (or verifies an external reference — any non-empty reference = paid).
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly mode = "mock" as const;
  private readonly processed = new Map<string, PaymentVerification>();
  private seq = 0;

  async createRequirement(input: {
    auditId: string;
    total: string;
    currency: string;
    recipients: PaymentRecipient[];
    network: string;
  }): Promise<PaymentRequirement> {
    this.seq += 1;
    return {
      paymentId: `mock-pay-${this.seq}-${Date.now()}`,
      auditId: input.auditId,
      total: input.total,
      currency: input.currency,
      recipients: input.recipients,
      network: input.network,
    };
  }

  async verifyPayment(requirement: PaymentRequirement, reference?: string): Promise<PaymentVerification> {
    const existing = this.processed.get(requirement.paymentId);
    if (existing) return existing; // duplicate confirmation → idempotent

    const paid = reference
      ? requirement.total
      : undefined;
    const verification: PaymentVerification =
      paid !== undefined
        ? {
            paymentId: requirement.paymentId,
            auditId: requirement.auditId,
            status: "paid",
            paidAmount: paid,
            paidAt: new Date().toISOString(),
            transactionReference: `mock-ref-${requirement.paymentId}`,
            message: "mock payment settled",
          }
        : {
            paymentId: requirement.paymentId,
            auditId: requirement.auditId,
            status: "pending",
            message: "awaiting payment (mock)",
          };
    if (verification.status === "paid") this.processed.set(requirement.paymentId, verification);
    return verification;
  }

  async pay(requirement: PaymentRequirement): Promise<PaymentVerification> {
    return this.verifyPayment(requirement, `client-paid-${Date.now()}`);
  }
}

/** Default specialist split (spec example: 6×0.15 agents + 0.10 gateway = 1.00). */
export const DEFAULT_PAYMENT_SHARES = [
  { agentId: "reentrancy-agent", share: 0.15 },
  { agentId: "access-control-agent", share: 0.15 },
  { agentId: "business-logic-agent", share: 0.15 },
  { agentId: "economic-agent", share: 0.15 },
  { agentId: "static-agent", share: 0.15 },
  { agentId: "verification-agent", share: 0.15 },
  { agentId: "swarmproof-gateway", share: 0.1 },
] as const;