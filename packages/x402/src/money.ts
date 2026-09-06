/**
 * Tiny money math for x402 quotes (no floating point anywhere).
 *
 * SwarmProof prices audits in USD for display; the x402 quote must carry
 * smallest-units of the settled asset. HBAR has 8 decimals (tinybars).
 * We convert USD -> tinybars with an env-driven rate (testnet has no real
 * value, so the default rate keeps the demo legible: 1 USD -> 1,000,000
 * tinybars = 0.01 HBAR).
 */

const MICROS = 1_000_000n; // 1 USD = 1e6 micro-dollars (6 decimals)

const DECIMAL_RE = /^(-?)(\d+)(?:\.(\d+))?$/;

/** "1.00" or "-0.5" -> integer micro-dollars. */
export function usdToMicros(value: string): bigint {
  const m = DECIMAL_RE.exec(value.trim());
  if (!m) throw new Error(`usdToMicros: not a decimal number: ${value}`);
  let micros = BigInt(m[2] ?? "0") * MICROS;
  const frac = (m[3] ?? "").padEnd(6, "0").slice(0, 6);
  micros += BigInt(frac.length ? frac : "0");
  return m[1] === "-" ? -micros : micros;
}

/** Integer micro-dollars -> decimal string ("1.00"). */
export function microsToUsd(micros: bigint): string {
  const neg = micros < 0n;
  const abs = neg ? -micros : micros;
  const whole = abs / MICROS;
  const frac = (abs % MICROS).toString().padStart(6, "0");
  const trimmed = frac.replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${trimmed ? "." + trimmed : ""}`;
}

export interface MoneyRate {
  /** tinybars per 1 USD (e.g. "1000000"). */
  tinybarsPerUSD: string;
}

/** USD decimal string -> tinybars (integer). Extra micros rounding is discarded. */
export function usdToTinybars(usd: string, rate: string): string {
  const tiny = (usdToMicros(usd) * BigInt(rate)) / MICROS;
  return tiny.toString();
}

/** tinybars -> USD decimal string (display only). */
export function tinybarsToUsd(tinybars: string, rate: string): string {
  const micros = (BigInt(tinybars) * MICROS) / BigInt(rate);
  return microsToUsd(micros);
}

/** true when `paid` covers `required` (both integer tinybars). */
export function covers(required: string, paid: string): boolean {
  return BigInt(paid) >= BigInt(required);
}