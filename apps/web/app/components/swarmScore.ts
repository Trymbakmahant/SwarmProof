export interface SwarmScoreFactor {
  name: string;
  category: "reentrancy" | "access-control" | "business-logic" | "economic" | "static-analysis" | "quorum";
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "POSITIVE";
  points: number; // e.g. -45, +5
  status: "PASSED" | "VIOLATED" | "WARNED";
  description: string;
}

export interface SwarmScoreResult {
  score: number; // 0 to 100
  tier: "PRIME_AAA" | "GOOD_AA" | "FAIR_B" | "CRITICAL_D";
  label: string;
  grade: string;
  color: string;
  bgLight: string;
  borderColor: string;
  summary: string;
  factors: SwarmScoreFactor[];
  percentile: number; // 0 to 100
}

export interface AgentReputationScore {
  agentId: string;
  name: string;
  role: string;
  reputationScore: number; // 0 to 100
  tier: "ELITE_SENTINEL" | "MASTER_AUDITOR" | "VERIFIED_SENTINEL" | "ROOKIE";
  tierColor: string;
  accuracyRate: number; // e.g. 99.2%
  totalAudits: number;
  acceptedFindings: number;
  disputedFindings: number;
  falsePositivePenalty: number;
  totalEarningsTinybars: number;
  totalEarningsUSD: string;
  hederaVerified: boolean;
  did: string;
  specialty: string;
}

/**
 * Calculates the SwarmProof Security Score (0 - 100) for a smart contract
 * based on consensus findings, severity, and verification reproduction.
 */
