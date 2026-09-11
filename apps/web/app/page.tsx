"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SwarmSimulation3D } from "./components/SwarmSimulation3D";
import { AgentInspectorModal } from "./components/AgentInspectorModal";
import { RegisterAgentModal } from "./components/RegisterAgentModal";
import { AuditPoolModal } from "./components/AuditPoolModal";
import { FullAuditReportModal } from "./components/FullAuditReportModal";
import { SwarmScoreGauge } from "./components/SwarmScoreGauge";
import { CONTRACT_PRESETS, type ContractPreset } from "./components/presets";
import { SPECIALIST_AGENTS, createAgentMetaFromBackend, type SpecialistAgentMeta } from "./components/agentData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

interface AuditProof {
  hcsTopicId: string;
  sequenceNumber?: number;
  consensusTimestamp?: string;
  reportHash: string;
  verified: boolean;
}

interface FindingItem {
  id: string;
  category: string;
  severity: string;
  locations?: string[];
  location?: string;
  agents?: string[];
  snippets?: string[];
  evidence?: string[];
  title?: string;
}

interface AuditRecord {
  id: string;
  status: "payment-required" | "running" | "done" | "failed" | "unpaid";
  task?: {
    contractName: string;
    network: string;
  };
  findings?: FindingItem[];
  report?: {
    result: string;
    consensusSummary?: string;
    findings?: FindingItem[];
    reportHash?: string;
  };
  proof?: AuditProof;
  reportHash?: string;
  error?: string;
}

