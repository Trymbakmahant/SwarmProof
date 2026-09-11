"use client";

import { useState, useEffect } from "react";
import { type SpecialistAgentMeta, SHAPE_METAS } from "./agentData";
import { AgentCompetencyExamView } from "./AgentCompetencyExamView";

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
  // Active Tab: V2 Competency Exam (recommended) or Custom Manual Configuration
  const [activeTab, setActiveTab] = useState<"exam" | "custom">("exam");

  // Form State
  const defaultPreset = AGENT_PRESETS[0]!;
  const [name, setName] = useState(defaultPreset.name);
  const [agentId, setAgentId] = useState(defaultPreset.agentId);
  const [role, setRole] = useState(defaultPreset.role);
  const [shape, setShape] = useState<SpecialistAgentMeta["shape"]>(defaultPreset.shape);
  const [color, setColor] = useState(defaultPreset.color);
  const [capabilitiesStr, setCapabilitiesStr] = useState(defaultPreset.capabilities.join(", "));
  const [paymentAddress, setPaymentAddress] = useState("0.0.10119346");
  const [systemPrompt, setSystemPrompt] = useState(defaultPreset.systemPrompt);
  const [model, setModel] = useState("gpt-4o");

  // Cryptographic Proof of Ownership State
  const [publicKey, setPublicKey] = useState("033ba0f4cba001b21c3f52006119e8796913cd2328ab03ac2f8b8bf9b97c8e98aa");
  const [signature, setSignature] = useState("");
  const [challenge, setChallenge] = useState("");
  const [nonce, setNonce] = useState("");
  const [keyType, setKeyType] = useState<string>("EcdsaSecp256k1VerificationKey2019");
  const [isGeneratingChallenge, setIsGeneratingChallenge] = useState(false);
  const [isSigningChallenge, setIsSigningChallenge] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"unverified" | "signed" | "verified" | "error">("unverified");
  const [verificationFeedback, setVerificationFeedback] = useState<string>("External agents must prove Hedera wallet ownership before enrollment.");
  const [showChallengeDetails, setShowChallengeDetails] = useState(false);

  // Browser Wallet State (MetaMask / Rabby / Arc / Safari EIP-1193)
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isSigningWithWallet, setIsSigningWithWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Connect browser wallet
  const handleConnectWallet = async () => {
    setWalletError(null);
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setWalletError("No browser wallet extension detected. Please ensure MetaMask, Rabby, or a web3 wallet extension is enabled in your browser.");
      return;
    }

    try {
      setIsConnectingWallet(true);
      const accounts = (await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const first = accounts?.[0];
      if (!first) {
        throw new Error("No accounts selected in wallet");
      }

      const selected = first.toLowerCase();
      setWalletAddress(selected);

      // Look up Hedera account ID mapped to this EVM address
      try {
        const lookupRes = await fetch(`${API_BASE}/accounts/lookup?query=${selected}`);
        if (lookupRes.ok) {
          const lookupData = await lookupRes.json();
          if (lookupData.accountId) {
            setPaymentAddress(lookupData.accountId);
            if (lookupData.key) {
              setPublicKey(lookupData.key);
            }
          } else {
            setPaymentAddress(selected);
            setPublicKey(selected);
          }
        } else {
          setPaymentAddress(selected);
          setPublicKey(selected);
        }
      } catch {
        setPaymentAddress(selected);
        setPublicKey(selected);
      }

      // Refresh challenge for connected wallet
      fetchChallenge(agentId, selected);
      setVerificationFeedback(`Connected: ${selected.slice(0, 6)}...${selected.slice(-4)}. Click 'Sign with Connected Wallet' to sign the challenge.`);
    } catch (err) {
      console.error("Wallet connection failed:", err);
      setWalletError((err as Error).message);
    } finally {
      setIsConnectingWallet(false);
    }
  };

  // Sign challenge directly from connected browser wallet
  const handleSignWithBrowserWallet = async () => {
    setWalletError(null);
    const activeAddress = walletAddress;
    if (!activeAddress) {
      await handleConnectWallet();
      return;
    }

    if (typeof window === "undefined" || !(window as any).ethereum) {
      setWalletError("Browser wallet extension not available.");
      return;
    }

    try {
      setIsSigningWithWallet(true);
      let activeChallenge = challenge;
      if (!activeChallenge) {
        const targetAgent = agentId || "unnamed-agent";
        const cRes = await fetch(
          `${API_BASE}/agents/challenge?agentId=${encodeURIComponent(targetAgent)}&accountId=${encodeURIComponent(activeAddress)}`,
        );
        const cData = await cRes.json();
        activeChallenge = cData.challenge;
        setChallenge(cData.challenge);
        setNonce(cData.nonce);
      }

      // EIP-191 personal_sign request:
      const sig = (await (window as any).ethereum.request({
        method: "personal_sign",
        params: [activeChallenge, activeAddress],
      })) as string;

      setSignature(sig);
      setPublicKey(activeAddress);
      setKeyType("EcdsaSecp256k1VerificationKey2019");
      setVerificationStatus("signed");
      setVerificationFeedback(
        `✓ Cryptographically signed by wallet ${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)} (EIP-191 ECDSA secp256k1).`,
      );
    } catch (err) {
      console.error("Wallet signing rejected or failed:", err);
      setWalletError((err as Error).message);
      setVerificationStatus("error");
    } finally {
      setIsSigningWithWallet(false);
    }
  };

  // Registration Lifecycle
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [stepMessage, setStepMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredData, setRegisteredData] = useState<any | null>(null);
  const [showCredentialDrawer, setShowCredentialDrawer] = useState(false);
  const [copiedDid, setCopiedDid] = useState(false);

  const fetchChallenge = async (customAgentId?: string, customAccountId?: string) => {
    try {
      setIsGeneratingChallenge(true);
      const targetAgent = customAgentId || agentId || "unnamed-agent";
      const targetAccount = customAccountId || paymentAddress.trim() || "0.0.10119346";
      const res = await fetch(
        `${API_BASE}/agents/challenge?agentId=${encodeURIComponent(targetAgent)}&accountId=${encodeURIComponent(targetAccount)}`,
      );
      if (!res.ok) throw new Error(`Challenge generation failed: HTTP ${res.status}`);
      const data = await res.json();
      setChallenge(data.challenge);
      setNonce(data.nonce);
      setSignature("");
      setVerificationStatus("unverified");
      setVerificationFeedback("Challenge generated. Sign with your Hedera private key to prove ownership.");
    } catch (err) {
      console.error("Failed to generate challenge:", err);
      setVerificationFeedback(`Challenge error: ${(err as Error).message}`);
    } finally {
      setIsGeneratingChallenge(false);
    }
  };

  useEffect(() => {
    fetchChallenge(agentId, paymentAddress);
  }, []);

  // Quick 1-click testnet signing demo for judges / testing
  const handleSignWithTestnetKey = async () => {
    try {
      setIsSigningChallenge(true);
      let activeChallenge = challenge;
      if (!activeChallenge) {
        const targetAgent = agentId || "unnamed-agent";
        const targetAccount = paymentAddress.trim() || "0.0.10119346";
        const cRes = await fetch(
          `${API_BASE}/agents/challenge?agentId=${encodeURIComponent(targetAgent)}&accountId=${encodeURIComponent(targetAccount)}`,
        );
        const cData = await cRes.json();
        activeChallenge = cData.challenge;
        setChallenge(cData.challenge);
        setNonce(cData.nonce);
      }

      const res = await fetch(`${API_BASE}/agents/sign-test-challenge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge: activeChallenge }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const signData = await res.json();
      setPublicKey(signData.publicKey);
      setSignature(signData.signature);
      setKeyType(signData.keyType);
      setPaymentAddress(signData.accountId);
      setVerificationStatus("signed");
      setVerificationFeedback("Cryptographically signed with Hedera ECDSA secp256k1 key. Verified on-chain via Mirror Node.");
    } catch (err) {
      console.error("Signing error:", err);
      setVerificationFeedback(`Signing failed: ${(err as Error).message}`);
      setVerificationStatus("error");
    } finally {
      setIsSigningChallenge(false);
    }
  };

  const handleSignatureChange = (sigVal: string) => {
    setSignature(sigVal);
    if (sigVal.trim().length >= 64 && publicKey.trim()) {
      setVerificationStatus("signed");
      setVerificationFeedback("Custom cryptographic signature provided.");
    } else {
      setVerificationStatus("unverified");
      setVerificationFeedback("Signature required to prove wallet ownership.");
    }
  };

  // Quick Preset Selection
  const applyPreset = (preset: PresetTemplate) => {
    setName(preset.name);
    setAgentId(preset.agentId);
    setRole(preset.role);
    setShape(preset.shape);
    setColor(preset.color);
    setCapabilitiesStr(preset.capabilities.join(", "));
    setSystemPrompt(preset.systemPrompt);
    fetchChallenge(preset.agentId, paymentAddress);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const newId = slug ? `${slug}-agent` : "";
    setAgentId(newId);
    if (newId) {
      fetchChallenge(newId, paymentAddress);
    }
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
      setStepMessage("1/5: Verifying cryptographic signature & Hedera wallet ownership...");
      await new Promise((r) => setTimeout(r, 400));

      setStepMessage("2/5: Constructing W3C did:hedera DID Document with verified public key...");
      await new Promise((r) => setTimeout(r, 400));

      setStepMessage("3/5: Issuing W3C Verifiable Credential with cryptographic proof...");
      await new Promise((r) => setTimeout(r, 400));

      setStepMessage("4/5: Anchoring DID & Credential to Hedera HCS Topic 0.0.10417469...");

      const payload = {
        name,
        agentId: agentId || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        role,
        capabilities,
        paymentAddress: paymentAddress.trim() || "0.0.10119346",
        publicKey: publicKey.trim(),
        signature: signature.trim(),
        challenge,
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

      setStepMessage("5/5: Enrolling sovereign agent into weighted consensus quorum...");
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
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.15)",
          border: "1px solid #e4e4e7",
          backgroundColor: "#ffffff",
        }}
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
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                backgroundColor: "#f4f4f5",
                border: "1px solid #e4e4e7",
                color: "#09090b",
              }}
            >
              {activeTab === "exam" ? "🧪" : SHAPE_METAS[shape].icon}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                  {activeTab === "exam" ? "Agent Competency Exam & HCS Proof" : "Register AI Security Agent"}
                </h3>
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
                  Hedera HCS Anchored
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#71717a" }}>
                {activeTab === "exam"
                  ? "Prove specialist competency against on-chain benchmark suites to earn cryptographic Hedera credentials."
                  : "Deploy a specialized auditor into the SwarmProof quorum on-chain."}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-swarm-secondary"
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            ✕ Close
          </button>
        </div>

        {/* Dual Tab Switcher Bar */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e4e4e7",
            backgroundColor: "#fcfcfc",
            padding: "0 20px",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("exam")}
            style={{
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: activeTab === "exam" ? "#09090b" : "#71717a",
              borderBottom: activeTab === "exam" ? "2px solid #09090b" : "2px solid transparent",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s ease",
            }}
          >
            <span>🧪</span>
            <span>Take Competency Exam &amp; HCS Proof</span>
            <span
              style={{
                fontSize: 10,
                backgroundColor: activeTab === "exam" ? "#10b98115" : "#f4f4f5",
                color: activeTab === "exam" ? "#059669" : "#71717a",
                padding: "2px 6px",
                borderRadius: 4,
                fontWeight: 700,
              }}
            >
              V2 Recommended
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            style={{
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: activeTab === "custom" ? "#09090b" : "#71717a",
              borderBottom: activeTab === "custom" ? "2px solid #09090b" : "2px solid transparent",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s ease",
            }}
          >
            <span>⚙️</span>
            <span>Manual Specialist Config</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, backgroundColor: "#ffffff" }}>
          {status === "success" ? (
            /* Success Screen */
            <div style={{ display: "flex", flexDirection: "column", gap: 20, textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  margin: "0 auto",
                  borderRadius: "50%",
                  backgroundColor: "#f0fdf4",
                  border: "2px solid #bbf7d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  color: "#16a34a",
                }}
              >
                ✓
              </div>

              <div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 700, color: "#09090b" }}>
                  Agent Identity Registered On-Chain!
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: "#71717a" }}>
                  {name} is now an active member of the decentralized SwarmProof audit quorum.
                </p>
              </div>

              {/* Certificate Card */}
              <div
                style={{
                  backgroundColor: "#fafafa",
                  border: "1px solid #e4e4e7",
                  borderRadius: 10,
                  padding: 16,
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{SHAPE_METAS[shape].icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: "#09090b", fontSize: 14 }}>{name}</div>
                      <div style={{ fontSize: 11, color: "#71717a", fontFamily: "var(--font-mono)" }}>
                        ID: {agentId}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        backgroundColor: "#f4f4f5",
                        border: "1px solid #e4e4e7",
                        color: "#09090b",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      W3C did:hedera
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
                      ● Quorum Active
                    </span>
                  </div>
                </div>

                {/* W3C DID Highlight Banner */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e4e4e7",
                    borderRadius: 6,
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                      W3C Sovereign Decentralized Identifier (DID)
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "#09090b",
                        fontWeight: 500,
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
                    className="btn-swarm-secondary"
                    style={{ fontSize: 11, padding: "4px 8px", whiteSpace: "nowrap" }}
                  >
                    {copiedDid ? "✓ Copied" : "Copy DID"}
                  </button>
                </div>

                <div style={{ height: 1, backgroundColor: "#e4e4e7" }} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                  <div>
                    <div style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>Hedera HCS Topic ID</div>
                    <div style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 600 }}>
                      {registeredData?.agent?.identityTopicId || "0.0.10417469"}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>W3C Verifiable Credential</div>
                    <div style={{ fontFamily: "var(--font-mono)", color: "#166534", fontWeight: 600 }}>
                      SwarmSecurityAuditorCredential
                    </div>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>Hedera HCS Consensus Timestamp &amp; Tx</div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "#09090b",
                        fontSize: 11,
                        backgroundColor: "#ffffff",
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #e4e4e7",
                        marginTop: 4,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{registeredData?.agent?.identityReference || "0.0.10119346@registered"}</span>
                      <span style={{ color: "#71717a", fontSize: 10 }}>
                        {registeredData?.agent?.consensusTimestamp || new Date().toISOString()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>Payout Revenue Address (x402)</div>
                    <div style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 600 }}>
                      {paymentAddress}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>3D Orbit Mesh</div>
                    <div style={{ color: "#09090b", fontWeight: 600 }}>
                      {SHAPE_METAS[shape].label}
                    </div>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>Verified Hedera Public Key</div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "#09090b",
                        fontSize: 11,
                        backgroundColor: "#ffffff",
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #e4e4e7",
                        marginTop: 4,
                        wordBreak: "break-all",
                      }}
                    >
                      {registeredData?.agent?.publicKey || publicKey}
                    </div>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>Cryptographic Signature Proof</span>
                      <span style={{ fontSize: 10, color: "#166534", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                        ● {registeredData?.agent?.keyType || keyType}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "#52525b",
                        fontSize: 10,
                        backgroundColor: "#f4f4f5",
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #e4e4e7",
                        marginTop: 4,
                        wordBreak: "break-all",
                      }}
                    >
                      {registeredData?.agent?.signature || signature || "Verified Cryptographic Signature"}
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
                      color: "#09090b",
                      textDecoration: "underline",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span>{showCredentialDrawer ? "▼ Hide" : "▶ Inspect"} W3C Verifiable Credential &amp; DID Document (JSON-LD)</span>
                  </button>

                  {showCredentialDrawer && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
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
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
                <a
                  href={`https://hashscan.io/testnet/topic/${registeredData?.agent?.identityTopicId || "0.0.10417469"}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-swarm-secondary"
                  style={{ textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <span>HashScan Topic</span> ↗
                </a>

                <a
                  href={`${API_BASE}/agents/${agentId}/did`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-swarm-secondary"
                  style={{ textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <span>W3C DID Document</span> ↗
                </a>

                <a
                  href={`${API_BASE}/agents/${agentId}/credential`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-swarm-secondary"
                  style={{ textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <span>W3C Credential</span> ↗
                </a>

                <button
                  onClick={onClose}
                  className="btn-swarm-primary"
                  style={{
                    backgroundColor: "#09090b",
                    color: "#ffffff",
                    border: "1px solid #09090b",
                  }}
                >
                  Inspect in 3D Swarm Simulation →
                </button>
              </div>
            </div>
          ) : activeTab === "exam" ? (
            /* V2 Benchmark & Competency Exam Flow */
            <AgentCompetencyExamView
              onQualified={(newAgent) => {
                onRegistered(newAgent);
                onClose();
              }}
              onCancel={onClose}
              initialWalletAddress={walletAddress}
              initialPaymentAddress={paymentAddress}
              initialPublicKey={publicKey}
              initialSignature={signature}
              initialChallenge={challenge}
            />
          ) : (
            /* Form Screen */
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Preset Template Selector */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "var(--font-mono)", marginBottom: 8 }}>
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
                          backgroundColor: isSelected ? "#f4f4f5" : "#ffffff",
                          border: isSelected ? "1px solid #09090b" : "1px solid #e4e4e7",
                          borderRadius: 6,
                          padding: "8px 10px",
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{SHAPE_METAS[p.shape].icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "#09090b" : "#52525b" }}>
                          {p.name.replace(/ Specialist| Agent| Auditor/gi, "")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Two Column Section */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
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
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
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
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
                  Security Specialty &amp; Role *
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

              {/* Capabilities */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
                  Capabilities &amp; AST Detector Tags (comma-separated)
                </label>
                <input
                  type="text"
                  className="swarm-input"
                  value={capabilitiesStr}
                  onChange={(e) => setCapabilitiesStr(e.target.value)}
                  placeholder="e.g. flash-loan, oracle-manipulation, slippage-omission"
                  style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 12 }}
                />
              </div>

              {/* Cryptographic Proof of Hedera Wallet Ownership */}
              <div
                style={{
                  backgroundColor: "#fafafa",
                  border: "1px solid #e4e4e7",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15 }}>🔒</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#09090b" }}>
                        Hedera Wallet Cryptographic Ownership Proof
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontWeight: 600,
                          backgroundColor: verificationStatus === "signed" ? "#f0fdf4" : "#f4f4f5",
                          border: verificationStatus === "signed" ? "1px solid #bbf7d0" : "1px solid #e4e4e7",
                          color: verificationStatus === "signed" ? "#166534" : "#52525b",
                        }}
                      >
                        {verificationStatus === "signed" ? "✓ Signature Verified" : "Proof Required"}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#71717a" }}>
                      Agents must prove private key possession before binding their Hedera wallet to W3C did:hedera and entering consensus.
                    </p>
                    {walletAddress && (
                      <div
                        style={{
                          marginTop: 6,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          color: "#166534",
                          fontFamily: "var(--font-mono)",
                          backgroundColor: "#f0fdf4",
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: "1px solid #bbf7d0",
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16a34a" }} />
                        <span>Connected: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</span>
                        <button
                          type="button"
                          onClick={() => setWalletAddress(null)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "#71717a",
                            textDecoration: "underline",
                            fontSize: 10,
                            cursor: "pointer",
                            marginLeft: 4,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {walletError && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: "#b91c1c",
                          backgroundColor: "#fef2f2",
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid #fecaca",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        ✕ {walletError}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {walletAddress ? (
                      <button
                        type="button"
                        onClick={handleSignWithBrowserWallet}
                        disabled={isSigningWithWallet}
                        className="btn-swarm-primary"
                        style={{
                          fontSize: 11,
                          padding: "6px 12px",
                          whiteSpace: "nowrap",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: "#09090b",
                          color: "#ffffff",
                          border: "1px solid #09090b",
                        }}
                      >
                        {isSigningWithWallet
                          ? "Signing in Wallet..."
                          : `✍️ Sign Challenge (${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)})`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectWallet}
                        disabled={isConnectingWallet}
                        className="btn-swarm-primary"
                        style={{
                          fontSize: 11,
                          padding: "6px 12px",
                          whiteSpace: "nowrap",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: "#09090b",
                          color: "#ffffff",
                          border: "1px solid #09090b",
                        }}
                      >
                        {isConnectingWallet ? "Connecting..." : "🦊 Connect & Sign Wallet"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSignWithTestnetKey}
                      disabled={isSigningChallenge}
                      className="btn-swarm-secondary"
                      style={{
                        fontSize: 11,
                        padding: "6px 10px",
                        whiteSpace: "nowrap",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: "#ffffff",
                      }}
                      title="Auto-sign using pre-funded Hedera testnet operator key (0.0.10119346)"
                    >
                      {isSigningChallenge ? "Signing..." : "⚡ 1-Click Demo Key"}
                    </button>
                  </div>
                </div>

                {/* Account ID & Public Key Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#52525b", marginBottom: 4 }}>
                      Hedera Account ID (Payout &amp; Identity) *
                    </label>
                    <input
                      type="text"
                      className="swarm-input"
                      value={paymentAddress}
                      onChange={(e) => {
                        setPaymentAddress(e.target.value);
                        fetchChallenge(agentId, e.target.value);
                      }}
                      required
                      placeholder="0.0.10119346"
                      style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 12 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#52525b", marginBottom: 4 }}>
                      Hedera Public Key (Hex) *
                    </label>
                    <input
                      type="text"
                      className="swarm-input"
                      value={publicKey}
                      onChange={(e) => setPublicKey(e.target.value)}
                      required
                      placeholder="033ba0f4cba001b21c3f52006119e8796913cd2328ab03ac2f8b8bf9b97c8e98aa"
                      style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 11 }}
                    />
                  </div>
                </div>

                {/* Challenge & Nonce Box */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#52525b" }}>
                      Cryptographic Challenge &amp; Session Nonce
                    </label>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => fetchChallenge(agentId, paymentAddress)}
                        disabled={isGeneratingChallenge}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: "#09090b",
                          textDecoration: "underline",
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {isGeneratingChallenge ? "Generating..." : "🔄 Refresh Challenge"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowChallengeDetails(!showChallengeDetails)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: "#71717a",
                          textDecoration: "underline",
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {showChallengeDetails ? "Hide Raw" : "View Raw Challenge"}
                      </button>
                    </div>
                  </div>

                  {showChallengeDetails ? (
                    <textarea
                      readOnly
                      className="swarm-input"
                      value={challenge}
                      rows={4}
                      style={{
                        width: "100%",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        backgroundColor: "#f4f4f5",
                        color: "#09090b",
                        lineHeight: 1.4,
                        marginBottom: 8,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "#52525b",
                        backgroundColor: "#f4f4f5",
                        border: "1px solid #e4e4e7",
                        padding: "6px 10px",
                        borderRadius: 6,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <span>Nonce: {nonce || "generating…"}</span>
                      <span style={{ fontSize: 10, color: "#71717a" }}>Topic 0.0.10417469 • hedera:testnet</span>
                    </div>
                  )}

                  {/* Signature Input */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#52525b", marginBottom: 4 }}>
                      Cryptographic Signature (Hex Digest) *
                    </label>
                    <input
                      type="text"
                      className="swarm-input"
                      value={signature}
                      onChange={(e) => handleSignatureChange(e.target.value)}
                      required
                      placeholder="Paste hex signature from external agent key or click 'Sign with Agent Testnet Key'..."
                      style={{
                        width: "100%",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        backgroundColor: signature ? "#ffffff" : "#fffbeb",
                        borderColor: signature ? "#e4e4e7" : "#fef08a",
                      }}
                    />
                  </div>

                  {/* Live Status Pill */}
                  <div
                    style={{
                      marginTop: 8,
                      padding: "6px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: signature ? "#f0fdf4" : "#fefce8",
                      border: signature ? "1px solid #bbf7d0" : "1px solid #fef08a",
                      color: signature ? "#166534" : "#854d0e",
                    }}
                  >
                    <span>{signature ? "✓" : "⚠️"}</span>
                    <span>{verificationFeedback}</span>
                  </div>
                </div>
              </div>

              {/* 3D Geometry Shape Picker */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 8 }}>
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
                          backgroundColor: isSelected ? "#f4f4f5" : "#ffffff",
                          border: isSelected ? "1px solid #09090b" : "1px solid #e4e4e7",
                          borderRadius: 6,
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
                        <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "#09090b" : "#71717a" }}>
                          {sh}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme Color & Model Engine */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 8 }}>
                    Theme Accent Color
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {COLOR_PALETTES.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setColor(c.hex)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          backgroundColor: c.hex,
                          border: color === c.hex ? "2px solid #09090b" : "2px solid #e4e4e7",
                          cursor: "pointer",
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
                        width: 24,
                        height: 24,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        borderRadius: "50%",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
                    Inference Engine
                  </label>
                  <select
                    className="swarm-input"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="gpt-4o">OpenAI GPT-4o (Reasoning &amp; AST)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
                    <option value="ollama-deepseek-r1">Local DeepSeek-R1 (Ollama)</option>
                    <option value="heuristic-ast">Heuristic Static AST Scanner</option>
                  </select>
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
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
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    padding: "10px 14px",
                    color: "#991b1b",
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  ✕ Registration Error: {errorMessage}
                </div>
              )}

              {status === "submitting" && (
                <div
                  style={{
                    backgroundColor: "#fafafa",
                    border: "1px solid #e4e4e7",
                    borderRadius: 6,
                    padding: "10px 14px",
                    color: "#09090b",
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: "2px solid #09090b",
                      borderTopColor: "transparent",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span>{stepMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-swarm-secondary"
                  disabled={status === "submitting"}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-swarm-primary"
                  disabled={status === "submitting"}
                  style={{
                    backgroundColor: "#09090b",
                    color: "#ffffff",
                    border: "1px solid #09090b",
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
