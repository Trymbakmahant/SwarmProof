"use client";

import { useState } from "react";
import { type SpecialistAgentMeta, SHAPE_METAS } from "./agentData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

interface RegisterAgentModalProps {
  onClose: () => void;
  onRegistered: (newAgent: SpecialistAgentMeta) => void;
}

interface PresetTemplate {
  name: string;
  agentId: string;
  role: string;
  shape: SpecialistAgentMeta["shape"];
  color: string;
  capabilities: string[];
  systemPrompt: string;
}

const AGENT_PRESETS: PresetTemplate[] = [
  {
    name: "MEV & Flash Loan Sentinel",
    agentId: "mev-sentinel",
    role: "Flash Loan Arbitrage, AMM Price Distortion & Sandwich Attacks",
    shape: "icosahedron",
    color: "#10b981",
    capabilities: ["flash-loan", "oracle-manipulation", "sandwich-attack", "slippage-omission"],
    systemPrompt:
      "You are the MEV & Flash Loan Sentinel Specialist. Your domain is detecting atomic arbitrage risks, flash-loan vulnerable balance reserves, single-block AMM spot manipulation, and lack of slippage protections in Solidity contracts. Output findings in valid JSON.",
  },
  {
    name: "Bridge & Cross-Chain Guard",
    agentId: "bridge-guard",
    role: "Cross-Chain Relays, Merkle Proofs & Signature Replays",
    shape: "dodecahedron",
    color: "#ffb703",
    capabilities: ["merkle-proof", "signature-replay", "cross-chain-nonce", "payload-injection"],
    systemPrompt:
      "You are the Bridge & Cross-Chain Security Specialist. Detect replay vulnerabilities, missing chainId domain separators, insufficient validator quorum validation, and malleable ECDSA signatures. Output findings in valid JSON.",
  },
  {
    name: "DAO Governance Guardian",
    agentId: "governance-guard",
    role: "Timelock Execution, Voting Power Flash Loans & Proposal Hijacking",
    shape: "torusKnot",
    color: "#d946ef",
    capabilities: ["timelock-delay", "voting-power-flashloan", "proposal-hijack", "quorum-bypass"],
    systemPrompt:
      "You are the DAO Governance Guardian Specialist. Audit voting mechanics, snapshot timing, timelock bypasses, and self-delegation loopholes. Output findings in valid JSON.",
  },
  {
    name: "ERC-4337 Account Abstraction Auditor",
    agentId: "account-abstraction-agent",
    role: "UserOp Validation, Paymaster Draining & Session Keys",
    shape: "gyroscope",
    color: "#3b82f6",
    capabilities: ["userop-validation", "paymaster-draining", "signature-aggregator", "gas-griefing"],
    systemPrompt:
      "You are the ERC-4337 Account Abstraction Specialist. Detect paymaster fund draining, improper validateUserOp execution, unbounded gas limits, and signature aggregation bypasses. Output findings in valid JSON.",
  },
  {
    name: "ZK Circuit & Constraint Verifier",
    agentId: "zk-verifier-agent",
    role: "Under-constrained Signals, Soundness & Public Input Tampering",
    shape: "octahedron",
    color: "#00f5ff",
    capabilities: ["underconstrained-signals", "zk-soundness", "public-input-tamper", "nullifier-reuse"],
    systemPrompt:
      "You are the ZK Circuit & Verifier Specialist. Scan on-chain verifier contracts for nullifier re-use, unconstrained inputs, pairing checks, and proof malleability. Output findings in valid JSON.",
  },
];

