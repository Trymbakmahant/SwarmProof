import type { AgentRole, Finding, Severity } from "@swarmproof/agents";

export interface EvidenceItem {
  agentRole: AgentRole;
  /** Plugin id when the evidence came from a third-party agent (plugin ecosystem). */
  agentId?: string;
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

/* ------------------------------------------------------------------ */
/* Normalization & clustering                                          */
/* ------------------------------------------------------------------ */

/** One specialist's raw output, keyed by agent. */
export interface RawFinding {
  agentId: string;
  finding: Finding;
}

/** Normalized finding: dedup key + merged info across agents. */
export interface NormalizedFinding {
  key: string; // cluster identity: normalizedCategory + function-scope location
  category: string;
  severity: Severity;
  locations: string[];
  agents: string[];
  snippets: string[];
  finding: Finding;
}

/** Canonical vulnerability category normalization across heterogeneous agent vocabularies. */
export function canonicalCategory(category: string, title?: string, detail?: string): string {
  const text = `${category} ${title ?? ""} ${detail ?? ""}`.toLowerCase();
  if (/reentranc|checks-effects|cei-violation/i.test(text)) return "reentrancy";
  if (/access.?control|auth|unauthorized|onlyowner|tx\.origin|privilege/i.test(text)) return "access-control";
  if (/business.?logic|accounting|input.?validation|precision/i.test(text)) return "business-logic";
  if (/oracle|price|flash.?loan|slippage|mev|sandwich/i.test(text)) return "economic";
  if (/delegatecall/i.test(text)) return "delegatecall";
  if (/selfdestruct|suicide/i.test(text)) return "selfdestruct";
  return category.toLowerCase().trim();
}

/** Extract a stable function/contract scope from a location string. */
export function locationScope(loc: string): string {
  const fn =
    /function\s+([A-Za-z0-9_]+)/i.exec(loc)?.[1] ??
    /([A-Za-z0-9_]+)\s+function/i.exec(loc)?.[1] ??
    /([A-Za-z0-9_]+)\s*\(/i.exec(loc)?.[1];
  const contract = /contract\s+([A-Za-z0-9_]+)/i.exec(loc)?.[1];
  if (fn) return fn;
  if (contract) return contract;
  return "contract";
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

/**
 * Normalize raw specialist findings into a per-key map, merging evidence
 * from every independent agent that reported an equivalent finding.
 */
export function normalizeFindings(raw: RawFinding[]): NormalizedFinding[] {
  const map = new Map<string, NormalizedFinding>();
  for (const { agentId, finding } of raw) {
    const category = canonicalCategory(finding.category, finding.title);
    const scope = locationScope(finding.location);
    const key = `${category}::${scope}`;
    let norm = map.get(key);
    if (!norm) {
      norm = {
        key,
        category,
        severity: finding.severity,
        locations: [finding.location],
        agents: [],
        snippets: [],
        finding: { ...finding, id: key, category, evidence: [] },
      };
      map.set(key, norm);
    }
    norm.agents.push(agentId);
    norm.locations.push(finding.location);
    norm.snippets.push(finding.evidence.join(" | "));
    norm.finding.evidence.push(...finding.evidence);
    if (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[norm.severity]) {
      norm.severity = finding.severity;
      norm.finding.severity = finding.severity;
    }
  }
  return [...map.values()];
}

/** Alias kept for naming symmetry with the spec. */
export const clusterFindings = normalizeFindings;

/** Build consensus candidates from normalized findings. */
export function toConsensusCandidates(
  normalized: NormalizedFinding[],
  overrides?: Record<string, { confidence: number; artifactWeight: number }>,
): Array<{ finding: Finding; evidence: EvidenceItem[] }> {
  return normalized.map((n) => ({
    finding: n.finding,
    evidence: n.agents.map((agentId) => {
      const o = overrides?.[agentId] ?? { confidence: 0.75, artifactWeight: 1 };
      return { agentRole: "analyzer" as const, agentId, confidence: o.confidence, artifactWeight: o.artifactWeight };
    }),
  }));
}

function itemWeight(e: EvidenceItem, roleWeights: Record<string, number> | undefined): number {
  // Plugin-specific weight (by agentId) wins; else built-in role weight.
  return roleWeights?.[e.agentId ?? e.agentRole] ?? ROLE_WEIGHTS[e.agentRole];
}

/**
 * Weighted consensus over findings. Pure function.
 * score = Σ(roleWeight * confidence * artifactWeight); accepted if score >= minScore,
 * quorum met, and not explicitly rejected by an exploiter.
 * `roleWeights` (e.g. from an AgentRegistry.weights()) lets plugin agents
 * weight their opinion differently than the built-in role default.
 */
export function reachConsensus(
  runId: string,
  candidates: Array<{ finding: Finding; evidence: EvidenceItem[] }>,
  config: ConsensusConfig = DEFAULT_CONFIG,
  roleWeights?: Record<string, number>,
): ConsensusReport {
  const weighted: WeightedFinding[] = candidates.map((c) => {
    const exploiterRejected = c.evidence.some(
      (e) => e.agentRole === "exploiter" && e.artifactWeight === 0,
    );
    const score = c.evidence.reduce(
      (sum, e) => sum + itemWeight(e, roleWeights) * e.confidence * (e.artifactWeight || 1),
      0,
    );
    const quorumMet = new Set(c.evidence.map((e) => e.agentId ?? e.agentRole)).size >= config.quorum;
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