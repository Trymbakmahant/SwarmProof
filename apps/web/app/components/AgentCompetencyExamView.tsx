"use client";

import React, { useState, useEffect } from "react";
import { type SpecialistAgentMeta, SHAPE_METAS } from "./agentData";
import { getApiBase } from "../lib/api";

const API_BASE = getApiBase();

interface AgentCompetencyExamViewProps {
  onQualified: (newAgent: SpecialistAgentMeta) => void;
  onCancel: () => void;
  initialWalletAddress?: string | null;
  initialPaymentAddress?: string;
  initialPublicKey?: string;
  initialSignature?: string;
  initialChallenge?: string;
}

interface BenchmarkSuiteItem {
  role: string;
  roleTitle: string;
  contractName: string;
  description: string;
  passingThreshold: number;
  groundTruthVulnerabilitiesCount: number;
  trapsCount: number;
}

const ROLE_ICONS: Record<string, { icon: string; shape: SpecialistAgentMeta["shape"]; color: string }> = {
  reentrancy: { icon: "🛡️", shape: "icosahedron", color: "#ec4899" },
  "access-control": { icon: "🔐", shape: "torusKnot", color: "#3b82f6" },
  "static-analysis": { icon: "⚡", shape: "octahedron", color: "#06b6d4" },
  "business-logic": { icon: "⚖️", shape: "gyroscope", color: "#8b5cf6" },
  "economic-oracle": { icon: "📈", shape: "dodecahedron", color: "#f59e0b" },
};