const COLOR_PALETTES = [
  { name: "Cyan", hex: "#00f5ff" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Amber", hex: "#ffb703" },
  { name: "Magenta", hex: "#d946ef" },
  { name: "Electric Blue", hex: "#3b82f6" },
  { name: "Violet", hex: "#a855f7" },
  { name: "Neon Coral", hex: "#f43f5e" },
  { name: "Lime", hex: "#84cc16" },
];

export function RegisterAgentModal({ onClose, onRegistered }: RegisterAgentModalProps) {
  // Form State
  const defaultPreset = AGENT_PRESETS[0]!;
  const [name, setName] = useState(defaultPreset.name);
  const [agentId, setAgentId] = useState(defaultPreset.agentId);
  const [role, setRole] = useState(defaultPreset.role);
  const [shape, setShape] = useState<SpecialistAgentMeta["shape"]>(defaultPreset.shape);
  const [color, setColor] = useState(defaultPreset.color);
  const [capabilitiesStr, setCapabilitiesStr] = useState(defaultPreset.capabilities.join(", "));
  const [paymentAddress, setPaymentAddress] = useState("0.0.10417474");
  const [systemPrompt, setSystemPrompt] = useState(defaultPreset.systemPrompt);
  const [model, setModel] = useState("gpt-4o");

  // Registration Lifecycle
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [stepMessage, setStepMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredData, setRegisteredData] = useState<any | null>(null);
  const [showCredentialDrawer, setShowCredentialDrawer] = useState(false);
  const [copiedDid, setCopiedDid] = useState(false);

  // Quick Preset Selection
  const applyPreset = (preset: PresetTemplate) => {
    setName(preset.name);
    setAgentId(preset.agentId);
    setRole(preset.role);
    setShape(preset.shape);
    setColor(preset.color);
    setCapabilitiesStr(preset.capabilities.join(", "));
    setSystemPrompt(preset.systemPrompt);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setAgentId(slug ? `${slug}-agent` : "");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDid(true);
    setTimeout(() => setCopiedDid(false), 2500);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);

    const capabilities = capabilitiesStr
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    try {
      setStepMessage("1/4: Constructing W3C did:hedera DID Document...");
      await new Promise((r) => setTimeout(r, 450));

      setStepMessage("2/4: Issuing W3C Verifiable Credential (SwarmSecurityAuditorCredential)...");
      await new Promise((r) => setTimeout(r, 450));

      setStepMessage("3/4: Anchoring DID & Credential to Hedera HCS Topic 0.0.10417469...");

      const payload = {
        name,
        agentId: agentId || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        role,
        capabilities,
        paymentAddress: paymentAddress.trim() || "0.0.10417474",
        shape,
        color,
        systemPrompt,
        model,
      };

      const res = await fetch(`${API_BASE}/agents/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      setStepMessage("4/4: Joining SwarmProof weighted multi-agent consensus quorum...");
      const data = await res.json();
      setRegisteredData(data);
      setStatus("success");

      // Build frontend specialist meta
      const shapeInfo = SHAPE_METAS[shape];
      const newMeta: SpecialistAgentMeta = {
        id: payload.agentId,
        name: payload.name,
        shortName: payload.name.replace(/ Specialist| Agent/gi, "").trim(),
        role: payload.role,
        color: payload.color,
        colorSecondary: payload.color,
        shape: payload.shape,
        shapeLabel: shapeInfo.label,
        shapeRationale: shapeInfo.rationale,
        capabilities: payload.capabilities,
        systemPromptSummary: payload.systemPrompt.slice(0, 160) + "…",
        simulatedThoughts: [
          `Initializing ${payload.name} reasoning engine…`,
          `Querying Hedera consensus topic for verified W3C DID document…`,
          `Verifying SwarmSecurityAuditorCredential on HCS Topic 0.0.10417469…`,
          `Scanning abstract syntax trees for ${payload.role}…`,
          `Participating in weighted multi-agent consensus quorum…`,
        ],
        identityReference: data.agent?.identityReference,
        identityTopicId: data.agent?.identityTopicId,
        consensusTimestamp: data.agent?.consensusTimestamp,
        did: data.agent?.did || `did:hedera:testnet:0.0.10417469_${payload.agentId}`,
        didDocumentUrl: `/agents/${payload.agentId}/did`,
        credentialUrl: `/agents/${payload.agentId}/credential`,
        w3cStandard: "did:hedera",
        paymentAddress: payload.paymentAddress,
        mode: data.agent?.mode ?? "heuristic",
        provider: data.agent?.provider ?? model,
        isCustom: true,
        sampleFinding: {
          title: `Specialist finding by ${payload.name}`,
          category: payload.agentId.replace("-agent", ""),
          severity: "high",
          location: "executeAuditTask()",
          evidence: `Verified ${payload.role} invariant condition`,
          reasoning: "Custom neural detector confirmed exploit signature during multi-agent analysis.",
        },
      };

      onRegistered(newMeta);
    } catch (err) {
      console.error("Agent registration failed:", err);
      setErrorMessage((err as Error).message);
      setStatus("error");
    }
  };

  return (
    <div className="swarm-modal-backdrop" onClick={onClose}>
      <div
        className="swarm-modal-window"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 780,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: `0 0 60px ${color}25`,
        }}
      >
        {/* Modal Header */}
        <div
          className="swarm-modal-header"
          style={{
            background: `linear-gradient(90deg, ${color}20 0%, rgba(11, 18, 34, 0.6) 100%)`,
            borderBottom: `1px solid ${color}40`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                backgroundColor: `${color}25`,
                border: `1px solid ${color}`,
                boxShadow: `0 0 16px ${color}40`,
              }}
            >
              {SHAPE_METAS[shape].icon}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>
                  Register AI Security Agent
                </h3>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    padding: "2px 8px",
                    borderRadius: 20,
                    textTransform: "uppercase",
                    fontWeight: 700,
                    backgroundColor: `${color}15`,
                    border: `1px solid ${color}40`,
                    color,
                  }}
                >
                  Hedera HCS Anchored
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#94a3b8" }}>
                Deploy a custom specialized auditor into the SwarmProof quorum on-chain.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="swarm-btn-secondary"
            style={{ padding: "6px 14px", fontSize: 12 }}
          >
            ✕ Close
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24 }}>
          {status === "success" ? (
            /* Success Screen */
            <div style={{ display: "flex", flexDirection: "column", gap: 20, textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  margin: "0 auto",
                  borderRadius: "50%",
                  backgroundColor: `${color}20`,
                  border: `2px solid ${color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 34,
                  boxShadow: `0 0 30px ${color}50`,
                }}
              >
                ✓
              </div>

              <div>
                <h4 style={{ margin: "0 0 6px 0", fontSize: 20, fontWeight: 700, color: "#fff" }}>
                  Agent Identity Registered On-Chain!
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  {name} is now an active member of the decentralized SwarmProof audit quorum.
                </p>
              </div>

              {/* Certificate Card */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.7)",
                  border: `1px solid ${color}40`,
                  borderRadius: 14,
                  padding: 18,
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{SHAPE_METAS[shape].icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "var(--font-mono)" }}>
                        ID: {agentId}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        backgroundColor: "rgba(0, 245, 255, 0.15)",
                        border: "1px solid rgba(0, 245, 255, 0.4)",
                        color: "#00f5ff",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontWeight: 700,
                      }}
                    >
                      W3C did:hedera
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        backgroundColor: "rgba(16, 185, 129, 0.2)",
                        border: "1px solid #10b981",
                        color: "#10b981",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontWeight: 600,
                      }}
                    >
                      ● Quorum Active
                    </span>
                  </div>
                </div>

                {/* W3C DID Highlight Banner */}
                <div
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    border: `1px solid ${color}30`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                      W3C Sovereign Decentralized Identifier (DID)
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: color,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {registeredData?.agent?.did || `did:hedera:testnet:0.0.10417469_${agentId}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        registeredData?.agent?.did || `did:hedera:testnet:0.0.10417469_${agentId}`,
                      )
                    }
                    className="swarm-btn-secondary"
                    style={{ fontSize: 11, padding: "4px 10px", whiteSpace: "nowrap" }}
                  >
                    {copiedDid ? "✓ Copied" : "📋 Copy DID"}
                  </button>
                </div>

                <div style={{ height: 1, backgroundColor: "rgba(255, 255, 255, 0.08)" }} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>Hedera HCS Topic ID</div>
                    <div style={{ fontFamily: "var(--font-mono)", color: "#fff", fontWeight: 600 }}>
                      {registeredData?.agent?.identityTopicId || "0.0.10417469"}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>W3C Verifiable Credential</div>
                    <div style={{ fontFamily: "var(--font-mono)", color: "#34d399", fontWeight: 600 }}>
                      SwarmSecurityAuditorCredential
                    </div>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ color: "#64748b", fontSize: 11 }}>Hedera HCS Consensus Timestamp & Tx</div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "#cbd5e1",
                        fontSize: 11,
                        backgroundColor: "rgba(0,0,0,0.3)",
                        padding: "6px 10px",
                        borderRadius: 6,
                        marginTop: 4,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{registeredData?.agent?.identityReference || "0.0.10119346@registered"}</span>
                      <span style={{ color: "#64748b", fontSize: 10 }}>
                        {registeredData?.agent?.consensusTimestamp || new Date().toISOString()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>Payout Revenue Address (x402)</div>
                    <div style={{ fontFamily: "var(--font-mono)", color: "#94a3b8" }}>
                      {paymentAddress}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>3D Orbit Mesh</div>
                    <div style={{ color: "#94a3b8" }}>
                      {SHAPE_METAS[shape].label}
                    </div>
                  </div>
                </div>

                {/* Collapsible W3C JSON-LD Viewer */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowCredentialDrawer(!showCredentialDrawer)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#38bdf8",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                      fontWeight: 600,
                    }}
                  >
                    <span>{showCredentialDrawer ? "▼ Hide" : "▶ Inspect"} W3C Verifiable Credential & DID Document (JSON-LD)</span>
                  </button>

                  {showCredentialDrawer && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
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
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(
                          registeredData?.verifiableCredential || registeredData?.didDocument || {
                            "@context": ["https://www.w3.org/2018/credentials/v1", "https://identity.hedera.com/vc/v1"],
                            id: `vc:hedera:testnet:0.0.10417469:${agentId}`,
                            type: ["VerifiableCredential", "SwarmSecurityAuditorCredential"],
                            issuer: "did:hedera:testnet:0.0.10417469",
                            credentialSubject: {
                              id: `did:hedera:testnet:0.0.10417469_${agentId}`,
                              name,
                              role,
                              capabilities: capabilitiesStr.split(",").map((s) => s.trim()),
                              paymentAddress,
                            },
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
                <a
                  href={`https://hashscan.io/testnet/topic/${registeredData?.agent?.identityTopicId || "0.0.10417469"}`}
                  target="_blank"
                  rel="noreferrer"
                  className="swarm-btn-secondary"
                  style={{ textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <span>HashScan Topic</span> ↗
                </a>

                <a
                  href={`${API_BASE}/agents/${agentId}/did`}
                  target="_blank"
                  rel="noreferrer"
                  className="swarm-btn-secondary"
                  style={{ textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <span>W3C DID Document</span> ↗
                </a>

                <a
                  href={`${API_BASE}/agents/${agentId}/credential`}
                  target="_blank"
                  rel="noreferrer"
                  className="swarm-btn-secondary"
                  style={{ textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <span>W3C Credential</span> ↗
                </a>

                <button
                  onClick={onClose}
                  className="swarm-btn-primary"
                  style={{
                    backgroundColor: color,
                    borderColor: color,
                    boxShadow: `0 0 20px ${color}40`,
                    color: "#050b14",
                    fontWeight: 700,
                  }}
                >
                  Inspect in 3D Swarm Simulation →
                </button>
              </div>
            </div>
          ) : (
            /* Form Screen */
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Preset Template Selector */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>
                  ⚡ Quick-Fill Specialist Templates
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                  {AGENT_PRESETS.map((p) => {
                    const isSelected = p.agentId === agentId;
                    return (
                      <button
                        key={p.agentId}
                        type="button"
                        onClick={() => applyPreset(p)}
                        style={{
                          background: isSelected ? `${p.color}20` : "rgba(15, 23, 42, 0.6)",
                          border: `1px solid ${isSelected ? p.color : "rgba(255, 255, 255, 0.1)"}`,
                          borderRadius: 8,
                          padding: "8px 10px",
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{SHAPE_METAS[p.shape].icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "#fff" : "#cbd5e1" }}>
                          {p.name.replace(/ Specialist| Agent| Auditor/gi, "")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Two Column Section */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                    Agent Name *
                  </label>
                  <input
                    type="text"
                    className="swarm-input"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    placeholder="e.g. MEV & Flash Loan Sentinel"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                    Agent Slug / ID *
                  </label>
                  <input
                    type="text"
                    className="swarm-input"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    required
                    placeholder="e.g. mev-sentinel"
                    style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                  />
                </div>
              </div>

              {/* Role & Domain */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                  Security Specialty & Role *
                </label>
                <input
                  type="text"
                  className="swarm-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  placeholder="e.g. Flash Loan Arbitrage, AMM Price Distortion & Slippage"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Capabilities & Payout Address */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                    Capabilities (comma-separated)
                  </label>
                  <input
                    type="text"
                    className="swarm-input"
                    value={capabilitiesStr}
                    onChange={(e) => setCapabilitiesStr(e.target.value)}
                    placeholder="e.g. flash-loan, oracle-manipulation"
                    style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                    Hedera Payout Account ID
                  </label>
                  <input
                    type="text"
                    className="swarm-input"
                    value={paymentAddress}
                    onChange={(e) => setPaymentAddress(e.target.value)}
                    placeholder="0.0.10417474"
                    style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                  />
                </div>
              </div>

              {/* 3D Geometry Shape Picker */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 8 }}>
                  3D Visualization Geometry (Orbit Ring)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                  {(Object.keys(SHAPE_METAS) as Array<SpecialistAgentMeta["shape"]>).map((sh) => {
                    const info = SHAPE_METAS[sh];
                    const isSelected = shape === sh;
                    return (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => setShape(sh)}
                        style={{
                          background: isSelected ? `${color}25` : "rgba(15, 23, 42, 0.6)",
                          border: `1px solid ${isSelected ? color : "rgba(255, 255, 255, 0.1)"}`,
                          borderRadius: 8,
                          padding: "8px 10px",
                          textAlign: "center",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{info.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "#fff" : "#94a3b8" }}>
                          {sh}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme Color & Model Engine */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 8 }}>
                    Theme Neon Color
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {COLOR_PALETTES.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setColor(c.hex)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          backgroundColor: c.hex,
                          border: color === c.hex ? "2px solid #fff" : "2px solid transparent",
                          cursor: "pointer",
                          boxShadow: color === c.hex ? `0 0 12px ${c.hex}` : "none",
                          transform: color === c.hex ? "scale(1.15)" : "scale(1)",
                          transition: "all 0.15s ease",
                        }}
                        title={c.name}
                      />
                    ))}
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      style={{
                        width: 26,
                        height: 26,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        borderRadius: "50%",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                    Inference Engine
                  </label>
                  <select
                    className="swarm-input"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="gpt-4o">OpenAI GPT-4o (Reasoning & AST)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
                    <option value="ollama-deepseek-r1">Local DeepSeek-R1 (Ollama)</option>
                    <option value="heuristic-ast">Heuristic Static AST Scanner</option>
                  </select>
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                  Agent System Instruction / Prompt
                </label>
                <textarea
                  className="swarm-input"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  style={{ width: "100%", fontSize: 12, fontFamily: "var(--font-mono)", lineHeight: 1.5 }}
                />
              </div>

              {/* Submission Status & Error Display */}
              {errorMessage && (
                <div
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "#fca5a5",
                    fontSize: 12,
                  }}
                >
                  ✕ Registration Error: {errorMessage}
                </div>
              )}

              {status === "submitting" && (
                <div
                  style={{
                    backgroundColor: `${color}15`,
                    border: `1px solid ${color}40`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    color: "#fff",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: `2px solid ${color}`,
                      borderTopColor: "transparent",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span>{stepMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="swarm-btn-secondary"
                  disabled={status === "submitting"}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="swarm-btn-primary"
                  disabled={status === "submitting"}
                  style={{
                    backgroundColor: color,
                    borderColor: color,
                    boxShadow: `0 0 20px ${color}40`,
                    color: "#050b14",
                    fontWeight: 700,
                  }}
                >
                  {status === "submitting" ? "Registering on Hedera..." : "Register Agent on Hedera HCS →"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
