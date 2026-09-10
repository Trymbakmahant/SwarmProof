"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SwarmSimulation3D } from "./components/SwarmSimulation3D";
import { AgentInspectorModal } from "./components/AgentInspectorModal";
import { RegisterAgentModal } from "./components/RegisterAgentModal";
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
  const [is3DFullscreen, setIs3DFullscreen] = useState(false);

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
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-dark)" }}>
      {/* ── Top Navigation Bar ────────────────────────────────────── */}
      <header
        style={{
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "rgba(6, 9, 17, 0.9)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "linear-gradient(135deg, #00f5ff 0%, #14b8a6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                boxShadow: "0 0 15px rgba(0, 245, 255, 0.35)",
              }}
            >
              🐝
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>
                  SwarmProof
                </h1>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    background: "rgba(45, 212, 191, 0.15)",
                    color: "#2dd4bf",
                    border: "1px solid rgba(45, 212, 191, 0.3)",
                    padding: "1px 6px",
                    borderRadius: 6,
                    fontWeight: 700,
                  }}
                >
                  v0.2.0 • 3D Swarm
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
                Decentralized Multi-Agent Smart Contract Security Swarm
              </p>
            </div>
          </div>

          {/* Network & Protocol Status Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 10,
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "#34d399",
              }}
            >
              <span className="pulse-dot" style={{ backgroundColor: "#10b981", width: 6, height: 6 }} />
              Hedera Testnet: 0.0.10417469
            </div>

            <Link
              href="/x402"
              className="btn-swarm-secondary"
              style={{ fontSize: 12, padding: "8px 14px", textDecoration: "none" }}
            >
              💳 Payment Lab (x402) →
            </Link>

            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className="swarm-btn-primary"
              style={{
                fontSize: 12,
                padding: "8px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "linear-gradient(135deg, #00f5ff 0%, #0284c7 100%)",
                border: "1px solid rgba(0, 245, 255, 0.4)",
                color: "#050b14",
                fontWeight: 700,
                cursor: "pointer",
                borderRadius: 8,
              }}
            >
              <span>➕</span> Register Agent
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ────────────────────────────────────────── */}
      <main className="swarm-container">
        {/* Hero 3D Simulation Deck */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>
                Interactive 3D Multi-Agent Swarm Simulation
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                Watch the {Object.keys(allAgents).length} specialist agents interact, analyze code concurrently, and transmit findings to the central Hedera consensus core. Click any agent in 3D to inspect its live thoughts and findings.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(true)}
                className="swarm-btn-primary"
                style={{
                  fontSize: 12,
                  padding: "8px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(0, 245, 255, 0.15)",
                  border: "1px solid rgba(0, 245, 255, 0.4)",
                  color: "#00f5ff",
                  fontWeight: 700,
                  cursor: "pointer",
                  borderRadius: 8,
                }}
              >
                <span>➕</span> Register Agent
              </button>

              <button
                type="button"
                onClick={() => setIs3DFullscreen((prev) => !prev)}
                className="btn-swarm-secondary"
                style={{ fontSize: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
                title="Toggle immersive fullscreen 3D mode (or press F)"
              >
                <span>{is3DFullscreen ? "🗗" : "⛶"}</span> {is3DFullscreen ? "Exit Fullscreen" : "Fullscreen 3D View"}
              </button>

              <button
                type="button"
                onClick={triggerSimulation}
                disabled={isAuditing}
                className="btn-swarm-secondary"
                style={{ fontSize: 12, padding: "8px 16px" }}
              >
                ⚡ Test Agent Beams
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
        <div className="swarm-grid">
          {/* Left Column: Code Editor & Contract Setup */}
          <div className="swarm-card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                Smart Contract Security Target
              </h3>

              {/* Preset Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Preset:</span>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  style={{ fontSize: 12, padding: "6px 10px" }}
                >
                  {CONTRACT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} ({preset.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                Contract Name:
              </label>
              <input
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                style={{ flex: 1 }}
                placeholder="e.g. Vault"
              />
            </div>

            {/* Code Textarea */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  Solidity Source Code (.sol):
                </span>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {sourceCode.split("\n").length} lines
                </span>
              </div>
              <textarea
                value={sourceCode}
                onChange={(e) => setSourceCode(e.target.value)}
                rows={16}
                style={{
                  width: "100%",
                  resize: "vertical",
                  minHeight: 280,
                  lineHeight: 1.5,
                  tabSize: 4,
                }}
                spellCheck={false}
              />
            </div>

            {/* Action Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                onClick={() => runSwarmAudit()}
                disabled={isAuditing}
                className="btn-swarm-primary"
                style={{ flex: 1, padding: "12px 20px", fontSize: 14 }}
              >
                {isAuditing ? (
                  <>
                    <span className="pulse-dot" style={{ backgroundColor: "#030712" }} />
                    Swarm Auditing in Progress…
                  </>
                ) : (
                  <>🐝 Launch Swarm Audit</>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceCode(CONTRACT_PRESETS.find((p) => p.id === selectedPreset)?.source ?? "");
                }}
                className="btn-swarm-secondary"
                style={{ padding: "12px 16px" }}
                title="Reset to original preset code"
              >
                Reset Code
              </button>
            </div>
          </div>

          {/* Right Column: Swarm Lifecycle & Findings Console */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Swarm Lifecycle Progress Card */}
            <div className="swarm-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
                  Swarm Execution Pipeline
                </h3>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: isAuditing ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                    color: isAuditing ? "#f59e0b" : "#34d399",
                    fontWeight: 700,
                  }}
                >
                  {isAuditing ? `Phase: ${auditPhase}` : "Ready"}
                </span>
              </div>

              {/* 5-Step Pipeline Graphic */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {[
                  { id: "payment", label: "1. x402 Quote" },
                  { id: "analyzing", label: "2. 5 Agents" },
                  { id: "consensus", label: "3. Quorum" },
                  { id: "verifying", label: "4. Verifier" },
                  { id: "anchored", label: "5. HCS Proof" },
                ].map((step, idx) => {
                  const stepIndex = ["payment", "analyzing", "consensus", "verifying", "anchored"].indexOf(auditPhase);
                  const isCurrent = auditPhase === step.id;
                  const isDone = auditResult !== null || stepIndex > idx;

                  return (
                    <div
                      key={step.id}
                      style={{
                        padding: "8px 6px",
                        borderRadius: 8,
                        textAlign: "center",
                        background: isCurrent
                          ? "rgba(0, 245, 255, 0.15)"
                          : isDone
                          ? "rgba(16, 185, 129, 0.1)"
                          : "#090f1d",
                        border: isCurrent
                          ? "1px solid #00f5ff"
                          : isDone
                          ? "1px solid rgba(16, 185, 129, 0.3)"
                          : "1px solid var(--border-color)",
                        transition: "all 0.3s ease",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          display: "block",
                          color: isCurrent ? "#00f5ff" : isDone ? "#34d399" : "#64748b",
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
                    borderRadius: 10,
                    background: "#070b14",
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: isAuditing ? "#38bdf8" : "#a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span className="pulse-dot" style={{ backgroundColor: isAuditing ? "#00f5ff" : "#10b981" }} />
                  {statusMessage}
                </div>
              )}
            </div>

            {/* Findings & Consensus Deck */}
            <div className="swarm-card" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
                  Consensus Security Report
                </h3>
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
                  {/* Hedera Proof Receipt Box */}
                  {auditResult.proof && (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <strong style={{ color: "#34d399" }}>🛡️ Hedera HCS Proof Anchored:</strong>
                        <a
                          href={`https://hashscan.io/testnet/topic/${auditResult.proof.hcsTopicId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "#00f5ff",
                            textDecoration: "none",
                          }}
                        >
                          Topic: {auditResult.proof.hcsTopicId} ↗
                        </a>
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#94a3b8", wordBreak: "break-all" }}>
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
                          borderRadius: 12,
                          background: "#080e1c",
                          border: "1px solid var(--border-color)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>
                            {f.title || `${f.category.toUpperCase()} Vulnerability`}
                          </span>
                          <span className={`swarm-tag swarm-tag-${(f.severity || "medium").toLowerCase()}`}>
                            {f.severity}
                          </span>
                        </div>

                        <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: "var(--font-mono)" }}>
                          📍 {f.location || f.locations?.join(", ") || "contract"}
                        </div>

                        {f.agents && f.agents.length > 0 && (
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            Confirmed by:{" "}
                            {f.agents.map((ag) => (
                              <button
                                key={ag}
                                type="button"
                                onClick={() => setSelectedAgentId(ag)}
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "#132038",
                                  color: "#00f5ff",
                                  fontSize: 10,
                                  fontFamily: "var(--font-mono)",
                                  marginRight: 4,
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
                    padding: 30,
                    textAlign: "center",
                    color: "var(--text-dim)",
                    fontSize: 13,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 32 }}>🔬</span>
                  <p style={{ margin: 0 }}>
                    Click &ldquo;Launch Swarm Audit&rdquo; or click any agent above to inspect its vulnerability detector.
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
    </div>
  );
}