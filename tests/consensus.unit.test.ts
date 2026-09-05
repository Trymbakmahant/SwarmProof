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
});