import { describe, it, expect } from "vitest";
import { ReputationEngine, computeTier } from "../apps/api/src/reputation";
import type { Finding } from "@swarmproof/agents";

describe("Dynamic Proof-of-Reputation Engine (Stage C.2)", () => {
  it("initializes with baseline specialist agents", () => {
    const engine = new ReputationEngine();
    const leaderboard = engine.getLeaderboard();

    expect(leaderboard.length).toBeGreaterThanOrEqual(6);
    expect(leaderboard[0]!.reputationScore).toBeGreaterThanOrEqual(95);
    expect(leaderboard[0]!.tier).toBe("ELITE_SENTINEL");

    // All baseline scores must be strictly between 0 and 100
    for (const a of leaderboard) {
      expect(a.reputationScore).toBeGreaterThanOrEqual(0);
      expect(a.reputationScore).toBeLessThanOrEqual(100);
    }
  });

  it("registers a newly qualified agent with benchmark score", () => {
    const engine = new ReputationEngine();
    const newAgent = engine.registerAgent({
      agentId: "custom-zk-guard",
      name: "ZK Guard Sentinel",
      role: "ZK Constraint Verifier",
      benchmarkScore: 92,
      specialty: "Underconstrained signal checks",
    });

    expect(newAgent.agentId).toBe("custom-zk-guard");
    expect(newAgent.reputationScore).toBe(92);
    expect(newAgent.tier).toBe("MASTER_AUDITOR");
    expect(newAgent.totalAudits).toBe(0);

    const found = engine.getAgentReputation("custom-zk-guard");
    expect(found).toBeDefined();
    expect(found?.reputationScore).toBe(92);
  });

  it("awards +3 pts for consensus-accepted findings", () => {
    const engine = new ReputationEngine();
    engine.registerAgent({
      agentId: "agent-test-award",
      name: "Test Award Agent",
      role: "Reentrancy",
      benchmarkScore: 80,
    });

    const findings: Finding[] = [
      {
        id: "f_accepted_1",
        title: "Reentrancy flaw",
        category: "reentrancy",
        severity: "critical",
        location: "withdraw",
        evidence: ["code"],
        status: "proposed",
      },
      {
        id: "f_accepted_2",
        title: "Cross function flaw",
        category: "reentrancy",
        severity: "high",
        location: "transfer",
        evidence: ["code"],
        status: "proposed",
      },
    ];

    const acceptedIds = new Set(["f_accepted_1", "f_accepted_2"]);
    const results = engine.recordAuditConsensus({
      auditId: "audit_123",
      submissions: [{ agentId: "agent-test-award", findings }],
      acceptedFindingIds: acceptedIds,
      revenuePerAgentUSD: 0.2,
    });

    const outcome = results.get("agent-test-award");
    expect(outcome).toBeDefined();
    expect(outcome?.delta).toBe(6); // 2 * 3 = +6
    expect(outcome?.newScore).toBe(86); // 80 + 6 = 86
    expect(outcome?.accepted).toBe(2);
    expect(outcome?.rejected).toBe(0);

    const updated = engine.getAgentReputation("agent-test-award");
    expect(updated?.reputationScore).toBe(86);
    expect(updated?.totalAudits).toBe(1);
    expect(updated?.totalEarningsUSD).toBe("0.20");
  });

  it("penalizes -5 pts for rejected (hallucinated) findings", () => {
    const engine = new ReputationEngine();
    engine.registerAgent({
      agentId: "agent-test-penalty",
      name: "Test Penalty Agent",
      role: "Business Logic",
      benchmarkScore: 85,
    });

    const findings: Finding[] = [
      {
        id: "f_hallucinated_1",
        title: "Fake bug",
        category: "business-logic",
        severity: "medium",
        location: "nowhere",
        evidence: ["false evidence"],
        status: "proposed",
      },
    ];

    // None accepted
    const acceptedIds = new Set<string>();
    const results = engine.recordAuditConsensus({
      auditId: "audit_456",
      submissions: [{ agentId: "agent-test-penalty", findings }],
      acceptedFindingIds: acceptedIds,
    });

    const outcome = results.get("agent-test-penalty");
    expect(outcome?.delta).toBe(-5); // 0 - 5 = -5
    expect(outcome?.newScore).toBe(80); // 85 - 5 = 80
    expect(outcome?.rejected).toBe(1);

    const updated = engine.getAgentReputation("agent-test-penalty");
    expect(updated?.reputationScore).toBe(80);
    expect(updated?.rejectedFindingsCount).toBe(1);
  });

  it("strictly bounds reputation scores within [0, 100]", () => {
    const engine = new ReputationEngine();
    engine.registerAgent({
      agentId: "agent-boundary",
      name: "Boundary Agent",
      role: "Oracle",
      benchmarkScore: 99,
    });

    // Award +6 when at 99 -> should cap at 100
    engine.recordAuditConsensus({
      auditId: "audit_789",
      submissions: [
        {
          agentId: "agent-boundary",
          findings: [
            { id: "f1", title: "1", category: "oracle", severity: "high", location: "loc", evidence: [], status: "proposed" },
            { id: "f2", title: "2", category: "oracle", severity: "high", location: "loc", evidence: [], status: "proposed" },
          ],
        },
      ],
      acceptedFindingIds: new Set(["f1", "f2"]),
    });

    expect(engine.getAgentReputation("agent-boundary")?.reputationScore).toBe(100);

    // Repeated huge penalties -> should clamp at 0
    engine.recordAuditConsensus({
      auditId: "audit_999",
      submissions: [
        {
          agentId: "agent-boundary",
          findings: Array.from({ length: 30 }, (_, i) => ({
            id: `fake_${i}`,
            title: "fake",
            category: "oracle",
            severity: "low" as const,
            location: "loc",
            evidence: [],
            status: "proposed" as const,
          })),
        },
      ],
      acceptedFindingIds: new Set(),
    });

    expect(engine.getAgentReputation("agent-boundary")?.reputationScore).toBe(0);
    expect(engine.getAgentReputation("agent-boundary")?.tier).toBe("PROBATIONARY_AGENT");
  });

  it("correctly computes tiers based on score thresholds", () => {
    expect(computeTier(100)).toBe("ELITE_SENTINEL");
    expect(computeTier(95)).toBe("ELITE_SENTINEL");
    expect(computeTier(94)).toBe("MASTER_AUDITOR");
    expect(computeTier(85)).toBe("MASTER_AUDITOR");
    expect(computeTier(84)).toBe("VERIFIED_SENTINEL");
    expect(computeTier(70)).toBe("VERIFIED_SENTINEL");
    expect(computeTier(69)).toBe("PROBATIONARY_AGENT");
    expect(computeTier(0)).toBe("PROBATIONARY_AGENT");
  });
});
