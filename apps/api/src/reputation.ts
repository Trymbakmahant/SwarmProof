import type { Finding } from "@swarmproof/agents";

export interface AgentReputationRecord {
  agentId: string;
  name: string;
  role: string;
  reputationScore: number; // Strictly 0–100 Proof-of-Reputation (PoR)
  tier: "ELITE_SENTINEL" | "MASTER_AUDITOR" | "VERIFIED_SENTINEL" | "PROBATIONARY_AGENT";
  accuracyRate: number; // 0.0 - 100.0%
  totalAudits: number;
  acceptedFindingsCount: number;
  rejectedFindingsCount: number;
  disputedFindingsCount: number;
  totalEarningsUSD: string;
  totalEarningsTinybars: number;
  specialty: string;
  hederaVerified: boolean;
  did: string;
  shape?: string;
  color?: string;
  lastUpdated: string;
}

export function computeTier(score: number): AgentReputationRecord["tier"] {
  if (score >= 95) return "ELITE_SENTINEL";
  if (score >= 85) return "MASTER_AUDITOR";
  if (score >= 70) return "VERIFIED_SENTINEL";
  return "PROBATIONARY_AGENT";
}

export class ReputationEngine {
  private records = new Map<string, AgentReputationRecord>();

  constructor() {
    this.seedBaselineAgents();
  }

  /**
   * Seed the platform's initial specialist quorum with baseline scores
   */
  private seedBaselineAgents(): void {
    const baselines: Array<Partial<AgentReputationRecord> & { agentId: string; name: string; role: string; reputationScore: number }> = [
      {
        agentId: "verification-agent",
        name: "Tool Verification Oracle",
        role: "Deterministic PoC Sandbox",
        reputationScore: 98,
        accuracyRate: 100.0,
        totalAudits: 148,
        acceptedFindingsCount: 290,
        rejectedFindingsCount: 0,
        disputedFindingsCount: 6,
        totalEarningsUSD: "22.20",
        specialty: "Automated exploit test execution & Sandbox PoC reproduction",
        color: "#10b981",
        shape: "octahedron",
      },
      {
        agentId: "reentrancy-agent",
        name: "Reentrancy Sentinel",
        role: "CEI & Call-Graph Specialist",
        reputationScore: 96,
        accuracyRate: 99.2,
        totalAudits: 148,
        acceptedFindingsCount: 265,
        rejectedFindingsCount: 2,
        disputedFindingsCount: 14,
        totalEarningsUSD: "22.20",
        specialty: "Checks-Effects-Interactions & Reentrancy Call-Graph",
        color: "#ec4899",
        shape: "icosahedron",
      },
      {
        agentId: "static-agent",
        name: "Static Code Guard",
        role: "Cross-Signal & Slither Specialist",
        reputationScore: 93,
        accuracyRate: 98.6,
        totalAudits: 148,
        acceptedFindingsCount: 248,
        rejectedFindingsCount: 4,
        disputedFindingsCount: 18,
        totalEarningsUSD: "22.20",
        specialty: "Low-level calls, Unchecked arithmetic, Assembly bounds",
        color: "#06b6d4",
        shape: "octahedron",
      },
      {
        agentId: "access-control-agent",
        name: "Access Control Guardian",
        role: "Privilege & Auth Auditor",
        reputationScore: 89,
        accuracyRate: 97.4,
        totalAudits: 148,
        acceptedFindingsCount: 220,
        rejectedFindingsCount: 6,
        disputedFindingsCount: 22,
        totalEarningsUSD: "22.20",
        specialty: "Privilege escalation, tx.origin, Initializer bypass",
        color: "#3b82f6",
        shape: "torusKnot",
      },
      {
        agentId: "business-logic-agent",
        name: "Business Logic Specialist",
        role: "State Machine & Invariants",
        reputationScore: 85,
        accuracyRate: 95.8,
        totalAudits: 148,
        acceptedFindingsCount: 198,
        rejectedFindingsCount: 9,
        disputedFindingsCount: 25,
        totalEarningsUSD: "22.20",
        specialty: "State invariants, Rounding precision, Input boundaries",
        color: "#8b5cf6",
        shape: "gyroscope",
      },
      {
        agentId: "economic-agent",
        name: "Economic & Oracle Sentinel",
        role: "MEV & Spot Distortion Guard",
        reputationScore: 81,
        accuracyRate: 94.1,
        totalAudits: 148,
        acceptedFindingsCount: 175,
        rejectedFindingsCount: 11,
        disputedFindingsCount: 28,
        totalEarningsUSD: "22.20",
        specialty: "Flash loans, Spot AMM manipulation, Slippage frontrunning",
        color: "#f59e0b",
        shape: "dodecahedron",
      },
    ];

    const now = new Date().toISOString();
    for (const b of baselines) {
      this.records.set(b.agentId, {
        agentId: b.agentId,
        name: b.name,
        role: b.role,
        reputationScore: b.reputationScore,
        tier: computeTier(b.reputationScore),
        accuracyRate: b.accuracyRate ?? 95.0,
        totalAudits: b.totalAudits ?? 148,
        acceptedFindingsCount: b.acceptedFindingsCount ?? 200,
        rejectedFindingsCount: b.rejectedFindingsCount ?? 5,
        disputedFindingsCount: b.disputedFindingsCount ?? 15,
        totalEarningsUSD: b.totalEarningsUSD ?? "22.20",
        totalEarningsTinybars: Math.round(parseFloat(b.totalEarningsUSD ?? "22.20") * 1_000_000),
        specialty: b.specialty ?? b.role,
        hederaVerified: true,
        did: `did:hedera:testnet:0.0.10417469_${b.agentId}`,
        shape: b.shape,
        color: b.color,
        lastUpdated: now,
      });
    }
  }

