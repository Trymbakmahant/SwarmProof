import { MOCK_FEE_PAYER, usdToTinybars, type X402PaymentPayload, type X402PaymentRequirements } from "@swarmproof/x402";
import type { PaymentProvider, PaymentRequirement, PaymentVerification, PaymentRecipient } from "../types.js";

/** Mock settlement rate: 1 USD -> 1,000,000 tinybars (0.01 HBAR). */
const MOCK_TINYBARS_PER_USD = "1000000";

function pickPayee(recipients: PaymentRecipient[]): PaymentRecipient {
  return recipients.find((r) => r.agentId === "swarmproof-gateway") ?? recipients[0]!;
}

function mockQuote(input: {
  auditId: string;
  total: string;
  currency: string;
  recipients: PaymentRecipient[];
  network: string;
}): { quote: X402PaymentRequirements; nonce: string } {
  const nonce = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const quote: X402PaymentRequirements = {
    scheme: "exact",
    network: input.network,
    amount: usdToTinybars(input.total, MOCK_TINYBARS_PER_USD),
    payTo: pickPayee(input.recipients).address,
    maxTimeoutSeconds: 300,
    asset: "0.0.0",
    extra: {
      feePayer: MOCK_FEE_PAYER,
      service: "swarmproof-audit",
      auditId: input.auditId,
      nonce,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    },
  };
  return { quote, nonce };
}

/**
 * In-memory mock x402 provider. Fully offline: creates requirements with a
 * canonical x402 quote, tracks paid payment ids (duplicate detection), and
 * accepts either a mock reference or a well-formed signed x402 payload.
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
    const { quote } = mockQuote(input);
    return {
      paymentId: `mock-pay-${this.seq}-${Date.now()}`,
      auditId: input.auditId,
      total: input.total,
      currency: input.currency,
      recipients: input.recipients,
      network: input.network,
      x402: quote,
    };
  }

  async verifyPayment(requirement: PaymentRequirement, reference?: string, x402Payload?: X402PaymentPayload): Promise<PaymentVerification> {
    const existing = this.processed.get(requirement.paymentId);
    if (existing) return existing; // duplicate confirmation → idempotent

    // Signed x402 payload path — mirror the real provider's server-side checks
    // (nonce / auditId / amount) so offline tests exercise the same semantics.
    if (x402Payload) {
      const quote = requirement.x402;
      if (!quote) {
        return { paymentId: requirement.paymentId, auditId: requirement.auditId, status: "invalid", message: "mock: requirement has no x402 quote" };
      }
      const nonceOk = !quote.extra?.nonce || x402Payload.accepted.extra?.nonce === quote.extra?.nonce;
      const auditOk = !quote.extra?.auditId || (x402Payload.accepted.extra?.auditId ?? requirement.auditId) === quote.extra?.auditId;
      const amountOk = quote.amount === x402Payload.accepted.amount && x402Payload.accepted.amount !== "";
      if (!nonceOk || !auditOk || !amountOk) {
        return {
          paymentId: requirement.paymentId,
          auditId: requirement.auditId,
          status: "invalid",
          message: `mock x402 rejected: nonce=${String(nonceOk)} audit=${String(auditOk)} amount=${String(amountOk)}`,
        };
      }
      const verification: PaymentVerification = {
        paymentId: requirement.paymentId,
        auditId: requirement.auditId,
        status: "paid",
        paidAmount: requirement.total,
        paidAt: new Date().toISOString(),
        transactionReference: x402Payload.accepted.extra?.settlementTx ?? `mock-ref-${requirement.paymentId}`,
        message: "mock x402 payment settled (payload)",
      };
      this.processed.set(requirement.paymentId, verification);
      return verification;
    }

    const verification: PaymentVerification =
      reference
        ? {
            paymentId: requirement.paymentId,
            auditId: requirement.auditId,
            status: "paid",
            paidAmount: requirement.total,
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