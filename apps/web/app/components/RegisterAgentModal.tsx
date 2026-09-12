"use client";

import { useState, useEffect } from "react";
import { type SpecialistAgentMeta, SHAPE_METAS } from "./agentData";
import { AgentCompetencyExamView } from "./AgentCompetencyExamView";
import { getApiBase } from "../lib/api";

const API_BASE = getApiBase();

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
  // Stepper state: Step 1 (Biometric Anti-Sybil) -> Step 2 (Agent Profile) -> Step 3 (Hedera Anchor)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [agentConfigMode, setAgentConfigMode] = useState<"preset" | "exam">("preset");

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

  // Browser Wallet State
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isSigningWithWallet, setIsSigningWithWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

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

  // Active agents in quorum
  const [existingAgentIds, setExistingAgentIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadActiveAgents() {
      try {
        const res = await fetch(`${API_BASE}/agents`);
        if (res.ok) {
          const data = await res.json();
          const ids = (data.agents || []).map((a: any) => a.agentId);
          setExistingAgentIds(ids);

          // If MEV Sentinel is already registered in the quorum, auto-select Bridge Guard preset
          if (ids.includes("mev-sentinel") || ids.some((id: string) => id.includes("mev"))) {
            const alternative = AGENT_PRESETS[1]!;
            setName(alternative.name);
            setAgentId(alternative.agentId);
            setRole(alternative.role);
            setShape(alternative.shape);
            setColor(alternative.color);
            setCapabilitiesStr(alternative.capabilities.join(", "));
            setSystemPrompt(alternative.systemPrompt);
          }
        }
      } catch (err) {
        console.warn("Failed to query active agents:", err);
      }
    }
    loadActiveAgents();
  }, []);

  const isMevAlreadyRegistered =
    existingAgentIds.includes("mev-sentinel") ||
    existingAgentIds.some((id) => id.includes("mev"));

  const isDuplicateMevSelected =
    isMevAlreadyRegistered &&
    (agentId.toLowerCase().includes("mev") ||
      name.toLowerCase().includes("mev") ||
      role.toLowerCase().includes("flash loan"));

  const handleConnectWallet = async () => {
    setWalletError(null);
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setWalletError("No browser wallet extension detected. Please ensure MetaMask or Rabby is installed.");
      return;
    }

    try {
      setIsConnectingWallet(true);
      const accounts = (await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const first = accounts?.[0];
      if (!first) throw new Error("No accounts selected in wallet");

      const selected = first.toLowerCase();
      setWalletAddress(selected);

      try {
        const mirrorRes = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${selected}`);
        if (mirrorRes.ok) {
          const mirrorData = await mirrorRes.json();
          if (mirrorData?.account) {
            setPaymentAddress(mirrorData.account);
          } else {
            setPaymentAddress(selected);
          }
          if (mirrorData?.key?.key) {
            setPublicKey(mirrorData.key.key);
          } else {
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

      fetchChallenge(agentId, selected);
      setVerificationFeedback(`Connected: ${selected.slice(0, 6)}...${selected.slice(-4)}. Click 'Sign with Connected Wallet' to sign the challenge.`);
    } catch (err) {
      console.error("Wallet connection failed:", err);
      setWalletError((err as Error).message);
    } finally {
      setIsConnectingWallet(false);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isDuplicateMevSelected) {
      setErrorMessage("Duplicate Specialty Restriction: An MEV & Flash Loan Specialist is already registered in the quorum. You cannot create a duplicate MEV & Flash Loan agent.");
      setCurrentStep(1);
      return;
    }

    if (!name.trim()) {
      setErrorMessage("Agent name is required.");
      setCurrentStep(1);
      return;
    }

    setStatus("submitting");
    setStepMessage("1/5: Anchoring sovereign agent identity on Hedera HCS Topic 0.0.10417469...");

    try {
      const capabilities = capabilitiesStr
        .split(",")
        .map((c) => c.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter(Boolean);

      const payload = {
        name: name.trim(),
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
        sampleFinding: {
          title: `Potential Vulnerability in ${payload.role}`,
          category: payload.capabilities[0] || "general-security",
          severity: "high",
          location: "Contract Logic Analysis",
          evidence: "Automated AST scan flagged candidate vulnerability pattern matching specialist domain.",
          reasoning: payload.systemPrompt.slice(0, 180),
        },
      };

      onRegistered(newMeta);
    } catch (err) {
      console.error("Agent registration failed:", err);
      setErrorMessage((err as Error).message || "Failed to register agent on Hedera");
      setStatus("error");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDid(true);
      setTimeout(() => setCopiedDid(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <div className="swarm-modal-backdrop" onClick={onClose}>
        <div
          className="swarm-modal"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: 780,
            width: "95%",
            maxHeight: "92vh",
            overflowY: "auto",
            padding: 0,
            borderRadius: 16,
            backgroundColor: "#ffffff",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "1px solid #e4e4e7",
          }}
        >
          {/* Modal Header */}
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid #e4e4e7",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#ffffff",
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
                  fontSize: 22,
                  backgroundColor: "#f4f4f5",
                  border: "1px solid #e4e4e7",
                }}
              >
                🤖
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                    Register Specialist Security Agent
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
                  Deploy an autonomous specialist into the SwarmProof decentralized consensus quorum.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-swarm-secondary"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              ✕ Close
            </button>
          </div>

          {/* 3-Step Wizard Progress Bar */}
          {status !== "success" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderBottom: "1px solid #e4e4e7",
                backgroundColor: "#fcfcfc",
                padding: "10px 20px",
                gap: 8,
                overflowX: "auto",
              }}
            >
              {/* Step 1 Tab */}
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: currentStep === 1 ? "#09090b" : "#f4f4f5",
                  color: currentStep === 1 ? "#ffffff" : "#71717a",
                  fontWeight: currentStep === 1 ? 700 : 600,
                  fontSize: 12,
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: currentStep === 1 ? "#27272a" : "#e4e4e7",
                    color: currentStep === 1 ? "#ffffff" : "#71717a",
                  }}
                >
                  1
                </span>
                <span>1. Specialist Profile</span>
              </button>

              <span style={{ color: "#cbd5e1", fontSize: 14 }}>→</span>

              {/* Step 2 Tab */}
              <button
                type="button"
                onClick={() => {
                  if (!isDuplicateMevSelected && name.trim()) setCurrentStep(2);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: currentStep === 2 ? "#09090b" : "#f4f4f5",
                  color: currentStep === 2 ? "#ffffff" : "#71717a",
                  fontWeight: currentStep === 2 ? 700 : 600,
                  fontSize: 12,
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: currentStep === 2 ? "#27272a" : "#e4e4e7",
                    color: currentStep === 2 ? "#ffffff" : "#71717a",
                  }}
                >
                  2
                </span>
                <span>2. Hedera Consensus &amp; Keys</span>
              </button>
            </div>
          )}

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

                    <div>
                      <div style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>Cryptographic Key Challenge</div>
                      <div style={{ fontFamily: "var(--font-mono)", color: "#166534", fontWeight: 600, fontSize: 11 }}>
                        Verified (Hedera SECP256K1)
                      </div>
                    </div>

                    <div>
                      <div style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>Payout Address (x402)</div>
                      <div style={{ fontFamily: "var(--font-mono)", color: "#09090b", fontWeight: 600 }}>
                        {paymentAddress}
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
                            registeredData?.credential || {
                              "@context": ["https://www.w3.org/2018/credentials/v1"],
                              id: `urn:uuid:${agentId}`,
                              type: ["VerifiableCredential", "SwarmSecurityAuditorCredential"],
                              issuer: "did:hedera:testnet:0.0.10417469_registry-authority",
                              issuanceDate: new Date().toISOString(),
                              credentialSubject: {
                                id: registeredData?.agent?.did || `did:hedera:testnet:0.0.10417469_${agentId}`,
                                name,
                                role,
                                publicKey: publicKey.slice(0, 20) + "...",
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

                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
                  <button type="button" onClick={onClose} className="btn-swarm-primary" style={{ padding: "10px 24px" }}>
                    Done &amp; Return to Quorum
                  </button>
                </div>
              </div>
            ) : currentStep === 1 ? (
              /* STEP 1: Specialist Agent Profile & Domain */
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                      Step 1: Configure Specialist Agent Profile
                    </h4>
                    <p style={{ margin: 0, fontSize: 13, color: "#71717a" }}>
                      Select domain specialization, inference engine, and custom analysis prompt.
                    </p>
                  </div>

                  {/* Mode Selector */}
                  <div style={{ display: "flex", gap: 6, backgroundColor: "#f4f4f5", padding: 3, borderRadius: 8 }}>
                    <button
                      type="button"
                      onClick={() => setAgentConfigMode("preset")}
                      style={{
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: agentConfigMode === "preset" ? "#ffffff" : "transparent",
                        color: agentConfigMode === "preset" ? "#09090b" : "#71717a",
                        boxShadow: agentConfigMode === "preset" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                      }}
                    >
                      ⚡ Quick-Fill Form
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgentConfigMode("exam")}
                      style={{
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: agentConfigMode === "exam" ? "#ffffff" : "transparent",
                        color: agentConfigMode === "exam" ? "#09090b" : "#71717a",
                        boxShadow: agentConfigMode === "exam" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                      }}
                    >
                      🧪 Take Benchmark Exam
                    </button>
                  </div>
                </div>

                {agentConfigMode === "exam" ? (
                  /* Embed Competency Exam View */
                  <AgentCompetencyExamView
                    onQualified={(newAgent) => {
                      onRegistered(newAgent);
                      onClose();
                    }}
                    onCancel={() => setAgentConfigMode("preset")}
                    initialWalletAddress={walletAddress}
                    initialPaymentAddress={paymentAddress}
                    initialPublicKey={publicKey}
                    initialSignature={signature}
                    initialChallenge={challenge}
                  />
                ) : (
                  /* Standard Specialist Profile Form */
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Presets */}
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "var(--font-mono)", marginBottom: 8 }}>
                        ⚡ Quick-Fill Specialist Presets
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                        {AGENT_PRESETS.map((p) => {
                          const isSelected = p.agentId === agentId;
                          const isMev = p.agentId === "mev-sentinel";
                          const isBlocked = isMev && isMevAlreadyRegistered;

                          return (
                            <button
                              key={p.agentId}
                              type="button"
                              onClick={() => {
                                if (!isBlocked) applyPreset(p);
                              }}
                              disabled={isBlocked}
                              style={{
                                backgroundColor: isBlocked ? "#f8fafc" : isSelected ? "#09090b" : "#ffffff",
                                color: isBlocked ? "#94a3b8" : isSelected ? "#ffffff" : "#09090b",
                                border: isBlocked ? "1px dashed #cbd5e1" : isSelected ? "1px solid #09090b" : "1px solid #e4e4e7",
                                borderRadius: 8,
                                padding: "8px 10px",
                                textAlign: "left",
                                cursor: isBlocked ? "not-allowed" : "pointer",
                                opacity: isBlocked ? 0.6 : 1,
                                transition: "all 0.15s ease",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 11, fontWeight: 700 }}>{p.name}</span>
                                {isBlocked && (
                                  <span style={{ fontSize: 8, backgroundColor: "#fee2e2", color: "#991b1b", padding: "1px 4px", borderRadius: 4, fontWeight: 700 }}>
                                    Already Registered ✓
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{p.capabilities[0]}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Basic Info */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
                          Agent Display Name
                        </label>
                        <input
                          type="text"
                          className="swarm-input"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Flash Loan Sentinel"
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
                          Unique Agent Identifier
                        </label>
                        <input
                          type="text"
                          className="swarm-input"
                          value={agentId}
                          onChange={(e) => setAgentId(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
                          placeholder="e.g. mev-sentinel"
                          style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
                        Specialist Role &amp; Focus Domain
                      </label>
                      <input
                        type="text"
                        className="swarm-input"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="e.g. Reentrancy & Cross-Function Locks"
                        style={{ width: "100%" }}
                      />
                    </div>

                    {/* Inference Model & Theme Color */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
                          Inference Reasoning Engine
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
                          <option value="heuristic-ast">Heuristic Static AST Scanner</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
                          Accent Theme Color
                        </label>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 4 }}>
                          {COLOR_PALETTES.map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              onClick={() => setColor(c.hex)}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                backgroundColor: c.hex,
                                border: color === c.hex ? "2px solid #09090b" : "2px solid #e4e4e7",
                                cursor: "pointer",
                                transform: color === c.hex ? "scale(1.15)" : "scale(1)",
                              }}
                              title={c.name}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* System Prompt */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
                        Agent System Instruction Prompt
                      </label>
                      <textarea
                        className="swarm-input"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        rows={3}
                        style={{ width: "100%", fontSize: 12, fontFamily: "var(--font-mono)", lineHeight: 1.4 }}
                      />
                    </div>

                    {/* Duplicate MEV Restriction Warning Banner */}
                    {isDuplicateMevSelected && (
                      <div
                        style={{
                          padding: "10px 14px",
                          backgroundColor: "#fffbeb",
                          border: "1px solid #fef3c7",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#92400e",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>⚠️</span>
                        <div>
                          <strong>Quorum Limit Reached:</strong> An MEV &amp; Flash Loan Specialist is already registered in the SwarmProof quorum. You cannot create a duplicate MEV &amp; Flash Loan agent. Please configure an agent in a different domain (e.g. Bridge Guard, DAO Governance Guardian, or ZK Circuit Verifier).
                        </div>
                      </div>
                    )}

                    {/* Step 1 Navigation Actions */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                      <button type="button" onClick={onClose} className="btn-swarm-secondary">
                        Cancel
                      </button>

                      <button
                        type="button"
                        id="step1-continue-btn"
                        onClick={() => {
                          if (!name.trim()) {
                            setErrorMessage("Please specify an agent name.");
                            return;
                          }
                          if (!isDuplicateMevSelected) setCurrentStep(2);
                        }}
                        disabled={isDuplicateMevSelected || !name.trim()}
                        className="btn-swarm-primary"
                        style={{
                          padding: "10px 20px",
                          opacity: isDuplicateMevSelected || !name.trim() ? 0.5 : 1,
                          cursor: isDuplicateMevSelected || !name.trim() ? "not-allowed" : "pointer",
                          backgroundColor: isDuplicateMevSelected || !name.trim() ? "#71717a" : "#09090b",
                        }}
                      >
                        {isDuplicateMevSelected ? "🔒 Duplicate MEV Agent Disallowed" : "Continue to Hedera Security (Step 2) →"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* STEP 2: Hedera HCS Anchor & Cryptographic Keypair */
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                    Step 2: Hedera Consensus Anchor &amp; Cryptographic Keys
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: "#71717a" }}>
                    Anchor your specialist on Hedera Topic 0.0.10417469 and verify cryptographic ownership.
                  </p>
                </div>

                {/* Identity Summary Card */}
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 14,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>Hedera DID Identifier</div>
                    <div style={{ color: "#166534", fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      did:hedera:testnet:0.0.10417469_{agentId || "specialist"}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>Specialist Agent</div>
                    <div style={{ color: "#09090b", fontWeight: 700 }}>
                      {name} ({agentId})
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>Hedera Consensus Topic</div>
                    <div style={{ color: "#09090b", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                      0.0.10417469 (SwarmProof Registry)
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>W3C Verifiable Credential</div>
                    <div style={{ color: "#166534", fontWeight: 600 }}>
                      SwarmSecurityAuditorCredential
                    </div>
                  </div>
                </div>

                {/* Payment Address */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52525b", marginBottom: 6 }}>
                    Payout Revenue Address (Hedera Account or EVM x402)
                  </label>
                  <input
                    type="text"
                    className="swarm-input"
                    value={paymentAddress}
                    onChange={(e) => setPaymentAddress(e.target.value)}
                    placeholder="0.0.10119346 or 0x..."
                    style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                  />
                </div>

                {/* Proof of Ownership Challenge */}
                <div style={{ backgroundColor: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#09090b" }}>
                      Cryptographic Signature Proof
                    </label>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        backgroundColor: verificationStatus === "signed" ? "#dcfce7" : "#f4f4f5",
                        color: verificationStatus === "signed" ? "#166534" : "#71717a",
                      }}
                    >
                      {verificationStatus === "signed" ? "✓ Signed" : "Proof Required"}
                    </span>
                  </div>

                  <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 10px 0" }}>
                    Sign the registration challenge to prove cryptographic ownership of your Hedera keys.
                  </p>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <button
                      type="button"
                      onClick={handleSignWithTestnetKey}
                      disabled={isSigningChallenge}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 6,
                        backgroundColor: "#09090b",
                        color: "#ffffff",
                        fontSize: 11,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {isSigningChallenge ? "Signing..." : "⚡ Quick Sign (Hedera Testnet Key)"}
                    </button>

                    <button
                      type="button"
                      onClick={handleSignWithBrowserWallet}
                      disabled={isSigningWithWallet}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 6,
                        backgroundColor: "#ffffff",
                        color: "#09090b",
                        fontSize: 11,
                        fontWeight: 600,
                        border: "1px solid #d4d4d8",
                        cursor: "pointer",
                      }}
                    >
                      {isSigningWithWallet ? "Signing..." : "🦊 Sign with Browser Wallet"}
                    </button>
                  </div>

                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: verificationStatus === "signed" ? "#dcfce7" : "#f4f4f5",
                      color: verificationStatus === "signed" ? "#15803d" : "#52525b",
                    }}
                  >
                    {verificationFeedback}
                  </div>
                </div>

                {/* Error Banner */}
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

                {/* Submitting spinner */}
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

                {/* Submit Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <button type="button" onClick={() => setCurrentStep(1)} className="btn-swarm-secondary">
                    ← Back to Step 1
                  </button>

                  <button
                    type="submit"
                    id="submit-register-agent-btn"
                    disabled={status === "submitting"}
                    className="btn-swarm-primary"
                    style={{
                      padding: "10px 24px",
                      backgroundColor: "#09090b",
                      cursor: "pointer",
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
    </>
  );
}
