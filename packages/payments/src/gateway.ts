import { allocateShares, AllocationError, toCents } from "./allocator.js";
import type {
  PaymentProvider,
  PaymentRequirement,
  PaymentVerification,
  RecipientShare,
} from "./types.js";
import type { X402PaymentPayload } from "@swarmproof/x402";

/**
 * SwarmProof payment gateway.
 *
 * Responsibilities (and ONLY these — the swarm never sees money logic):
 *  - compute the allocation BEFORE the client signs (visible: total/recipients/network/paymentId)
 *  - validate totals, addresses, amounts, duplicates, underpayment
 *  - confirm one payment per audit; guard double-spend/duplicate confirms
 *
 * The provider is injectable (mock ⇄ x402) so the whole system runs offline.
 */
export class PaymentGateway {
  private readonly requirements = new Map<string, PaymentRequirement>();
  private readonly paidAudits = new Set<string>();

  constructor(
    private readonly provider: PaymentProvider,
    private readonly network: string,
  ) {}

  getProvider(): PaymentProvider {
    return this.provider;
  }

  /** Build the payment requirement for an audit. Idempotent per audit id. */
  async createRequirement(input: {
    auditId: string;
    total: string;
    currency: string;
    shares: RecipientShare[];
  }): Promise<PaymentRequirement> {
    const existing = this.requirements.get(input.auditId);
    if (existing) return existing; // duplicate requirement → same payment

    const { recipients } = allocateShares(input.total, input.shares);
    const requirement = await this.provider.createRequirement({
      auditId: input.auditId,
      total: input.total,
      currency: input.currency,
      recipients,
      network: this.network,
    });
    this.requirements.set(input.auditId, requirement);
    return requirement;
  }

  getRequirement(auditId: string): PaymentRequirement | undefined {
    return this.requirements.get(auditId);
  }

  isPaid(auditId: string): boolean {
    return this.paidAudits.has(auditId);
  }

  /**
   * Confirm a payment for an audit. Enforces:
   *  - requirement must exist (created before signing)
   *  - exactly one payment per audit (duplicate confirm → rejected)
   *  - underpayment → status underpaid
   *  - unknown/garbage reference → invalid
   */
  async confirmPayment(auditId: string, reference?: string, x402Payload?: X402PaymentPayload): Promise<PaymentVerification> {
    if (this.paidAudits.has(auditId)) {
      return {
        paymentId: this.requireRequirement(auditId).paymentId,
        auditId,
        status: "invalid",
        message: "duplicate payment confirmation for audit",
      };
    }
    const requirement = this.requireRequirement(auditId);
    let verification: PaymentVerification;
    try {
      verification = await this.provider.verifyPayment(requirement, reference, x402Payload);
    } catch (err) {
      return {
        paymentId: requirement.paymentId,
        auditId,
        status: "invalid",
        message: `provider error: ${(err as Error).message}`,
      };
    }

    if (verification.status === "paid") {
      if (toCents(verification.paidAmount ?? "0") < toCents(requirement.total)) {
        verification = { ...verification, status: "underpaid" };
      } else {
        this.paidAudits.add(auditId);
      }
    }
    return verification;
  }

  private requireRequirement(auditId: string): PaymentRequirement {
    const r = this.requirements.get(auditId);
    if (!r) throw new AllocationError("EMPTY_RECIPIENTS", `no payment requirement for audit ${auditId} — create one before paying`);
    return r;
  }
}