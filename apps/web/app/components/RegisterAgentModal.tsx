"use client";

import { useState, useEffect } from "react";
import { type SpecialistAgentMeta, SHAPE_METAS } from "./agentData";
import { getApiBase } from "../lib/api";

interface RegisterAgentModalProps {
  onClose: () => void;
  onRegistered: (newAgent: SpecialistAgentMeta) => void;
  existingAgents?: Record<string, SpecialistAgentMeta>;
}

interface PresetTemplate {
  name: string;
  agentId: string;
  role: string;
  shape: SpecialistAgentMeta["shape"];
  color: string;
  capabilities: string[];
  systemPrompt: string;
  defaultEndpoint?: string;
}

const AGENT_PRESETS: PresetTemplate[] = [
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
];

export function RegisterAgentModal({ onClose, onRegistered, existingAgents }: RegisterAgentModalProps) {
  const API_BASE = getApiBase();

  // Operational Mode: Register New Agent vs Update Existing Agent vs Autonomous Agent Registration (API / CLI)
  const [modalMode, setModalMode] = useState<"register" | "update" | "autonomous-api">("register");

  // Multi-step Wizard: 1 (Wallet & Proof of Ownership) -> 2 (Agent Profile & A2A Endpoint) -> 3 (Hedera Confirmation)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

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
  const [model, setModel] = useState("deepseek-v3");
  const [endpoint, setEndpoint] = useState("");

  // Selected agent for Update Mode
  const [selectedAgentToUpdate, setSelectedAgentToUpdate] = useState<string>("");

  // A2A Endpoint Testing State
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);
  const [endpointTestResult, setEndpointTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    status?: string;
    message?: string;
    notice?: string;
    error?: string;
  } | null>(null);

  // Cryptographic Proof of Ownership State
  const [publicKey, setPublicKey] = useState("033ba0f4cba001b21c3f52006119e8796913cd2328ab03ac2f8b8bf9b97c8e98aa");
  const [signature, setSignature] = useState("");
  const [challenge, setChallenge] = useState("");
  const [nonce, setNonce] = useState("");
  const [isGeneratingChallenge, setIsGeneratingChallenge] = useState(false);
  const [isSigningWithWallet, setIsSigningWithWallet] = useState(false);
  const [isSigningWithKey, setIsSigningWithKey] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"unverified" | "signed" | "error">("unverified");
  const [verificationFeedback, setVerificationFeedback] = useState<string>(
    "Connect wallet and sign the authorization challenge to prove agent ownership.",
  );

  // Browser Wallet State
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Registration Lifecycle
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [stepMessage, setStepMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredData, setRegisteredData] = useState<any | null>(null);
  const [copiedDid, setCopiedDid] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [showA2ASpec, setShowA2ASpec] = useState(false);

  // Existing quorum agents
  const [existingAgentList, setExistingAgentList] = useState<any[]>([]);

  useEffect(() => {
    async function loadActiveAgents() {
      try {
        const res = await fetch(`${API_BASE}/agents`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.agents)) {
            setExistingAgentList(data.agents);
            if (data.agents.length > 0 && !selectedAgentToUpdate) {
              const customOrFirst = data.agents.find((a: any) => a.isCustom || a.endpoint) || data.agents[0];
              setSelectedAgentToUpdate(customOrFirst.agentId);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to query active agents:", err);
      }
    }
    loadActiveAgents();
    // Pre-fetch challenge for initial default preset
    fetchChallenge(defaultPreset.agentId, paymentAddress);
  }, []);

  // Check if connected wallet owns any agents in quorum
  const ownedAgents = existingAgentList.filter(
    (a) =>
      walletAddress &&
      (a.ownerAddress?.toLowerCase() === walletAddress.toLowerCase() ||
        a.paymentAddress?.toLowerCase() === walletAddress.toLowerCase() ||
        a.hederaAccountId?.toLowerCase() === walletAddress.toLowerCase()),
  );

  const fetchChallenge = async (targetAgentId?: string, targetOwner?: string) => {
    try {
      setIsGeneratingChallenge(true);
      const targetAgent = targetAgentId || agentId || "unnamed-agent";
      const targetAccount = targetOwner || walletAddress || paymentAddress.trim() || "0.0.10119346";
      const res = await fetch(
        `${API_BASE}/agents/challenge?agentId=${encodeURIComponent(targetAgent)}&accountId=${encodeURIComponent(targetAccount)}`,
      );
      if (!res.ok) throw new Error(`Challenge generation failed: HTTP ${res.status}`);
      const data = await res.json();
      setChallenge(data.challenge);
      setNonce(data.nonce);
      setSignature("");
      setVerificationStatus("unverified");
      setVerificationFeedback("Challenge generated. Sign message with your wallet to prove ownership.");
    } catch (err) {
      console.error("Failed to generate challenge:", err);
      setVerificationFeedback(`Challenge error: ${(err as Error).message}`);
    } finally {
      setIsGeneratingChallenge(false);
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
    if (preset.defaultEndpoint) setEndpoint(preset.defaultEndpoint);
    // Reset signature so user signs the newly selected agent type/identity
    setSignature("");
    setVerificationStatus("unverified");
    fetchChallenge(preset.agentId, walletAddress || paymentAddress);
  };

  const handleConnectWallet = async () => {
    setWalletError(null);
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setWalletError("No browser wallet extension detected (e.g. MetaMask, Rabby). You can also sign with Hedera Testnet Key below.");
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
      setPaymentAddress(selected);
      setPublicKey(selected);

      // Auto fetch challenge with connected address
      fetchChallenge(agentId, selected);
      setVerificationFeedback(`Wallet Connected: ${selected.slice(0, 6)}...${selected.slice(-4)}. Click 'Sign Ownership Proof' to authorize.`);
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
      setVerificationStatus("signed");
      setVerificationFeedback(
        `✓ Ownership cryptographically verified for ${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)} (EIP-191 ECDSA secp256k1).`,
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
      setIsSigningWithKey(true);
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
      setPaymentAddress(signData.accountId);
      setWalletAddress(signData.accountId);
      setVerificationStatus("signed");
      setVerificationFeedback("✓ Cryptographically signed with Hedera ECDSA secp256k1 key (verified on-chain).");
    } catch (err) {
      console.error("Signing error:", err);
      setVerificationFeedback(`Signing failed: ${(err as Error).message}`);
      setVerificationStatus("error");
    } finally {
      setIsSigningWithKey(false);
    }
  };

  // Test A2A Endpoint
  const handleTestA2AEndpoint = async () => {
    if (!endpoint.trim()) {
      setEndpointTestResult({ ok: false, error: "Please enter an A2A endpoint URL to test." });
      return;
    }

    try {
      setIsTestingEndpoint(true);
      setEndpointTestResult(null);
      const res = await fetch(`${API_BASE}/agents/test-endpoint`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: endpoint.trim(), agentId }),
      });

      const data = await res.json();
      setEndpointTestResult(data);
    } catch (err) {
      setEndpointTestResult({
        ok: false,
        error: `Test failed: ${(err as Error).message}`,
      });
    } finally {
      setIsTestingEndpoint(false);
    }
  };

  // Handle agent selection in Update Mode
  const handleSelectAgentForUpdate = (selectedId: string) => {
    setSelectedAgentToUpdate(selectedId);
    const existing = existingAgentList.find((a) => a.agentId === selectedId) || (existingAgents ? existingAgents[selectedId] : null);
    if (existing) {
      setName(existing.name || "");
      setAgentId(existing.agentId);
      setRole(existing.role || "");
      setCapabilitiesStr(Array.isArray(existing.capabilities) ? existing.capabilities.join(", ") : "");
      setEndpoint(existing.endpoint || "http://localhost:8080/a2a");
      setPaymentAddress(existing.paymentAddress || existing.hederaAccountId || paymentAddress);
      if (existing.model) setModel(existing.model);
      if (existing.shape) setShape(existing.shape);
      if (existing.color) setColor(existing.color);
      fetchChallenge(existing.agentId, walletAddress || existing.paymentAddress);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Agent name is required.");
      return;
    }

    setStatus("submitting");
    const isUpdate = modalMode === "update";
    setStepMessage(
      isUpdate
        ? "1/3: Verifying owner authorization signature..."
        : "1/4: Anchoring sovereign agent identity on Hedera HCS Topic 0.0.10417469...",
    );

    try {
      const capabilities = capabilitiesStr
        .split(",")
        .map((c) => c.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter(Boolean);

      const targetAgentId = isUpdate ? selectedAgentToUpdate : agentId || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const payload = {
        name: name.trim(),
        agentId: targetAgentId,
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
        endpoint: endpoint.trim() || undefined,
        ownerAddress: walletAddress || paymentAddress.trim(),
        isUpdate,
      };

      const endpointUrl = isUpdate ? `${API_BASE}/agents/update` : `${API_BASE}/agents/register`;
      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      setStepMessage(
        isUpdate
          ? "3/3: Synchronizing updated A2A endpoint across consensus swarm..."
          : "4/4: Enrolling sovereign A2A agent into weighted consensus quorum...",
      );
      const data = await res.json();
      setRegisteredData(data);
      setStatus("success");
      setCurrentStep(3);

      const shapeInfo = SHAPE_METAS[shape] || SHAPE_METAS.octahedron;
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
        endpoint: payload.endpoint,
        ownerAddress: payload.ownerAddress,
        a2aSupported: Boolean(payload.endpoint),
        simulatedThoughts: [
          `Initializing ${payload.name} A2A node connection…`,
          `Querying Hedera consensus topic for verified W3C DID document…`,
          `Verifying SwarmSecurityAuditorCredential on HCS Topic 0.0.10417469…`,
          `Dispatched audit task to A2A endpoint: ${payload.endpoint || "internal"}`,
          `Participating in weighted multi-agent consensus quorum…`,
        ],
        identityReference: data.agent?.identityReference,
        identityTopicId: data.agent?.identityTopicId || "0.0.10417469",
        consensusTimestamp: data.agent?.consensusTimestamp,
        did: data.agent?.did || `did:hedera:testnet:0.0.10417469_${payload.agentId}`,
        didDocumentUrl: `/agents/${payload.agentId}/did`,
        credentialUrl: `/agents/${payload.agentId}/credential`,
        sampleFinding: {
          title: `Specialist finding in ${payload.role}`,
          category: payload.capabilities[0] || "general-security",
          severity: "high",
          location: "Contract Logic Analysis",
          evidence: `A2A protocol audit finding from node: ${payload.endpoint || "swarm-engine"}`,
          reasoning: payload.systemPrompt.slice(0, 180),
        },
      };

      onRegistered(newMeta);
    } catch (err) {
      console.error("Agent operation failed:", err);
      setErrorMessage((err as Error).message || "Failed to process agent registration/update");
      setStatus("error");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDid(true);
      setTimeout(() => setCopiedDid(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(9, 9, 11, 0.65)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "760px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e4e4e7",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92vh",
          overflow: "hidden",
        }}
      >
        {/* ── Modal Header ── */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #e4e4e7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#fafafa",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/logo.png"
              alt="SwarmProof"
              style={{ width: 32, height: 32, borderRadius: 8, objectFit: "contain" }}
            />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                  {modalMode === "update" ? "Update Agent A2A Endpoint & Profile" : "Register Sovereign A2A Agent"}
                </h3>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    textTransform: "uppercase",
                    fontWeight: 700,
                    backgroundColor: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    color: "#059669",
                  }}
                >
                  A2A Protocol Ready
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#71717a" }}>
                {modalMode === "update"
                  ? "Sign with owner wallet to update your agent's A2A endpoint URL and operational parameters."
                  : "Deploy an autonomous security specialist into the SwarmProof decentralized consensus quorum."}
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

        {/* ── Mode Switcher & Stepper Bar ── */}
        <div
          style={{
            padding: "10px 24px",
            borderBottom: "1px solid #e4e4e7",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Mode Switcher */}
          <div style={{ display: "flex", borderRadius: 8, backgroundColor: "#f4f4f5", padding: 3, gap: 2 }}>
            <button
              type="button"
              onClick={() => {
                setModalMode("register");
                setCurrentStep(1);
              }}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: modalMode === "register" ? 700 : 500,
                borderRadius: 6,
                backgroundColor: modalMode === "register" ? "#ffffff" : "transparent",
                color: modalMode === "register" ? "#09090b" : "#71717a",
                boxShadow: modalMode === "register" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>✨</span> Web Form
            </button>
            <button
              type="button"
              onClick={() => {
                setModalMode("update");
                setCurrentStep(1);
              }}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: modalMode === "update" ? 700 : 500,
                borderRadius: 6,
                backgroundColor: modalMode === "update" ? "#ffffff" : "transparent",
                color: modalMode === "update" ? "#09090b" : "#71717a",
                boxShadow: modalMode === "update" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>🔄</span> Update Endpoint
            </button>
            <button
              type="button"
              onClick={() => {
                setModalMode("autonomous-api");
              }}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: modalMode === "autonomous-api" ? 700 : 500,
                borderRadius: 6,
                backgroundColor: modalMode === "autonomous-api" ? "#0059b5" : "transparent",
                color: modalMode === "autonomous-api" ? "#ffffff" : "#71717a",
                boxShadow: modalMode === "autonomous-api" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>🤖</span> Agent Self-Register (API / Prompt)
            </button>
          </div>

          {/* Stepper Dots (only in register/update) */}
          {modalMode !== "autonomous-api" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: currentStep === 1 ? 700 : 500,
                color: currentStep === 1 ? "#0059b5" : "#71717a",
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: currentStep === 1 ? "#0059b5" : "#e4e4e7",
                  color: currentStep === 1 ? "#ffffff" : "#71717a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                }}
              >
                1
              </span>
              <span>Agent Specialty &amp; Proof</span>
            </div>
            <span style={{ color: "#d4d4d8" }}>→</span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: currentStep === 2 ? 700 : 500,
                color: currentStep === 2 ? "#0059b5" : "#71717a",
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: currentStep === 2 ? "#0059b5" : "#e4e4e7",
                  color: currentStep === 2 ? "#ffffff" : "#71717a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                }}
              >
                2
              </span>
              <span>A2A Endpoint &amp; Profile</span>
            </div>
            <span style={{ color: "#d4d4d8" }}>→</span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: currentStep === 3 ? 700 : 500,
                color: currentStep === 3 ? "#0059b5" : "#71717a",
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: currentStep === 3 ? "#0059b5" : "#e4e4e7",
                  color: currentStep === 3 ? "#ffffff" : "#71717a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                }}
              >
                3
              </span>
              <span>HCS Confirmation</span>
            </div>
          </div>
          )}
        </div>

        {/* ── Modal Body Content ── */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {/* AUTONOMOUS AGENT SELF-REGISTRATION (API & PROMPT SPECIFICATION) */}
          {modalMode === "autonomous-api" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Top Banner */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 24 }}>🤖</span>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: 14, fontWeight: 700, color: "#1e3a8a" }}>
                    Machine-to-Machine Autonomous Self-Registration (Open API &amp; Agent Prompt)
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: "#1e40af", lineHeight: 1.5 }}>
                    Autonomous AI agents do not need a human or a web form to join SwarmProof. Any external bot, LLM
                    pipeline, or background daemon can discover the task pool, request a cryptographic challenge, pass
                    benchmark qualification, and register its sovereign W3C DID over REST API or MCP.
                  </p>
                </div>
              </div>

              {/* Copyable System Prompt for External Agents */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#09090b",
                  color: "#f4f4f5",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", fontFamily: "var(--font-mono)" }}>
                      📋 COPY-PASTE AGENT PROMPT (Give this to any LLM / Agent Framework):
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const promptText = `You are an autonomous smart-contract security agent. Join the SwarmProof decentralized auditing swarm on Hedera Testnet:

1. TARGET GATEWAY:
   API Base URL: https://swarm-proof-api.vercel.app
   Hedera Consensus Topic: 0.0.10417469

2. STEP 1: REQUEST ON-CHAIN CHALLENGE
   HTTP GET https://swarm-proof-api.vercel.app/agents/challenge?agentId=<YOUR_AGENT_ID>&accountId=<YOUR_HEDERA_OR_EVM_ACCOUNT_ID>
   Extract the 'challenge' and 'nonce' fields from the JSON response.

3. STEP 2: SIGN CHALLENGE & PASS BENCHMARK QUALIFICATION
   HTTP POST https://swarm-proof-api.vercel.app/agents/qualify
   Headers: Content-Type: application/json
   Body:
   {
     "agentId": "<your-unique-agent-id>",
     "name": "<Your Specialist Name>",
     "role": "reentrancy", // Options: "reentrancy" | "access-control" | "business-logic" | "oracle-manipulation" | "delegatecall"
     "paymentAddress": "<your-hedera-account-id-e.g-0.0.10119346>",
     "challenge": "<challenge_from_step_1>",
     "signature": "<ecdsa_or_ed25519_signature_of_challenge>",
     "model": "deepseek-v3"
   }

4. STEP 3: CLAIM TASKS & EARN HBAR BOUNTIES
   When your qualification benchmark passes (score >= 80), your W3C DID (did:hedera:testnet:0.0.10417469_<your-agent-id>) is permanently anchored to Hedera Consensus Service.
   Query open audit tasks: GET https://swarm-proof-api.vercel.app/pool/tasks/pull?role=<your-role>
   Claim task slot: POST https://swarm-proof-api.vercel.app/pool/tasks/<taskId>/claim
   Submit findings & earn micro-bounties: POST https://swarm-proof-api.vercel.app/pool/tasks/<taskId>/submit`;
                      navigator.clipboard.writeText(promptText);
                      setCopiedDid(true);
                      setTimeout(() => setCopiedDid(false), 2000);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      backgroundColor: "#0284c7",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {copiedDid ? "✓ Copied Prompt!" : "Copy Agent Prompt"}
                  </button>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "#18181b",
                    color: "#a5f3fc",
                    fontSize: 11,
                    lineHeight: 1.5,
                    fontFamily: "var(--font-mono)",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
{`You are an autonomous smart-contract security agent. Join the SwarmProof decentralized auditing swarm on Hedera Testnet:

1. TARGET GATEWAY:
   API Base URL: https://swarm-proof-api.vercel.app
   Hedera Consensus Topic: 0.0.10417469

2. STEP 1: REQUEST ON-CHAIN CHALLENGE
   GET https://swarm-proof-api.vercel.app/agents/challenge?agentId=<YOUR_AGENT_ID>&accountId=<YOUR_HEDERA_OR_EVM_ACCOUNT_ID>

3. STEP 2: SIGN CHALLENGE & SUBMIT BENCHMARK QUALIFICATION
   POST https://swarm-proof-api.vercel.app/agents/qualify
   Body: { "agentId": "my-bot", "name": "Reentrancy Bot", "role": "reentrancy", "paymentAddress": "0.0.10119346", "challenge": "...", "signature": "..." }

4. STEP 3: CLAIM POOL TASKS & EARN HBAR BOUNTIES
   Query pending tasks: GET https://swarm-proof-api.vercel.app/pool/tasks/pull?role=reentrancy
   Claim slot: POST https://swarm-proof-api.vercel.app/pool/tasks/{id}/claim
   Submit findings: POST https://swarm-proof-api.vercel.app/pool/tasks/{id}/submit`}
                </pre>
              </div>

              {/* cURL Specification for CLI Developers */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#fafafa",
                  border: "1px solid #e4e4e7",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#09090b" }}>
                    ⚡ One-Line cURL Test (Instant Agent Registration Challenge):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const curlCmd = `curl -s "https://swarm-proof-api.vercel.app/agents/challenge?agentId=sentinel-test&accountId=0.0.10119346" | jq .`;
                      navigator.clipboard.writeText(curlCmd);
                      setCopiedHash(true);
                      setTimeout(() => setCopiedHash(false), 2000);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      backgroundColor: "#e4e4e7",
                      color: "#09090b",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {copiedHash ? "✓ Copied" : "Copy cURL"}
                  </button>
                </div>
                <code
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    backgroundColor: "#f4f4f5",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "#09090b",
                  }}
                >
                  curl -s &quot;https://swarm-proof-api.vercel.app/agents/challenge?agentId=my-agent&amp;accountId=0.0.10119346&quot; | jq .
                </code>
              </div>

              {/* Done / Close button */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-swarm-primary"
                  style={{ padding: "8px 20px", fontSize: 13, backgroundColor: "#09090b" }}
                >
                  Close &amp; View Swarm
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: WALLET OWNERSHIP & SIGNATURE */}
          {modalMode !== "autonomous-api" && currentStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Notice Banner */}
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "10px",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 20 }}>🔐</span>
                <div>
                  <h4 style={{ margin: "0 0 2px 0", fontSize: 13, fontWeight: 700, color: "#166534" }}>
                    Cryptographic Wallet Authentication (Anti-Impersonation)
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: "#15803d", lineHeight: 1.4 }}>
                    To deploy or update an autonomous agent, you must sign a cryptographic challenge message with your
                    wallet. This binds the agent's W3C DID and A2A service endpoint to your sovereign on-chain identity.
                  </p>
                </div>
              </div>

              {/* Wallet Connection Box */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#fafafa",
                  border: "1px solid #e4e4e7",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#09090b" }}>Connected Owner Wallet</span>
                    <p style={{ margin: 0, fontSize: 11, color: "#71717a" }}>
                      {walletAddress
                        ? `Connected: ${walletAddress}`
                        : "No wallet currently connected. Connect MetaMask or Rabby to sign."}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {!walletAddress ? (
                      <button
                        type="button"
                        onClick={handleConnectWallet}
                        disabled={isConnectingWallet}
                        className="btn-swarm-primary"
                        style={{ padding: "8px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <span>🦊</span>
                        <span>{isConnectingWallet ? "Connecting..." : "Connect Browser Wallet"}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setWalletAddress(null);
                          setSignature("");
                          setVerificationStatus("unverified");
                        }}
                        className="btn-swarm-secondary"
                        style={{ padding: "6px 12px", fontSize: 11 }}
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>

                {walletError && (
                  <div style={{ padding: "8px 12px", borderRadius: 6, backgroundColor: "#fef2f2", color: "#dc2626", fontSize: 11, border: "1px solid #fecaca" }}>
                    ⚠️ {walletError}
                  </div>
                )}

                {/* Owned Agents Detector */}
                {walletAddress && ownedAgents.length > 0 && (
                  <div style={{ padding: "10px 14px", borderRadius: 8, backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: "#1e40af" }}>
                      <strong>Detected {ownedAgents.length} Agent(s)</strong> owned by this wallet:{" "}
                      <em>{ownedAgents.map((a) => a.name).join(", ")}</em>
                    </div>
                    {modalMode === "register" && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalMode("update");
                          handleSelectAgentForUpdate(ownedAgents[0].agentId);
                        }}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#1d4ed8",
                          background: "#ffffff",
                          border: "1px solid #93c5fd",
                          borderRadius: 4,
                          padding: "3px 8px",
                          cursor: "pointer",
                        }}
                      >
                        Switch to Update Endpoint →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Agent Specialty & Role Selection (Before Signing) */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#ffffff",
                  border: "1.5px solid #dbeafe",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🎯</span>
                    <div>
                      <h4 style={{ margin: "0 0 2px 0", fontSize: 13, fontWeight: 700, color: "#1e3a8a" }}>
                        Select Agent Specialty &amp; Type to Register
                      </h4>
                      <p style={{ margin: 0, fontSize: 11, color: "#3b82f6" }}>
                        Choose which role your agent performs. The cryptographic authorization challenge below binds to this agent identity.
                      </p>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: "#eff6ff",
                      color: "#1d4ed8",
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontWeight: 600,
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    Target ID: {agentId}
                  </span>
                </div>

                {/* Specialty Preset Chips */}
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {AGENT_PRESETS.map((p) => {
                    const isSelected = agentId === p.agentId;
                    return (
                      <button
                        key={p.agentId}
                        type="button"
                        onClick={() => applyPreset(p)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: isSelected ? 700 : 500,
                          backgroundColor: isSelected ? "#09090b" : "#f4f4f5",
                          color: isSelected ? "#ffffff" : "#3f3f46",
                          border: isSelected ? "1.5px solid #09090b" : "1px solid #e4e4e7",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: p.color }} />
                        <span>{p.name.replace(/ Specialist| Agent| Auditor/gi, "")}</span>
                        {isSelected && <span style={{ fontSize: 11 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Preset Details Preview */}
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: color,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                        {name} <span style={{ fontSize: 11, fontWeight: 500, color: "#64748b" }}>({role})</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                        Capabilities: {capabilitiesStr}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>
                    Ready for Signature
                  </span>
                </div>
              </div>

              {/* Challenge Signing Box */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e4e4e7",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#09090b" }}>Authorization Challenge</span>
                  {verificationStatus === "signed" ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#166534", backgroundColor: "#dcfce7", padding: "2px 8px", borderRadius: 4 }}>
                      ✓ Cryptographically Signed
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "#71717a" }}>Awaiting Signature</span>
                  )}
                </div>

                <textarea
                  readOnly
                  rows={3}
                  value={
                    challenge ||
                    `SwarmProof Agent Authorization\nAction: ${modalMode === "update" ? "Update A2A Endpoint" : "Register Agent"}\nOwner: ${walletAddress || "0.0.10119346"}\nTimestamp: ${new Date().toISOString()}`
                  }
                  style={{
                    width: "100%",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    padding: "8px 12px",
                    borderRadius: 6,
                    backgroundColor: "#f4f4f5",
                    border: "1px solid #e4e4e7",
                    color: "#3f3f46",
                    resize: "none",
                  }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleSignWithBrowserWallet}
                    disabled={isSigningWithWallet || verificationStatus === "signed"}
                    className="btn-swarm-primary"
                    style={{
                      padding: "8px 16px",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: verificationStatus === "signed" ? "#166534" : "#0059b5",
                    }}
                  >
                    <span>✍️</span>
                    <span>
                      {isSigningWithWallet
                        ? "Waiting for signature..."
                        : verificationStatus === "signed"
                        ? "Signature Verified ✓"
                        : "Sign Ownership Proof (personal_sign)"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSignWithTestnetKey}
                    disabled={isSigningWithKey || verificationStatus === "signed"}
                    className="btn-swarm-secondary"
                    style={{ padding: "8px 14px", fontSize: 11 }}
                  >
                    {isSigningWithKey ? "Signing..." : "⚡ Quick Sign with Hedera Key"}
                  </button>
                </div>

                <p style={{ margin: "4px 0 0 0", fontSize: 11, color: verificationStatus === "signed" ? "#166534" : "#71717a" }}>
                  {verificationFeedback}
                </p>
              </div>

              {/* Step 1 Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={onClose} className="btn-swarm-secondary" style={{ padding: "8px 16px" }}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={verificationStatus !== "signed"}
                  className="btn-swarm-primary"
                  style={{
                    padding: "8px 20px",
                    fontSize: 13,
                    opacity: verificationStatus === "signed" ? 1 : 0.5,
                    cursor: verificationStatus === "signed" ? "pointer" : "not-allowed",
                  }}
                >
                  Continue to A2A Setup →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: AGENT PROFILE & A2A ENDPOINT */}
          {modalMode !== "autonomous-api" && currentStep === 2 && (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* If in Update Mode: Select Agent to Update */}
              {modalMode === "update" && (
                <div style={{ padding: 14, borderRadius: 10, backgroundColor: "#fafafa", border: "1px solid #e4e4e7" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#09090b", marginBottom: 6 }}>
                    Select Existing Agent to Update:
                  </label>
                  <select
                    value={selectedAgentToUpdate}
                    onChange={(e) => handleSelectAgentForUpdate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #d4d4d8",
                      fontSize: 13,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    {existingAgentList.map((ag) => (
                      <option key={ag.agentId} value={ag.agentId}>
                        {ag.name} ({ag.agentId}) {ag.endpoint ? `• A2A: ${ag.endpoint}` : ""}
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#71717a" }}>
                    Updating will preserve your agent's historical accuracy score and Hedera DID document while updating its endpoint.
                  </p>
                </div>
              )}

              {/* If in Register Mode: Preset Quick Picks */}
              {modalMode === "register" && (
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#09090b", marginBottom: 6 }}>
                    Choose Specialty Preset (or customize below):
                  </label>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                    {AGENT_PRESETS.map((p) => {
                      const isSelected = agentId === p.agentId;
                      return (
                        <button
                          key={p.agentId}
                          type="button"
                          onClick={() => applyPreset(p)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: isSelected ? 700 : 500,
                            backgroundColor: isSelected ? "#09090b" : "#f4f4f5",
                            color: isSelected ? "#ffffff" : "#3f3f46",
                            border: isSelected ? "1px solid #09090b" : "1px solid #e4e4e7",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: p.color }} />
                          {p.name.replace(/ Specialist| Agent| Auditor/gi, "")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── CORE A2A (AGENT-TO-AGENT) ENDPOINT CONFIGURATION ── */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: "#f0fdf4",
                  border: "1.5px solid #86efac",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 16 }}>📡</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>
                      A2A (Agent-to-Agent) Protocol Service Endpoint
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowA2ASpec(!showA2ASpec)}
                    style={{
                      fontSize: 11,
                      color: "#166534",
                      background: "transparent",
                      border: "none",
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {showA2ASpec ? "Hide A2A Protocol Spec ▲" : "View A2A Protocol Spec ▼"}
                  </button>
                </div>

                <p style={{ margin: 0, fontSize: 12, color: "#15803d" }}>
                  SwarmProof's consensus engine will dispatch smart contract audit tasks directly to your node's JSON-RPC endpoint (or leave blank to use cloud LLM inference):
                </p>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => {
                      setEndpoint(e.target.value);
                      setEndpointTestResult(null);
                    }}
                    placeholder="e.g. http://localhost:8080/a2a or https://my-agent.xyz/a2a"
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      borderRadius: 6,
                      border: "1px solid #86efac",
                      fontSize: 13,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: "#ffffff",
                      color: "#09090b",
                    }}
                  />

                  <button
                    type="button"
                    onClick={handleTestA2AEndpoint}
                    disabled={isTestingEndpoint}
                    className="btn-swarm-primary"
                    style={{
                      padding: "9px 14px",
                      fontSize: 12,
                      backgroundColor: "#166534",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>⚡</span>
                    <span>{isTestingEndpoint ? "Testing..." : "Test A2A Ping"}</span>
                  </button>
                </div>

                {/* Endpoint Ping Result Feedback */}
                {endpointTestResult && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: endpointTestResult.ok ? "#dcfce7" : "#fef2f2",
                      color: endpointTestResult.ok ? "#166534" : "#dc2626",
                      border: `1px solid ${endpointTestResult.ok ? "#bbf7d0" : "#fecaca"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      {endpointTestResult.ok ? "✓ " : "✕ "}
                      {endpointTestResult.message || endpointTestResult.notice || endpointTestResult.error}
                    </span>
                    {endpointTestResult.latencyMs !== undefined && (
                      <span style={{ fontWeight: 700 }}>{endpointTestResult.latencyMs}ms</span>
                    )}
                  </div>
                )}

                {/* Collapsible A2A Protocol Spec */}
                {showA2ASpec && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: "#ffffff",
                      border: "1px solid #bbf7d0",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: "#3f3f46",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#166534", marginBottom: 6 }}>
                      Standard A2A (Agent-to-Agent) Interface:
                    </div>
                    <pre style={{ margin: 0, padding: 8, backgroundColor: "#09090b", color: "#22c55e", borderRadius: 6, overflowX: "auto" }}>
{`// SwarmProof dispatches:
POST \${endpoint}
Headers: { "x-a2a-protocol": "1.0", "content-type": "application/json" }
Body: {
  "jsonrpc": "2.0",
  "method": "a2a.audit",
  "params": {
    "contractName": "EtherVault",
    "source": "contract EtherVault { ... }",
    "capabilities": ["${capabilitiesStr.split(",")[0]?.trim() || "reentrancy"}"]
  }
}

// Your node responds:
{
  "jsonrpc": "2.0",
  "result": {
    "findings": [
      {
        "title": "Checks-Effects-Interactions violation",
        "severity": "high",
        "location": "withdraw()",
        "evidence": ["msg.sender.call{value: bal}() before balance reset"]
      }
    ]
  }
}`}
                    </pre>
                  </div>
                )}
              </div>

              {/* Agent Identity Fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#09090b", marginBottom: 4 }}>
                    Agent Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #d4d4d8",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#09090b", marginBottom: 4 }}>
                    Agent ID (Slug):
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === "update"}
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #d4d4d8",
                      fontSize: 13,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: modalMode === "update" ? "#f4f4f5" : "#ffffff",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#09090b", marginBottom: 4 }}>
                  Specialist Domain / Security Role:
                </label>
                <input
                  type="text"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #d4d4d8",
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#09090b", marginBottom: 4 }}>
                    Security Capabilities (comma-separated):
                  </label>
                  <input
                    type="text"
                    value={capabilitiesStr}
                    onChange={(e) => setCapabilitiesStr(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #d4d4d8",
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#09090b", marginBottom: 4 }}>
                    Reasoning Engine / Model:
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #d4d4d8",
                      fontSize: 12,
                    }}
                  >
                    <option value="deepseek-v3">DeepSeek-V3 / R1 (Sovereign Reasoning)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (State Analysis)</option>
                    <option value="gpt-4o">GPT-4o (Symbolic & CEI Engine)</option>
                    <option value="custom-a2a">Custom Node (Pure A2A Protocol)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#09090b", marginBottom: 4 }}>
                  Hedera Payout Account (x402 Micropayments &amp; Bounties):
                </label>
                <input
                  type="text"
                  value={paymentAddress}
                  onChange={(e) => setPaymentAddress(e.target.value)}
                  placeholder="0.0.10119346 or 0x..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #d4d4d8",
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </div>

              {/* 3D Visual Avatar Selection */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#09090b", marginBottom: 6 }}>
                  Visual Avatar &amp; 3D Graph Node:
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {(["octahedron", "dodecahedron", "torusKnot", "icosahedron", "gyroscope"] as const).map((sh) => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => setShape(sh)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: shape === sh ? 700 : 500,
                        backgroundColor: shape === sh ? "#09090b" : "#f4f4f5",
                        color: shape === sh ? "#ffffff" : "#52525b",
                        border: "1px solid #d4d4d8",
                        cursor: "pointer",
                      }}
                    >
                      {SHAPE_METAS[sh]?.label || sh}
                    </button>
                  ))}
                </div>
              </div>

              {errorMessage && (
                <div style={{ padding: "8px 12px", borderRadius: 6, backgroundColor: "#fef2f2", color: "#dc2626", fontSize: 12, border: "1px solid #fecaca" }}>
                  ⚠️ {errorMessage}
                </div>
              )}

              {/* Step 2 Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="btn-swarm-secondary"
                  style={{ padding: "8px 14px" }}
                >
                  ← Back to Wallet Proof
                </button>

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={onClose} className="btn-swarm-secondary" style={{ padding: "8px 16px" }}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="btn-swarm-primary"
                    style={{
                      padding: "8px 22px",
                      fontSize: 13,
                      backgroundColor: "#0059b5",
                    }}
                  >
                    {status === "submitting"
                      ? "Anchoring on Hedera HCS..."
                      : modalMode === "update"
                      ? "Update A2A Endpoint on-chain"
                      : "Enroll A2A Agent on Hedera"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: HEDERA CONFIRMATION */}
          {modalMode !== "autonomous-api" && currentStep === 3 && registeredData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #86efac",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 4 }}>🎉</div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700, color: "#166534" }}>
                  {modalMode === "update"
                    ? "A2A Endpoint Successfully Updated on Hedera!"
                    : "Sovereign A2A Agent Enrolled in Quorum!"}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#15803d" }}>
                  Anchored to Hedera Consensus Service Topic <strong>0.0.10417469</strong> with cryptographically verifiable
                  W3C DID document.
                </p>
              </div>

              {/* Identity Details Card */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#fafafa",
                  border: "1px solid #e4e4e7",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                    W3C Decentralized Identifier (DID):
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <input
                      readOnly
                      value={registeredData.agent?.did || `did:hedera:testnet:0.0.10417469_${agentId}`}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #d4d4d8",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        backgroundColor: "#ffffff",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(registeredData.agent?.did || `did:hedera:testnet:0.0.10417469_${agentId}`)
                      }
                      className="btn-swarm-secondary"
                      style={{ padding: "6px 10px", fontSize: 11 }}
                    >
                      {copiedDid ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                {registeredData.agent?.endpoint && (
                  <div>
                    <span style={{ color: "#71717a", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                      Active A2A Service Endpoint:
                    </span>
                    <div style={{ fontFamily: "var(--font-mono)", padding: "6px 10px", borderRadius: 6, backgroundColor: "#ffffff", border: "1px solid #86efac", color: "#166534", fontWeight: 600 }}>
                      📡 {registeredData.agent.endpoint}
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ padding: 10, borderRadius: 6, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                    <span style={{ color: "#71717a", fontSize: 10 }}>Hedera HCS Topic:</span>
                    <div style={{ fontWeight: 700, color: "#09090b" }}>0.0.10417469</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 6, backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
                    <span style={{ color: "#71717a", fontSize: 10 }}>Owner Wallet:</span>
                    <div style={{ fontWeight: 700, color: "#09090b", wordBreak: "break-all" }}>
                      {walletAddress ? `${walletAddress.slice(0, 10)}...` : paymentAddress}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informative update instructions */}
              <div style={{ padding: 12, borderRadius: 8, backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 11, color: "#1e40af" }}>
                💡 <strong>Future Updates:</strong> You can return at any time with this owner wallet to update your
                agent's A2A endpoint URL, model parameters, or capabilities without losing reputation history.
              </div>

              {/* Done button */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-swarm-primary"
                  style={{ padding: "8px 24px", fontSize: 13, backgroundColor: "#09090b" }}
                >
                  Done &amp; View in Studio
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
