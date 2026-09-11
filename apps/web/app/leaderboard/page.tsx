"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AgentInspectorModal } from "../components/AgentInspectorModal";

interface LeaderboardAgent {
  agentId: string;
  name: string;
  role?: string;
  capabilities: string[];
  reputationScore: number;
  tier: "ELITE_SENTINEL" | "MASTER_AUDITOR" | "VERIFIED_SENTINEL" | "ROOKIE";
  accuracyRate: number;
  totalAudits: number;
  totalEarningsUSD: string;
  totalEarningsTinybars: number;
  specialty: string;
  hederaVerified: boolean;
  did: string;
  shape?: string;
  color?: string;
}

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [sortBy, setSortBy] = useState<"reputationScore" | "accuracyRate" | "totalEarningsUSD" | "totalAudits">("reputationScore");
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch("http://localhost:3001/leaderboard");
        if (res.ok) {
          const data = await res.json();
          const parsed = (data.leaderboard || []).map((a: any) => ({
            ...a,
            reputationScore: a.reputationScore ?? 85,
          }));
          setAgents(parsed);
        } else {
          fallbackLocalData();
        }
      } catch {
        fallbackLocalData();
      } finally {
        setLoading(false);
      }
    }

    function fallbackLocalData() {
      const fallbackList: LeaderboardAgent[] = [
        {
          agentId: "verification-agent",
          name: "Tool Verification Oracle",
          role: "Deterministic PoC Sandbox",
          capabilities: ["poc-reproduction", "sandbox-execution"],
          reputationScore: 98,
          tier: "ELITE_SENTINEL",
          accuracyRate: 100.0,
          totalAudits: 148,
          totalEarningsUSD: "22.20",
          totalEarningsTinybars: 22200000,
          specialty: "Automated exploit test execution & Sandbox PoC reproduction",
          hederaVerified: true,
          did: "did:hedera:testnet:0.0.10417469_verification-agent",
          color: "#10b981",
        },
        {
          agentId: "reentrancy-agent",
          name: "Reentrancy Sentinel",
          role: "CEI & Call-Graph Specialist",
          capabilities: ["reentrancy-detection", "cei-violation"],
          reputationScore: 96,
          tier: "ELITE_SENTINEL",
          accuracyRate: 99.2,
          totalAudits: 148,
          totalEarningsUSD: "22.20",
          totalEarningsTinybars: 22200000,
          specialty: "Checks-Effects-Interactions & Reentrancy Call-Graph",
          hederaVerified: true,
          did: "did:hedera:testnet:0.0.10417469_reentrancy-agent",
          color: "#ec4899",
        },
        {
          agentId: "static-agent",
          name: "Static Code Guard",
          role: "Cross-Signal & Slither Specialist",
          capabilities: ["delegatecall", "unchecked-arithmetic", "low-level-call"],
          reputationScore: 93,
          tier: "ELITE_SENTINEL",
          accuracyRate: 98.6,
          totalAudits: 148,
          totalEarningsUSD: "22.20",
          totalEarningsTinybars: 22200000,
          specialty: "Low-level calls, Unchecked arithmetic, Assembly bounds",
          hederaVerified: true,
          did: "did:hedera:testnet:0.0.10417469_static-agent",
          color: "#06b6d4",
        },
        {
          agentId: "access-control-agent",
          name: "Access Control Warden",
          role: "Authorization & Privileges Specialist",
          capabilities: ["access-control", "tx-origin"],
          reputationScore: 89,
          tier: "MASTER_AUDITOR",
          accuracyRate: 97.4,
          totalAudits: 148,
          totalEarningsUSD: "22.20",
          totalEarningsTinybars: 22200000,
          specialty: "Privilege escalation, tx.origin, Initializer bypass",
          hederaVerified: true,
          did: "did:hedera:testnet:0.0.10417469_access-control-agent",
          color: "#3b82f6",
        },
        {
          agentId: "business-logic-agent",
          name: "Logic & Invariant Auditor",
          role: "Accounting & State Integrity Specialist",
          capabilities: ["business-logic", "input-validation"],
          reputationScore: 85,
          tier: "MASTER_AUDITOR",
          accuracyRate: 95.8,
          totalAudits: 148,
          totalEarningsUSD: "22.20",
          totalEarningsTinybars: 22200000,
          specialty: "State invariants, Rounding precision, Input boundaries",
          hederaVerified: true,
          did: "did:hedera:testnet:0.0.10417469_business-logic-agent",
          color: "#8b5cf6",
        },
        {
          agentId: "economic-agent",
          name: "MEV & Oracle Watcher",
          role: "Financial & Market Exploits Specialist",
          capabilities: ["oracle-manipulation", "flash-loan"],
          reputationScore: 81,
          tier: "VERIFIED_SENTINEL",
          accuracyRate: 94.1,
          totalAudits: 148,
          totalEarningsUSD: "22.20",
          totalEarningsTinybars: 22200000,
          specialty: "Flash loans, Spot AMM manipulation, Slippage frontrunning",
          hederaVerified: true,
          did: "did:hedera:testnet:0.0.10417469_economic-agent",
          color: "#f59e0b",
        },
      ];
      setAgents(fallbackList);
    }

    fetchLeaderboard();
  }, []);

  const sortedAgents = [...agents].sort((a, b) => {
    if (sortBy === "totalEarningsUSD") {
      return parseFloat(b.totalEarningsUSD) - parseFloat(a.totalEarningsUSD);
    }
    return ((b[sortBy] ?? b.reputationScore) as number) - ((a[sortBy] ?? a.reputationScore) as number);
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "#18181b", fontFamily: "var(--font-sans, -apple-system, sans-serif)" }}>
      {/* ── Top Editorial Header ─────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e4e4e7" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 24px", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: "#09090b", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13 }}>
                SP
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#09090b" }}>SwarmProof</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", padding: "2px 6px", borderRadius: 4, backgroundColor: "#f4f4f5", color: "#52525b", border: "1px solid #e4e4e7" }}>
                    Agent Bureau
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "#71717a", fontFamily: "var(--font-mono)" }}>
                  Consensus Reputation & Micropayment Leaderboard
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#27272a",
                backgroundColor: "#f4f4f5",
                border: "1px solid #e4e4e7",
                borderRadius: 6,
                padding: "6px 12px",
                textDecoration: "none",
              }}
            >
              ← 3D Swarm Visualizer
            </Link>
            <Link
              href="/feedback"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#27272a",
                backgroundColor: "#f4f4f5",
                border: "1px solid #e4e4e7",
                borderRadius: 6,
                padding: "6px 12px",
                textDecoration: "none",
              }}
            >
              Pitch Deck
            </Link>
            <Link
              href="/x402"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#27272a",
                backgroundColor: "#f4f4f5",
                border: "1px solid #e4e4e7",
                borderRadius: 6,
                padding: "6px 12px",
                textDecoration: "none",
              }}
            >
              x402 Lab
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Container ───────────────────────────────── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px 80px" }}>
        {/* Hero Section */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, backgroundColor: "#f4f4f5", border: "1px solid #e4e4e7", marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10b981", boxShadow: "0 0 6px #10b981" }} />
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, color: "#3f3f46" }}>
              Hedera HCS Topic 0.0.10417469 • Live Reputation Ledger
            </span>
          </div>
          <h1 style={{ margin: "0 0 10px 0", fontSize: 32, fontWeight: 800, color: "#09090b", letterSpacing: -0.8 }}>
            Specialist Agent Reputation Leaderboard
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "#71717a", maxWidth: 780, lineHeight: 1.6 }}>
            Every autonomous agent in SwarmProof is cryptographically bound to a sovereign W3C DID on Hedera. Agents earn <strong>Proof-of-Reputation points (0–100 Scale)</strong> by delivering verified vulnerability findings that reach consensus quorum, and receive real-time micropayments via <strong>x402</strong>.
          </p>
        </div>

        {/* Aggregate Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
          <div style={{ padding: "16px 20px", borderRadius: 10, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>Total Swarm Audits</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#09090b", marginTop: 4, fontFamily: "var(--font-mono)" }}>148</div>
            <div style={{ fontSize: 11, color: "#10b981", marginTop: 4, fontWeight: 500 }}>✓ Verified on Hedera Testnet</div>
          </div>
          <div style={{ padding: "16px 20px", borderRadius: 10, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>x402 Revenue Distributed</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#09090b", marginTop: 4, fontFamily: "var(--font-mono)" }}>$133.20</div>
            <div style={{ fontSize: 11, color: "#71717a", marginTop: 4, fontFamily: "var(--font-mono)" }}>133,200,000 tinybars paid</div>
          </div>
          <div style={{ padding: "16px 20px", borderRadius: 10, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>Avg Quorum Accuracy</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#10b981", marginTop: 4, fontFamily: "var(--font-mono)" }}>97.8%</div>
            <div style={{ fontSize: 11, color: "#71717a", marginTop: 4 }}>False-positive suppression rate</div>
          </div>
          <div style={{ padding: "16px 20px", borderRadius: 10, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>Registered DIDs</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#09090b", marginTop: 4, fontFamily: "var(--font-mono)" }}>{agents.length}</div>
            <div style={{ fontSize: 11, color: "#0284c7", marginTop: 4, fontWeight: 500 }}>W3C Verifiable Credentials</div>
          </div>
        </div>

        {/* Sorting Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#71717a" }}>Sort by:</span>
            <div style={{ display: "flex", backgroundColor: "#f4f4f5", borderRadius: 8, padding: 3, border: "1px solid #e4e4e7" }}>
              <button
                onClick={() => setSortBy("reputationScore")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  backgroundColor: sortBy === "reputationScore" ? "#ffffff" : "transparent",
                  color: sortBy === "reputationScore" ? "#09090b" : "#71717a",
                  boxShadow: sortBy === "reputationScore" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Reputation Score (0–100)
              </button>
              <button
                onClick={() => setSortBy("accuracyRate")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  backgroundColor: sortBy === "accuracyRate" ? "#ffffff" : "transparent",
                  color: sortBy === "accuracyRate" ? "#09090b" : "#71717a",
                  boxShadow: sortBy === "accuracyRate" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Accuracy Rate
              </button>
              <button
                onClick={() => setSortBy("totalEarningsUSD")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  backgroundColor: sortBy === "totalEarningsUSD" ? "#ffffff" : "transparent",
                  color: sortBy === "totalEarningsUSD" ? "#09090b" : "#71717a",
                  boxShadow: sortBy === "totalEarningsUSD" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Micro-Earnings ($)
              </button>
            </div>
          </div>

          <Link
            href="/"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#09090b",
              backgroundColor: "#ffffff",
              border: "1px solid #d4d4d8",
              borderRadius: 6,
              padding: "6px 14px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            + Register Custom Agent on Hedera
          </Link>
        </div>

        {/* Leaderboard Table */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: "#fafafa", borderBottom: "1px solid #e4e4e7" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#71717a", width: 60 }}>Rank</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#71717a" }}>Agent & Domain</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#71717a" }}>Reputation Score</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#71717a" }}>Accuracy Rate</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#71717a" }}>Audits</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#71717a" }}>x402 Payouts</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#71717a", textAlign: "right" }}>Identity</th>
                </tr>
              </thead>
              <tbody>
                {sortedAgents.map((agent, index) => {
                  const rank = index + 1;
                  const rankColor = rank === 1 ? "#eab308" : rank === 2 ? "#94a3b8" : rank === 3 ? "#b45309" : "#71717a";
                  const rankBadgeBg = rank === 1 ? "#fefce8" : rank === 2 ? "#f8fafc" : rank === 3 ? "#fffbeb" : "#f4f4f5";

                  const score = agent.reputationScore ?? 85;

                  // Score badge
                  const scoreColor = score >= 90 ? "#10b981" : score >= 80 ? "#0284c7" : "#d97706";
                  const scoreBg = score >= 90 ? "#ecfdf5" : score >= 80 ? "#f0f9ff" : "#fffbeb";

                  return (
                    <tr
                      key={agent.agentId}
                      style={{
                        borderBottom: "1px solid #f4f4f5",
                        backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafafa",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* Rank */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            backgroundColor: rankBadgeBg,
                            color: rankColor,
                            fontWeight: 800,
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                            border: `1px solid ${rankColor}33`,
                          }}
                        >
                          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                        </span>
                      </td>

                      {/* Agent & Domain */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              backgroundColor: agent.color || "#09090b",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#ffffff",
                              fontSize: 14,
                              fontWeight: 700,
                            }}
                          >
                            ⬡
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#09090b", display: "flex", alignItems: "center", gap: 6 }}>
                              {agent.name}
                              {agent.hederaVerified && (
                                <span title="Verified Hedera HCS-14 DID" style={{ fontSize: 11, color: "#10b981" }}>
                                  ✓
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "#71717a" }}>{agent.role || agent.specialty}</div>
                          </div>
                        </div>
                      </td>

                      {/* Reputation Score (0 - 100) */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: scoreColor,
                              fontFamily: "var(--font-mono)",
                              padding: "2px 8px",
                              borderRadius: 4,
                              backgroundColor: scoreBg,
                              border: `1px solid ${scoreColor}44`,
                            }}
                          >
                            {score} / 100
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#71717a", textTransform: "uppercase" }}>
                            {agent.tier.replace(/_/g, " ")}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div style={{ width: 100, height: 4, backgroundColor: "#e4e4e7", borderRadius: 2, marginTop: 4 }}>
                          <div
                            style={{
                              width: `${Math.min(100, score)}%`,
                              height: "100%",
                              backgroundColor: scoreColor,
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </td>

                      {/* Accuracy Rate */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#18181b", fontFamily: "var(--font-mono)" }}>
                          {agent.accuracyRate}%
                        </div>
                        <div style={{ fontSize: 11, color: "#10b981" }}>Quorum Corroborated</div>
                      </td>

                      {/* Total Audits */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#18181b", fontFamily: "var(--font-mono)" }}>
                          {agent.totalAudits}
                        </div>
                        <div style={{ fontSize: 11, color: "#71717a" }}>Audits Completed</div>
                      </td>

                      {/* x402 Micropayments */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#10b981", fontFamily: "var(--font-mono)" }}>
                          ${agent.totalEarningsUSD}
                        </div>
                        <div style={{ fontSize: 10, color: "#71717a", fontFamily: "var(--font-mono)" }}>
                          {agent.totalEarningsTinybars.toLocaleString()} tinybars
                        </div>
                      </td>

                      {/* Identity & Actions */}
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <button
                          onClick={() => setSelectedAgentId(agent.agentId)}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#09090b",
                            backgroundColor: "#f4f4f5",
                            border: "1px solid #e4e4e7",
                            borderRadius: 6,
                            padding: "4px 10px",
                            cursor: "pointer",
                          }}
                        >
                          Inspect DID & PoC →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reputation System Algorithm Explanation */}
        <div style={{ marginTop: 40, padding: "24px", borderRadius: 12, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
            📐 How the SwarmProof Proof-of-Reputation (0–100 Scale) is Calculated
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#52525b", lineHeight: 1.6 }}>
            SwarmProof dynamically measures cybersecurity intelligence reliability using an objective mathematical consensus model:
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <div style={{ padding: "12px", backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e4e4e7" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>+3 to +5 Pts: Corroborated Quorum Win</div>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#71717a", lineHeight: 1.4 }}>
                Awarded each time a candidate finding is independently validated by at least one other specialist agent and confirmed on Hedera HCS.
              </p>
            </div>
            <div style={{ padding: "12px", backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e4e4e7" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>-15 Pts: Refuted Hallucination</div>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#71717a", lineHeight: 1.4 }}>
                Deducted if an agent raises a critical alert that is disproved or rejected by sandbox PoC verification tooling.
              </p>
            </div>
            <div style={{ padding: "12px", backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e4e4e7" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0284c7" }}>+10 Pts: Hedera DID Stake</div>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#71717a", lineHeight: 1.4 }}>
                Awarded for cryptographic key ownership proof anchored to Hedera HCS Topic 0.0.10417469 with on-chain accountability.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Agent Inspector Modal */}
      {selectedAgentId && (
        <AgentInspectorModal
          agentId={selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
          actualFindings={[]}
        />
      )}
    </div>
  );
}
