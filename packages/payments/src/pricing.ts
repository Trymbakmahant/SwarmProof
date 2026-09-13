/**
 * Dynamic x402 Pricing & Complexity Sizing Engine for SwarmProof Audits.
 *
 * Calculates contract complexity (SLOC, function count, external calls),
 * selects or applies an audit tier (quick, standard, deep, high-assurance),
 * and generates transparent quotes with breakdown of agent payouts,
 * exploit verification sandbox rewards, and protocol fees.
 */

export const DEFAULT_TINYBARS_PER_USD = "100000000"; // 100M tinybars = 1 HBAR = $1.00 USD nominal
export const MIN_BOUNTY_USD = 0.50; // Minimum bounty floor to guarantee specialist incentives
export const HEDERA_FAUCET_URL = "https://portal.hedera.com/dashboard";

export type AuditTier = "quick" | "standard" | "deep" | "high-assurance";

export interface ComplexityMetrics {
  sloc: number;
  functions: number;
  externalCalls: number;
  hasPayable: boolean;
  hasDelegateCall: boolean;
  score: number;
}

export interface PricingQuote {
  tier: AuditTier;
  amountUSD: string;
  totalUSD: number;
  amountTinybars: number;
  amountHbar: string;
  rateTinybarsPerUSD: number;
  complexity: ComplexityMetrics;
  breakdown: {
    specialistPoolPercent: number;
    specialistPoolTinybars: number;
    specialistPoolUSD: string;
    verificationRewardPercent: number;
    verificationRewardTinybars: number;
    verificationRewardUSD: string;
    protocolFeePercent: number;
    protocolFeeTinybars: number;
    protocolFeeUSD: string;
  };
  recommendedRoles: string[];
  faucetNotice: string;
  faucetUrl: string;
}

/** Format tinybars cleanly to HBAR string with up to 4 decimal places, avoiding 0.0 HBAR truncations. */
export function formatTinybarsToHbar(tinybars: number | bigint | string): string {
  const num = typeof tinybars === "bigint" ? Number(tinybars) : Number(tinybars || 0);
  const hbar = num / 100_000_000;
  if (hbar === 0) return "0.00 ℏ";
  if (hbar >= 1 && hbar % 1 === 0) return `${hbar.toFixed(2)} ℏ`;
  if (hbar < 0.01) return `${hbar.toFixed(4)} ℏ`;
  return `${hbar.toFixed(2)} ℏ`;
}

/** Analyze Solidity source code for sizing & complexity factors. */
export function analyzeSolidityComplexity(source: string): ComplexityMetrics {
  const lines = source.split("\n");
  let sloc = 0;
  let inBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    if (line.startsWith("/*")) {
      if (!line.includes("*/")) inBlockComment = true;
      continue;
    }
    if (line.startsWith("//")) continue;
    sloc++;
  }

  const functions = (source.match(/function\s+[a-zA-Z0-9_]+\s*\(/g) || []).length;
  const externalCalls = (source.match(/\.call|\.delegatecall|\.transfer|\.send/g) || []).length;
  const hasPayable = /payable/g.test(source);
  const hasDelegateCall = /\.delegatecall/g.test(source);

  // Complexity score out of 100
  let score = Math.min(100, Math.round(
    (sloc * 0.4) +
    (functions * 4) +
    (externalCalls * 10) +
    (hasDelegateCall ? 20 : 0) +
    (hasPayable ? 10 : 0)
  ));
  if (score < 10) score = 10;

  return {
    sloc,
    functions,
    externalCalls,
    hasPayable,
    hasDelegateCall,
    score,
  };
}

/**
 * Calculate dynamic pricing quote for a contract audit.
 */
export function calculateAuditQuote(opts: {
  source?: string;
  tier?: AuditTier;
  totalUSD?: string | number;
  tinybarsPerUSD?: string | number;
}): PricingQuote {
  const rate = Number(opts.tinybarsPerUSD) || Number(DEFAULT_TINYBARS_PER_USD);
  const complexity = opts.source ? analyzeSolidityComplexity(opts.source) : {
    sloc: 50,
    functions: 2,
    externalCalls: 1,
    hasPayable: false,
    hasDelegateCall: false,
    score: 25,
  };

  // Determine Tier if not explicitly set
  let tier: AuditTier = opts.tier ?? "standard";
  if (!opts.tier && opts.source) {
    if (complexity.score > 60 || complexity.sloc > 250) {
      tier = "high-assurance";
    } else if (complexity.score > 30 || complexity.sloc > 80) {
      tier = "deep";
    } else {
      tier = "standard";
    }
  }

  // Base pricing per tier
  const tierBountiesUSD: Record<AuditTier, number> = {
    quick: 1.00,
    standard: 1.00,
    deep: 2.00,
    "high-assurance": 5.00,
  };

  let totalUSD = tierBountiesUSD[tier];

  // If caller requested a custom totalUSD, respect it if above minimum floor
  if (opts.totalUSD !== undefined && opts.totalUSD !== null && opts.totalUSD !== "") {
    const custom = typeof opts.totalUSD === "number" ? opts.totalUSD : parseFloat(opts.totalUSD);
    if (!isNaN(custom) && custom > 0) {
      totalUSD = Math.max(MIN_BOUNTY_USD, custom);
    }
  }

  const totalTinybars = Math.round(totalUSD * rate);

  // Breakdown percentages: 80% specialist pool, 10% verification PoC, 10% protocol fee
  const specialistPoolPercent = 80;
  const verificationRewardPercent = 10;
  const protocolFeePercent = 10;

  const specialistPoolTinybars = Math.round(totalTinybars * 0.80);
  const verificationRewardTinybars = Math.round(totalTinybars * 0.10);
  const protocolFeeTinybars = totalTinybars - specialistPoolTinybars - verificationRewardTinybars;

  const recommendedRoles = [
    "reentrancy",
    "access-control",
    "static-analysis",
    "business-logic",
    "economic-oracle",
  ];

  return {
    tier,
    amountUSD: `$${totalUSD.toFixed(2)} USD`,
    totalUSD,
    amountTinybars: totalTinybars,
    amountHbar: formatTinybarsToHbar(totalTinybars),
    rateTinybarsPerUSD: rate,
    complexity,
    breakdown: {
      specialistPoolPercent,
      specialistPoolTinybars,
      specialistPoolUSD: `$${(totalUSD * 0.80).toFixed(2)}`,
      verificationRewardPercent,
      verificationRewardTinybars,
      verificationRewardUSD: `$${(totalUSD * 0.10).toFixed(2)}`,
      protocolFeePercent,
      protocolFeeTinybars,
      protocolFeeUSD: `$${(totalUSD * 0.10).toFixed(2)}`,
    },
    recommendedRoles,
    faucetNotice: `Need testnet HBAR? Fund your Hedera testnet account with 100 free test HBAR at ${HEDERA_FAUCET_URL}`,
    faucetUrl: HEDERA_FAUCET_URL,
  };
}
