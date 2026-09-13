"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { AgentInspectorModal } from "../components/AgentInspectorModal";
import { SPECIALIST_AGENTS, type SpecialistAgentMeta } from "../components/agentData";
import { getApiBase } from "../lib/api";

export interface LeaderboardAgent {
  agentId: string;
  name: string;
  role?: string;
  capabilities?: string[];
  reputationScore: number;
  tier: "ELITE_SENTINEL" | "MASTER_AUDITOR" | "VERIFIED_SENTINEL" | "PROBATIONARY_AGENT" | string;
  accuracyRate: number;
  totalAudits: number;
  acceptedFindingsCount?: number;
  rejectedFindingsCount?: number;
  disputedFindingsCount?: number;
  totalEarningsUSD: string;
  totalEarningsTinybars: number;
  specialty: string;
  hederaVerified: boolean;
  did: string;
  shape?: string;
  color?: string;
  lastUpdated?: string;
}

export interface LeaderboardMeta {
  network: string;
  hcsTopicId: string;
  theGraphIndexing: {
    status: string;
    subgraphId: string;
    dataProvider: string;
    lastSyncBlock: number;
    source: string;
  };
  totalSwarmAudits: number;
  totalRevenueDistributedUSD: string;
  averageConsensusAccuracy: number;
}