export function calculateContractSwarmScore(params: {
  findings?: Array<{ category: string; severity: string; id?: string; title?: string }>;
  verified?: boolean;
  consensusSummary?: string;
}): SwarmScoreResult {
  const findings = params.findings ?? [];
  let score = 95; // Starting baseline for a clean, unviolated contract

  const factors: SwarmScoreFactor[] = [];

  // Check 1: Reentrancy & CEI Violations (High Severity Penalty)
  const reentrancyFindings = findings.filter(
    (f) =>
      f.category.toLowerCase().includes("reentrancy") ||
      (f.title && f.title.toLowerCase().includes("reentrancy"))
  );
  if (reentrancyFindings.length > 0) {
    const penalty = -45;
    score += penalty;
    factors.push({
      name: "Checks-Effects-Interactions (CEI)",
      category: "reentrancy",
      impact: "CRITICAL",
      points: penalty,
      status: "VIOLATED",
      description: "State update occurs after external call. Contract susceptible to fund-draining reentrancy.",
    });
  } else {
    factors.push({
      name: "Checks-Effects-Interactions (CEI)",
      category: "reentrancy",
      impact: "POSITIVE",
      points: +3,
      status: "PASSED",
      description: "No CEI or reentrancy paths found in call-graph analysis.",
    });
  }

  // Check 2: Access Control & Authorization
  const accessFindings = findings.filter(
    (f) =>
      f.category.toLowerCase().includes("access") ||
      (f.title && f.title.toLowerCase().includes("access"))
  );
  if (accessFindings.length > 0) {
    const penalty = -30;
    score += penalty;
    factors.push({
      name: "Access Control & Authorization",
      category: "access-control",
      impact: "HIGH",
      points: penalty,
      status: "VIOLATED",
      description: "Privileged action missing authentication modifier or vulnerable to tx.origin phishing.",
    });
  } else {
    factors.push({
      name: "Access Control & Authorization",
      category: "access-control",
      impact: "POSITIVE",
      points: +2,
      status: "PASSED",
      description: "Authorization modifiers and caller validation conform to security standards.",
    });
  }

  // Check 3: Business Logic & Limits
  const logicFindings = findings.filter(
    (f) =>
      f.category.toLowerCase().includes("business") ||
      f.category.toLowerCase().includes("logic") ||
      (f.title && f.title.toLowerCase().includes("logic"))
  );
  if (logicFindings.length > 0) {
    const penalty = -15;
    score += penalty;
    factors.push({
      name: "Business Logic & Value Bounds",
      category: "business-logic",
      impact: "MEDIUM",
      points: penalty,
      status: "WARNED",
      description: "Unbounded balance decrement or missing zero-amount boundary checks.",
    });
  } else {
    factors.push({
      name: "Business Logic & Value Bounds",
      category: "business-logic",
      impact: "POSITIVE",
      points: +2,
      status: "PASSED",
      description: "State transition invariants and input boundary checks validated.",
    });
  }

  // Check 4: Economic & Oracle Exposure
  const economicFindings = findings.filter(
    (f) =>
      f.category.toLowerCase().includes("economic") ||
      (f.title && f.title.toLowerCase().includes("oracle"))
  );
  if (economicFindings.length > 0) {
    const penalty = -15;
    score += penalty;
    factors.push({
      name: "Economic & Flash Loan Resilience",
      category: "economic",
      impact: "HIGH",
      points: penalty,
      status: "VIOLATED",
      description: "Unshielded spot price oracle reads or single-block flash loan vulnerability.",
    });
  } else {
    factors.push({
      name: "Economic & Flash Loan Resilience",
      category: "economic",
      impact: "POSITIVE",
      points: +2,
      status: "PASSED",
      description: "No unprotected AMM spot price queries or flash-mint hazards detected.",
    });
  }

  // Check 5: Quorum Corroboration Factor
  if (findings.length === 0) {
    score += 5;
    factors.push({
      name: "Consensus Quorum Corroboration",
      category: "quorum",
      impact: "POSITIVE",
      points: +5,
      status: "PASSED",
      description: "All 5 specialist agents independently concurred with zero disputed vulnerabilities.",
    });
  } else {
    factors.push({
      name: "Consensus Quorum Corroboration",
      category: "quorum",
      impact: "POSITIVE",
      points: +3,
      status: "PASSED",
      description: "Vulnerabilities verified across weighted multi-agent consensus topic on Hedera HCS.",
    });
  }

  // Clamp score strictly between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Determine Tiers (0 - 100 Scale)
  let tier: SwarmScoreResult["tier"];
  let label: string;
  let grade: string;
  let color: string;
  let bgLight: string;
  let borderColor: string;
  let summary: string;

  if (score >= 90) {
    tier = "PRIME_AAA";
    label = "Prime Institutional Grade";
    grade = "AAA";
    color = "#10b981"; // Emerald
    bgLight = "#ecfdf5";
    borderColor = "#a7f3d0";
    summary = "Exemplary security posture. Zero critical or high-risk vulnerabilities verified across all specialists.";
  } else if (score >= 75) {
    tier = "GOOD_AA";
    label = "Low Risk / Audited Grade";
    grade = "AA";
    color = "#0284c7"; // Sky Blue
    bgLight = "#f0f9ff";
    borderColor = "#bae6fd";
    summary = "Solid architecture with minor informational or gas observations. No immediate solvency risk.";
  } else if (score >= 50) {
    tier = "FAIR_B";
    label = "Moderate Risk / Caution";
    grade = "B";
    color = "#d97706"; // Amber
    bgLight = "#fffbeb";
    borderColor = "#fde68a";
    summary = "Elevated risk profile. Potential accounting or input boundary vulnerabilities require manual patching.";
  } else {
    tier = "CRITICAL_D";
    label = "Critical Hazard / High Risk";
    grade = "D";
    color = "#dc2626"; // Red
    bgLight = "#fef2f2";
    borderColor = "#fecaca";
    summary = "Critical security flaw detected (e.g. Reentrancy or Access Control drain). High probability of protocol exploit.";
  }

  return {
    score,
    tier,
    label,
    grade,
    color,
    bgLight,
    borderColor,
    summary,
    factors,
    percentile: score,
  };
}

/**
 * Standard simulated & live leaderboard data for all SwarmProof agents (0 - 100 scale)
 */
