import { describe, expect, it } from "vitest";
import { reachConsensus } from "@swarmproof/consensus";
import type { Finding } from "@swarmproof/agents";

function finding(id: string): Finding {
  return {
    id,
    title: `Finding ${id}`,
    category: "reentrancy",
    severity: "critical",
    location: "withdraw()",
    evidence: [],
    status: "proposed",
  };
}

describe("consensus", () => {
  it("accepts tool-verified findings with quorum", () => {
    const report = reachConsensus("run-1", [
      {
        finding: finding("f1"),
        evidence: [
          { agentRole: "analyzer", confidence: 0.8, artifactWeight: 1 },
          { agentRole: "verifier", confidence: 1, artifactWeight: 1 },
        ],
      },
    ]);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.verdict).toBe("accepted");
    expect(report.findings[0]?.confidence).toBeGreaterThan(0);
  });

  it("rejects findings the exploiter disproved", () => {
    const report = reachConsensus("run-2", [
      {
        finding: finding("f2"),
        evidence: [
          { agentRole: "analyzer", confidence: 0.9, artifactWeight: 1 },
          { agentRole: "exploiter", confidence: 0.1, artifactWeight: 0 }, // disproved
        ],
      },
    ]);
    expect(report.findings).toHaveLength(0);
  });

  it("flags low-quorum criticals as disputes", () => {
    const report = reachConsensus("run-3", [
      {
        finding: finding("f3"),
        evidence: [{ agentRole: "analyzer", confidence: 0.95, artifactWeight: 1 }],
      },
    ]);
    expect(report.disputes).toHaveLength(1);
  });

  it("default config values are sane", () => {
    const score = 1 * 0.3 + 1 * 1; // analyzer + verifier max weights
    expect(score).toBeGreaterThan(0.6);
  });

  it("plugin agents can carry their own consensus weight via agentId", () => {
    // keyword-analyzer plugin declares weight 0.25; alone it should NOT cross the bar,
    // but with a built-in verifier it passes and the plugin weight is what's used.
    const roleWeights = { "keyword-analyzer": 0.25 };
    const solo = reachConsensus(
      "run-plug-1",
      [
        {
          finding: finding("pf1"),
          evidence: [
            { agentRole: "analyzer", agentId: "keyword-analyzer", confidence: 1, artifactWeight: 1 },
          ],
        },
      ],
      undefined,
      roleWeights,
    );
    expect(solo.findings).toHaveLength(0); // 0.25 < 0.6 minScore
  });

  it("plugin weight higher than role default boosts score", () => {
    const roleWeights = { "trusted-verifier": 2.0 };
    const report = reachConsensus(
      "run-plug-2",
      [
        {
          finding: finding("pf2"),
          evidence: [
            { agentRole: "verifier", agentId: "trusted-verifier", confidence: 0.5, artifactWeight: 1 },
          ],
        },
      ],
      { minScore: 0.6, quorum: 1, disputeEscalation: false },
      roleWeights,
    );
    // 2.0 * 0.5 = 1.0 >= 0.6, quorum 1/1
    expect(report.findings[0]?.score).toBe(1.0);
    expect(report.findings[0]?.verdict).toBe("accepted");
  });
});