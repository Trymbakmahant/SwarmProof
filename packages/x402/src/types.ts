/**
 * x402 v2 wire types (see https://x402.org and Blocky402 facilitator docs).
 *
 * SwarmProof speaks the "exact" payment scheme on Hedera:
 *   - HBAR (`asset: "0.0.0"`) or an HTS token id as `asset`
 *   - a single `payTo` recipient account (the SwarmProof gateway), settled
 *     through the Blocky402 facilitator which co-signs as `extra.feePayer`.
 */

export const X402_VERSION = 2 as const;

/** Network-agnostic extra fields; Hedera carries the facilitator fee-payer. */
export interface X402Extra {
  /** Facilitator account that co-signs the transfer at settlement time. */
  feePayer?: string;
  /** SwarmProof extension: service id this quote pays for. */
  service?: string;
  /** SwarmProof extension: the audit this payment unlocks. */
  auditId?: string;
  /** SwarmProof extension: unique quote id (echoed back on redemption). */
  nonce?: string;
  /** SwarmProof extension: ISO timestamp after which the quote expires. */
  expiresAt?: string;
  /** SwarmProof extension: facilitator tx id after /settle (ledger only). */
  settlementTx?: string;
  [key: string]: unknown;
}

/**
 * Canonical payment requirements ("quote") served by an x402 resource endpoint
 * (`Accept: application/x402+json`). For `exact` there is a single recipient.
 */
export interface X402PaymentRequirements {
  scheme: "exact";
  /** CAIP-ish network id, e.g. "hedera:testnet". */
  network: string;
  /** Decimal string in the smallest units of `asset` (tinybars for HBAR). */
  amount: string;
  /** Recipient address: Hedera "0.0.x" account id (or 0x for EVM). */
  payTo: string;
  maxTimeoutSeconds: number;
  /** "0.0.0" = HBAR; any other token id is an HTS asset. */
  asset: string;
  extra?: X402Extra;
}

/** Partially-signed v2 payment payload produced by an @x402 client SDK. */
export interface X402PaymentPayload {
  x402Version: 2;
  scheme: "exact";
  network: string;
  accepted: X402PaymentRequirements;
  /** Network-native signed artifact. Hedera: base64 TransferTransaction bytes. */
  payload: { transaction: string };
}

/** Resource description served by the 402 envelope (x402 v2 spec). */
export interface X402ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
  serviceName?: string;
  tags?: string[];
  iconUrl?: string;
}

/**
 * v2 402 envelope (`PaymentRequired`): what an x402 resource endpoint returns
 * for `Accept: application/x402+json`. `accepts[0]` is the exact quote.
 */
export interface X402ResourceEnvelope {
  x402Version: 2;
  error?: string;
  resource: X402ResourceInfo;
  accepts: X402PaymentRequirements[];
  extensions?: unknown;
}

/* ------------------------------------------------------------------ */
/* Blocky402 facilitator wire shapes                                    */
/* ------------------------------------------------------------------ */

export interface X402SupportedKind {
  scheme: string;
  network: string;
  x402Version: number;
  extra?: { feePayer?: string; [key: string]: unknown };
}

export interface X402SupportedResponse {
  kinds: X402SupportedKind[];
  extensions: unknown[];
  signers: Record<string, string[]>;
}

export interface X402VerifyBody {
  x402Version: 2;
  paymentPayload: X402PaymentPayload;
  paymentRequirements: X402PaymentRequirements;
}

export interface X402VerifyResult {
  isValid: boolean;
  payer?: string;
  invalidReason?: string;
  invalidMessage?: string;
  extensions?: unknown;
  extra?: Record<string, unknown>;
}

export interface X402SettlementResult {
  success: boolean;
  /** Network-native tx id: "0.0.<feePayer>@<seconds>.<nanos>" on Hedera. */
  transaction: string;
  network: string;
  payer?: string;
  amount?: string;
  errorReason?: string;
  errorMessage?: string;
}

export interface X402FacilitatorHealth {
  status: string;
  timestamp: string;
  version: string;
}

export type X402FacilitatorMode = "real" | "mock";

/* ------------------------------------------------------------------ */
/* Transport helpers (x402 transport spec)                             */
/* ------------------------------------------------------------------ */

/** Encode a payment payload for the `X-PAYMENT` header (base64 JSON). */
export function toXPaymentHeader(payload: X402PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/** Decode an `X-PAYMENT` header value. Returns null on garbage. */
export function fromXPaymentHeader(header: string): X402PaymentPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as X402PaymentPayload;
    if (parsed && parsed.x402Version === 2 && parsed.payload?.transaction) return parsed;
    return null;
  } catch {
    return null;
  }
}