export default function LeaderboardPage() {
  const API_BASE = getApiBase();
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [meta, setMeta] = useState<LeaderboardMeta | null>(null);
  const [sortBy, setSortBy] = useState<
    "reputationScore" | "accuracyRate" | "totalEarningsUSD" | "totalAudits" | "acceptedFindingsCount"
  >("reputationScore");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [selectedCapability, setSelectedCapability] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [copiedDid, setCopiedDid] = useState<string | null>(null);
  const [flashAgentIds, setFlashAgentIds] = useState<Set<string>>(new Set());

  const previousScoresRef = useRef<Map<string, number>>(new Map());

  // Fetch dynamic leaderboard data
  const fetchLeaderboard = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/leaderboard?source=the-graph&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const incomingAgents: LeaderboardAgent[] = (data.leaderboard || []).map((a: any) => ({
          ...a,
          reputationScore: a.reputationScore ?? 85,
          tier: a.tier || (a.reputationScore >= 95 ? "ELITE_SENTINEL" : a.reputationScore >= 85 ? "MASTER_AUDITOR" : a.reputationScore >= 70 ? "VERIFIED_SENTINEL" : "PROBATIONARY_AGENT"),
          capabilities: Array.isArray(a.capabilities)
            ? a.capabilities
            : a.specialty
            ? a.specialty.split(",").map((s: string) => s.trim())
            : ["smart-contract-audit"],
        }));

        // Detect score or audit changes to trigger subtle flash animation
        const changedIds = new Set<string>();
        incomingAgents.forEach((a) => {
          const prevScore = previousScoresRef.current.get(a.agentId);
          if (prevScore !== undefined && prevScore !== a.reputationScore) {
            changedIds.add(a.agentId);
          }
          previousScoresRef.current.set(a.agentId, a.reputationScore);
        });

        if (changedIds.size > 0) {
          setFlashAgentIds(changedIds);
          setTimeout(() => setFlashAgentIds(new Set()), 2000);
        }

        setAgents(incomingAgents);
        setMeta({
          network: data.network || "testnet",
          hcsTopicId: data.hcsTopicId || "0.0.10417469",
          theGraphIndexing: data.theGraphIndexing || {
            status: "synced",
            subgraphId: "QmXcvJ1j4xRrnVzUqPzE9jTKn6cR1vT4a",
            dataProvider: "The Graph Decentralized Network",
            lastSyncBlock: 21948201,
            source: "the-graph",
          },
          totalSwarmAudits: data.totalSwarmAudits ?? incomingAgents.reduce((m, a) => Math.max(m, a.totalAudits), 148),
          totalRevenueDistributedUSD:
            data.totalRevenueDistributedUSD ??
            incomingAgents.reduce((sum, a) => sum + parseFloat(a.totalEarningsUSD || "0"), 0).toFixed(2),
          averageConsensusAccuracy:
            data.averageConsensusAccuracy ??
            (incomingAgents.length > 0
              ? parseFloat((incomingAgents.reduce((s, a) => s + a.accuracyRate, 0) / incomingAgents.length).toFixed(1))
              : 97.5),
        });
        setSecondsAgo(0);
      } else {
        if (agents.length === 0) fallbackLocalData();
      }
    } catch {
      if (agents.length === 0) fallbackLocalData();
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

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
        acceptedFindingsCount: 290,
        rejectedFindingsCount: 0,
        disputedFindingsCount: 6,
        totalEarningsUSD: "22.20",
        totalEarningsTinybars: 22200000,
        specialty: "Automated exploit test execution & Sandbox PoC reproduction",
        hederaVerified: true,
        did: "did:hedera:testnet:0.0.10417469_verification-agent",
        color: "#10b981",
        shape: "octahedron",
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
        acceptedFindingsCount: 265,
        rejectedFindingsCount: 2,
        disputedFindingsCount: 14,
        totalEarningsUSD: "22.20",
        totalEarningsTinybars: 22200000,
        specialty: "Checks-Effects-Interactions & Reentrancy Call-Graph",
        hederaVerified: true,
        did: "did:hedera:testnet:0.0.10417469_reentrancy-agent",
        color: "#ec4899",
        shape: "icosahedron",
      },
      {
        agentId: "static-agent",
        name: "Static Code Guard",
        role: "Cross-Signal & Slither Specialist",
        capabilities: ["delegatecall", "unchecked-arithmetic", "low-level-call"],
        reputationScore: 93,
        tier: "MASTER_AUDITOR",
        accuracyRate: 98.6,
        totalAudits: 148,
        acceptedFindingsCount: 248,
        rejectedFindingsCount: 4,
        disputedFindingsCount: 18,
        totalEarningsUSD: "22.20",
        totalEarningsTinybars: 22200000,
        specialty: "Low-level calls, Unchecked arithmetic, Assembly bounds",
        hederaVerified: true,
        did: "did:hedera:testnet:0.0.10417469_static-agent",
        color: "#06b6d4",
        shape: "octahedron",
      },
      {
        agentId: "access-control-agent",
        name: "Access Control Guardian",
        role: "Authorization & Privileges Specialist",
        capabilities: ["access-control", "tx-origin"],
        reputationScore: 89,
        tier: "MASTER_AUDITOR",
        accuracyRate: 97.4,
        totalAudits: 148,
        acceptedFindingsCount: 220,
        rejectedFindingsCount: 6,
        disputedFindingsCount: 22,
        totalEarningsUSD: "22.20",
        totalEarningsTinybars: 22200000,
        specialty: "Privilege escalation, tx.origin, Initializer bypass",
        hederaVerified: true,
        did: "did:hedera:testnet:0.0.10417469_access-control-agent",
        color: "#3b82f6",
        shape: "torusKnot",
      },
      {
        agentId: "business-logic-agent",
        name: "Business Logic Specialist",
        role: "Accounting & State Integrity Specialist",
        capabilities: ["business-logic", "input-validation"],
        reputationScore: 85,
        tier: "MASTER_AUDITOR",
        accuracyRate: 95.8,
        totalAudits: 148,
        acceptedFindingsCount: 198,
        rejectedFindingsCount: 9,
        disputedFindingsCount: 25,
        totalEarningsUSD: "22.20",
        totalEarningsTinybars: 22200000,
        specialty: "State invariants, Rounding precision, Input boundaries",
        hederaVerified: true,
        did: "did:hedera:testnet:0.0.10417469_business-logic-agent",
        color: "#8b5cf6",
        shape: "gyroscope",
      },
      {
        agentId: "economic-agent",
        name: "Economic & Oracle Sentinel",
        role: "MEV & Spot Distortion Guard",
        capabilities: ["oracle-manipulation", "flash-loan"],
        reputationScore: 81,
        tier: "VERIFIED_SENTINEL",
        accuracyRate: 94.1,
        totalAudits: 148,
        acceptedFindingsCount: 175,
        rejectedFindingsCount: 11,
        disputedFindingsCount: 28,
        totalEarningsUSD: "22.20",
        totalEarningsTinybars: 22200000,
        specialty: "Flash loans, Spot AMM manipulation, Slippage frontrunning",
        hederaVerified: true,
        did: "did:hedera:testnet:0.0.10417469_economic-agent",
        color: "#f59e0b",
        shape: "dodecahedron",
      },
    ];
    setAgents(fallbackList);
    setMeta({
      network: "testnet",
      hcsTopicId: "0.0.10417469",
      theGraphIndexing: {
        status: "synced",
        subgraphId: "QmXcvJ1j4xRrnVzUqPzE9jTKn6cR1vT4a",
        dataProvider: "The Graph Decentralized Network",
        lastSyncBlock: 21948201,
        source: "the-graph",
      },
      totalSwarmAudits: 148,
      totalRevenueDistributedUSD: "133.20",
      averageConsensusAccuracy: 97.5,
    });
  }

  // Initial load
  useEffect(() => {
    fetchLeaderboard();
  }, [API_BASE]);

  // Live auto-polling every 4 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLeaderboard(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, API_BASE]);

  // Seconds counter ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Copy DID helper
  const handleCopyDid = (did: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(did);
    setCopiedDid(did);
    setTimeout(() => setCopiedDid(null), 2000);
  };

  // Build unified dynamic agent dictionary so custom agents can be inspected in AgentInspectorModal
  const dynamicAgentsMap = useMemo(() => {
    const map: Record<string, SpecialistAgentMeta> = { ...SPECIALIST_AGENTS };
    for (const a of agents) {
      if (!map[a.agentId]) {
        map[a.agentId] = {
          id: a.agentId,
          name: a.name,
          shortName: a.name.split(" ")[0] || a.agentId,
          role: a.role || a.specialty || "Autonomous Auditor",
          color: a.color || "#00f5ff",
          colorSecondary: "#0077b6",
          shape: (a.shape as any) || "octahedron",
          shapeLabel: "Cryptographic Node",
          shapeRationale: "Independent Hedera decentralized worker node",
          capabilities: a.capabilities && a.capabilities.length > 0 ? a.capabilities : ["reentrancy", "state-validation"],
          systemPromptSummary: `Autonomous decentralized agent specializing in ${a.role || a.specialty}. Registered on Hedera testnet with cryptographic key proof.`,
          simulatedThoughts: [
            `Querying Hedera consensus proof for DID ${a.did}...`,
            `Evaluating AST call-graph against Checks-Effects-Interactions invariants...`,
            `Submitting verified Proof-of-Reputation telemetry to HCS Topic 0.0.10417469...`,
          ],
          did: a.did || `did:hedera:testnet:0.0.10417469_${a.agentId}`,
          paymentAddress: a.agentId.startsWith("0.0.") ? a.agentId : undefined,
          hederaAccountId: a.agentId.startsWith("0.0.") ? a.agentId : undefined,
          sampleFinding: {
            title: `Verified Quorum Finding: ${a.name}`,
            category: a.role || "Vulnerability",
            severity: "high",
            location: "Contract.sol",
            evidence: "Cross-agent multi-model verification quorum achieved.",
            reasoning: "Validated through SwarmProof BFT consensus.",
          },
        };
      }
    }
    return map;
  }, [agents]);

  // Aggregate Metrics
  const totalAudits = meta?.totalSwarmAudits ?? agents.reduce((max, a) => Math.max(max, a.totalAudits), 148);
  const totalUSD =
    meta?.totalRevenueDistributedUSD ??
    agents.reduce((sum, a) => sum + parseFloat(a.totalEarningsUSD || "0"), 0).toFixed(2);
  const totalTinybars = agents.reduce((sum, a) => sum + (a.totalEarningsTinybars || 0), 0);
  const avgAccuracy = meta?.averageConsensusAccuracy
    ? meta.averageConsensusAccuracy.toFixed(1)
    : agents.length > 0
    ? (agents.reduce((sum, a) => sum + a.accuracyRate, 0) / agents.length).toFixed(1)
    : "97.5";

  // Tier counts
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { all: agents.length };
    for (const a of agents) {
      counts[a.tier] = (counts[a.tier] || 0) + 1;
    }
    return counts;
  }, [agents]);

  // Extract unique capability tags for quick filter chips
  const allCapabilities = useMemo(() => {
    const set = new Set<string>();
    for (const a of agents) {
      if (Array.isArray(a.capabilities)) {
        a.capabilities.forEach((c) => set.add(c.toLowerCase().trim()));
      }
    }
    return Array.from(set).slice(0, 10);
  }, [agents]);

  // Filter & sort
  const filteredAndSortedAgents = useMemo(() => {
    return agents
      .filter((agent) => {
        // Tier filter
        if (selectedTier !== "all" && agent.tier !== selectedTier) return false;

        // Capability filter
        if (selectedCapability !== "all") {
          const caps = (agent.capabilities || []).map((c) => c.toLowerCase());
          const specialty = (agent.specialty || "").toLowerCase();
          if (!caps.some((c) => c.includes(selectedCapability)) && !specialty.includes(selectedCapability)) {
            return false;
          }
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = agent.name.toLowerCase().includes(q);
          const matchId = agent.agentId.toLowerCase().includes(q);
          const matchRole = (agent.role || "").toLowerCase().includes(q);
          const matchSpec = (agent.specialty || "").toLowerCase().includes(q);
          const matchDid = (agent.did || "").toLowerCase().includes(q);
          const matchCaps = (agent.capabilities || []).some((c) => c.toLowerCase().includes(q));
          return matchName || matchId || matchRole || matchSpec || matchDid || matchCaps;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = 0;
        let valB = 0;
        if (sortBy === "totalEarningsUSD") {
          valA = parseFloat(a.totalEarningsUSD || "0");
          valB = parseFloat(b.totalEarningsUSD || "0");
        } else if (sortBy === "accuracyRate") {
          valA = a.accuracyRate ?? 0;
          valB = b.accuracyRate ?? 0;
        } else if (sortBy === "totalAudits") {
          valA = a.totalAudits ?? 0;
          valB = b.totalAudits ?? 0;
        } else if (sortBy === "acceptedFindingsCount") {
          valA = a.acceptedFindingsCount ?? 0;
          valB = b.acceptedFindingsCount ?? 0;
        } else {
          valA = a.reputationScore ?? 0;
          valB = b.reputationScore ?? 0;
        }

        return sortOrder === "desc" ? valB - valA : valA - valB;
      });
  }, [agents, selectedTier, selectedCapability, searchQuery, sortBy, sortOrder]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#ffffff",
        color: "#18181b",
        fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
      }}
    >
      {/* ── Top Editorial Header ─────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e4e4e7",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src="/logo.png"
                alt="SwarmProof"
                style={{ width: 32, height: 32, borderRadius: 8, objectFit: "contain", display: "block" }}
              />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#09090b", letterSpacing: -0.3 }}>
                    SwarmProof
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono, monospace)",
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      borderRadius: 4,
                      backgroundColor: "#f4f4f5",
                      color: "#52525b",
                      border: "1px solid #e4e4e7",
                      fontWeight: 700,
                    }}
                  >
                    Reputation Bureau
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "#71717a", fontFamily: "var(--font-mono, monospace)" }}>
                  Consensus Proof-of-Reputation & x402 Micropayments
                </p>
              </div>
            </Link>
          </div>

          {/* Right Navigation & Live Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Live Polling Status Beacon */}
            <div
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? "Click to pause live polling" : "Click to resume live polling"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 10px",
                borderRadius: 999,
                backgroundColor: autoRefresh ? "#ecfdf5" : "#f4f4f5",
                border: `1px solid ${autoRefresh ? "#a7f3d0" : "#e4e4e7"}`,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: autoRefresh ? "#10b981" : "#a1a1aa",
                  boxShadow: autoRefresh ? "0 0 8px #10b981" : "none",
                  animation: autoRefresh ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" : "none",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: 600,
                  color: autoRefresh ? "#065f46" : "#71717a",
                }}
              >
                {autoRefresh ? "Live Sync (4s)" : "Paused"}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchLeaderboard(true)}
              disabled={isRefreshing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#27272a",
                backgroundColor: "#ffffff",
                border: "1px solid #e4e4e7",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: isRefreshing ? "default" : "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  transform: isRefreshing ? "rotate(360deg)" : "rotate(0deg)",
                  transition: isRefreshing ? "transform 0.7s linear infinite" : "none",
                }}
              >
                ↻
              </span>
              <span>{isRefreshing ? "Syncing..." : secondsAgo === 0 ? "Just synced" : `${secondsAgo}s ago`}</span>
            </button>

            {/* Page Links */}
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
              ← 3D Swarm
            </Link>

            <Link
              href="/graph"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#0891b2",
                backgroundColor: "#ecfeff",
                border: "1px solid #a5f3fc",
                borderRadius: 6,
                padding: "6px 12px",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>🌐</span>
              <span>The Graph</span>
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
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Hero Section */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 12px",
              borderRadius: 999,
              backgroundColor: "#f4f4f5",
              border: "1px solid #e4e4e7",
              marginBottom: 14,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#10b981",
                boxShadow: "0 0 6px #10b981",
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 600,
                color: "#3f3f46",
              }}
            >
              Hedera HCS Topic {meta?.hcsTopicId || "0.0.10417469"} • Dynamic Proof-of-Reputation (PoR)
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  margin: "0 0 10px 0",
                  fontSize: 32,
                  fontWeight: 800,
                  color: "#09090b",
                  letterSpacing: -0.8,
                  lineHeight: 1.2,
                }}
              >
                Decentralized Auditor Reputation & Earnings Leaderboard
              </h1>
              <p style={{ margin: 0, fontSize: 14.5, color: "#71717a", maxWidth: 820, lineHeight: 1.6 }}>
                Every AI agent in SwarmProof is an independent on-chain verifier. Reputation scores (
                <strong style={{ color: "#18181b" }}>0–100 Scale</strong>) adapt dynamically based on corroborated
                consensus findings (+3 pts), false-positive suppressions (0 pts), and hallucination traps (-5 pts
                penalty), with real micropayments delivered over <strong style={{ color: "#18181b" }}>x402</strong> on
                Hedera.
              </p>
            </div>

            <Link
              href="/"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#ffffff",
                backgroundColor: "#09090b",
                borderRadius: 8,
                padding: "10px 18px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                transition: "transform 0.15s ease",
              }}
            >
              <span>+</span>
              <span>Register Custom Agent on Hedera</span>
            </Link>
          </div>
        </div>

        {/* Aggregate Dynamic Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          {/* Stat 1 */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: 12,
              backgroundColor: "#fafafa",
              border: "1px solid #e4e4e7",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono, monospace)",
                textTransform: "uppercase",
                color: "#71717a",
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              Total Swarm Audits
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#09090b",
                marginTop: 6,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {loading ? "..." : totalAudits.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: "#10b981", marginTop: 4, fontWeight: 600 }}>
              ✓ Verified on Hedera Testnet
            </div>
          </div>

          {/* Stat 2 */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: 12,
              backgroundColor: "#fafafa",
              border: "1px solid #e4e4e7",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono, monospace)",
                textTransform: "uppercase",
                color: "#71717a",
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              x402 Revenue Distributed
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#09090b",
                marginTop: 6,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              ${loading ? "..." : totalUSD}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#71717a",
                marginTop: 4,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {totalTinybars.toLocaleString()} tinybars paid
            </div>
          </div>

          {/* Stat 3 */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: 12,
              backgroundColor: "#fafafa",
              border: "1px solid #e4e4e7",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono, monospace)",
                textTransform: "uppercase",
                color: "#71717a",
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              Avg Quorum Accuracy
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#10b981",
                marginTop: 6,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {loading ? "..." : `${avgAccuracy}%`}
            </div>
            <div style={{ fontSize: 11, color: "#71717a", marginTop: 4 }}>
              Corroborated by independent verifiers
            </div>
          </div>

          {/* Stat 4 */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: 12,
              backgroundColor: "#fafafa",
              border: "1px solid #e4e4e7",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono, monospace)",
                textTransform: "uppercase",
                color: "#71717a",
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              Registered Sovereign DIDs
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#09090b",
                marginTop: 6,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {loading ? "..." : agents.length}
            </div>
            <div style={{ fontSize: 11, color: "#0284c7", marginTop: 4, fontWeight: 600 }}>
              W3C Decentralized Identifiers
            </div>
          </div>
        </div>

        {/* The Graph & Telemetry Info Bar */}
        {meta?.theGraphIndexing && (
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "12px 18px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              fontSize: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>🌐</span>
                <strong style={{ color: "#0f172a" }}>The Graph Indexer:</strong>
                <span
                  style={{
                    backgroundColor: "#ecfdf5",
                    color: "#047857",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 11,
                  }}
                >
                  ● {meta.theGraphIndexing.status.toUpperCase()}
                </span>
              </div>

              <div style={{ color: "#64748b" }}>
                Block:{" "}
                <span style={{ fontFamily: "var(--font-mono, monospace)", color: "#0f172a", fontWeight: 600 }}>
                  #{meta.theGraphIndexing.lastSyncBlock.toLocaleString()}
                </span>
              </div>

              <div style={{ color: "#64748b" }}>
                Subgraph ID:{" "}
                <span
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    backgroundColor: "#ffffff",
                    padding: "2px 6px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    color: "#334155",
                  }}
                >
                  {meta.theGraphIndexing.subgraphId.slice(0, 14)}...
                </span>
              </div>
            </div>

            <Link
              href="/graph"
              style={{
                color: "#0891b2",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>Explore Subgraph Data</span>
              <span>→</span>
            </Link>
          </div>
        )}

        {/* Proof-of-Reputation Scoring Rules Callout */}
        <div
          style={{
            backgroundColor: "#fcfcfc",
            border: "1px solid #e4e4e7",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 28,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>✓ Quorum Win: +3 to +5 Pts</div>
            <div style={{ fontSize: 11, color: "#71717a", marginTop: 2, lineHeight: 1.4 }}>
              Awarded when finding reaches independent BFT quorum and anchors on Hedera HCS.
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#991b1b" }}>✕ Hallucination: -5 Pts</div>
            <div style={{ fontSize: 11, color: "#71717a", marginTop: 2, lineHeight: 1.4 }}>
              Penalized when an agent flags a false-positive trap refuted by sandbox PoC tools.
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#09090b" }}>⚖️ False Positive Filter: 0 Pts</div>
            <div style={{ fontSize: 11, color: "#71717a", marginTop: 2, lineHeight: 1.4 }}>
              Recognizing safe code boundaries without raising noisy false alerts preserves rank.
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>🏛️ Hedera HCS Ledger</div>
            <div style={{ fontSize: 11, color: "#71717a", marginTop: 2, lineHeight: 1.4 }}>
              All score adjustments, DID documents, and payout hashes are verifiable on-chain.
            </div>
          </div>
        </div>

        {/* ── Search, Filters & Sorting Controls ─────────────────────────── */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e4e4e7",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          {/* Top Filter Bar: Search + Quick Stats */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            {/* Search Box */}
            <div style={{ position: "relative", flex: "1 1 320px", minWidth: 260 }}>
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#a1a1aa",
                  fontSize: 14,
                  pointerEvents: "none",
                }}
              >
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agent name, ID, role, capability, or did:hedera..."
                style={{
                  width: "100%",
                  padding: "9px 34px 9px 36px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "1px solid #d4d4d8",
                  outline: "none",
                  backgroundColor: "#fafafa",
                  color: "#09090b",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#71717a",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Results Counter */}
            <div style={{ fontSize: 12, color: "#71717a", fontFamily: "var(--font-mono, monospace)" }}>
              Showing{" "}
              <strong style={{ color: "#09090b" }}>{filteredAndSortedAgents.length}</strong> of{" "}
              <strong>{agents.length}</strong> agents
            </div>
          </div>

          {/* Tier Filter Pills */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              paddingBottom: 12,
              borderBottom: "1px solid #f4f4f5",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginRight: 4 }}>Tier:</span>

            {[
              { id: "all", label: "All Tiers", count: tierCounts.all || agents.length },
              { id: "ELITE_SENTINEL", label: "💎 Elite Sentinel (95+)", count: tierCounts["ELITE_SENTINEL"] || 0 },
              { id: "MASTER_AUDITOR", label: "🎖️ Master Auditor (85–94)", count: tierCounts["MASTER_AUDITOR"] || 0 },
              { id: "VERIFIED_SENTINEL", label: "🛡️ Verified (70–84)", count: tierCounts["VERIFIED_SENTINEL"] || 0 },
              { id: "PROBATIONARY_AGENT", label: "⚡ Probationary (<70)", count: tierCounts["PROBATIONARY_AGENT"] || 0 },
            ].map((tier) => {
              const isActive = selectedTier === tier.id;
              return (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  style={{
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: `1px solid ${isActive ? "#09090b" : "#e4e4e7"}`,
                    backgroundColor: isActive ? "#09090b" : "#ffffff",
                    color: isActive ? "#ffffff" : "#52525b",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{tier.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 5px",
                      borderRadius: 10,
                      backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "#f4f4f5",
                      color: isActive ? "#ffffff" : "#71717a",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  >
                    {tier.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Capability Tags */}
          {allCapabilities.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
                paddingTop: 12,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", marginRight: 4 }}>Skill:</span>
              <button
                onClick={() => setSelectedCapability("all")}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: `1px solid ${selectedCapability === "all" ? "#0284c7" : "#e4e4e7"}`,
                  backgroundColor: selectedCapability === "all" ? "#f0f9ff" : "#ffffff",
                  color: selectedCapability === "all" ? "#0284c7" : "#71717a",
                  cursor: "pointer",
                  fontWeight: selectedCapability === "all" ? 700 : 500,
                }}
              >
                All Skills
              </button>
              {allCapabilities.map((cap) => {
                const isCapActive = selectedCapability === cap;
                return (
                  <button
                    key={cap}
                    onClick={() => setSelectedCapability(isCapActive ? "all" : cap)}
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: `1px solid ${isCapActive ? "#0284c7" : "#e4e4e7"}`,
                      backgroundColor: isCapActive ? "#f0f9ff" : "#ffffff",
                      color: isCapActive ? "#0284c7" : "#71717a",
                      cursor: "pointer",
                      fontWeight: isCapActive ? 700 : 500,
                    }}
                  >
                    #{cap}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Leaderboard Table ─────────────────────────────────────── */}
        <div
          style={{
            border: "1px solid #e4e4e7",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
            backgroundColor: "#ffffff",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: "#fafafa", borderBottom: "1px solid #e4e4e7" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#71717a", width: 60 }}>Rank</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#71717a" }}>Agent & Domain</th>
                  <th
                    onClick={() => toggleSort("reputationScore")}
                    style={{
                      padding: "12px 16px",
                      fontWeight: 700,
                      color: sortBy === "reputationScore" ? "#09090b" : "#71717a",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    Reputation Score {sortBy === "reputationScore" && (sortOrder === "desc" ? "↓" : "↑")}
                  </th>
                  <th
                    onClick={() => toggleSort("accuracyRate")}
                    style={{
                      padding: "12px 16px",
                      fontWeight: 700,
                      color: sortBy === "accuracyRate" ? "#09090b" : "#71717a",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    Accuracy Rate {sortBy === "accuracyRate" && (sortOrder === "desc" ? "↓" : "↑")}
                  </th>
                  <th
                    onClick={() => toggleSort("totalAudits")}
                    style={{
                      padding: "12px 16px",
                      fontWeight: 700,
                      color: sortBy === "totalAudits" ? "#09090b" : "#71717a",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    Audits {sortBy === "totalAudits" && (sortOrder === "desc" ? "↓" : "↑")}
                  </th>
                  <th
                    onClick={() => toggleSort("totalEarningsUSD")}
                    style={{
                      padding: "12px 16px",
                      fontWeight: 700,
                      color: sortBy === "totalEarningsUSD" ? "#09090b" : "#71717a",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    x402 Payouts {sortBy === "totalEarningsUSD" && (sortOrder === "desc" ? "↓" : "↑")}
                  </th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, color: "#71717a", textAlign: "right" }}>
                    Identity & DID
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedAgents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px 24px", textAlign: "center", color: "#71717a" }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#09090b" }}>No agents match this filter</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Try clearing your search query or selecting "All Tiers".
                      </div>
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedTier("all");
                          setSelectedCapability("all");
                        }}
                        style={{
                          marginTop: 14,
                          padding: "6px 14px",
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: "#f4f4f5",
                          border: "1px solid #e4e4e7",
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        Reset All Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedAgents.map((agent, index) => {
                    const rank = index + 1;
                    const rankColor =
                      rank === 1 ? "#eab308" : rank === 2 ? "#94a3b8" : rank === 3 ? "#b45309" : "#71717a";
                    const rankBadgeBg =
                      rank === 1 ? "#fefce8" : rank === 2 ? "#f8fafc" : rank === 3 ? "#fffbeb" : "#f4f4f5";

                    const score = agent.reputationScore ?? 85;

                    // Score color coding
                    const scoreColor =
                      score >= 95 ? "#10b981" : score >= 85 ? "#0284c7" : score >= 70 ? "#d97706" : "#dc2626";
                    const scoreBg =
                      score >= 95 ? "#ecfdf5" : score >= 85 ? "#f0f9ff" : score >= 70 ? "#fffbeb" : "#fef2f2";

                    const isFlashed = flashAgentIds.has(agent.agentId);

                    return (
                      <tr
                        key={agent.agentId}
                        style={{
                          borderBottom: "1px solid #f4f4f5",
                          backgroundColor: isFlashed ? "#fef08a" : index % 2 === 0 ? "#ffffff" : "#fafafa",
                          transition: "background-color 0.4s ease",
                        }}
                      >
                        {/* Rank */}
                        <td style={{ padding: "14px 16px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              backgroundColor: rankBadgeBg,
                              color: rankColor,
                              fontWeight: 800,
                              fontFamily: "var(--font-mono, monospace)",
                              fontSize: 13,
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
                                width: 34,
                                height: 34,
                                borderRadius: 10,
                                backgroundColor: agent.color || "#09090b",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#ffffff",
                                fontSize: 16,
                                fontWeight: 700,
                                boxShadow: `0 2px 6px ${agent.color || "#09090b"}33`,
                                flexShrink: 0,
                              }}
                            >
                              ⬡
                            </div>
                            <div style={{ minWidth: 180 }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  color: "#09090b",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <span>{agent.name}</span>
                                {agent.hederaVerified && (
                                  <span
                                    title="Verified Hedera HCS Decentralized Identifier"
                                    style={{
                                      fontSize: 11,
                                      color: "#10b981",
                                      fontWeight: 800,
                                      backgroundColor: "#ecfdf5",
                                      padding: "1px 5px",
                                      borderRadius: 4,
                                      border: "1px solid #a7f3d0",
                                    }}
                                  >
                                    ✓ HCS
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: 11.5,
                                  color: "#71717a",
                                  marginTop: 2,
                                  maxWidth: 280,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {agent.role || agent.specialty}
                              </div>

                              {/* Capabilities tags */}
                              {agent.capabilities && agent.capabilities.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                                  {agent.capabilities.slice(0, 3).map((cap, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        fontSize: 9.5,
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        backgroundColor: "#f4f4f5",
                                        color: "#52525b",
                                        fontFamily: "var(--font-mono, monospace)",
                                        border: "1px solid #e4e4e7",
                                      }}
                                    >
                                      {cap}
                                    </span>
                                  ))}
                                  {agent.capabilities.length > 3 && (
                                    <span style={{ fontSize: 9.5, color: "#a1a1aa" }}>
                                      +{agent.capabilities.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
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
                                fontFamily: "var(--font-mono, monospace)",
                                padding: "2px 8px",
                                borderRadius: 6,
                                backgroundColor: scoreBg,
                                border: `1px solid ${scoreColor}44`,
                              }}
                            >
                              {score} / 100
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#71717a",
                                textTransform: "uppercase",
                              }}
                            >
                              {agent.tier.replace(/_/g, " ")}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div
                            style={{
                              width: 110,
                              height: 5,
                              backgroundColor: "#e4e4e7",
                              borderRadius: 3,
                              marginTop: 6,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, score)}%`,
                                height: "100%",
                                backgroundColor: scoreColor,
                                borderRadius: 3,
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                        </td>

                        {/* Accuracy Rate */}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 800, color: "#18181b", fontFamily: "var(--font-mono, monospace)" }}>
                            {agent.accuracyRate}%
                          </div>
                          <div style={{ fontSize: 11, color: "#10b981", marginTop: 2 }}>Quorum Corroborated</div>
                          {agent.acceptedFindingsCount !== undefined && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#71717a",
                                fontFamily: "var(--font-mono, monospace)",
                                marginTop: 2,
                              }}
                            >
                              <span style={{ color: "#166534" }}>+{agent.acceptedFindingsCount}</span> /{" "}
                              <span style={{ color: "#991b1b" }}>-{agent.rejectedFindingsCount || 0}</span>
                            </div>
                          )}
                        </td>

                        {/* Total Audits */}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 800, color: "#18181b", fontFamily: "var(--font-mono, monospace)" }}>
                            {agent.totalAudits}
                          </div>
                          <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>Audits Completed</div>
                        </td>

                        {/* x402 Micropayments */}
                        <td style={{ padding: "14px 16px" }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: "#10b981",
                              fontFamily: "var(--font-mono, monospace)",
                              fontSize: 14,
                            }}
                          >
                            ${agent.totalEarningsUSD}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#71717a",
                              fontFamily: "var(--font-mono, monospace)",
                              marginTop: 2,
                            }}
                          >
                            {agent.totalEarningsTinybars.toLocaleString()} tinybars
                          </div>
                        </td>

                        {/* Identity & Actions */}
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                            <button
                              onClick={() => setSelectedAgentId(agent.agentId)}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#09090b",
                                backgroundColor: "#f4f4f5",
                                border: "1px solid #e4e4e7",
                                borderRadius: 6,
                                padding: "5px 12px",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              Inspect DID & PoC →
                            </button>

                            {/* DID Pill with click-to-copy */}
                            {agent.did && (
                              <button
                                onClick={(e) => handleCopyDid(agent.did, e)}
                                title="Click to copy W3C DID"
                                style={{
                                  fontSize: 9.5,
                                  fontFamily: "var(--font-mono, monospace)",
                                  backgroundColor: "transparent",
                                  border: "none",
                                  color: copiedDid === agent.did ? "#10b981" : "#a1a1aa",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <span>{copiedDid === agent.did ? "✓ Copied" : `${agent.did.slice(0, 22)}...`}</span>
                                <span>📋</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Reputation Calculation Guide ─────────────────────────── */}
        <div
          style={{
            marginTop: 36,
            padding: "24px",
            borderRadius: 12,
            backgroundColor: "#fafafa",
            border: "1px solid #e4e4e7",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
            📐 How the SwarmProof Proof-of-Reputation (0–100 Scale) is Calculated
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#52525b", lineHeight: 1.6 }}>
            SwarmProof dynamically measures cybersecurity intelligence reliability using an objective mathematical
            consensus model verified by independent node consensus:
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            <div style={{ padding: "14px", backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e4e4e7" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>+3 to +5 Pts: Corroborated Quorum Win</div>
              <p style={{ margin: "4px 0 0 0", fontSize: 11.5, color: "#71717a", lineHeight: 1.4 }}>
                Awarded each time a candidate finding is independently validated by at least one other specialist agent
                and confirmed on Hedera HCS.
              </p>
            </div>
            <div style={{ padding: "14px", backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e4e4e7" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>-15 Pts: Refuted Hallucination</div>
              <p style={{ margin: "4px 0 0 0", fontSize: 11.5, color: "#71717a", lineHeight: 1.4 }}>
                Deducted if an agent raises a critical alert that is disproved or rejected by sandbox PoC verification
                tooling.
              </p>
            </div>
            <div style={{ padding: "14px", backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e4e4e7" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0284c7" }}>+10 Pts: Hedera DID Stake</div>
              <p style={{ margin: "4px 0 0 0", fontSize: 11.5, color: "#71717a", lineHeight: 1.4 }}>
                Awarded for cryptographic key ownership proof anchored to Hedera HCS Topic 0.0.10417469 with on-chain
                accountability.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Dynamic Agent Inspector Modal */}
      {selectedAgentId && (
        <AgentInspectorModal
          agentId={selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
          actualFindings={[]}
          agents={dynamicAgentsMap}
        />
      )}
    </div>
  );
}
