"use client";

import { useEffect, useState } from "react";
import { SPECIALIST_AGENTS, type SpecialistAgentMeta } from "./agentData";

interface AgentInspectorModalProps {
  agentId: string | null;
  onClose: () => void;
  isAuditing?: boolean;
  actualFindings?: Array<{
    id: string;
    title?: string;
    category: string;
    severity: string;
    location?: string;
    locations?: string[];
    evidence?: string[];
    snippets?: string[];
    agents?: string[];
  }>;
  onRunSingleAgentSimulation?: (agentId: string) => void;
  agents?: Record<string, SpecialistAgentMeta>;
}

export function AgentInspectorModal({
  agentId,
  onClose,
  isAuditing = false,
  actualFindings = [],
  onRunSingleAgentSimulation,
  agents = SPECIALIST_AGENTS,
}: AgentInspectorModalProps) {
  const [activeTab, setActiveTab] = useState<"findings" | "thoughts" | "identity">("findings");
  const [isSimulating, setIsSimulating] = useState(false);
  const [thoughtIndex, setThoughtIndex] = useState(0);
  const [viewJsonMode, setViewJsonMode] = useState<"none" | "did" | "credential">("none");
  const [copiedDid, setCopiedDid] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDid(true);
    setTimeout(() => setCopiedDid(false), 2500);
  };

  const agent: SpecialistAgentMeta | undefined = agentId ? agents[agentId] : undefined;

  // Filter findings relevant to this agent
  const agentFindings = actualFindings.filter(
    (f) =>
      f.id?.includes(agentId ?? "") ||
      f.category?.toLowerCase() === agent?.shortName.toLowerCase() ||
      f.agents?.includes(agentId ?? ""),
  );

  useEffect(() => {
    setThoughtIndex(0);
  }, [agentId]);

  // Simulate thought stream stepping when simulating or auditing
  useEffect(() => {
    if (!agent || (!isSimulating && !isAuditing)) return;
    const interval = setInterval(() => {
      setThoughtIndex((prev) => (prev + 1) % agent.simulatedThoughts.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [agent, isSimulating, isAuditing]);

  if (!agent) return null;

  const handleSimulate = () => {
    setIsSimulating(true);
    if (onRunSingleAgentSimulation) {
      onRunSingleAgentSimulation(agent.id);
    }
    setTimeout(() => {
      setIsSimulating(false);
    }, 6000);
  };

  return (
    <div className="swarm-modal-backdrop" onClick={onClose}>
      <div
        className="swarm-modal-window"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: `0 0 50px ${agent.color}20` }}
      >
        {/* Header with Glowing Accent Banner */}
        <div
          className="swarm-modal-header"
          style={{
            background: `linear-gradient(90deg, ${agent.color}15 0%, rgba(11, 18, 34, 0.4) 100%)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Shape Badge */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                backgroundColor: `${agent.color}20`,
                border: `1px solid ${agent.color}`,
                color: agent.color,
                boxShadow: `0 0 16px ${agent.color}30`,
              }}
            >
              {agent.shape === "octahedron" && "💎"}
              {agent.shape === "dodecahedron" && "🛡️"}
              {agent.shape === "torusKnot" && "♾️"}
              {agent.shape === "icosahedron" && "💠"}
              {agent.shape === "gyroscope" && "⚙️"}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#fff" }}>{agent.name}</h3>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    padding: "2px 8px",
                    borderRadius: 20,
                    textTransform: "uppercase",
                    fontWeight: 700,
                    backgroundColor: `${agent.color}15`,
                    border: `1px solid ${agent.color}40`,
                    color: agent.color,
                  }}
                >
                  {agent.shapeLabel}
                </span>
              </div>
              <p style={{ margin: "3px 0 0 0", fontSize: 12, color: "#94a3b8" }}>{agent.role}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-swarm-secondary"
            style={{ width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 14 }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border-color)", background: "#080d19" }}>
          <button
            type="button"
            onClick={() => setActiveTab("findings")}
            style={{
              flex: 1,
              padding: "12px 16px",
              fontSize: 12,
              fontWeight: 600,
              background: "transparent",
              borderRadius: 0,
              borderBottom: activeTab === "findings" ? "2px solid #00f5ff" : "2px solid transparent",
              color: activeTab === "findings" ? "#fff" : "#94a3b8",
            }}
          >
            Findings & Detections ({agentFindings.length > 0 ? agentFindings.length : 1})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("thoughts")}
            style={{
              flex: 1,
              padding: "12px 16px",
              fontSize: 12,
              fontWeight: 600,
              background: "transparent",
              borderRadius: 0,
              borderBottom: activeTab === "thoughts" ? "2px solid #00f5ff" : "2px solid transparent",
              color: activeTab === "thoughts" ? "#fff" : "#94a3b8",
            }}
          >
            Live Thought Stream
            {(isSimulating || isAuditing) && (
              <span className="pulse-dot" style={{ backgroundColor: "#00f5ff", marginLeft: 6 }} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("identity")}
            style={{
              flex: 1,
              padding: "12px 16px",
              fontSize: 12,
              fontWeight: 600,
              background: "transparent",
              borderRadius: 0,
              borderBottom: activeTab === "identity" ? "2px solid #00f5ff" : "2px solid transparent",
              color: activeTab === "identity" ? "#fff" : "#94a3b8",
            }}
          >
            Hedera Identity & x402
          </button>
        </div>

        {/* Modal Body */}
        <div className="swarm-modal-body">
          {activeTab === "findings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8" }}>
                  Domain Detection Results:
                </span>
                <button
                  type="button"
                  onClick={handleSimulate}
                  disabled={isSimulating || isAuditing}
                  className="btn-swarm-primary"
                  style={{ fontSize: 11, padding: "6px 14px" }}
                >
                  ⚡ {isSimulating ? "Analyzing Code…" : "Trigger Domain Scan"}
                </button>
              </div>

              {agentFindings.length > 0 ? (
                agentFindings.map((finding, idx) => (
                  <div
                    key={finding.id || idx}
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      background: "#0f172a",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{finding.title}</span>
                      <span className={`swarm-tag swarm-tag-${finding.severity.toLowerCase()}`}>
                        {finding.severity}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#cbd5e1", background: "#070b14", padding: "6px 10px", borderRadius: 8, border: "1px solid #1e293b" }}>
                      📍 Location: {finding.location || finding.locations?.join(", ") || "contract"}
                    </div>

                    {(finding.evidence || finding.snippets) && (
                      <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                        <span style={{ fontWeight: 600, color: "#94a3b8" }}>Evidence:</span>
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: 18, fontSize: 11 }}>
                          {(finding.evidence || finding.snippets || []).map((ev, i) => (
                            <li key={i}>{ev}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                /* Sample domain finding representation */
                <div
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: "#0f172a",
                    border: "1px solid var(--border-color)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{agent.sampleFinding.title}</span>
                    <span className={`swarm-tag swarm-tag-${agent.sampleFinding.severity}`}>
                      {agent.sampleFinding.severity}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#cbd5e1", background: "#070b14", padding: "6px 10px", borderRadius: 8, border: "1px solid #1e293b" }}>
                    📍 Location: {agent.sampleFinding.location}
                  </div>

                  <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                    <span style={{ fontWeight: 600, color: "#94a3b8" }}>Detection Evidence:</span>
                    <p style={{ margin: "4px 0 0 0", fontSize: 11, fontFamily: "var(--font-mono)", background: "#060911", padding: 8, borderRadius: 6, border: "1px solid #1e293b" }}>
                      {agent.sampleFinding.evidence}
                    </p>
                  </div>

                  <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                    <span style={{ fontWeight: 600, color: "#94a3b8" }}>Specialist Reasoning:</span>
                    <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                      {agent.sampleFinding.reasoning}
                    </p>
                  </div>
                </div>
              )}

              {/* 3D Shape Rationale Card */}
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "#090f1d",
                  border: "1px solid #1a2538",
                  fontSize: 12,
                  color: "#94a3b8",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 18 }}>💡</span>
                <div>
                  <strong style={{ color: "#e2e8f0" }}>3D Shape Representation: </strong>
                  {agent.shapeRationale}
                </div>
              </div>
            </div>
          )}

          {activeTab === "thoughts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8" }}>
                  Real-time Neural Thought Stream:
                </span>
                <span style={{ color: "#00f5ff", fontSize: 11, fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="pulse-dot" style={{ backgroundColor: "#00f5ff" }} />
                  Live Swarm Broadcast
                </span>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: "#060a14",
                  border: "1px solid #162035",
                  maxHeight: 280,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {agent.simulatedThoughts.map((thought, idx) => {
                  const isCurrent = idx === thoughtIndex;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: isCurrent ? "#101b33" : "transparent",
                        borderLeft: isCurrent ? "3px solid #00f5ff" : "3px solid transparent",
                        color: isCurrent ? "#38bdf8" : "#64748b",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span style={{ color: "#475569", userSelect: "none" }}>[{idx + 1}]</span>
                      <p style={{ margin: 0, lineHeight: 1.5 }}>{thought}</p>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: 14, borderRadius: 12, background: "#0a1020", border: "1px solid #1c273c" }}>
                <strong style={{ color: "#e2e8f0", fontSize: 12, display: "block", marginBottom: 4 }}>
                  Specialist Domain System Prompt:
                </strong>
                <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                  {agent.systemPromptSummary}
                </p>
              </div>
            </div>
          )}

          {activeTab === "identity" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* W3C Sovereign DID Header Card */}
              <div
                style={{
                  backgroundColor: "rgba(0, 245, 255, 0.05)",
                  border: `1px solid ${agent.color}40`,
                  borderRadius: 14,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: `${agent.color}20`,
                      color: agent.color,
                      border: `1px solid ${agent.color}50`,
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    W3C did:hedera Standard
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid #10b981",
                      color: "#10b981",
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontWeight: 600,
                    }}
                  >
                    ● Verifiable Credential Issued
                  </span>
                </div>

                <div>
                  <span style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>
                    W3C Decentralized Identifier (DID URI):
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 4,
                      background: "rgba(0,0,0,0.4)",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #1e293b",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "#fff",
                        fontSize: 12,
                        wordBreak: "break-all",
                        fontWeight: 600,
                      }}
                    >
                      {agent.did || `did:hedera:testnet:${agent.identityTopicId || "0.0.10417469"}_${agent.id}`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          agent.did ||
                            `did:hedera:testnet:${agent.identityTopicId || "0.0.10417469"}_${agent.id}`,
                        )
                      }
                      className="swarm-btn-secondary"
                      style={{ fontSize: 11, padding: "4px 8px", whiteSpace: "nowrap" }}
                    >
                      {copiedDid ? "✓ Copied" : "📋 Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Identity & Payment Details Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 14, background: "#090f1d", border: "1px solid var(--border-color)" }}>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: 11, marginBottom: 4 }}>
                    Hedera HCS Topic:
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "#2dd4bf", fontWeight: 700, fontSize: 13 }}>
                    {agent.identityTopicId || "0.0.10417469"}
                  </span>
                  <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "#64748b" }}>Anchor on Hedera Testnet</p>
                </div>

                <div style={{ padding: 14, borderRadius: 14, background: "#090f1d", border: "1px solid var(--border-color)" }}>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: 11, marginBottom: 4 }}>
                    Payout Revenue Share (x402):
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "#f59e0b", fontWeight: 700, fontSize: 13 }}>
                    {agent.paymentAddress || "0.0.10417474"}
                  </span>
                  <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "#64748b" }}>Direct micropayment allocation</p>
                </div>
              </div>

              {agent.identityReference && (
                <div style={{ padding: 14, borderRadius: 14, background: "#090f1d", border: "1px solid var(--border-color)" }}>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: 11, marginBottom: 4 }}>
                    On-Chain Identity Transaction Reference:
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: agent.color,
                      fontSize: 11,
                      wordBreak: "break-all",
                    }}
                  >
                    {agent.identityReference}
                  </span>
                  {agent.consensusTimestamp && (
                    <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "#64748b" }}>
                      Consensus Timestamp: {agent.consensusTimestamp}
                    </p>
                  )}
                </div>
              )}

              {/* Capabilities */}
              <div style={{ padding: 14, borderRadius: 14, background: "#090f1d", border: "1px solid var(--border-color)" }}>
                <span style={{ color: "#94a3b8", display: "block", fontSize: 11, marginBottom: 8 }}>
                  Specialist Verified Capabilities:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 8,
                        background: "#162035",
                        color: "#38bdf8",
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        border: "1px solid rgba(56, 189, 248, 0.2)",
                      }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* Interactive W3C JSON-LD Inspector Buttons */}
              <div style={{ padding: 14, borderRadius: 14, background: "#090f1d", border: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong style={{ color: "#fff", fontSize: 12 }}>W3C Cryptographic Proofs:</strong>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setViewJsonMode(viewJsonMode === "did" ? "none" : "did")}
                      className="swarm-btn-secondary"
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        background: viewJsonMode === "did" ? "rgba(0, 245, 255, 0.2)" : undefined,
                        borderColor: viewJsonMode === "did" ? "#00f5ff" : undefined,
                      }}
                    >
                      {viewJsonMode === "did" ? "Hide DID Doc" : "DID Document"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewJsonMode(viewJsonMode === "credential" ? "none" : "credential")}
                      className="swarm-btn-secondary"
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        background: viewJsonMode === "credential" ? "rgba(16, 185, 129, 0.2)" : undefined,
                        borderColor: viewJsonMode === "credential" ? "#10b981" : undefined,
                      }}
                    >
                      {viewJsonMode === "credential" ? "Hide Credential" : "Verifiable Credential"}
                    </button>
                  </div>
                </div>

                {viewJsonMode !== "none" && (
                  <pre
                    style={{
                      background: "#050811",
                      border: "1px solid #1e293b",
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 11,
                      color: "#94a3b8",
                      fontFamily: "var(--font-mono)",
                      maxHeight: 220,
                      overflowY: "auto",
                      margin: "8px 0 0 0",
                    }}
                  >
                    {viewJsonMode === "did"
                      ? JSON.stringify(
                          {
                            "@context": ["https://www.w3.org/ns/did/v1", "https://identity.hedera.com/did/v1"],
                            id:
                              agent.did ||
                              `did:hedera:testnet:${agent.identityTopicId || "0.0.10417469"}_${agent.id}`,
                            verificationMethod: [
                              {
                                id: `${agent.did || `did:hedera:testnet:${agent.identityTopicId || "0.0.10417469"}_${agent.id}`}#key-1`,
                                type: "Ed25519VerificationKey2020",
                                controller:
                                  agent.did ||
                                  `did:hedera:testnet:${agent.identityTopicId || "0.0.10417469"}_${agent.id}`,
                                blockchainAccountId: `hedera:testnet:${agent.paymentAddress || "0.0.10417474"}`,
                              },
                            ],
                            authentication: [
                              `${agent.did || `did:hedera:testnet:${agent.identityTopicId || "0.0.10417469"}_${agent.id}`}#key-1`,
                            ],
                            service: [
                              {
                                id: `${agent.did || `did:hedera:testnet:${agent.identityTopicId || "0.0.10417469"}_${agent.id}`}#security-audit-agent`,
                                type: "SecurityAuditAgent",
                                serviceEndpoint: `http://localhost:3001/agents/${agent.id}`,
                                description: agent.role,
                                paymentAddress: agent.paymentAddress || "0.0.10417474",
                                capabilities: agent.capabilities,
                              },
                            ],
                          },
                          null,
                          2,
                        )
                      : JSON.stringify(
                          {
                            "@context": [
                              "https://www.w3.org/2018/credentials/v1",
                              "https://identity.hedera.com/vc/v1",
                            ],
                            id: `vc:hedera:testnet:${agent.identityTopicId || "0.0.10417469"}:${agent.id}`,
                            type: ["VerifiableCredential", "SwarmSecurityAuditorCredential"],
                            issuer: {
                              id: `did:hedera:testnet:${agent.identityTopicId || "0.0.10417469"}`,
                              name: "SwarmProof Decentralized Security Quorum",
                            },
                            issuanceDate: agent.consensusTimestamp || new Date().toISOString(),
                            credentialSubject: {
                              id:
                                agent.did ||
                                `did:hedera:testnet:${agent.identityTopicId || "0.0.10417469"}_${agent.id}`,
                              name: agent.name,
                              role: agent.role,
                              capabilities: agent.capabilities,
                              payoutAddress: agent.paymentAddress || "0.0.10417474",
                              authorizedQuorum: true,
                              trustScore: 98.5,
                            },
                            proof: {
                              type: "HederaHCSConsensusProof",
                              topicId: agent.identityTopicId || "0.0.10417469",
                              transactionId: agent.identityReference || "0.0.10119346@registered",
                              consensusTimestamp: agent.consensusTimestamp || new Date().toISOString(),
                              proofPurpose: "assertionMethod",
                            },
                          },
                          null,
                          2,
                        )}
                  </pre>
                )}
              </div>

              {/* External Verification Links */}
              <div style={{ padding: 14, borderRadius: 14, background: "#090f1d", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong style={{ color: "#fff", display: "block", fontSize: 12 }}>Hedera Mirror Node Verification:</strong>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "var(--font-mono)" }}>testnet.mirrornode.hedera.com</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a
                    href={`http://localhost:3001/agents/${agent.id}/did`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "#162035",
                      color: "#38bdf8",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      textDecoration: "none",
                    }}
                  >
                    DID Document ↗
                  </a>
                  <a
                    href={`http://localhost:3001/agents/${agent.id}/credential`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "#162035",
                      color: "#34d399",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "1px solid rgba(52, 211, 153, 0.3)",
                      textDecoration: "none",
                    }}
                  >
                    W3C Credential ↗
                  </a>
                  <a
                    href={`https://hashscan.io/testnet/topic/${agent.identityTopicId || "0.0.10417469"}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "#1a263d",
                      color: "#00f5ff",
                      fontSize: 11,
                      fontWeight: 700,
                      border: "1px solid rgba(0, 245, 255, 0.3)",
                      textDecoration: "none",
                    }}
                  >
                    HashScan ↗
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="swarm-modal-footer">
          <span style={{ fontSize: 11, color: "#64748b" }}>
            Powered by SwarmProof Multi-Agent Consensus Protocol
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-swarm-secondary"
            style={{ fontSize: 12, padding: "8px 18px" }}
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
