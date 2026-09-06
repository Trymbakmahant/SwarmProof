import type {
  PaymentProvider,
  PaymentRequirement,
  PaymentVerification,
  PaymentRecipient,
} from "../types.js";

export interface X402Config {
  hint: string; // network hint, e.g. "ethereum", "hedera:testnet"
  facilitatorUrl: string; // X402_FACILITATOR_URL — Cooperative-style facilitator
  apiToken?: string;
}

/**
 * Real x402 payment provider (Cooperative HTTP-402 style).
 *
 * Flow (standard x402):
 *   1. SwarmProof shows the client a payment requirement (total, recipients,
 *      network, paymentId) — an HTTP 402 challenge.
 *   2. Client agent resolves the challenge against the facilitator
 *      (token proxy / paymaster) and posts proof-of-payment back.
 *   3. SwarmProof calls verifyPayment with that proof → facilitator confirms.
 *
 * MVP wiring: the facilitator endpoints below follow the x402 contract; the
 * exact routing logic lives on the facilitator side (X402_FACILITATOR_URL).
 * Everything is env-driven — no keys in source.
 */
export class X402PaymentProvider implements PaymentProvider {
  readonly mode = "x402" as const;

  constructor(private readonly config: X402Config) {}

  async createRequirement(input: {
    auditId: string;
    total: string;
    currency: string;
    recipients: PaymentRecipient[];
    network: string;
  }): Promise<PaymentRequirement> {
    const res = await fetch(`${this.config.facilitatorUrl.replace(/\/$/, "")}/swarmproof/payments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.config.apiToken ? { authorization: `Bearer ${this.config.apiToken}` } : {}),
      },
      body: JSON.stringify({
        auditId: input.auditId,
        total: input.total,
        currency: input.currency,
        recipients: input.recipients,
        network: input.network,
        hint: this.config.hint,
      }),
    });
    if (!res.ok) throw new Error(`x402 createRequirement -> ${res.status} ${await res.text()}`);
    const body = (await res.json()) as PaymentRequirement;
    return body;
  }

  async verifyPayment(
    requirement: PaymentRequirement,
    reference?: string,
  ): Promise<PaymentVerification> {
    const res = await fetch(
      `${this.config.facilitatorUrl.replace(/\/$/, "")}/swarmproof/payments/${requirement.paymentId}/verify`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference }),
      },
    );
    if (!res.ok) throw new Error(`x402 verifyPayment -> ${res.status}`);
    return (await res.json()) as PaymentVerification;
  }

  /** x402 payments are client-side; the gateway never signs. Guards misuse. */
  async pay(): Promise<PaymentVerification> {
    throw new Error("x402 pay() is client-side — use verifyPayment(reference) after the client agent pays.");
  }
}