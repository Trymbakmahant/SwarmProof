import type { AgentRole, Finding, Severity } from "@swarmproof/agents";

export interface EvidenceItem {
  agentRole: AgentRole;
  confidence: number; // 0..1
  artifactWeight: number; // 0..1 — 1 when tool-reproduced
}

export interface WeightedFinding {
  finding: Finding;
  evidence: EvidenceItem[];
  score: number;
  verdict: "accepted" | "rejected" | "disputed";
  confidence: number;
}

export interface ConsensusReport {
  runId: string;
  findings: WeightedFinding[];
  disputes: WeightedFinding[];
  confidenceMap: Record<string, number>;
  summary: string;
}

export const ROLE_WEIGHTS: Record<AgentRole, number> = {
  analyzer: 0.3,
  exploiter: 0.35,
  verifier: 1.0, // tool-reproduced evidence dominates
  judge: 0.4,
};

export interface ConsensusConfig {
  minScore: number; // acceptance threshold
  quorum: number; // min distinct agents supporting
  disputeEscalation: boolean;
}

export const DEFAULT_CONFIG: ConsensusConfig = {
  minScore: 0.6,
  quorum: 2,
  disputeEscalation: true,
};

export function isDeemedCritical(severity: Severity): boolean {
  return severity === "critical" || severity === "high";
}

/**
 * Weighted consensus over findings. Pure function.
 * score = Σ(roleWeight * confidence * artifactWeight); accepted if score >= minScore,
 * quorum met, and not explicitly rejected by an exploiter.
 */
export function reachConsensus(
  runId: string,
  candidates: Array<{ finding: Finding; evidence: EvidenceItem[] }>,
  config: ConsensusConfig = DEFAULT_CONFIG,
): ConsensusReport {
  const weighted: WeightedFinding[] = candidates.map((c) => {
    const exploiterRejected = c.evidence.some(
      (e) => e.agentRole === "exploiter" && e.artifactWeight === 0,
    );
    const score = c.evidence.reduce(
      (sum, e) => sum + ROLE_WEIGHTS[e.agentRole] * e.confidence * (e.artifactWeight || 1),
      0,
    );
    const quorumMet = new Set(c.evidence.map((e) => e.agentRole)).size >= config.quorum;
    const disputed = isDeemedCritical(c.finding.severity) && !quorumMet;
    const verdict: WeightedFinding["verdict"] = exploiterRejected
      ? "rejected"
      : disputed
        ? "disputed"
        : score >= config.minScore && quorumMet
          ? "accepted"
          : "rejected";

    const confidence = Math.min(1, score / config.minScore);
    return { finding: c.finding, evidence: c.evidence, score, verdict, confidence };
  });

  const accepted = weighted.filter((w) => w.verdict === "accepted");
  const disputes = weighted.filter((w) => w.verdict === "disputed");
  const confidenceMap = Object.fromEntries(weighted.map((w) => [w.finding.id, w.confidence]));

  return {
    runId,
    findings: accepted,
    disputes,
    confidenceMap,
    summary: `${accepted.length} accepted, ${disputes.length} disputed, ${weighted.length - accepted.length - disputes.length} rejected`,
  };
}