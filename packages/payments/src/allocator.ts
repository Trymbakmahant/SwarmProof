import type { PaymentRecipient, RecipientShare } from "./types.js";

export type AllocationErrorCode =
  | "EMPTY_RECIPIENTS"
  | "DUPLICATE_AGENT"
  | "INVALID_ADDRESS"
  | "ZERO_AMOUNT"
  | "SHARES_DONT_SUM"
  | "UNDERPAYMENT"
  | "OVERPAYMENT"
  | "INVALID_TOTAL";

export class AllocationError extends Error {
  readonly code: AllocationErrorCode;
  constructor(code: AllocationErrorCode, message: string) {
    super(message);
    this.name = "AllocationError";
    this.code = code;
  }
}

const AMOUNT_RE = /^\d+(\.\d+)?$/;

/** Parse a decimal money string into integer cents (BigInt-safe). */
export function toCents(amount: string): bigint {
  if (!AMOUNT_RE.test(amount)) throw new AllocationError("INVALID_TOTAL", `invalid amount: ${amount}`);
  const [whole = "0", frac = ""] = amount.split(".");
  return BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
}

export function fromCents(cents: bigint): string {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
const HEDERA_ACCOUNT_RE = /^(0|(?:[1-9]\d*))\.(0|(?:[1-9]\d*))\.(0|(?:[1-9]\d*))$/;

export function isValidPaymentAddress(address: string): boolean {
  return EVM_RE.test(address) || HEDERA_ACCOUNT_RE.test(address);
}

/**
 * Distribute a total across recipients by share.
 * Validates: non-empty, unique agents, valid addresses, positive amounts,
 * shares sum to 1 (within rounding), and the sum of parts equals the total.
 */
export function allocateShares(
  total: string,
  shares: RecipientShare[],
): { recipients: PaymentRecipient[]; checks: string[] } {
  const checks: string[] = [];
  if (shares.length === 0) throw new AllocationError("EMPTY_RECIPIENTS", "no recipients configured");
  const totalCents = toCents(total);
  if (totalCents <= 0n) throw new AllocationError("INVALID_TOTAL", `total must be > 0, got ${total}`);

  const seen = new Set<string>();
  for (const s of shares) {
    if (seen.has(s.agentId)) throw new AllocationError("DUPLICATE_AGENT", `duplicate recipient agent: ${s.agentId}`);
    seen.add(s.agentId);
    if (!isValidPaymentAddress(s.address)) throw new AllocationError("INVALID_ADDRESS", `invalid payment address for ${s.agentId}: ${s.address}`);
    if (s.share <= 0) throw new AllocationError("ZERO_AMOUNT", `share for ${s.agentId} must be > 0`);
  }

  const shareSum = shares.reduce((a, s) => a + s.share, 0);
  if (Math.abs(shareSum - 1) > 1e-9) {
    throw new AllocationError("SHARES_DONT_SUM", `shares sum to ${shareSum}, expected 1`);
  }

  // Proportional split in cents; give any rounding remainder to the last recipient.
  const cents = shares.map((s) => totalCents * BigInt(Math.round(s.share * 10000)) / 10000n);
  const assigned = cents.reduce((a, b) => a + b, 0n);
  const diff = totalCents - assigned;
  if (cents.length > 0) cents[cents.length - 1] = (cents[cents.length - 1] ?? 0n) + diff;

  const recipients: PaymentRecipient[] = shares.map((s, i) => ({
    agentId: s.agentId,
    address: s.address,
    amount: fromCents(cents[i] ?? 0n),
  }));

  const paid = recipients.reduce((a, r) => a + toCents(r.amount), 0n);
  if (paid < totalCents) throw new AllocationError("UNDERPAYMENT", `allocated ${paid} < total ${totalCents}`);
  if (paid > totalCents) throw new AllocationError("OVERPAYMENT", `allocated ${paid} > total ${totalCents}`);

  checks.push(`sum of shares = 1 (1e-9)`);
  checks.push(`intra-accounting: ${fromCents(paid)} == ${total}`);
  return { recipients, checks };
}