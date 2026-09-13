import {
  acceptPayment,
  createFacilitator,
  usdToTinybars,
  tinybarsToUsd,
  type X402FacilitatorClient,
  type X402PaymentPayload,
  type X402PaymentRequirements,
} from "@swarmproof/x402";
import type {
  PaymentProvider,
  PaymentRequirement,
  PaymentVerification,
  PaymentRecipient,
} from "../types.js";
import { hasX402Quote } from "../types.js";

export interface X402Config {
  /** Network hint, e.g. "hedera:testnet". */
  hint: string;
  /** Blocky402 (or self-hosted) facilitator base URL. Empty → offline mock. */
  facilitatorUrl?: string;
  /** Mainnet API key (X-Api-Key). */
  apiToken?: string;
  /** tinybars per 1 USD (default 1_000_000 = 0.01 HBAR). */
  tinybarsPerUSD?: string;
  /** Quote timeout. */
  maxTimeoutSeconds?: number;
  /** Settled asset: "0.0.0" = HBAR, otherwise an HTS token id. */
  asset?: string;
  /** Optional on-chain verification (e.g. mirror node) for direct tx ids. */
  verifyOnChain?: (input: {
    transactionId: string;
    payTo: string;
    amountTinybars: string;
    asset: string;
  }) => Promise<{ verified: boolean; payer?: string; message?: string }>;
}

const SERVICE_ID = "swarmproof-audit";

/**
 * Real x402 payment provider (v2 wire format, Blocky402 facilitator).
 *
 * Server side of the protocol:
 *   1. createRequirement builds a canonical x402 quote (single exact payTo =
 *      the SwarmProof gateway; amount in tinybars; fee-payer from the
 *      facilitator's GET /supported).
 *   2. The client (X402Client) signs the payment and settles through the
 *      facilitator, then presents the payload via the X-PAYMENT header.
 *   3. verifyPayment validates the payload with POST /verify plus strict
 *      server-side checks (network / payTo / asset / amount / auditId /
 *      nonce / expiry) — or, for a direct tx id, falls back to on-chain
 *      verification (mirror node).
 */
export class X402PaymentProvider implements PaymentProvider {
  readonly mode = "x402" as const;
  private readonly facilitator: X402FacilitatorClient;
  private readonly network: string;
  private readonly maxTimeoutSeconds: number;
  private readonly asset: string;
  private readonly tinybarsPerUSD: string;
  private readonly verifyOnChain?: X402Config["verifyOnChain"];

  constructor(private readonly config: X402Config) {
    this.network = config.hint;
    this.facilitator = createFacilitator({ baseUrl: config.facilitatorUrl, apiKey: config.apiToken });
    this.maxTimeoutSeconds = config.maxTimeoutSeconds ?? 300;
    this.asset = config.asset ?? "0.0.0";
    this.tinybarsPerUSD = config.tinybarsPerUSD ?? "100000000";
    this.verifyOnChain = config.verifyOnChain;
  }

  get facilitatorClient(): X402FacilitatorClient {
    return this.facilitator;
  }

  /** The facilitator's co-signing account for the chosen network. */
  async feePayer(): Promise<string> {
    const feePayer = await this.facilitator.feePayer(this.network);
    if (!feePayer) throw new Error(`x402: facilitator does not advertise a fee-payer for ${this.network}`);
    return feePayer;
  }

  private pickPayee(recipients: PaymentRecipient[]): PaymentRecipient {
    return recipients.find((r) => r.agentId === "swarmproof-gateway") ?? recipients[0]!;
  }

  async createRequirement(input: {
    auditId: string;
    total: string;
    currency: string;
    recipients: PaymentRecipient[];
    network: string;
  }): Promise<PaymentRequirement> {
    const feePayer = await this.feePayer().catch(() => (this.facilitator.mode === "mock" ? "0.0.1002001" : undefined));
    const payee = this.pickPayee(input.recipients);
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.maxTimeoutSeconds * 1000).toISOString();
    const amount = usdToTinybars(input.total, this.tinybarsPerUSD);

    const quote: X402PaymentRequirements = {
      scheme: "exact",
      network: this.network,
      amount,
      payTo: payee.address,
      maxTimeoutSeconds: this.maxTimeoutSeconds,
      asset: this.asset,
      extra: {
        feePayer,
        service: SERVICE_ID,
        auditId: input.auditId,
        nonce,
        expiresAt,
      },
    };

    return {
      paymentId: `x402-${nonce}`,
      auditId: input.auditId,
      total: input.total,
      currency: input.currency,
      recipients: input.recipients,
      network: this.network,
      x402: quote,
    };
  }

  async verifyPayment(
    requirement: PaymentRequirement,
    reference?: string,
    x402Payload?: X402PaymentPayload,
  ): Promise<PaymentVerification> {
    const base = { paymentId: requirement.paymentId, auditId: requirement.auditId };

    // --- path 1: signed x402 payload presented via X-PAYMENT ---
    if (x402Payload) {
      if (!hasX402Quote(requirement)) {
        return { ...base, status: "invalid", message: "x402: requirement has no quote" };
      }
      const quote = requirement.x402;
      const expectedNonce = quote.extra?.nonce;
      const presentedNonce = x402Payload.accepted.extra?.nonce;
      if (expectedNonce && presentedNonce !== expectedNonce) {
        return { ...base, status: "invalid", message: "x402: stale payment (nonce mismatch)" };
      }
      const result = await acceptPayment(this.facilitator, x402Payload, {
        expectedNetwork: quote.network,
        expectedPayTo: quote.payTo,
        expectedAsset: quote.asset,
        minAmount: quote.amount,
        expectedAuditId: quote.extra?.auditId ?? requirement.auditId,
      });
      if (!result.ok) {
        return { ...base, status: "invalid", message: `x402: ${result.reason}` };
      }
      return {
        ...base,
        status: "paid",
        paidAmount: tinybarsToUsd(quote.amount, this.tinybarsPerUSD),
        paidAt: new Date().toISOString(),
        transactionReference: x402Payload.accepted.extra?.settlementTx ?? result.payer,
        message: `x402 paid by ${result.payer ?? "?"} (${quote.amount} ${quote.asset === "0.0.0" ? "tinybars" : quote.asset})`,
      };
    }

    // --- path 2: direct transfer tx id, verified on-chain ---
    if (reference && hasX402Quote(requirement) && this.verifyOnChain) {
      const quote = requirement.x402;
      const onChain = await this.verifyOnChain({
        transactionId: reference,
        payTo: quote.payTo,
        amountTinybars: quote.amount,
        asset: quote.asset,
      });
      if (onChain.verified) {
        return {
          ...base,
          status: "paid",
          paidAmount: tinybarsToUsd(quote.amount, this.tinybarsPerUSD),
          paidAt: new Date().toISOString(),
          transactionReference: reference,
          message: onChain.message ?? "transfer verified on mirror node",
        };
      }
      return { ...base, status: "pending", message: `on-chain verification failed: ${onChain.message ?? "amount/recipient mismatch"}` };
    }

    return { ...base, status: "pending", message: "awaiting x402 payment (present X-PAYMENT header)" };
  }

  /** x402 payments are client-side; the gateway never signs. Guards misuse. */
  async pay(): Promise<PaymentVerification> {
    throw new Error("x402 pay() is client-side — use X402Client to sign + settle, then present X-PAYMENT.");
  }
}