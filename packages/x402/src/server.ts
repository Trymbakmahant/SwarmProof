import type { X402FacilitatorClient } from "./facilitator.js";
import { covers, usdToTinybars } from "./money.js";
import type { X402PaymentPayload, X402PaymentRequirements } from "./types.js";
import { fromXPaymentHeader } from "./types.js";

/**
 * X402Server — service-side helpers for gating a route with x402.
 *
 * The pattern (used by apps/api):
 *   1. gated endpoint responds 402 with `WWW-Authenticate: X402 resource="…"`.
 *   2. GET that resource with `Accept: application/x402+json` returns the
 *      payment requirement (quote).
 *   3. client pays/settles via the facilitator and replays with `X-PAYMENT`.
 *   4. `acceptPayment()` verifies the payload against the facilitator and
 *      enforces amount / payTo / network / asset / expiry server-side.
 */

/** A decision about a presented payment. */
export interface X402AcceptResult {
  ok: boolean;
  status: "paid" | "invalid" | "expired" | "mismatch";
  payer?: string;
  payload?: X402PaymentPayload;
  reason?: string;
  /** Payer id or tx reference for the application ledger. */
  reference?: string;
}

export interface X402GateChecks {
  expectedNetwork?: string;
  expectedPayTo?: string;
  expectedAsset?: string;
  /** Minimum acceptable amount in asset units (tinybars). */
  minAmount?: string;
  expectedService?: string;
  expectedAuditId?: string;
}

/** Build the standard 402 challenge headers. */
export function x402ChallengeHeaders(resourceUrl: string): Record<string, string> {
  return { "www-authenticate": `X402 resource="${resourceUrl}"` };
}

/** Read the x402 resource URL from a request's WWW-Authenticate header. */
export function x402ChallengeResource(wwwAuthenticate: string | undefined): string | undefined {
  if (!wwwAuthenticate) return undefined;
  const m = /X402\s+resource="([^"]+)"/.exec(wwwAuthenticate);
  return m?.[1];
}

/** Read the signed payment payload from X-PAYMENT (spec) / PAYMENT-SIGNATURE (Hedera PoC alias). */
export function parseXPpaymentHeaders(headers: Record<string, string | undefined>): X402PaymentPayload | null {
  for (const name of ["x-payment", "payment-signature"]) {
    const raw = headers[name] ?? headers[name.toLowerCase()];
    if (!raw) continue;
    const payload = fromXPaymentHeader(raw);
    if (payload) return payload;
  }
  return null;
}

/** True when the quote has not lapsed. */
export function isExpired(requirements: X402PaymentRequirements, now = Date.now()): boolean {
  const expiresAt = requirements.extra?.expiresAt;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < now;
}

/**
 * Verify a presented payment:
 *   - facilitator signature check (/verify),
 *   - server-side consistency vs the original quote (amount/payTo/network/asset),
 *   - expiry.
 */
export async function acceptPayment(
  facilitator: X402FacilitatorClient,
  payload: X402PaymentPayload,
  expected: X402GateChecks = {},
): Promise<X402AcceptResult> {
  const accepted = payload.accepted;
  if (isExpired(accepted)) return { ok: false, status: "expired", reason: "payment quote expired" };

  if (expected.expectedAuditId && accepted.extra?.auditId !== expected.expectedAuditId) {
    return { ok: false, status: "mismatch", reason: `payment is for audit ${accepted.extra?.auditId ?? "?"}, expected ${expected.expectedAuditId}` };
  }
  if (expected.expectedNetwork && accepted.network !== expected.expectedNetwork) {
    return { ok: false, status: "mismatch", reason: `network ${accepted.network} != ${expected.expectedNetwork}` };
  }
  if (expected.expectedAsset && accepted.asset !== expected.expectedAsset) {
    return { ok: false, status: "mismatch", reason: `asset ${accepted.asset} != ${expected.expectedAsset}` };
  }
  if (expected.expectedPayTo && accepted.payTo !== expected.expectedPayTo) {
    return { ok: false, status: "mismatch", reason: `recipient ${accepted.payTo} != ${expected.expectedPayTo}` };
  }
  if (expected.minAmount && !covers(expected.minAmount, accepted.amount)) {
    return { ok: false, status: "mismatch", reason: `amount ${accepted.amount} < ${expected.minAmount}` };
  }

  const verification = await facilitator.verify(payload, accepted);
  if (!verification.isValid) {
    return { ok: false, status: "invalid", reason: verification.invalidMessage ?? verification.invalidReason ?? "facilitator rejected payment" };
  }

  return { ok: true, status: "paid", payer: verification.payer, payload, reference: verification.payer };
}

export { covers, fromXPaymentHeader, usdToTinybars };
export type { X402PaymentPayload, X402PaymentRequirements, X402FacilitatorClient };