const PRESET_FINDINGS_TEMPLATES: Record<string, { pass: any[]; incomplete: any[]; trap: any[] }> = {
  reentrancy: {
    pass: [
      {
        id: "f_cei",
        title: "State updated after external transfer in withdraw()",
        category: "reentrancy",
        severity: "critical",
        location: "withdraw",
        evidence: ["msg.sender.call{value: amount} before balances[msg.sender] -= amount"],
        status: "proposed",
      },
      {
        id: "f_cross",
        title: "Cross-function reentrancy via external hook in transferCredit()",
        category: "reentrancy",
        severity: "high",
        location: "transferCredit",
        evidence: ["to.call with onCreditReceived allows reentrancy into withdraw()"],
        status: "proposed",
      },
    ],
    incomplete: [
      {
        id: "f_minor",
        title: "Unchecked deposit log emission",
        category: "info",
        severity: "low",
        location: "deposit",
        evidence: ["Deposit event emitted"],
        status: "proposed",
      },
    ],
    trap: [
      {
        id: "f_cei",
        title: "State updated after external transfer in withdraw()",
        category: "reentrancy",
        severity: "critical",
        location: "withdraw",
        evidence: ["Call before state update"],
        status: "proposed",
      },
      {
        id: "f_cross",
        title: "Cross-function reentrancy in transferCredit()",
        category: "reentrancy",
        severity: "high",
        location: "transferCredit",
        evidence: ["External hook"],
        status: "proposed",
      },
      {
        id: "f_trap_mutex",
        title: "Reentrancy detected in safeWithdrawWithMutex",
        category: "reentrancy",
        severity: "critical",
        location: "safeWithdrawWithMutex",
        evidence: ["Function has external call"],
        status: "proposed",
      },
    ],
  },
  "access-control": {
    pass: [
      {
        id: "f_admin",
        title: "Missing authorization modifier on setPlatformAdmin()",
        category: "access-control",
        severity: "critical",
        location: "setPlatformAdmin",
        evidence: ["Missing onlyOwner check allows public admin hijack"],
        status: "proposed",
      },
      {
        id: "f_txorigin",
        title: "Dangerous authorization using tx.origin in emergencyDrain()",
        category: "access-control",
        severity: "high",
        location: "emergencyDrain",
        evidence: ["tx.origin == owner allows phishing exploit"],
        status: "proposed",
      },
    ],
    incomplete: [
      {
        id: "f_incomplete",
        title: "Constructor sets owner to msg.sender",
        category: "info",
        severity: "low",
        location: "constructor",
        evidence: ["Owner assignment"],
        status: "proposed",
      },
    ],
    trap: [
      {
        id: "f_admin",
        title: "Missing modifier on setPlatformAdmin()",
        category: "access-control",
        severity: "critical",
        location: "setPlatformAdmin",
        evidence: ["No modifier"],
        status: "proposed",
      },
      {
        id: "f_txorigin",
        title: "tx.origin in emergencyDrain",
        category: "access-control",
        severity: "high",
        location: "emergencyDrain",
        evidence: ["tx.origin check"],
        status: "proposed",
      },
      {
        id: "f_trap_owner",
        title: "Unauthorized owner transfer in transferOwnership",
        category: "access-control",
        severity: "high",
        location: "transferOwnership",
        evidence: ["Flags transferOwnership despite onlyOwner modifier"],
        status: "proposed",
      },
    ],
  },
  "static-analysis": {
    pass: [
      {
        id: "f_call",
        title: "Unchecked return value of low-level call in batchPayout()",
        category: "static-analysis",
        severity: "high",
        location: "batchPayout",
        evidence: ["recipients[i].call{value: amount} return boolean ignored"],
        status: "proposed",
      },
      {
        id: "f_delegate",
        title: "Arbitrary delegatecall execution in forwardExecution()",
        category: "delegatecall",
        severity: "critical",
        location: "forwardExecution",
        evidence: ["target.delegatecall(data) executes arbitrary user bytecode"],
        status: "proposed",
      },
    ],
    incomplete: [
      {
        id: "f_incomplete",
        title: "For loop index overflow",
        category: "info",
        severity: "low",
        location: "batchPayout",
        evidence: ["Standard iteration"],
        status: "proposed",
      },
    ],
    trap: [
      {
        id: "f_call",
        title: "Unchecked call in batchPayout()",
        category: "static-analysis",
        severity: "high",
        location: "batchPayout",
        evidence: ["Unchecked return value"],
        status: "proposed",
      },
      {
        id: "f_delegate",
        title: "Arbitrary delegatecall in forwardExecution()",
        category: "delegatecall",
        severity: "critical",
        location: "forwardExecution",
        evidence: ["Delegatecall"],
        status: "proposed",
      },
      {
        id: "f_trap_checked",
        title: "Unchecked low level call in safeTransferChecked",
        category: "static-analysis",
        severity: "high",
        location: "safeTransferChecked",
        evidence: ["Flags safeTransferChecked despite require(success) check"],
        status: "proposed",
      },
    ],
  },
  "business-logic": {
    pass: [
      {
        id: "f_inflation",
        title: "First-depositor share price inflation attack in deposit()",
        category: "business-logic",
        severity: "critical",
        location: "deposit",
        evidence: ["shares = (assets * totalShares) / totalAssets without virtual offset"],
        status: "proposed",
      },
      {
        id: "f_zero",
        title: "Missing input boundary validation in recordActivity()",
        category: "input-validation",
        severity: "medium",
        location: "recordActivity",
        evidence: ["Accepts 0-value parameters distorting rewards"],
        status: "proposed",
      },
    ],
    incomplete: [
      {
        id: "f_incomplete",
        title: "Assets tracking logic",
        category: "info",
        severity: "low",
        location: "deposit",
        evidence: ["Asset counter updated"],
        status: "proposed",
      },
    ],
    trap: [
      {
        id: "f_inflation",
        title: "First-depositor inflation in deposit()",
        category: "business-logic",
        severity: "critical",
        location: "deposit",
        evidence: ["Inflation flaw"],
        status: "proposed",
      },
      {
        id: "f_zero",
        title: "Zero validation in recordActivity()",
        category: "input-validation",
        severity: "medium",
        location: "recordActivity",
        evidence: ["Zero amount"],
        status: "proposed",
      },
      {
        id: "f_trap_fixed",
        title: "Share inflation vulnerability in safeFixedDeposit",
        category: "business-logic",
        severity: "high",
        location: "safeFixedDeposit",
        evidence: ["Flags safeFixedDeposit despite virtual offset protection"],
        status: "proposed",
      },
    ],
  },
  "economic-oracle": {
    pass: [
      {
        id: "f_spot",
        title: "Spot price oracle manipulation via AMM reserves without TWAP",
        category: "oracle-manipulation",
        severity: "critical",
        location: "getCollateralPrice",
        evidence: ["Reading spot reserves directly without TWAP observation"],
        status: "proposed",
      },
      {
        id: "f_borrow",
        title: "Flash loan drain vector in borrow() relying on manipulated spot price",
        category: "flash-loan",
        severity: "high",
        location: "borrow",
        evidence: ["Undercollateralized borrow permitted during single-block price spike"],
        status: "proposed",
      },
    ],
    incomplete: [
      {
        id: "f_incomplete",
        title: "Interface declaration check",
        category: "info",
        severity: "low",
        location: "IUniswapV2Pair",
        evidence: ["Interface definition"],
        status: "proposed",
      },
    ],
    trap: [
      {
        id: "f_spot",
        title: "Spot price manipulation in getCollateralPrice",
        category: "oracle-manipulation",
        severity: "critical",
        location: "getCollateralPrice",
        evidence: ["Spot reserves manipulation"],
        status: "proposed",
      },
      {
        id: "f_borrow",
        title: "Flash loan borrow in borrow()",
        category: "flash-loan",
        severity: "high",
        location: "borrow",
        evidence: ["Borrow relies on spot price"],
        status: "proposed",
      },
      {
        id: "f_trap_twap",
        title: "Oracle manipulation flaw in getSafeTwapPrice",
        category: "oracle-manipulation",
        severity: "high",
        location: "getSafeTwapPrice",
        evidence: ["Flags getSafeTwapPrice despite 30m TWAP window requirement"],
        status: "proposed",
      },
    ],
  },
};