export default function Home() {
  const [selectedPreset, setSelectedPreset] = useState<string>("reentrancy");
  const [contractName, setContractName] = useState("EtherVault");
  const [sourceCode, setSourceCode] = useState(CONTRACT_PRESETS[0]!.source);

  // Swarm & Audit execution state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditPhase, setAuditPhase] = useState<"idle" | "payment" | "analyzing" | "consensus" | "verifying" | "anchored">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<AuditRecord | null>(null);

  // Selected agent for 3D inspection modal
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Dynamic Agent Registry
  const [allAgents, setAllAgents] = useState<Record<string, SpecialistAgentMeta>>(SPECIALIST_AGENTS);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [is3DFullscreen, setIs3DFullscreen] = useState(false);
  const [isFullReportOpen, setIsFullReportOpen] = useState(false);

  // Fetch live agents on mount from Hedera / API registry
  useEffect(() => {
    async function loadAgents() {
      try {
        const res = await fetch(`${API_BASE}/agents`);
        if (res.ok) {
          const data = (await res.json()) as { agents: any[] };
          if (Array.isArray(data.agents)) {
            setAllAgents((prev) => {
              const nextMap = { ...prev };
              for (const a of data.agents) {
                nextMap[a.agentId] = createAgentMetaFromBackend(a);
              }
              return nextMap;
            });
          }
        }
      } catch (err) {
        console.warn("Could not load backend agents, using defaults:", err);
      }
    }
    loadAgents();
  }, []);

  // Handle Preset Change
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = CONTRACT_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setContractName(preset.contractName);
      setSourceCode(preset.source);
    }
  };

  // Run full swarm audit pipeline
  async function runSwarmAudit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIsAuditing(true);
    setAuditResult(null);

    try {
      // 1. Payment Challenge & Initialization
      setAuditPhase("payment");
      setStatusMessage("Phase 1: Submitting contract & settling x402 payment on Hedera testnet…");

      const createRes = await fetch(`${API_BASE}/audits`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractName, source: sourceCode }),
      });

      if (!createRes.ok) {
        throw new Error(`API returned HTTP ${createRes.status}`);
      }

      const { id } = (await createRes.json()) as { id: string };

      // 2. Parallel Specialist Agent Analysis
      setAuditPhase("analyzing");
      const agentCount = Object.keys(allAgents).length;
      setStatusMessage(`Phase 2: ${agentCount} Specialist Agents analyzing "${contractName}" in parallel…`);

      // Poll audit record
      let completedRecord: AuditRecord | null = null;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1200));

        if (i === 3) {
          setAuditPhase("consensus");
          setStatusMessage("Phase 3: Multi-agent clustering & weighted quorum consensus…");
        } else if (i === 7) {
          setAuditPhase("verifying");
          setStatusMessage("Phase 4: Tooling verification reproducing candidate findings…");
        }

        const pollRes = await fetch(`${API_BASE}/audits/${id}`);
        if (pollRes.ok) {
          const rec = (await pollRes.json()) as AuditRecord;
          if (rec.status === "done") {
            completedRecord = rec;
            break;
          } else if (rec.status === "failed") {
            throw new Error(rec.error || "Swarm audit failed");
          }
        }
      }

      if (completedRecord) {
        setAuditPhase("anchored");
        setStatusMessage(`Audit complete! Proof anchored to Hedera HCS Topic 0.0.10417469`);
        setAuditResult(completedRecord);
      } else {
        setStatusMessage("Audit polling timed out — check API logs in your terminal.");
      }
    } catch (err) {
      setStatusMessage(`Error during audit: ${(err as Error).message}`);
    } finally {
      setIsAuditing(false);
    }
  }

  // Quick simulation trigger for testing visual beams & states
  const triggerSimulation = () => {
    setIsAuditing(true);
    setAuditPhase("analyzing");
    setStatusMessage("Simulation: 5 Specialist AI Agents scanning AST & executing domain prompts…");

    setTimeout(() => {
      setAuditPhase("consensus");
      setStatusMessage("Simulation: Calculating weighted voting quorum across agents…");
    }, 2500);

    setTimeout(() => {
      setAuditPhase("anchored");
      setStatusMessage("Simulation complete: Consensus report generated and proof verified.");
      setIsAuditing(false);
    }, 5500);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "#18181b" }}>
      {/* ── Minimalist Editorial Header ─────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e4e4e7" }}>
        <div style={{ maxWidth: 1024, margin: "0 auto", padding: "14px 24px", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          {/* Brand & Metadata */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Monochromatic Geometric Brand Mark */}
              <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: "#09090b", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, letterSpacing: -0.5 }}>
                SP
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#09090b", letterSpacing: -0.2 }}>SwarmProof</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, padding: "2px 6px", borderRadius: 4, backgroundColor: "#f4f4f5", color: "#52525b", border: "1px solid #e4e4e7" }}>
                    3D Visualizer
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "#71717a", fontFamily: "var(--font-mono)", letterSpacing: -0.2 }}>
                  ETHGlobal Online 2026 / Hedera Agentic Payments
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setIsPoolModalOpen(true)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#09090b",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#16a34a", display: "inline-block" }} />
              <span>⚡ Live Audit Pool</span>
            </button>

            <Link
              href="/leaderboard"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#09090b",
                backgroundColor: "#f4f4f5",
                border: "1px solid #e4e4e7",
                borderRadius: 6,
                padding: "6px 12px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              🏆 Leaderboard & Reputation
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
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
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
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Payment Lab (x402)
            </Link>

            <a
              href="https://hashscan.io/testnet/topic/0.0.10417469"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                color: "#09090b",
                backgroundColor: "#ffffff",
                border: "1px solid #d4d4d8",
                borderRadius: 6,
                padding: "6px 12px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#09090b" }} />
              <span>Topic 0.0.10417469</span>
              <svg style={{ width: 12, height: 12, color: "#a1a1aa" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>

            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              style={{
                fontSize: 12,
                fontWeight: 500,
                backgroundColor: "#09090b",
                color: "#ffffff",
                border: "1px solid #09090b",
                borderRadius: 6,
                padding: "6px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              + Register Agent
            </button>
          </div>
        </div>

        {/* Subtle Navigation Underline Bar */}
        <div style={{ borderTop: "1px solid #e4e4e7", backgroundColor: "rgba(250, 250, 250, 0.6)" }}>
          <div style={{ maxWidth: 1024, margin: "0 auto", padding: "4px 24px", display: "flex", alignItems: "center", gap: 4, overflowX: "auto" }}>
            <span
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                color: "#09090b",
                backgroundColor: "#ffffff",
                border: "1px solid #d4d4d8",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                whiteSpace: "nowrap",
              }}
            >
              3D Swarm Visualizer
            </span>
            <Link
              href="/feedback"
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                color: "#52525b",
                border: "1px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Executive Pitch
            </Link>
            <Link
              href="/feedback"
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                color: "#52525b",
                border: "1px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              SDK &amp; MCP Architecture
            </Link>
            <Link
              href="/feedback"
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                color: "#52525b",
                border: "1px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              W3C did:hedera
            </Link>
            <Link
              href="/feedback"
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                color: "#52525b",
                border: "1px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              On-Chain Proofs
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ────────────────────────────────────────── */}
      <main style={{ maxWidth: 1024, margin: "0 auto", padding: "32px 24px 64px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* 3D Simulation Deck Card */}
        <section style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 10, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "#71717a", fontWeight: 600 }}>
                Consensus Visualizer
              </span>
              <h2 style={{ margin: "2px 0 0 0", fontSize: 20, fontWeight: 700, color: "#09090b", letterSpacing: -0.3 }}>
                Multi-Agent Security Quorum Simulation
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#52525b", lineHeight: 1.5 }}>
                {Object.keys(allAgents).length} specialist agents analyze the AST concurrently, challenge each other, and transmit findings to the central Hedera consensus topic. Click any agent geometry to inspect its sovereign DID and neural thought stream.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => setIs3DFullscreen((prev) => !prev)}
                className="btn-swarm-secondary"
                style={{ fontSize: 12, padding: "6px 12px" }}
                title="Toggle immersive fullscreen 3D mode (or press F)"
              >
                <span>{is3DFullscreen ? "🗗" : "⛶"}</span> {is3DFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
              </button>

              <button
                type="button"
                onClick={triggerSimulation}
                disabled={isAuditing}
                className="btn-swarm-secondary"
                style={{ fontSize: 12, padding: "6px 12px" }}
              >
                ⚡ Trigger Beams
              </button>
            </div>
          </div>

          {/* The 3D Canvas */}
          <SwarmSimulation3D
            activeAgentId={selectedAgentId}
            onSelectAgent={(agentId) => setSelectedAgentId(agentId)}
            isAuditing={isAuditing}
            auditPhase={auditPhase}
            agents={allAgents}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
            isFullscreen={is3DFullscreen}
            onToggleFullscreen={setIs3DFullscreen}
          />
        </section>

        {/* ── Contract Audit & Terminal Workspace Grid ────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
          {/* Left Column: Code Editor & Contract Setup */}
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "#71717a", fontWeight: 600 }}>
                  Audit Target
                </span>
                <h3 style={{ margin: "2px 0 0 0", fontSize: 15, fontWeight: 700, color: "#09090b" }}>
                  Smart Contract Target
                </h3>
              </div>

              {/* Preset Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#71717a" }}>Preset:</span>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  style={{ fontSize: 12, padding: "5px 8px", backgroundColor: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 6 }}
                >
                  {CONTRACT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} ({preset.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#52525b", whiteSpace: "nowrap" }}>
                Contract Name:
              </label>
              <input
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                style={{ flex: 1, padding: "6px 10px", fontSize: 12, backgroundColor: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 6 }}
                placeholder="e.g. EtherVault"
              />
            </div>

            {/* Code Textarea in Dark Monochromatic Surface */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#71717a", fontFamily: "var(--font-mono)" }}>
                  Solidity Source Code (.sol):
                </span>
                <span style={{ fontSize: 11, color: "#a1a1aa", fontFamily: "var(--font-mono)" }}>
                  {sourceCode.split("\n").length} lines
                </span>
              </div>
              <div style={{ borderRadius: 6, border: "1px solid #27272a", backgroundColor: "#09090b", overflow: "hidden" }}>
                <div style={{ padding: "6px 12px", borderBottom: "1px solid #27272a", fontSize: 11, fontFamily: "var(--font-mono)", color: "#a1a1aa", display: "flex", justifyContent: "space-between" }}>
                  <span>{contractName}.sol</span>
                  <span>Solidity</span>
                </div>
                <textarea
                  value={sourceCode}
                  onChange={(e) => setSourceCode(e.target.value)}
                  rows={15}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    minHeight: 260,
                    lineHeight: 1.5,
                    tabSize: 4,
                    backgroundColor: "#09090b",
                    color: "#f4f4f5",
                    border: "none",
                    borderRadius: 0,
                    padding: 12,
                    fontSize: 12,
                    outline: "none",
                    fontFamily: "var(--font-mono)",
                  }}
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={() => runSwarmAudit()}
                disabled={isAuditing}
                className="btn-swarm-primary"
                style={{ flex: 1, padding: "10px 16px", fontSize: 13, backgroundColor: "#09090b", color: "#ffffff", border: "1px solid #09090b" }}
              >
                {isAuditing ? (
                  <>
                    <span className="pulse-dot" style={{ backgroundColor: "#ffffff" }} />
                    Swarm Auditing in Progress…
                  </>
                ) : (
                  <>Launch Swarm Audit</>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceCode(CONTRACT_PRESETS.find((p) => p.id === selectedPreset)?.source ?? "");
                }}
                className="btn-swarm-secondary"
                style={{ padding: "10px 14px", fontSize: 12 }}
                title="Reset to original preset code"
              >
                Reset Code
              </button>
            </div>
          </div>

          {/* Right Column: Swarm Lifecycle & Findings Console */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Swarm Lifecycle Progress Card */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "#71717a", fontWeight: 600 }}>
                    Telemetry
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: 15, fontWeight: 700, color: "#09090b" }}>
                    Execution Pipeline
                  </h3>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: 4,
                    backgroundColor: isAuditing ? "#faf5ff" : "#f4f4f5",
                    color: isAuditing ? "#7c3aed" : "#18181b",
                    border: "1px solid #e4e4e7",
                    fontWeight: 600,
                  }}
                >
                  {isAuditing ? `Phase: ${auditPhase}` : "Ready"}
                </span>
              </div>

              {/* 5-Step Pipeline Graphic */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {[
                  { id: "payment", label: "01 Quote" },
                  { id: "analyzing", label: "02 5 Agents" },
                  { id: "consensus", label: "03 Quorum" },
                  { id: "verifying", label: "04 Verifier" },
                  { id: "anchored", label: "05 HCS Proof" },
                ].map((step, idx) => {
                  const stepIndex = ["payment", "analyzing", "consensus", "verifying", "anchored"].indexOf(auditPhase);
                  const isCurrent = auditPhase === step.id;
                  const isDone = auditResult !== null || stepIndex > idx;

                  return (
                    <div
                      key={step.id}
                      style={{
                        padding: "8px 4px",
                        borderRadius: 6,
                        textAlign: "center",
                        backgroundColor: isCurrent
                          ? "#09090b"
                          : isDone
                          ? "#f4f4f5"
                          : "#fafafa",
                        border: isCurrent
                          ? "1px solid #09090b"
                          : isDone
                          ? "1px solid #d4d4d8"
                          : "1px solid #e4e4e7",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          fontFamily: "var(--font-mono)",
                          display: "block",
                          color: isCurrent ? "#ffffff" : isDone ? "#09090b" : "#a1a1aa",
                        }}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Status Message Log */}
              {statusMessage && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 6,
                    backgroundColor: "#fafafa",
                    border: "1px solid #e4e4e7",
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: "#18181b",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span className="pulse-dot" style={{ backgroundColor: isAuditing ? "#09090b" : "#16a34a" }} />
                  {statusMessage}
                </div>
              )}
            </div>

            {/* Findings & Consensus Deck */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 10, padding: 20, flex: 1, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "#71717a", fontWeight: 600 }}>
                    Report
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: 15, fontWeight: 700, color: "#09090b" }}>
                    Consensus Findings
                  </h3>
                </div>
                {auditResult && (
                  <span
                    className={`swarm-tag ${
                      auditResult.report?.result === "verified" ? "swarm-tag-critical" : "swarm-tag-medium"
                    }`}
                  >
                    Verdict: {auditResult.report?.result?.toUpperCase()}
                  </span>
                )}
              </div>

              {auditResult ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* SwarmProof Trust & Security Rating */}
                  <SwarmScoreGauge
                    contractName={contractName}
                    findings={auditResult.report?.findings || auditResult.findings || []}
                    verified={auditResult.report?.result === "verified"}
                    compact={true}
                    showFactors={false}
                  />

                  {/* View Full Report CTA */}
                  <button
                    type="button"
                    onClick={() => setIsFullReportOpen(true)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      backgroundColor: "#09090b",
                      color: "#ffffff",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid #09090b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
                    }}
                  >
                    📄 View Full Formal Audit Report & PDF →
                  </button>

                  {/* Hedera Proof Receipt Box */}
                  {auditResult.proof && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        backgroundColor: "#fafafa",
                        border: "1px solid #e4e4e7",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <strong style={{ color: "#09090b", fontSize: 12 }}>Hedera HCS Proof Anchored:</strong>
                        <a
                          href={`https://hashscan.io/testnet/topic/${auditResult.proof.hcsTopicId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "#09090b",
                            textDecoration: "underline",
                          }}
                        >
                          Topic: {auditResult.proof.hcsTopicId} ↗
                        </a>
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#52525b", wordBreak: "break-all" }}>
                        Report SHA-256 Hash: {auditResult.proof.reportHash || auditResult.reportHash}
                      </div>
                    </div>
                  )}

                  {/* Findings list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto" }}>
                    {(auditResult.report?.findings || auditResult.findings || []).map((f, i) => (
                      <div
                        key={f.id || i}
                        style={{
                          padding: 12,
                          borderRadius: 6,
                          backgroundColor: "#fafafa",
                          border: "1px solid #e4e4e7",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "#09090b" }}>
                            {f.title || `${f.category.toUpperCase()} Vulnerability`}
                          </span>
                          <span className={`swarm-tag swarm-tag-${(f.severity || "medium").toLowerCase()}`}>
                            {f.severity}
                          </span>
                        </div>

                        <div style={{ fontSize: 11, color: "#52525b", fontFamily: "var(--font-mono)" }}>
                          📍 {f.location || f.locations?.join(", ") || "contract"}
                        </div>

                        {f.agents && f.agents.length > 0 && (
                          <div style={{ fontSize: 11, color: "#71717a" }}>
                            Confirmed by:{" "}
                            {f.agents.map((ag) => (
                              <button
                                key={ag}
                                type="button"
                                onClick={() => setSelectedAgentId(ag)}
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  backgroundColor: "#f4f4f5",
                                  border: "1px solid #e4e4e7",
                                  color: "#09090b",
                                  fontSize: 10,
                                  fontFamily: "var(--font-mono)",
                                  marginRight: 4,
                                  cursor: "pointer",
                                }}
                              >
                                {ag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: 36,
                    textAlign: "center",
                    color: "#71717a",
                    fontSize: 13,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 28, color: "#71717a" }}>🔬</span>
                  <p style={{ margin: 0, lineHeight: 1.5 }}>
                    Click &ldquo;Launch Swarm Audit&rdquo; or click any agent node above to inspect its vulnerability detector.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── 3D Agent Detail Inspector Modal ──────────────────────── */}
      {selectedAgentId && (
        <AgentInspectorModal
          agentId={selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
          isAuditing={isAuditing}
          actualFindings={auditResult?.report?.findings || auditResult?.findings || []}
          onRunSingleAgentSimulation={() => triggerSimulation()}
          agents={allAgents}
        />
      )}

      {/* ── Register New Agent Modal (Hedera HCS Anchored) ────────── */}
      {isRegisterModalOpen && (
        <RegisterAgentModal
          onClose={() => setIsRegisterModalOpen(false)}
          onRegistered={(newAgent) => {
            setAllAgents((prev) => ({ ...prev, [newAgent.id]: newAgent }));
            setSelectedAgentId(newAgent.id);
          }}
        />
      )}

      {/* ── Live Audit Task Pool Modal ────────────────────────────── */}
      {isPoolModalOpen && (
        <AuditPoolModal onClose={() => setIsPoolModalOpen(false)} />
      )}

      {/* ── Full Formal Audit Report Modal (with PDF Print) ──────── */}
      {isFullReportOpen && auditResult && (
        <FullAuditReportModal
          auditResult={{
            ...auditResult,
            task: {
              contractName,
              source: sourceCode,
              network: "ethereum",
            },
          } as any}
          onClose={() => setIsFullReportOpen(false)}
        />
      )}
    </div>
  );
}