export const MOCK_AGENT_LEADERBOARD: AgentReputationScore[] = [
  {
    agentId: "verification-agent",
    name: "Tool Verification Oracle",
    role: "Deterministic PoC Reproducer",
    reputationScore: 98,
    tier: "ELITE_SENTINEL",
    tierColor: "#10b981",
    accuracyRate: 100.0,
    totalAudits: 148,
    acceptedFindings: 140,
    disputedFindings: 0,
    falsePositivePenalty: 0,
    totalEarningsTinybars: 22200000,
    totalEarningsUSD: "22.20",
    hederaVerified: true,
    did: "did:hedera:testnet:0.0.10417469_verification-agent",
    specialty: "Automated exploit test execution, Sandbox reproduction, Bytecode diffing",
  },
  {
    agentId: "reentrancy-agent",
    name: "Reentrancy Sentinel",
    role: "CEI & Call-Graph Specialist",
    reputationScore: 96,
    tier: "ELITE_SENTINEL",
    tierColor: "#10b981",
    accuracyRate: 99.2,
    totalAudits: 148,
    acceptedFindings: 132,
    disputedFindings: 2,
    falsePositivePenalty: -1,
    totalEarningsTinybars: 22200000, // 22.2 HBAR
    totalEarningsUSD: "22.20",
    hederaVerified: true,
    did: "did:hedera:testnet:0.0.10417469_reentrancy-agent",
    specialty: "Checks-Effects-Interactions, Cross-Function Reentrancy, ERC-777 callbacks",
  },
  {
    agentId: "static-agent",
    name: "Static Code Guard",
    role: "Cross-Signal & Slither Specialist",
    reputationScore: 93,
    tier: "ELITE_SENTINEL",
    tierColor: "#10b981",
    accuracyRate: 98.6,
    totalAudits: 148,
    acceptedFindings: 118,
    disputedFindings: 4,
    falsePositivePenalty: -2,
    totalEarningsTinybars: 22200000,
    totalEarningsUSD: "22.20",
    hederaVerified: true,
    did: "did:hedera:testnet:0.0.10417469_static-agent",
    specialty: "Low-level calls, Unchecked arithmetic, Assembly memory bounds",
  },
  {
    agentId: "access-control-agent",
    name: "Access Control Warden",
    role: "Authorization & Privileges Specialist",
    reputationScore: 89,
    tier: "MASTER_AUDITOR",
    tierColor: "#0284c7",
    accuracyRate: 97.4,
    totalAudits: 148,
    acceptedFindings: 94,
    disputedFindings: 6,
    falsePositivePenalty: -3,
    totalEarningsTinybars: 22200000,
    totalEarningsUSD: "22.20",
    hederaVerified: true,
    did: "did:hedera:testnet:0.0.10417469_access-control-agent",
    specialty: "tx.origin phishing, Uninitialized proxies, Missing onlyOwner modifiers",
  },
  {
    agentId: "business-logic-agent",
    name: "Logic & Invariant Auditor",
    role: "Accounting & State Integrity Specialist",
    reputationScore: 85,
    tier: "MASTER_AUDITOR",
    tierColor: "#0284c7",
    accuracyRate: 95.8,
    totalAudits: 148,
    acceptedFindings: 87,
    disputedFindings: 9,
    falsePositivePenalty: -4,
    totalEarningsTinybars: 22200000,
    totalEarningsUSD: "22.20",
    hederaVerified: true,
    did: "did:hedera:testnet:0.0.10417469_business-logic-agent",
    specialty: "Token rounding mismatch, Zero-amount validation, Array DOS",
  },
  {
    agentId: "economic-agent",
    name: "MEV & Oracle Watcher",
    role: "Financial & Market Exploits Specialist",
    reputationScore: 81,
    tier: "VERIFIED_SENTINEL",
    tierColor: "#8b5cf6",
    accuracyRate: 94.1,
    totalAudits: 148,
    acceptedFindings: 68,
    disputedFindings: 11,
    falsePositivePenalty: -5,
    totalEarningsTinybars: 22200000,
    totalEarningsUSD: "22.20",
    hederaVerified: true,
    did: "did:hedera:testnet:0.0.10417469_economic-agent",
    specialty: "Spot price manipulation, Flash loans, Slippage frontrunning",
  },
];