export function AgentCompetencyExamView({
  onQualified,
  onCancel,
  initialWalletAddress,
  initialPaymentAddress = "0.0.10119346",
  initialPublicKey = "",
  initialSignature = "",
  initialChallenge = "",
}: AgentCompetencyExamViewProps) {
  const [benchmarks, setBenchmarks] = useState<BenchmarkSuiteItem[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("reentrancy");
  const [benchmarkContract, setBenchmarkContract] = useState<{ contractName: string; contractSource: string; instructions: string } | null>(null);
  const [agentName, setAgentName] = useState("Alpha Sentinel V2");
  const [agentId, setAgentId] = useState("alpha-sentinel-v2");
  const [paymentAddress, setPaymentAddress] = useState(initialPaymentAddress);
  const [findingsJson, setFindingsJson] = useState("");
  const [findingsPresetMode, setFindingsPresetMode] = useState<"pass" | "incomplete" | "trap">("pass");

  // Exam Run State
  const [examStatus, setExamStatus] = useState<"idle" | "running" | "passed" | "failed">("idle");
  const [examResult, setExamResult] = useState<any>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isAutoScanning, setIsAutoScanning] = useState(false);

  // Fetch all benchmark suites on mount
  useEffect(() => {
    async function loadBenchmarks() {
      try {
        const res = await fetch(`${API_BASE}/benchmarks`);
        if (res.ok) {
          const data = await res.json();
          setBenchmarks(data.benchmarks || []);
        }
      } catch (err) {
        console.error("Failed to fetch benchmarks:", err);
      }
    }
    loadBenchmarks();
  }, []);

  // Fetch specific benchmark contract when selectedRole changes
  useEffect(() => {
    async function loadContract() {
      try {
        const res = await fetch(`${API_BASE}/benchmarks/${selectedRole}`);
        if (res.ok) {
          const data = await res.json();
          setBenchmarkContract(data);
        }
      } catch (err) {
        console.error("Failed to load benchmark contract:", err);
      }
    }
    loadContract();

    // Set default findings template
    const template = PRESET_FINDINGS_TEMPLATES[selectedRole]?.pass || [];
    setFindingsJson(JSON.stringify(template, null, 2));
    setFindingsPresetMode("pass");
    setExamStatus("idle");
    setExamResult(null);
    setTerminalLogs([]);
  }, [selectedRole]);

  const setFindingsTemplate = (mode: "pass" | "incomplete" | "trap") => {
    setFindingsPresetMode(mode);
    const template = PRESET_FINDINGS_TEMPLATES[selectedRole]?.[mode] || [];
    setFindingsJson(JSON.stringify(template, null, 2));
  };

  const handleNameChange = (val: string) => {
    setAgentName(val);
    const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setAgentId(slug ? `${slug}-agent` : "");
  };

  const addLog = (msg: string) => {
    const time = new Date().toISOString().split("T")[1]?.slice(0, 8);
    setTerminalLogs((prev) => [...prev, `[${time}] ${msg}`]);
  };

  // Run the Competency Exam against Hedera HCS Oracle
  const handleRunExam = async () => {
    setExamStatus("running");
    setTerminalLogs([]);

    addLog("🚀 Dispatched benchmark exam request to SwarmProof Oracle...");
    await new Promise((r) => setTimeout(r, 400));
    addLog(`📄 Benchmark Suite: ${selectedRole.toUpperCase()} (${benchmarkContract?.contractName || "Contract"})`);
    await new Promise((r) => setTimeout(r, 500));
    addLog("🔍 Evaluating candidate findings against ground-truth exploit vectors...");
    await new Promise((r) => setTimeout(r, 500));
    addLog("⚠️ Checking for false-positive safe pattern violations (Traps)...");

    try {
      let parsedFindings: any[] = [];
      try {
        parsedFindings = JSON.parse(findingsJson);
      } catch {
        addLog("❌ JSON Syntax Error: Invalid candidate findings JSON format.");
        setExamStatus("failed");
        return;
      }

      const res = await fetch(`${API_BASE}/agents/qualify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: agentId || `${selectedRole}-sentinel`,
          name: agentName || `${selectedRole.toUpperCase()} Sentinel`,
          role: selectedRole,
          paymentAddress: paymentAddress.trim() || initialPaymentAddress,
          publicKey: initialPublicKey,
          signature: initialSignature,
          challenge: initialChallenge,
          findings: parsedFindings,
          shape: ROLE_ICONS[selectedRole]?.shape || "icosahedron",
          color: ROLE_ICONS[selectedRole]?.color || "#10b981",
        }),
      });

      const data = await res.json();

      if (res.ok && data.passed) {
        addLog(`✅ EXAM PASSED! Score: ${data.score}/100 (Threshold: >= ${data.evaluation.passingThreshold}%).`);
        addLog(`📊 True Positives: ${data.evaluation.truePositivesCount} | False Positives: ${data.evaluation.falsePositivesCount}`);
        addLog(`🔗 Anchoring Proof-of-Competency to Hedera Consensus Service Topic 0.0.10417469...`);
        await new Promise((r) => setTimeout(r, 600));
        addLog(`✓ HCS Transaction Anchored: ${data.qualificationProof.transactionId}`);
        addLog(`📜 W3C SwarmQualifiedAuditorCredential Minted: ${data.qualificationProof.credentialUrl}`);
        addLog(`🌟 Promoted Agent Status to: ACTIVE_SPECIALIST`);

        setExamResult(data);
        setExamStatus("passed");
      } else {
        addLog(`❌ EXAM FAILED: Score ${data.score ?? 0}/100 is below the required 80% threshold.`);
        if (data.evaluation?.falsePositiveTrapsTriggered?.length > 0) {
          addLog(`🚨 Trap Violation: Agent falsely flagged safe pattern: ${data.evaluation.falsePositiveTrapsTriggered.map((t: any) => t.safeFunction).join(", ")}`);
        }
        if (data.evaluation?.missedVulnerabilities?.length > 0) {
          addLog(`⚠️ Missed ground-truth flaws: ${data.evaluation.missedVulnerabilities.map((m: any) => m.title).join("; ")}`);
        }
        setExamResult(data);
        setExamStatus("failed");
      }
    } catch (err) {
      addLog(`❌ Network error: ${(err as Error).message}`);
      setExamStatus("failed");
    }
  };

  // Deploy & activate in live swarm
  const handleDeployToSwarm = () => {
    if (!examResult) return;

    const roleMeta = ROLE_ICONS[selectedRole] || { shape: "icosahedron", color: "#10b981" };
    const shapeInfo = SHAPE_METAS[roleMeta.shape];

    const newAgentMeta: SpecialistAgentMeta = {
      id: examResult.registration?.agentId || agentId,
      name: agentName,
      shortName: agentName.replace(/ Specialist| Agent/gi, "").trim(),
      role: `Qualified ${selectedRole} Specialist`,
      color: roleMeta.color,
      colorSecondary: roleMeta.color,
      shape: roleMeta.shape,
      shapeLabel: shapeInfo.label,
      shapeRationale: shapeInfo.rationale,
      capabilities: [selectedRole, `${selectedRole}-specialist`],
      systemPromptSummary: `Certified ${selectedRole} auditor qualified with benchmark score ${examResult.score}/100.`,
      simulatedThoughts: [
        `Ingesting candidate contract for ${selectedRole} vulnerabilities…`,
        `Cross-referencing verified Hedera DID credentials…`,
        `Analyzing control-flow invariants against HCS benchmark standards…`,
        `Voting in weighted quorum consensus…`,
      ],
      identityReference: examResult.qualificationProof?.transactionId,
      identityTopicId: examResult.qualificationProof?.hcsTopicId,
      consensusTimestamp: examResult.qualificationProof?.consensusTimestamp,
      did: examResult.qualificationProof?.did,
      didDocumentUrl: examResult.qualificationProof?.didDocumentUrl,
      credentialUrl: examResult.qualificationProof?.credentialUrl,
      w3cStandard: "did:hedera",
      paymentAddress: paymentAddress,
      mode: "llm",
      provider: "Hedera Qualified Auditor",
      isCustom: true,
      sampleFinding: {
        title: `Verified finding by ${agentName}`,
        category: selectedRole,
        severity: "critical",
        location: "executeAudit()",
        evidence: `Qualified Proof-of-Competency benchmark verification`,
        reasoning: `Corroborated exploit pattern with score ${examResult.score}/100 on Hedera HCS.`,
      },
    };

    onQualified(newAgentMeta);
  };

  const selectedRoleMeta = ROLE_ICONS[selectedRole] || { icon: "🛡️", color: "#10b981" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Role Selection Cards ─────────────────────────────── */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#09090b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            1. Select Specialist Role & Benchmark Exam
          </label>
          <span style={{ fontSize: 11, color: "#71717a" }}>
            Requires $\ge 80\%$ accuracy & $0$ false-positive trap violations to join
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
          {[
            { id: "reentrancy", label: "Reentrancy & CEI", icon: "🛡️", color: "#ec4899" },
            { id: "access-control", label: "Access Control", icon: "🔐", color: "#3b82f6" },
            { id: "static-analysis", label: "Static Analysis", icon: "⚡", color: "#06b6d4" },
            { id: "business-logic", label: "Business Logic", icon: "⚖️", color: "#8b5cf6" },
            { id: "economic-oracle", label: "Economic / AMM", icon: "📈", color: "#f59e0b" },
          ].map((r) => {
            const isSelected = selectedRole === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRole(r.id)}
                style={{
                  padding: "10px 8px",
                  borderRadius: 8,
                  backgroundColor: isSelected ? "#09090b" : "#fafafa",
                  color: isSelected ? "#ffffff" : "#18181b",
                  border: `1.5px solid ${isSelected ? "#09090b" : "#e4e4e7"}`,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.15s ease",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: 18 }}>{r.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Benchmark Contract Viewer ─────────────────────────── */}
      <div style={{ border: "1px solid #e4e4e7", borderRadius: 8, overflow: "hidden" }}>
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "#fafafa",
            borderBottom: "1px solid #e4e4e7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{selectedRoleMeta.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#09090b", fontFamily: "var(--font-mono)" }}>
              {benchmarkContract?.contractName || "BenchmarkContract"}.sol
            </span>
          </div>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              color: "#10b981",
              backgroundColor: "#ecfdf5",
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid #a7f3d0",
            }}
          >
            Pass Threshold: $\ge 80\%$
          </span>
        </div>

        <pre
          style={{
            margin: 0,
            padding: 12,
            backgroundColor: "#09090b",
            color: "#a1a1aa",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            maxHeight: 160,
            overflowY: "auto",
            lineHeight: 1.5,
          }}
        >
          <code>{benchmarkContract?.contractSource || "// Loading benchmark Solidity contract…"}</code>
        </pre>
      </div>

      {/* ── Agent Identity Parameters ─────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#71717a", marginBottom: 4 }}>
            Agent Display Name
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => handleNameChange(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #e4e4e7",
              fontSize: 12,
              fontFamily: "inherit",
              color: "#09090b",
              backgroundColor: "#ffffff",
            }}
            placeholder="e.g. SentinAI Specialist"
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#71717a", marginBottom: 4 }}>
            Payout Account ID (Hedera / EVM)
          </label>
          <input
            type="text"
            value={paymentAddress}
            onChange={(e) => setPaymentAddress(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #e4e4e7",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "#09090b",
              backgroundColor: "#ffffff",
            }}
            placeholder="0.0.10119346 or 0x..."
          />
        </div>
      </div>

      {/* ── Candidate Findings Test Controls ──────────────────── */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#09090b" }}>
            2. Candidate Findings Payload (Oracle Grading Input)
          </label>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setFindingsTemplate("pass")}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                cursor: "pointer",
                backgroundColor: findingsPresetMode === "pass" ? "#ecfdf5" : "#f4f4f5",
                color: findingsPresetMode === "pass" ? "#15803d" : "#71717a",
                border: `1px solid ${findingsPresetMode === "pass" ? "#86efac" : "#e4e4e7"}`,
              }}
            >
              🟢 Pass (100%)
            </button>
            <button
              type="button"
              onClick={() => setFindingsTemplate("incomplete")}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                cursor: "pointer",
                backgroundColor: findingsPresetMode === "incomplete" ? "#fffbeb" : "#f4f4f5",
                color: findingsPresetMode === "incomplete" ? "#b45309" : "#71717a",
                border: `1px solid ${findingsPresetMode === "incomplete" ? "#fde68a" : "#e4e4e7"}`,
              }}
            >
              🟡 Fail (&lt;80%)
            </button>
            <button
              type="button"
              onClick={() => setFindingsTemplate("trap")}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                cursor: "pointer",
                backgroundColor: findingsPresetMode === "trap" ? "#fef2f2" : "#f4f4f5",
                color: findingsPresetMode === "trap" ? "#b91c1c" : "#71717a",
                border: `1px solid ${findingsPresetMode === "trap" ? "#fca5a5" : "#e4e4e7"}`,
              }}
            >
              🔴 Trap Safe Mutex
            </button>
          </div>
        </div>

        <textarea
          value={findingsJson}
          onChange={(e) => setFindingsJson(e.target.value)}
          rows={5}
          style={{
            width: "100%",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            padding: 10,
            borderRadius: 6,
            border: "1px solid #e4e4e7",
            backgroundColor: "#fafafa",
            color: "#18181b",
            lineHeight: 1.4,
          }}
        />
      </div>

      {/* ── Terminal Simulator / Exam Execution Logs ──────────── */}
      {terminalLogs.length > 0 && (
        <div
          style={{
            backgroundColor: "#09090b",
            border: "1px solid #27272a",
            borderRadius: 8,
            padding: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "#e4e4e7",
            maxHeight: 150,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {terminalLogs.map((log, idx) => {
            const isPass = log.includes("PASSED") || log.includes("✓");
            const isFail = log.includes("FAILED") || log.includes("❌") || log.includes("Trap");
            const color = isPass ? "#4ade80" : isFail ? "#f87171" : "#a1a1aa";
            return (
              <div key={idx} style={{ color }}>
                {log}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Official Certificate Card (When Passed) ───────────── */}
      {examStatus === "passed" && examResult && (
        <div
          style={{
            backgroundColor: "#f0fdf4",
            border: "1.5px solid #86efac",
            borderRadius: 10,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                ✓
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#166534" }}>
                  OFFICIAL HEDERA HCS PROOF-OF-COMPETENCY
                </h4>
                <div style={{ fontSize: 11, color: "#15803d", fontFamily: "var(--font-mono)" }}>
                  W3C Qualified Auditor Credential Minted
                </div>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#166534" }}>Grade</span>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#15803d", fontFamily: "var(--font-mono)" }}>
                {examResult.score}/100
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, fontFamily: "var(--font-mono)" }}>
            <div style={{ backgroundColor: "#ffffff", padding: "6px 10px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
              <div style={{ color: "#71717a", fontSize: 9, textTransform: "uppercase" }}>Hedera DID</div>
              <div style={{ color: "#09090b", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {examResult.qualificationProof?.did}
              </div>
            </div>
            <div style={{ backgroundColor: "#ffffff", padding: "6px 10px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
              <div style={{ color: "#71717a", fontSize: 9, textTransform: "uppercase" }}>HCS Transaction ID</div>
              <div style={{ color: "#09090b", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {examResult.qualificationProof?.transactionId}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <a
              href={examResult.qualificationProof?.hashscanUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 11,
                color: "#16a34a",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Verify on HashScan Explorer ↗
            </a>

            <button
              type="button"
              onClick={handleDeployToSwarm}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                backgroundColor: "#16a34a",
                color: "#ffffff",
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(22, 163, 74, 0.25)",
              }}
            >
              🚀 Deploy & Activate Agent in Quorum →
            </button>
          </div>
        </div>
      )}

      {/* ── Failed Alert (When Score < 80% or Trap Flagged) ───── */}
      {examStatus === "failed" && examResult && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            color: "#991b1b",
          }}
        >
          <strong>Qualification Incomplete: </strong>
          {examResult.message}
        </div>
      )}

      {/* ── Bottom Submit Actions ─────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: "1px solid #e4e4e7",
            backgroundColor: "#ffffff",
            color: "#71717a",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleRunExam}
          disabled={examStatus === "running"}
          style={{
            padding: "8px 18px",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 6,
            backgroundColor: "#09090b",
            color: "#ffffff",
            border: "1px solid #09090b",
            cursor: examStatus === "running" ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
          }}
        >
          {examStatus === "running" ? "Grading on Hedera Oracle..." : "Submit Exam to Hedera HCS Oracle →"}
        </button>
      </div>
    </div>
  );
}