  /**
   * Register or update a newly qualified agent into the reputation engine
   */
  registerAgent(input: {
    agentId: string;
    name: string;
    role: string;
    benchmarkScore?: number;
    did?: string;
    shape?: string;
    color?: string;
    specialty?: string;
  }): AgentReputationRecord {
    const existing = this.records.get(input.agentId);
    if (existing) {
      if (input.benchmarkScore !== undefined) {
        // Average with current score if re-evaluated
        existing.reputationScore = Math.min(100, Math.max(0, Math.round((existing.reputationScore + input.benchmarkScore) / 2)));
        existing.tier = computeTier(existing.reputationScore);
      }
      existing.lastUpdated = new Date().toISOString();
      return existing;
    }

    // Default reputation score begins at the candidate's benchmark qualification score (e.g. 80-100), or 80 baseline
    const initialScore = input.benchmarkScore ?? 80;
    const boundedScore = Math.min(100, Math.max(0, initialScore));

    const record: AgentReputationRecord = {
      agentId: input.agentId,
      name: input.name,
      role: input.role,
      reputationScore: boundedScore,
      tier: computeTier(boundedScore),
      accuracyRate: 100.0,
      totalAudits: 0,
      acceptedFindingsCount: 0,
      rejectedFindingsCount: 0,
      disputedFindingsCount: 0,
      totalEarningsUSD: "0.00",
      totalEarningsTinybars: 0,
      specialty: input.specialty ?? input.role,
      hederaVerified: true,
      did: input.did ?? `did:hedera:testnet:0.0.10417469_${input.agentId}`,
      shape: input.shape ?? "octahedron",
      color: input.color ?? "#10b981",
      lastUpdated: new Date().toISOString(),
    };

    this.records.set(input.agentId, record);
    return record;
  }

  /**
   * Update Proof-of-Reputation scores for agents based on audit consensus outcomes:
   * - Consensus-supported (accepted) finding: +3 pts
   * - Suppressed false positive / disputed: 0 pts
   * - Hallucinated / rejected finding: -5 pts penalty
   */
  recordAuditConsensus(input: {
    auditId: string;
    submissions: Array<{ agentId: string; role?: string; findings: Finding[] }>;
    acceptedFindingIds: Set<string>;
    disputedFindingIds?: Set<string>;
    revenuePerAgentUSD?: number;
  }): Map<string, { delta: number; newScore: number; accepted: number; rejected: number }> {
    const results = new Map<string, { delta: number; newScore: number; accepted: number; rejected: number }>();
    const disputedSet = input.disputedFindingIds ?? new Set<string>();

    for (const sub of input.submissions) {
      let record = this.records.get(sub.agentId);
      if (!record) {
        // Auto-register agent if not found
        record = this.registerAgent({
          agentId: sub.agentId,
          name: sub.agentId,
          role: sub.role ?? "security-specialist",
          benchmarkScore: 85,
        });
      }

      let acceptedCount = 0;
      let rejectedCount = 0;
      let disputedCount = 0;

      for (const finding of sub.findings) {
        const findingKey = finding.id;
        const isAccepted = input.acceptedFindingIds.has(findingKey) ||
          Array.from(input.acceptedFindingIds).some((id) => id.includes(finding.category) || (finding.id && id.includes(finding.id)));
        const isDisputed = disputedSet.has(findingKey);

        if (isAccepted) {
          acceptedCount++;
        } else if (isDisputed) {
          disputedCount++;
        } else {
          rejectedCount++;
        }
      }

      // Compute delta: +3 pts per accepted finding, -5 pts penalty per rejected finding
      const delta = (acceptedCount * 3) - (rejectedCount * 5);
      const oldScore = record.reputationScore;
      const newScore = Math.max(0, Math.min(100, oldScore + delta));

      // Update record stats
      record.reputationScore = newScore;
      record.tier = computeTier(newScore);
      record.totalAudits += 1;
      record.acceptedFindingsCount += acceptedCount;
      record.rejectedFindingsCount += rejectedCount;
      record.disputedFindingsCount += disputedCount;

      const totalEvaluated = record.acceptedFindingsCount + record.rejectedFindingsCount;
      if (totalEvaluated > 0) {
        record.accuracyRate = parseFloat(((record.acceptedFindingsCount / totalEvaluated) * 100).toFixed(1));
      }

      if (input.revenuePerAgentUSD && input.revenuePerAgentUSD > 0) {
        const currentUSD = parseFloat(record.totalEarningsUSD) || 0;
        const newUSD = (currentUSD + input.revenuePerAgentUSD).toFixed(2);
        record.totalEarningsUSD = newUSD;
        record.totalEarningsTinybars = Math.round(parseFloat(newUSD) * 1_000_000);
      }

      record.lastUpdated = new Date().toISOString();

      results.set(sub.agentId, {
        delta,
        newScore,
        accepted: acceptedCount,
        rejected: rejectedCount,
      });
    }

    return results;
  }

  /**
   * Get single agent reputation record
   */
  getAgentReputation(agentId: string): AgentReputationRecord | undefined {
    return this.records.get(agentId);
  }

  /**
   * Get all agents sorted by reputation score descending
   */
  getLeaderboard(): AgentReputationRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.reputationScore - a.reputationScore);
  }
}
