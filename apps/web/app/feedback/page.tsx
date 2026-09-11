"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type TabId = "overview" | "sdk" | "mcp" | "identity" | "proofs" | "questions";
type SdkId = "plugins" | "x402" | "hedera" | "agents";

export default function FeedbackPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [activeSdk, setActiveSdk] = useState<SdkId>("plugins");
  const [idFormat, setIdFormat] = useState<"did" | "vc">("did");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mentorNotes, setMentorNotes] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("swarmproof_mentor_notes");
      if (saved) setMentorNotes(saved);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const copyToClipboard = (text: string, msg: string = "Copied to clipboard") => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(msg);
    }
  };

  const handleNotesChange = (val: string) => {
    setMentorNotes(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("swarmproof_mentor_notes", val);
    }
  };

  const didDocJson = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1"
    ],
    "id": "did:hedera:testnet:0.0.10417469_reentrancy-agent",
    "verificationMethod": [
      {
        "id": "did:hedera:testnet:0.0.10417469_reentrancy-agent#key-1",
        "type": "Ed25519VerificationKey2020",
        "controller": "did:hedera:testnet:0.0.10417469_reentrancy-agent",
        "blockchainAccountId": "hedera:testnet:0.0.10417474"
      }
    ],
    "authentication": [
      "did:hedera:testnet:0.0.10417469_reentrancy-agent#key-1"
    ],
    "service": [
      {
        "id": "did:hedera:testnet:0.0.10417469_reentrancy-agent#audit-service",
        "type": "SecurityAuditService",
        "serviceEndpoint": "http://localhost:3001/audit"
      }
    ]
  };

  const vcJson = {
    "@context": ["https://www.w3.org/2018/credentials/v1", "https://schema.org"],
    "id": "urn:uuid:credential-reentrancy-agent",
    "type": ["VerifiableCredential", "SwarmSecurityAuditorCredential"],
    "issuer": "did:hedera:testnet:0.0.10417469_authority",
    "issuanceDate": "2026-09-10T06:31:30.510Z",
    "credentialSubject": {
      "id": "did:hedera:testnet:0.0.10417469_reentrancy-agent",
      "name": "Reentrancy & State Guard",
      "role": "Reentrancy Vulnerability Specialist",
      "capabilities": ["reentrancy-detection", "cei-violation"],
      "paymentAddress": "0.0.10417474",
      "consensusVotingWeight": 1.2
    },
    "proof": {
      "type": "HederaConsensusProof2026",
      "created": "2026-09-10T06:31:30.510Z",
      "verificationMethod": "did:hedera:testnet:0.0.10417469#hcs-consensus",
      "proofPurpose": "assertionMethod",
      "hcsTopicId": "0.0.10417469",
      "transactionId": "0.0.10119346@1789021885.521714338",
      "consensusTimestamp": "2026-09-10T06:31:30.510Z"
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "#18181b", fontFamily: "var(--font-sans)" }}>
      {/* ── Minimalist Editorial Header ─────────────────────────────── */}
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
            maxWidth: 1040,
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          {/* Brand & Metadata */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Monochromatic Geometric Brand Mark */}
            <Link
              href="/"
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: "#09090b",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "-0.05em",
                textDecoration: "none",
              }}
            >
              SP
            </Link>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.02em", color: "#09090b" }}>
                  SwarmProof
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "2px 6px",
                    borderRadius: 4,
                    backgroundColor: "#f4f4f5",
                    color: "#52525b",
                    border: "1px solid #e4e4e7",
                    fontWeight: 600,
                  }}
                >
                 Pitch Deck
                </span>
              </div>
              
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                color: "#3f3f46",
                backgroundColor: "#f4f4f5",
                border: "1px solid #e4e4e7",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              3D Visualizer
            </Link>

            <Link
              href="/x402"
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                color: "#3f3f46",
                backgroundColor: "#f4f4f5",
                border: "1px solid #e4e4e7",
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
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                color: "#09090b",
                backgroundColor: "#ffffff",
                border: "1px solid #d4d4d8",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#09090b" }} />
              <span>Topic 0.0.10417469</span>
              <span style={{ color: "#a1a1aa" }}>↗</span>
            </a>
          </div>
        </div>

        {/* Navigation Tabs (Subtle Underline Style) */}
        <div style={{ borderTop: "1px solid #e4e4e7", backgroundColor: "rgba(250, 250, 250, 0.6)" }}>
          <div
            style={{
              maxWidth: 1040,
              margin: "0 auto",
              padding: "4px 24px",
              display: "flex",
              alignItems: "center",
              gap: 4,
              overflowX: "auto",
            }}
          >
            {[
              { id: "overview", label: "Overview & Pitch" },
              { id: "sdk", label: "SDK Architecture" },
              { id: "mcp", label: "MCP Integration" },
              { id: "identity", label: "W3C did:hedera" },
              { id: "proofs", label: "On-Chain Proofs" },
              { id: "questions", label: "Mentor Discussion" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabId)}
                  style={{
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 6,
                    color: isActive ? "#09090b" : "#52525b",
                    backgroundColor: isActive ? "#ffffff" : "transparent",
                    border: isActive ? "1px solid #d4d4d8" : "1px solid transparent",
                    boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Notification Toast ──────────────────────────────────────── */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            backgroundColor: "#09090b",
            color: "#ffffff",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            padding: "10px 16px",
            borderRadius: 6,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid #27272a",
          }}
        >
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Main Presentation Container ─────────────────────────────── */}
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "36px 20px 80px" }}>

        {/* ══════════════════════════════════════════════════════════════
            TAB 1: 60S PITCH & VISION
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Primary Hero Card */}
            <div
              style={{
                padding: "32px",
                borderRadius: 8,
                backgroundColor: "#ffffff",
                border: "1px solid #d4d4d8",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 16,
                  marginBottom: 20,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#71717a",
                      fontWeight: 600,
                    }}
                  >
                    Executive Brief
                  </span>
                  <h1
                    style={{
                      margin: "4px 0 0",
                      fontSize: 26,
                      fontWeight: 700,
                      color: "#09090b",
                      letterSpacing: "-0.03em",
                      lineHeight: 1.25,
                    }}
                  >
                    Multi-Agent Security Consensus Powered by Hedera
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      "SwarmProof is a decentralized smart contract security platform powered by an adversarial swarm of AI agents that debate, reach consensus, and anchor verifiable proofs on Hedera. Audits are gated by x402 micropayments settled live on Hedera testnet via Blocky402, and every agent has a sovereign W3C did:hedera identifier and Verifiable Credential.",
                      "Copied pitch text"
                    )
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                    backgroundColor: "#09090b",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  📋 Copy Pitch
                </button>
              </div>

              <p style={{ margin: 0, color: "#3f3f46", fontSize: 15, lineHeight: 1.65 }}>
                Single-LLM audit tools hallucinate and miss complex DeFi math exploits.{" "}
                <strong style={{ color: "#09090b", fontWeight: 600 }}>SwarmProof</strong> coordinates 5 parallel
                specialist agents (Reentrancy, Access Control, Business Logic, Economic/MEV, and Static Calls). They
                analyze code independently, challenge each other, reach a weighted quorum consensus, and anchor
                mathematically reproducible proofs on the{" "}
                <span
                  style={{
                    fontWeight: 500,
                    color: "#09090b",
                    textDecoration: "underline",
                    textUnderlineOffset: 4,
                  }}
                >
                  Hedera Consensus Service
                </span>
                .
              </p>

              {/* Metric Grid */}
              <div
                style={{
                  marginTop: 28,
                  paddingTop: 24,
                  borderTop: "1px solid #e4e4e7",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ padding: 14, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a" }}>
                    Quorum Model
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#09090b", marginTop: 4 }}>5 Specialists</div>
                </div>

                <div style={{ padding: 14, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a" }}>
                    Payment Rails
                  </div>
                  <div style={{ fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 600, color: "#09090b", marginTop: 4 }}>
                    x402 v2 (0.01 ℏ)
                  </div>
                </div>

                <div style={{ padding: 14, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a" }}>
                    Agent Identity
                  </div>
                  <div style={{ fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 600, color: "#09090b", marginTop: 4 }}>
                    did:hedera
                  </div>
                </div>

                <div style={{ padding: 14, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a" }}>
                    Consensus Anchor
                  </div>
                  <div style={{ fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 600, color: "#09090b", marginTop: 4 }}>
                    HCS 0.0.10417469
                  </div>
                </div>
              </div>
            </div>

            {/* Problem / Solution / Identity Triad */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 01 Problem */}
              <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>
                    01 / Challenge
                  </span>
                  <span style={{ fontSize: 12, color: "#a1a1aa" }}>Current Industry Bottlenecks</span>
                </div>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                  Fragile Audits, Cognitive Fatigue & Unverified Agents
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#52525b" }}>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #f4f4f5", display: "flex", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 700 }}>—</span>
                    <div>
                      <strong style={{ color: "#09090b", fontWeight: 600 }}>Single-Model Hallucinations:</strong> Solo LLMs
                      generate repetitive false positives while consistently missing composite reentrancy and oracle arbitrage loops.
                    </div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #f4f4f5", display: "flex", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 700 }}>—</span>
                    <div>
                      <strong style={{ color: "#09090b", fontWeight: 600 }}>Prohibitive Engagement Lag:</strong> Manual audit
                      firms operate on 4–6 week delays with minimum retainers starting at $50,000, halting CI/CD releases.
                    </div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #f4f4f5", display: "flex", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 700 }}>—</span>
                    <div>
                      <strong style={{ color: "#09090b", fontWeight: 600 }}>Anonymous Agent Identity:</strong> Most AI bot
                      frameworks have no persistent cryptographic identity, verifiable track record, or verifiable credentials.
                    </div>
                  </div>
                </div>
              </div>

              {/* 02 Solution */}
              <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>
                    02 / Approach
                  </span>
                  <span style={{ fontSize: 12, color: "#a1a1aa" }}>Adversarial Quorum Architecture</span>
                </div>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                  Domain Specialization with Quorum Consensus & HCS Proofs
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#52525b" }}>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #f4f4f5", display: "flex", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 700 }}>+</span>
                    <div>
                      <strong style={{ color: "#09090b", fontWeight: 600 }}>5 Specialized Analyzers:</strong> Segregated
                      micro-agents targeting Reentrancy, Access Control, Business Logic, Flashloans/MEV, and Static Calls.
                    </div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #f4f4f5", display: "flex", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 700 }}>+</span>
                    <div>
                      <strong style={{ color: "#09090b", fontWeight: 600 }}>Cross-Validation Quorum:</strong> High-severity
                      findings require corroboration across multiple domain specialists, suppressing spurious hallucinations.
                    </div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #f4f4f5", display: "flex", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 700 }}>+</span>
                    <div>
                      <strong style={{ color: "#09090b", fontWeight: 600 }}>Consensus Anchoring:</strong> Deterministic SHA-256
                      report hashes sequenced on Hedera HCS Topic{" "}
                      <span style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 600 }}>0.0.10417469</span>.
                    </div>
                  </div>
                </div>
              </div>

              {/* 03 Economic Rails */}
              <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>
                    03 / Mechanics
                  </span>
                  <span style={{ fontSize: 12, color: "#a1a1aa" }}>Micro-Settlement & Identity Standard</span>
                </div>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                  x402 v2 Pay-Per-Audit & W3C did:hedera Credentials
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#52525b" }}>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #f4f4f5", display: "flex", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 700 }}>→</span>
                    <div>
                      <strong style={{ color: "#09090b", fontWeight: 600 }}>x402 v2 Facilitated Settlement:</strong> Autonomous
                      payments settled live on Hedera testnet via Blocky402 in exact tinybar units.
                    </div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #f4f4f5", display: "flex", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 700 }}>→</span>
                    <div>
                      <strong style={{ color: "#09090b", fontWeight: 600 }}>W3C did:hedera Standard:</strong> Every agent holds
                      a verifiable DID document and signed credential proving role and voting authority.
                    </div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #f4f4f5", display: "flex", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 700 }}>→</span>
                    <div>
                      <strong style={{ color: "#09090b", fontWeight: 600 }}>Native MCP IDE Integration:</strong> Initiate and
                      verify audits directly from Cursor, Windsurf, or Claude Desktop.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Execution Stages (Clean Monochromatic Steps) */}
            <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>
                    Pipeline
                  </span>
                  <h3 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                    Consensus & Settlement Workflow
                  </h3>
                </div>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#71717a" }}>5 Stages</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid #e4e4e7", borderBottom: "1px solid #e4e4e7" }}>
                {[
                  { step: "01", title: "Ingestion & HTTP 402 Challenge", desc: "Target contract submitted; endpoint issues formal 402 challenge with exact tinybar fee.", badge: "HTTP 402" },
                  { step: "02", title: "Blocky402 Facilitator Settlement", desc: "Consumer signs CryptoTransfer; facilitator co-signs gas fee and settles on Hedera.", badge: "0.01 ℏ Settled" },
                  { step: "03", title: "Parallel Swarm Execution", desc: "5 specialized domain agents execute concurrent AST analysis and threat modeling.", badge: "5 Agents" },
                  { step: "04", title: "Weighted Quorum Consensus", desc: "Cross-agent findings are clustered, challenged, and ranked by domain authority weights.", badge: "Quorum Voting" },
                  { step: "05", title: "Hedera HCS Proof Anchoring", desc: "Deterministic SHA-256 report digest and split receipts published to Topic 0.0.10417469.", badge: "HCS Anchor" },
                ].map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "14px 0",
                      borderBottom: idx !== 4 ? "1px solid #e4e4e7" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#09090b", width: 22 }}>
                        {s.step}
                      </span>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#09090b" }}>{s.title}</span>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#71717a" }}>{s.desc}</p>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: "#52525b",
                        backgroundColor: "#f4f4f5",
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: "1px solid #e4e4e7",
                      }}
                    >
                      {s.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 2: SDK ARCHITECTURE
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "sdk" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>
                Modular Monorepo
              </span>
              <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: "#09090b" }}>
                Developer Packages (@swarmproof/*)
              </h2>
              <p style={{ margin: "4px 0 20px", fontSize: 13, color: "#52525b" }}>
                Four decoupled, TypeScript-native libraries powering the SwarmProof security stack.
              </p>

              {/* Sub-Nav Buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                {[
                  { id: "plugins", name: "@swarmproof/plugins", label: "Plugin Extension SDK" },
                  { id: "x402", name: "@swarmproof/x402", label: "Hedera x402 Client" },
                  { id: "hedera", name: "@swarmproof/hedera", label: "HCS & Mirror Node" },
                  { id: "agents", name: "@swarmproof/agents", label: "LLM Provider Layer" },
                ].map((s) => {
                  const isSel = activeSdk === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSdk(s.id as SdkId)}
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        textAlign: "left",
                        backgroundColor: isSel ? "#09090b" : "#fafafa",
                        color: isSel ? "#ffffff" : "#3f3f46",
                        border: isSel ? "1px solid #09090b" : "1px solid #e4e4e7",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: isSel ? "#a1a1aa" : "#71717a", marginTop: 2 }}>{s.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sub-Content: Plugins */}
            {activeSdk === "plugins" && (
              <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#71717a", textTransform: "uppercase", fontWeight: 600 }}>
                      BYO Agent Architecture
                    </span>
                    <h3 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                      Register Custom Security Models
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `import { AgentRegistry } from "@swarmproof/plugins";\n\nconst myAgent = {\n  manifest: {\n    id: "mev-sentinel",\n    name: "MEV & Flashloan Sentinel",\n    version: "1.0.0",\n    weight: 1.25\n  },\n  executor: { type: "http", url: "https://my-sec-firm.ai/audit" }\n};\n\nconst registry = new AgentRegistry();\nregistry.register(myAgent);`,
                        "Copied TS Snippet"
                      )
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: "#f4f4f5",
                      color: "#18181b",
                      border: "1px solid #d4d4d8",
                      cursor: "pointer",
                    }}
                  >
                    Copy TS Snippet
                  </button>
                </div>

                {/* Monochrome Code Block */}
                <div style={{ borderRadius: 6, border: "1px solid #27272a", backgroundColor: "#09090b", overflow: "hidden" }}>
                  <div
                    style={{
                      padding: "8px 16px",
                      borderBottom: "1px solid #27272a",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: "#a1a1aa",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>plugin-example.ts</span>
                    <span style={{ color: "#71717a" }}>TypeScript</span>
                  </div>
                  <pre style={{ margin: 0, padding: 16, fontSize: 12, fontFamily: "var(--font-mono)", color: "#e4e4e7", lineHeight: 1.6, overflowX: "auto" }}>
{`// 1. Import lightweight registry package
import { AgentRegistry } from "@swarmproof/plugins";

// 2. Define custom specialist agent with custom consensus voting weight
const myCustomAgent = {
  manifest: {
    id: "mev-sentinel",
    name: "MEV & Flashloan Sentinel",
    version: "1.0.0",
    weight: 1.25, // Consensus voting multiplier
  },
  executor: { type: "http", url: "https://my-sec-firm.ai/audit" }
};

// 3. Register to participate in swarm consensus
const registry = new AgentRegistry();
registry.register(myCustomAgent);`}
                  </pre>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
                  <div style={{ padding: 12, backgroundColor: "#fafafa", borderRadius: 6, border: "1px solid #e4e4e7" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#09090b" }}>Remote HTTP Agents</span>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#71717a" }}>
                      Stateless microservices returning strictly typed vulnerability schemas.
                    </p>
                  </div>
                  <div style={{ padding: 12, backgroundColor: "#fafafa", borderRadius: 6, border: "1px solid #e4e4e7" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#09090b" }}>Local LLM Pipelines</span>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#71717a" }}>
                      Self-contained prompts tuned for specific vulnerability classes.
                    </p>
                  </div>
                  <div style={{ padding: 12, backgroundColor: "#fafafa", borderRadius: 6, border: "1px solid #e4e4e7" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#09090b" }}>Weighted Quorums</span>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#71717a" }}>
                      Calculated influence during cross-domain aggregation voting.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Content: x402 */}
            {activeSdk === "x402" && (
              <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#71717a", textTransform: "uppercase", fontWeight: 600 }}>
                      Hedera Native Payments
                    </span>
                    <h3 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                      x402 Client & Facilitator Interaction
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `import { X402Client } from "@swarmproof/x402";\n\nconst client = new X402Client({\n  payerAccountId: "0.0.10119346",\n  payerPrivateKey: process.env.HEDERA_PRIVATE_KEY!,\n  facilitatorUrl: "https://api.testnet.blocky402.com",\n});\n\nconst result = await client.buy("http://localhost:3001/audit", {\n  method: "POST",\n  body: JSON.stringify({ contractName: "EtherVault", source: code }),\n});`,
                        "Copied x402 Snippet"
                      )
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: "#f4f4f5",
                      color: "#18181b",
                      border: "1px solid #d4d4d8",
                      cursor: "pointer",
                    }}
                  >
                    Copy TS Snippet
                  </button>
                </div>

                <div style={{ borderRadius: 6, border: "1px solid #27272a", backgroundColor: "#09090b", overflow: "hidden" }}>
                  <div
                    style={{
                      padding: "8px 16px",
                      borderBottom: "1px solid #27272a",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: "#a1a1aa",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>x402-client.ts</span>
                    <span style={{ color: "#71717a" }}>TypeScript</span>
                  </div>
                  <pre style={{ margin: 0, padding: 16, fontSize: 12, fontFamily: "var(--font-mono)", color: "#e4e4e7", lineHeight: 1.6, overflowX: "auto" }}>
{`import { X402Client } from "@swarmproof/x402";

const client = new X402Client({
  payerAccountId: "0.0.10119346",
  payerPrivateKey: process.env.HEDERA_PRIVATE_KEY!,
  facilitatorUrl: "https://api.testnet.blocky402.com",
});

// Intercepts 402, constructs Hedera transfer, signs, and executes
const result = await client.buy("http://localhost:3001/audit", {
  method: "POST",
  body: JSON.stringify({ contractName: "Vault", source: code }),
});`}
                  </pre>
                </div>

                <div style={{ padding: 12, backgroundColor: "#fafafa", borderRadius: 6, border: "1px solid #e4e4e7", marginTop: 14, fontSize: 12, fontFamily: "var(--font-mono)", color: "#3f3f46" }}>
                  <strong>Fixed-Point Unit Conversion:</strong> usdToTinybars($1.00) = 1,000,000 tinybars (0.01 ℏ) without floating-point inaccuracies.
                </div>
              </div>
            )}

            {/* Sub-Content: Hedera */}
            {activeSdk === "hedera" && (
              <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#71717a", textTransform: "uppercase", fontWeight: 600 }}>
                  Infrastructure
                </span>
                <h3 style={{ margin: "2px 0 14px", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                  Public Mirror Node & HCS Proof Toolkit
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ padding: 14, backgroundColor: "#fafafa", borderRadius: 6, border: "1px solid #e4e4e7", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: "#09090b" }}>mirror.verifyTransfer(payer, amount, timestamp)</span>
                    <p style={{ color: "#71717a", fontSize: 11, margin: "4px 0 0", fontFamily: "var(--font-sans)" }}>
                      Enables unauthenticated verification of settled transactions via public Hedera Mirror Nodes without API keys.
                    </p>
                  </div>

                  <div style={{ padding: 14, backgroundColor: "#fafafa", borderRadius: 6, border: "1px solid #e4e4e7", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: "#09090b" }}>paymentProof.anchor(auditId, splitDistribution)</span>
                    <p style={{ color: "#71717a", fontSize: 11, margin: "4px 0 0", fontFamily: "var(--font-sans)" }}>
                      Submits immutable micro-royalty payment trail directly into Hedera Consensus Service Topic 0.0.10417469.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Content: Agents */}
            {activeSdk === "agents" && (
              <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#71717a", textTransform: "uppercase", fontWeight: 600 }}>
                  Inference Abstraction
                </span>
                <h3 style={{ margin: "2px 0 14px", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                  Universal LLM Execution & AST Fallbacks
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12, fontFamily: "var(--font-mono)", color: "#3f3f46" }}>
                  <div style={{ padding: 10, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                    01 / Robust JSON and codeblock sanitization across Anthropic Claude, OpenAI, and local Ollama models.
                  </div>
                  <div style={{ padding: 10, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                    02 / Automatic graceful degradation to deterministic static rule checks if API rate limits occur.
                  </div>
                  <div style={{ padding: 10, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                    03 / Strict runtime validation ensuring severity, line indices, CWE taxonomy, and remediation code exist.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 3: MODEL CONTEXT PROTOCOL (MCP)
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "mcp" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>
                    IDE Protocol Standard
                  </span>
                  <h2 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: "#09090b" }}>
                    Model Context Protocol (@swarmproof/mcp)
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#52525b" }}>
                    Native execution inside Cursor, Windsurf, and Claude Desktop.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `{\n  "mcpServers": {\n    "swarmproof": {\n      "command": "node",\n      "args": ["packages/mcp/dist/index.js"],\n      "env": {\n        "SWARMPROOF_API_URL": "http://localhost:3001"\n      }\n    }\n  }\n}`,
                      "Copied MCP configuration"
                    )
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    backgroundColor: "#09090b",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Copy MCP Config
                </button>
              </div>

              <div style={{ padding: 12, borderRadius: 6, backgroundColor: "#fafafa", border: "1px solid #d4d4d8", fontFamily: "var(--font-mono)", fontSize: 12, color: "#3f3f46", display: "flex", gap: 8 }}>
                <strong style={{ color: "#09090b" }}>Prompt:</strong>
                <span>@swarmproof audit this ReentrancyVault contract and verify consensus proof on Hedera</span>
              </div>
            </div>

            {/* Exposed Tools List */}
            <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#09090b", fontWeight: 700 }}>
                  6 Registered MCP Tools
                </h3>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#71717a" }}>JSON-RPC 2.0</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid #e4e4e7" }}>
                {[
                  { name: "audit_contract(source, contractName, network?)", badge: "Core Engine", desc: "Executes full pipeline: creates job, verifies payment, triggers swarm debate, consensus quorum, and anchors SHA-256 report on Hedera HCS." },
                  { name: "get_audit_status(auditId)", badge: "Telemetry", desc: "Queries real-time phase: analyzing → consensus → verifying → anchored, including Hedera HCS payment receipts." },
                  { name: "get_findings(auditId)", badge: "Report", desc: "Returns all verified vulnerabilities confirmed by cross-agent quorum consensus with remediation diffs." },
                  { name: "verify_finding(auditId, findingId)", badge: "Validation", desc: "Automates independent reproductive proof execution using deterministic static analysis and bytecode checks." },
                  { name: "get_audit_proof(auditId)", badge: "Cryptographic", desc: "Retrieves immutable HCS consensus timestamp, transaction ID, and cryptographic report hash for tamper-proof audits." },
                  { name: "list_agents()", badge: "Identity", desc: "Enumerates active swarm participants, their W3C DIDs (did:hedera), domain competencies, and quorum weights." },
                ].map((t, idx) => (
                  <div key={idx} style={{ padding: "14px 0", borderBottom: "1px solid #e4e4e7" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 700, color: "#09090b" }}>{t.name}</span>
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", backgroundColor: "#f4f4f5", padding: "2px 6px", borderRadius: 4, border: "1px solid #e4e4e7", color: "#52525b" }}>
                        {t.badge}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#52525b" }}>{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 4: W3C DID CORE 1.0 & VCs
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "identity" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>
                    W3C DID Core 1.0 & VC 1.1
                  </span>
                  <h2 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: "#09090b" }}>
                    Autonomous Agent Digital Identity (did:hedera)
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#52525b" }}>
                    Each autonomous agent has a sovereign identifier anchored on Hedera HCS Topic 0.0.10417469.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setIdFormat("did")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: idFormat === "did" ? "#09090b" : "#f4f4f5",
                      color: idFormat === "did" ? "#ffffff" : "#52525b",
                      border: "1px solid #d4d4d8",
                      cursor: "pointer",
                    }}
                  >
                    DID Document
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdFormat("vc")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: idFormat === "vc" ? "#09090b" : "#f4f4f5",
                      color: idFormat === "vc" ? "#ffffff" : "#52525b",
                      border: "1px solid #d4d4d8",
                      cursor: "pointer",
                    }}
                  >
                    Verifiable Credential
                  </button>
                </div>
              </div>

              <div style={{ padding: "10px 14px", backgroundColor: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontFamily: "var(--font-mono)", fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                  <span style={{ color: "#a1a1aa" }}>URI:</span>
                  <span style={{ color: "#09090b", fontWeight: 600, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    did:hedera:testnet:0.0.10417469_reentrancy-agent
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard("did:hedera:testnet:0.0.10417469_reentrancy-agent", "Copied DID URI")}
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    backgroundColor: "#ffffff",
                    border: "1px solid #d4d4d8",
                    borderRadius: 4,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* JSON Viewer */}
            <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 700, color: "#09090b" }}>
                  {idFormat === "did" ? "W3C DID Document (GET /agents/:id/did)" : "W3C Verifiable Credential (GET /agents/:id/credential)"}
                </span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#71717a" }}>
                  {idFormat === "did" ? "MIME: application/did+ld+json" : "MIME: application/vc+ld+json"}
                </span>
              </div>

              <div style={{ borderRadius: 6, border: "1px solid #27272a", backgroundColor: "#09090b", overflow: "hidden" }}>
                <pre style={{ margin: 0, padding: 16, fontSize: 12, fontFamily: "var(--font-mono)", color: "#e4e4e7", maxHeight: 360, overflowY: "auto", lineHeight: 1.6 }}>
                  {idFormat === "did" ? JSON.stringify(didDocJson, null, 2) : JSON.stringify(vcJson, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 5: ON-CHAIN PROOFS
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "proofs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>
                Public Verification
              </span>
              <h2 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: "#09090b" }}>
                Hedera Testnet Explorer Receipts
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#52525b" }}>
                Real-time proofs verified on HashScan and public Hedera mirror nodes.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { title: "HCS Consensus Topic", id: "0.0.10417469", url: "https://hashscan.io/testnet/topic/0.0.10417469", desc: "Permanently sequences SHA-256 audit hashes, split settlement receipts, and agent identity messages." },
                { title: "x402 Micropayment Settlement", id: "0.0.7162784@1788849225.803231622", url: "https://hashscan.io/testnet/transaction/0.0.7162784@1788849225.803231622", desc: "Live 0.01 ℏ payment settled via Blocky402 facilitator with multi-sig execution." },
                { title: "Consensus Audit Proof", id: "0.0.10119346@1788849233.623260124", url: "https://hashscan.io/testnet/transaction/0.0.10119346@1788849233.623260124", desc: "Deterministic finding digest anchored with cryptographic consensus timestamp." },
                { title: "Agent DID Message", id: "0.0.10119346@1789021885.521714338", url: "https://hashscan.io/testnet/transaction/0.0.10119346@1789021885.521714338", desc: "Sovereign agent registration broadcast containing W3C DID metadata and capabilities." },
                { title: "Settlement Account", id: "0.0.10417474", url: "https://hashscan.io/testnet/account/0.0.10417474", desc: "Auditor pool account for collecting x402 micro-fees and triggering split allocations." },
              ].map((p, idx) => (
                <div key={idx} style={{ padding: 18, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 700, color: "#09090b" }}>{p.title}</span>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", backgroundColor: "#f4f4f5", color: "#27272a", padding: "2px 8px", borderRadius: 4, border: "1px solid #d4d4d8" }}>
                      Verified On-Chain
                    </span>
                  </div>
                  <p style={{ margin: "2px 0 12px", fontSize: 12, color: "#52525b" }}>{p.desc}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f4f4f5", paddingTop: 10, fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    <span style={{ color: "#27272a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.id}</span>
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "#09090b", fontWeight: 600, textDecoration: "none" }}>
                      HashScan ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* CLI Terminal Execution */}
            <div style={{ padding: 18, borderRadius: 8, backgroundColor: "#09090b", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#e4e4e7" }}>
                <span style={{ color: "#71717a", display: "block", fontSize: 11, fontWeight: 700, marginBottom: 2 }}>REPRODUCE VIA CLI</span>
                <code>pnpm --filter @swarmproof/api x402:live</code>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard("pnpm --filter @swarmproof/api x402:live", "Copied command")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  backgroundColor: "#ffffff",
                  color: "#09090b",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Copy Command
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 6: MENTOR DISCUSSION
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "questions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 600 }}>
                Rubric Alignment
              </span>
              <h2 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: "#09090b" }}>
                Strategic Discussion Points
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#52525b" }}>
                Targeted review questions formulated for the Hedera Agentic Payments judges.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ padding: 20, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Question 01 — Hedera Agentic Payments
                </span>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#09090b", lineHeight: 1.5 }}>
                  "We currently settle audits using the Blocky402 x402 facilitator for HBAR and HTS. For our final demo, would you recommend showing an atomic multi-recipient CryptoTransferTransaction splitting the fee across all 5 agents in a single transaction, or showing scheduled transactions with a challenge window?"
                </h4>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#71717a", borderTop: "1px solid #f4f4f5", paddingTop: 8 }}>
                  <strong>Strategic Focus:</strong> Directly validates adherence to the 'Streaming & Scheduled Transactions' rubric bonus point.
                </p>
              </div>

              <div style={{ padding: 20, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Question 02 — Agent Consensus & Evaluation
                </span>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#09090b", lineHeight: 1.5 }}>
                  "Our swarm runs 5 specialist agents with weighted quorum voting. Would you recommend showing the agents' debate transcripts directly on the dashboard, or focusing heavily on the verified HashScan cryptographic proofs?"
                </h4>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#71717a", borderTop: "1px solid #f4f4f5", paddingTop: 8 }}>
                  <strong>Strategic Focus:</strong> Clarifies whether evaluators prefer narrative UX friction vs verifiable cryptographic rigor.
                </p>
              </div>

              <div style={{ padding: 20, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#71717a", fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Question 03 — Developer Adoption & Tooling
                </span>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#09090b", lineHeight: 1.5 }}>
                  "We built both an MCP server for IDEs (Cursor/Claude Desktop) and a Bring-Your-Own-Agent SDK. Which of those two angles resonates most strongly with the Hedera and AI track judges?"
                </h4>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#71717a", borderTop: "1px solid #f4f4f5", paddingTop: 8 }}>
                  <strong>Strategic Focus:</strong> Determines the primary narrative emphasis for the 3-minute project demo recording.
                </p>
              </div>
            </div>

            {/* Notes Area */}
            <div style={{ padding: 24, borderRadius: 8, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#09090b" }}>Mentor Call Scratchpad</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#71717a" }}>Persists locally across browser refreshes.</p>
                </div>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#71717a", backgroundColor: "#f4f4f5", padding: "2px 6px", borderRadius: 4, border: "1px solid #e4e4e7" }}>
                  Local Storage
                </span>
              </div>
              <textarea
                value={mentorNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Type mentor notes, feedback, and action items here..."
                rows={6}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  backgroundColor: "#fafafa",
                  border: "1px solid #d4d4d8",
                  color: "#09090b",
                  lineHeight: 1.6,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
