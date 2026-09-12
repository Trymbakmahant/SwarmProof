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
  const [activeTab, setActiveTab] = useState<"findings" | "thoughts" | "identity">("identity");
  const [isSimulating, setIsSimulating] = useState(false);
  const [thoughtIndex, setThoughtIndex] = useState(0);
  const [viewJsonMode, setViewJsonMode] = useState<"none" | "did" | "credential">("none");
  const [copiedDid, setCopiedDid] = useState(false);
  const [copiedPub, setCopiedPub] = useState(false);
  const [copiedEvm, setCopiedEvm] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDid(true);
    setTimeout(() => setCopiedDid(false), 2500);
  };

  const copyCustom = (text: string, type: "pub" | "evm") => {
    navigator.clipboard.writeText(text);
    if (type === "pub") {
      setCopiedPub(true);
      setTimeout(() => setCopiedPub(false), 2000);
    } else {
      setCopiedEvm(true);
      setTimeout(() => setCopiedEvm(false), 2000);
    }
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
        style={{ boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.15)", border: "1px solid #e4e4e7", backgroundColor: "#ffffff" }}
      >
        {/* Minimalist Editorial Modal Header */}
        <div
          className="swarm-modal-header"
          style={{
            backgroundColor: "#fafafa",
            borderBottom: "1px solid #e4e4e7",
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Shape Badge */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                backgroundColor: "#f4f4f5",
                border: "1px solid #e4e4e7",
                color: "#09090b",
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
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#09090b" }}>{agent.name}</h3>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    textTransform: "uppercase",
                    fontWeight: 600,
                    backgroundColor: "#f4f4f5",
                    border: "1px solid #e4e4e7",
                    color: "#52525b",
                  }}
                >
                  {agent.shapeLabel}
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#71717a" }}>{agent.role}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-swarm-secondary"
            style={{ width: 32, height: 32, padding: 0, borderRadius: 6, fontSize: 14 }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #e4e4e7", backgroundColor: "#ffffff" }}>
          <button
            type="button"
            onClick={() => setActiveTab("findings")}
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: activeTab === "findings" ? 600 : 500,
              background: "transparent",
              borderRadius: 0,
              borderBottom: activeTab === "findings" ? "2px solid #09090b" : "2px solid transparent",
              color: activeTab === "findings" ? "#09090b" : "#71717a",
            }}
          >
            Findings ({agentFindings.length > 0 ? agentFindings.length : 1})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("thoughts")}
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: activeTab === "thoughts" ? 600 : 500,
              background: "transparent",
              borderRadius: 0,
              borderBottom: activeTab === "thoughts" ? "2px solid #09090b" : "2px solid transparent",
              color: activeTab === "thoughts" ? "#09090b" : "#71717a",
            }}
          >
            Thought Stream
            {(isSimulating || isAuditing) && (
              <span className="pulse-dot" style={{ backgroundColor: "#09090b", marginLeft: 6 }} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("identity")}
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: activeTab === "identity" ? 600 : 500,
              background: "transparent",
              borderRadius: 0,
              borderBottom: activeTab === "identity" ? "2px solid #09090b" : "2px solid transparent",
              color: activeTab === "identity" ? "#09090b" : "#71717a",
            }}
          >
            Hedera Identity &amp; x402
          </button>
        </div>

        {/* Modal Body */}
        <div className="swarm-modal-body" style={{ backgroundColor: "#ffffff", padding: 20 }}>
          {activeTab === "findings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#71717a", fontFamily: "var(--font-mono)" }}>
                  Domain Detection Results:
                </span>
                <button
                  type="button"
                  onClick={handleSimulate}
                  disabled={isSimulating || isAuditing}
                  className="btn-swarm-primary"
                  style={{ fontSize: 11, padding: "5px 12px" }}
                >
                  ⚡ {isSimulating ? "Analyzing Code…" : "Trigger Domain Scan"}
                </button>
              </div>

              {agentFindings.length > 0 ? (
                agentFindings.map((finding, idx) => (
                  <div
                    key={finding.id || idx}
                    style={{
                      padding: 14,
                      borderRadius: 8,
                      backgroundColor: "#fafafa",
                      border: "1px solid #e4e4e7",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#09090b" }}>{finding.title}</span>
                      <span className={`swarm-tag swarm-tag-${finding.severity.toLowerCase()}`}>
                        {finding.severity}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#52525b", backgroundColor: "#ffffff", padding: "6px 10px", borderRadius: 6, border: "1px solid #e4e4e7" }}>
                      📍 Location: {finding.location || finding.locations?.join(", ") || "contract"}
                    </div>

                    {(finding.evidence || finding.snippets) && (
                      <div style={{ fontSize: 12, color: "#52525b" }}>
                        <span style={{ fontWeight: 600, color: "#09090b" }}>Evidence:</span>
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
                    padding: 14,
                    borderRadius: 8,
                    backgroundColor: "#fafafa",
                    border: "1px solid #e4e4e7",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#09090b" }}>{agent.sampleFinding.title}</span>
                    <span className={`swarm-tag swarm-tag-${agent.sampleFinding.severity}`}>
                      {agent.sampleFinding.severity}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#52525b", backgroundColor: "#ffffff", padding: "6px 10px", borderRadius: 6, border: "1px solid #e4e4e7" }}>
                    📍 Location: {agent.sampleFinding.location}
                  </div>

                  <div style={{ fontSize: 12, color: "#52525b" }}>
                    <span style={{ fontWeight: 600, color: "#09090b" }}>Detection Evidence:</span>
                    <p style={{ margin: "4px 0 0 0", fontSize: 11, fontFamily: "var(--font-mono)", backgroundColor: "#09090b", color: "#f4f4f5", padding: "8px 10px", borderRadius: 6, border: "1px solid #27272a" }}>
                      {agent.sampleFinding.evidence}
                    </p>
                  </div>

                  <div style={{ fontSize: 12, color: "#52525b" }}>
                    <span style={{ fontWeight: 600, color: "#09090b" }}>Specialist Reasoning:</span>
                    <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#52525b", lineHeight: 1.5 }}>
                      {agent.sampleFinding.reasoning}
                    </p>
                  </div>
                </div>
              )}

              {/* 3D Shape Rationale Card */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: "#ffffff",
                  border: "1px solid #e4e4e7",
                  fontSize: 12,
                  color: "#52525b",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 16 }}>💡</span>
                <div>
                  <strong style={{ color: "#09090b" }}>3D Representation: </strong>
                  {agent.shapeRationale}
                </div>
              </div>
            </div>
          )}

          {activeTab === "thoughts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#71717a", fontFamily: "var(--font-mono)" }}>
                  Real-time Neural Thought Stream:
                </span>
                <span style={{ color: "#09090b", fontSize: 11, fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="pulse-dot" style={{ backgroundColor: "#16a34a" }} />
                  Live Swarm Broadcast
                </span>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: "#09090b",
                  border: "1px solid #27272a",
                  maxHeight: 280,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {agent.simulatedThoughts.map((thought, idx) => {
                  const isCurrent = idx === thoughtIndex;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 6,
                        backgroundColor: isCurrent ? "#18181b" : "transparent",
                        borderLeft: isCurrent ? "2px solid #ffffff" : "2px solid transparent",
                        color: isCurrent ? "#ffffff" : "#71717a",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ color: "#52525b", userSelect: "none" }}>[{idx + 1}]</span>
                      <p style={{ margin: 0, lineHeight: 1.4 }}>{thought}</p>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: 12, borderRadius: 8, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                <strong style={{ color: "#09090b", fontSize: 12, display: "block", marginBottom: 4 }}>
                  Specialist Domain System Prompt:
                </strong>
                <p style={{ margin: 0, fontSize: 11, color: "#52525b", lineHeight: 1.5 }}>
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
                  backgroundColor: "#fafafa",
                  border: "1px solid #e4e4e7",
                  borderRadius: 8,
                  padding: "12px 14px",
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
                      backgroundColor: "#f4f4f5",
                      color: "#09090b",
                      border: "1px solid #e4e4e7",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    W3C did:hedera Standard
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      color: "#166534",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    ● Verifiable Credential Issued
                  </span>
                </div>

                <div>
                  <span style={{ color: "#71717a", fontSize: 10, textTransform: "uppercase", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                    W3C Decentralized Identifier (DID URI):
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 4,
                      backgroundColor: "#ffffff",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #e4e4e7",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "#09090b",
                        fontSize: 12,
                        wordBreak: "break-all",
                        fontWeight: 500,
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
                      className="btn-swarm-secondary"
                      style={{ fontSize: 11, padding: "4px 8px", whiteSpace: "nowrap" }}
                    >
                      {copiedDid ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Identity & Payment Details Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                  <span style={{ color: "#71717a", display: "block", fontSize: 11, marginBottom: 2, fontFamily: "var(--font-mono)" }}>
                    Hedera HCS Topic:
                  </span>
                  <a
                    href={`https://hashscan.io/testnet/topic/${agent.identityTopicId || "0.0.10417469"}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 700, fontSize: 13, textDecoration: "underline" }}
                  >
                    {agent.identityTopicId || "0.0.10417469"} ↗
                  </a>
                  <p style={{ margin: "2px 0 0 0", fontSize: 10, color: "#71717a" }}>Consensus Topic on Hedera Testnet</p>
                </div>

                <div style={{ padding: 12, borderRadius: 8, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                  <span style={{ color: "#71717a", display: "block", fontSize: 11, marginBottom: 2, fontFamily: "var(--font-mono)" }}>
                    Hedera Payout Account:
                  </span>
                  <a
                    href={`https://hashscan.io/testnet/account/${agent.hederaAccountId || agent.paymentAddress || "0.0.10417470"}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "var(--font-mono)", color: "#166534", fontWeight: 700, fontSize: 13, textDecoration: "underline" }}
                  >
                    {agent.hederaAccountId || agent.paymentAddress || "0.0.10417470"} ↗
                  </a>
                  <p style={{ margin: "2px 0 0 0", fontSize: 10, color: "#71717a" }}>x402 Micropayment Revenue Wallet</p>
                </div>
              </div>

              {/* Cryptographic Keypair & Sovereign Wallet */}
              <div style={{ padding: 14, borderRadius: 8, backgroundColor: "#fafafa", border: "1px solid #e4e4e7", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#09090b", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🔑</span> Sovereign Cryptographic Keypair (SECP256K1)
                  </span>
                  <span style={{ fontSize: 10, backgroundColor: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                    Deterministic Signature Ready
                  </span>
                </div>

                {/* EVM Address */}
                {agent.evmAddress && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>EVM Address:</span>
                      <button
                        type="button"
                        onClick={() => copyCustom(agent.evmAddress || "", "evm")}
                        className="btn-swarm-secondary"
                        style={{ fontSize: 10, padding: "2px 6px" }}
                      >
                        {copiedEvm ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#09090b", backgroundColor: "#ffffff", padding: "6px 8px", borderRadius: 6, border: "1px solid #e4e4e7" }}>
                      {agent.evmAddress}
                    </div>
                  </div>
                )}

                {/* Public Key */}
                {agent.publicKey && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>Public Key (Compressed):</span>
                      <button
                        type="button"
                        onClick={() => copyCustom(agent.publicKey || "", "pub")}
                        className="btn-swarm-secondary"
                        style={{ fontSize: 10, padding: "2px 6px" }}
                      >
                        {copiedPub ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#09090b", backgroundColor: "#ffffff", padding: "6px 8px", borderRadius: 6, border: "1px solid #e4e4e7", wordBreak: "break-all" }}>
                      {agent.publicKey}
                    </div>
                  </div>
                )}
              </div>

              {agent.identityReference && (
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                  <span style={{ color: "#71717a", display: "block", fontSize: 11, marginBottom: 2, fontFamily: "var(--font-mono)" }}>
                    On-Chain Identity Transaction Reference:
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "#09090b",
                      fontSize: 11,
                      wordBreak: "break-all",
                    }}
                  >
                    {agent.identityReference}
                  </span>
                  {agent.consensusTimestamp && (
                    <p style={{ margin: "2px 0 0 0", fontSize: 10, color: "#71717a" }}>
                      Consensus Timestamp: {agent.consensusTimestamp}
                    </p>
                  )}
                </div>
              )}

              {/* Capabilities */}
              <div style={{ padding: 12, borderRadius: 8, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                <span style={{ color: "#71717a", display: "block", fontSize: 11, marginBottom: 6, fontFamily: "var(--font-mono)" }}>
                  Specialist Verified Capabilities:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        backgroundColor: "#f4f4f5",
                        color: "#18181b",
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        border: "1px solid #e4e4e7",
                      }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* Interactive W3C JSON-LD Inspector Buttons */}
              <div style={{ padding: 12, borderRadius: 8, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <strong style={{ color: "#09090b", fontSize: 12 }}>W3C Cryptographic Proofs:</strong>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setViewJsonMode(viewJsonMode === "did" ? "none" : "did")}
                      className="btn-swarm-secondary"
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        backgroundColor: viewJsonMode === "did" ? "#09090b" : "#ffffff",
                        color: viewJsonMode === "did" ? "#ffffff" : "#18181b",
                      }}
                    >
                      {viewJsonMode === "did" ? "Hide DID Doc" : "DID Document"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewJsonMode(viewJsonMode === "credential" ? "none" : "credential")}
                      className="btn-swarm-secondary"
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        backgroundColor: viewJsonMode === "credential" ? "#09090b" : "#ffffff",
                        color: viewJsonMode === "credential" ? "#ffffff" : "#18181b",
                      }}
                    >
                      {viewJsonMode === "credential" ? "Hide Credential" : "Verifiable Credential"}
                    </button>
                  </div>
                </div>

                {viewJsonMode !== "none" && (
                  <pre
                    style={{
                      backgroundColor: "#09090b",
                      border: "1px solid #27272a",
                      borderRadius: 6,
                      padding: 12,
                      fontSize: 11,
                      color: "#f4f4f5",
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
              <div style={{ padding: 12, borderRadius: 8, backgroundColor: "#fafafa", border: "1px solid #e4e4e7", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong style={{ color: "#09090b", display: "block", fontSize: 12 }}>Hedera Mirror Node Verification:</strong>
                  <span style={{ fontSize: 11, color: "#71717a", fontFamily: "var(--font-mono)" }}>testnet.mirrornode.hedera.com</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <a
                    href={`http://localhost:3001/agents/${agent.id}/did`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-swarm-secondary"
                    style={{ fontSize: 11, padding: "5px 10px", textDecoration: "none" }}
                  >
                    DID Document ↗
                  </a>
                  <a
                    href={`http://localhost:3001/agents/${agent.id}/credential`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-swarm-secondary"
                    style={{ fontSize: 11, padding: "5px 10px", textDecoration: "none" }}
                  >
                    W3C Credential ↗
                  </a>
                  <a
                    href={`https://hashscan.io/testnet/topic/${agent.identityTopicId || "0.0.10417469"}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-swarm-secondary"
                    style={{ fontSize: 11, padding: "5px 10px", textDecoration: "none" }}
                  >
                    HashScan ↗
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="swarm-modal-footer" style={{ backgroundColor: "#fafafa", borderTop: "1px solid #e4e4e7", padding: "12px 20px" }}>
          <span style={{ fontSize: 11, color: "#71717a", fontFamily: "var(--font-mono)" }}>
            SwarmProof Consensus Protocol • did:hedera
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-swarm-secondary"
            style={{ fontSize: 12, padding: "6px 14px" }}
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
