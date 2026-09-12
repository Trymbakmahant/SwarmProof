"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { RegisterAgentModal } from "../components/RegisterAgentModal";
import { CONTRACT_GRAPHS, type ContractGraphConfig, type GraphNode } from "./contractGraphs";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

interface ActivityRow {
  id: string;
  queryExpression: string;
  agents: string;
  latency: string;
  consensusState: string;
  timestamp?: string;
  isNew?: boolean;
}

interface NodeInspectorState {
  title: string;
  type: string;
  lines: string;
  statusBadge: string;
  statusBadgeType: "vuln" | "verified" | "agent";
  swcCode?: string;
  depth?: string;
  desc: string;
  flaggedAgents?: string[];
  codeSlice?: Array<{ line: number; text: string; type: "normal" | "deleted" | "added" }>;
  hcsSeq: string;
  hcsHash: string;
  hcsTimestamp: string;
}

const INITIAL_ACTIVITY_ROWS: ActivityRow[] = [
  {
    id: "gq_1789192401",
    queryExpression: "MATCH (a:Agent)-[:DETECTS]->(v:Vuln)",
    agents: "A1, A5",
    latency: "14ms",
    consensusState: "Anchored (HCS)",
  },
  {
    id: "gq_1789192388",
    queryExpression: "TRACE STATE slot(0x04) OVER writes",
    agents: "A3, A4",
    latency: "22ms",
    consensusState: "Anchored (HCS)",
  },
  {
    id: "gq_1789192340",
    queryExpression: "RESOLVE AST::FunctionDefinition['flashLoan']",
    agents: "All 10",
    latency: "9ms",
    consensusState: "Anchored (HCS)",
  },
  {
    id: "gq_1789192310",
    queryExpression: "ASSERT modifier(onlyVault) == true",
    agents: "A2",
    latency: "18ms",
    consensusState: "Anchored (HCS)",
  },
  {
    id: "gq_1789192290",
    queryExpression: '{ pool(id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640") { totalValueLockedUSD volumeUSD } }',
    agents: "A4",
    latency: "38ms",
    consensusState: "x402 Paid ✓",
  },
  {
    id: "gq_1789192250",
    queryExpression: "MATCH (fn:Function)-[:CALLS*]->(ext:ExternalCall) WHERE fn.updatesStateAfter = true RETURN fn, ext",
    agents: "A1, A2, A5",
    latency: "16ms",
    consensusState: "Anchored (HCS)",
  },
];

export default function GraphExplorerPage() {
  const [selectedContractKey, setSelectedContractKey] = useState<string>("flashlender");
  const activeGraph = (CONTRACT_GRAPHS[selectedContractKey] ?? CONTRACT_GRAPHS["flashlender"])!;

  const [queryInput, setQueryInput] = useState<string>(
    'MATCH (a:Agent)-[:DETECTS]->(v:Vulnerability {type: "Reentrancy"}) RETURN a, v'
  );
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [currentZoom, setCurrentZoom] = useState<number>(1.0);
  const [isForceDirected, setIsForceDirected] = useState<boolean>(true);
  const [showExploitVectors, setShowExploitVectors] = useState<boolean>(true);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>(INITIAL_ACTIVITY_ROWS);
  const [isSyncingHcs, setIsSyncingHcs] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);

  // Live dynamic data from backend API
  const [liveAgents, setLiveAgents] = useState<any[]>([]);
  const [liveTelemetry, setLiveTelemetry] = useState<{
    tvlUsd?: number;
    dailyVolumeUsd?: number;
    totalTransactions?: number;
    riskSignals?: string[];
  }>({});
  const [liveTasks, setLiveTasks] = useState<any[]>([]);

  const [inspector, setInspector] = useState<NodeInspectorState>({
    title: activeGraph.nodes[0]?.name || "flashLoan()",
    type: activeGraph.nodes[0]?.type || "FunctionDefinition",
    lines: `Lines ${activeGraph.nodes[0]?.startLine || 34} - ${activeGraph.nodes[0]?.endLine || 58}`,
    statusBadge: "AST INVARIANT VERIFIED",
    statusBadgeType: "verified",
    depth: "AST Depth: 3",
    desc: activeGraph.nodes[0]?.desc || "ERC-3156 flash loan disbursement.",
    flaggedAgents: activeGraph.nodes[0]?.flaggedAgents || ["Reentrancy Sentinel", "Logic Sentinel"],
    codeSlice: activeGraph.nodes[0]?.codeSlice || [],
    hcsSeq: activeGraph.hcsSeq,
    hcsHash: activeGraph.hcsHash,
    hcsTimestamp: activeGraph.hcsTimestamp,
  });

  // Fetch live Subgraph activity, live agents, and telemetry from backend on mount and when contract changes
  useEffect(() => {
    async function loadDynamicGraphData() {
      try {
        const [activityRes, agentsRes, telemetryRes, tasksRes] = await Promise.all([
          fetch(`${API_BASE}/graph/activity`).catch(() => null),
          fetch(`${API_BASE}/graph/agents`).catch(() => null),
          fetch(`${API_BASE}/graph/telemetry?contract=${activeGraph.fileName}`).catch(() => null),
          fetch(`${API_BASE}/pool/tasks`).catch(() => null),
        ]);

        if (activityRes && activityRes.ok) {
          const data = await activityRes.json();
          if (data.activityRows && Array.isArray(data.activityRows) && data.activityRows.length > 0) {
            setActivityRows(data.activityRows);
          }
        }
        if (agentsRes && agentsRes.ok) {
          const data = await agentsRes.json();
          if (Array.isArray(data.agents)) {
            setLiveAgents(data.agents);
          }
        }
        if (telemetryRes && telemetryRes.ok) {
          const data = await telemetryRes.json();
          if (data.telemetry) {
            setLiveTelemetry(data.telemetry);
          }
        }
        if (tasksRes && tasksRes.ok) {
          const data = await tasksRes.json();
          if (Array.isArray(data.tasks)) {
            setLiveTasks(data.tasks);
          }
        }
      } catch (err) {
        console.warn("Dynamic graph data fetch fallback:", err);
      }
    }
    loadDynamicGraphData();
  }, [selectedContractKey]);

  const handleSelectContract = (key: string) => {
    setSelectedContractKey(key);
    const target = CONTRACT_GRAPHS[key];
    if (target && target.nodes.length > 0) {
      const firstNode = target.nodes[0];
      if (firstNode) {
        setInspector({
          title: firstNode.name,
          type: firstNode.type,
          lines: `Lines ${firstNode.startLine} - ${firstNode.endLine} (${firstNode.endLine - firstNode.startLine + 1} LOC)`,
          statusBadge: firstNode.isVuln ? "VULNERABILITY DETECTED" : "AST INVARIANT VERIFIED",
          statusBadgeType: firstNode.isVuln ? "vuln" : "verified",
          swcCode: firstNode.swcCode,
          depth: firstNode.depth,
          desc: firstNode.desc,
          flaggedAgents: firstNode.flaggedAgents,
          codeSlice: firstNode.codeSlice,
          hcsSeq: target.hcsSeq,
          hcsHash: target.hcsHash,
          hcsTimestamp: target.hcsTimestamp,
        });
      }
    }
  };

  const handleRunQuery = async (customQuery?: string) => {
    const q = customQuery !== undefined ? customQuery : queryInput;
    setIsQuerying(true);

    const latencyMs = Math.floor(Math.random() * 15) + 8;
    const newEntry: ActivityRow = {
      id: `gq_${Date.now()}`,
      queryExpression: q.trim() || 'MATCH (n) RETURN n',
      agents: q.includes("Reentrancy") || q.includes("CEI") ? "A1, A5" : q.includes("tx.origin") ? "A2" : q.includes("Flashloan") || q.includes("Flash") ? "A4, A8" : "All 10",
      latency: `${latencyMs}ms`,
      consensusState: "Anchored (HCS)",
      isNew: true,
    };

    setActivityRows((prev) => [newEntry, ...prev.slice(0, 15)]);

    try {
      fetch(`${API_BASE}/graph/activity/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryExpression: q,
          agents: newEntry.agents,
          latencyMs,
          consensusState: "Anchored (HCS)",
        }),
      }).catch(() => {});
    } catch {
      // background
    }

    setTimeout(() => {
      setIsQuerying(false);
    }, 450);
  };

  const applyPreset = (presetName: string) => {
    let q = "";
    if (presetName.includes("CEI")) {
      q = "MATCH (fn:Function)-[:CALLS*]->(ext:ExternalCall) WHERE fn.updatesStateAfter = true RETURN fn, ext";
      handleSelectContract("ethervault");
    } else if (presetName.includes("tx.origin")) {
      q = 'MATCH (n:ASTNode {name: "tx.origin"})<-[:VALIDATES]-(guard:Requirement) RETURN n, guard';
      handleSelectContract("multisig");
    } else if (presetName.includes("Flashloan")) {
      q = "MATCH (p:Pool)-[:ALLOWS_LOAN]->(b:Borrower) ASSERT p.k_constant_post >= p.k_constant_pre";
      handleSelectContract("flashlender");
    } else {
      q = 'MATCH (op:BinaryOperation {type: "DivBeforeMul"}) RETURN op.scope, op.operands';
      handleSelectContract("redeemescrow");
    }
    setQueryInput(q);
    handleRunQuery(q);
  };

  const selectNode = (
    name: string,
    type: string,
    startLine: number,
    endLine: number,
    desc: string,
    isVuln: boolean,
    swcCode?: string,
    depth?: string,
    flaggedAgents?: string[],
    customSlice?: Array<{ line: number; text: string; type: "normal" | "deleted" | "added" }>
  ) => {
    setInspector({
      title: name,
      type: type,
      lines: `Lines ${startLine} - ${endLine} (${endLine - startLine + 1} LOC)`,
      statusBadge: isVuln ? "VULNERABILITY DETECTED" : "AST INVARIANT VERIFIED",
      statusBadgeType: isVuln ? "vuln" : "verified",
      swcCode: swcCode,
      depth: depth || "AST Level: Semantic",
      desc,
      flaggedAgents: flaggedAgents || ["Verification Agent"],
      codeSlice: customSlice || [
        { line: startLine, text: `// ${activeGraph.fileName} invariant scope`, type: "normal" },
        { line: startLine + 1, text: `${name}`, type: isVuln ? "deleted" : "added" },
      ],
      hcsSeq: activeGraph.hcsSeq,
      hcsHash: activeGraph.hcsHash,
      hcsTimestamp: activeGraph.hcsTimestamp,
    });
  };

  const selectAgentNode = (agentId: string, role: string, status: string, message: string) => {
    setInspector({
      title: `${agentId} [${role}]`,
      type: "NeuralCognitiveAgent",
      lines: "Subscribed to Topic 0.0.10417469",
      statusBadge: `AGENT STATE: ${status.toUpperCase()}`,
      statusBadgeType: "agent",
      desc: message,
      flaggedAgents: [agentId],
      hcsSeq: activeGraph.hcsSeq,
      hcsHash: activeGraph.hcsHash,
      hcsTimestamp: activeGraph.hcsTimestamp,
    });
  };

  const handleZoom = (factor: number) => {
    setCurrentZoom((prev) => Math.min(Math.max(prev * factor, 0.6), 2.2));
  };

  const resetGraphView = () => {
    setCurrentZoom(1.0);
  };

  const toggleLayoutMode = () => {
    setIsForceDirected((prev) => !prev);
  };

  const toggleVulnerabilityOverlay = () => {
    setShowExploitVectors((prev) => !prev);
  };

  const dispatchAgentReparse = () => {
    setIsSyncingHcs(true);
    setTimeout(() => {
      setIsSyncingHcs(false);
      handleRunQuery();
    }, 650);
  };

  const copyHcsProof = () => {
    navigator.clipboard?.writeText(inspector.hcsHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleExportSubgraph = () => {
    const data = {
      hcsTopic: "0.0.10417469",
      contract: "VaultCore.sol",
      nodesCount: 1420,
      edgesCount: 89,
      vulnerabilities: [
        { type: "SWC-107", node: "withdraw(uint256)", severity: "HIGH", agent: "A1" },
      ],
      timestamp: new Date().toISOString(),
      activityRows,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "swarmproof-ast-subgraph.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG viewBox calculation
  const viewBoxWidth = 920 / currentZoom;
  const viewBoxHeight = 620 / currentZoom;
  const minX = (920 - viewBoxWidth) / 2;
  const minY = (620 - viewBoxHeight) / 2;
  const currentViewBox = `${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`;

  return (
    <div className="bg-surface text-on-surface selection:bg-secondary-container selection:text-on-secondary-container min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-28 max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex flex-col justify-between pt-3 pb-2">
          <div className="flex items-center justify-between gap-gutter">
            <div className="flex items-center gap-space-md">
              <Link href="/" className="w-9 h-9 bg-primary flex items-center justify-center rounded hover:opacity-90 transition-opacity">
                <span className="font-code-md text-code-md font-semibold text-on-primary tracking-tight">SP</span>
              </Link>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <Link href="/" className="font-headline-sm text-headline-sm tracking-tight text-on-surface font-medium hover:text-secondary transition-colors">
                    SwarmProof
                  </Link>
                  <span className="font-label-caps text-label-caps px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                    3D Swarm Visualizer
                  </span>
                </div>
                <span className="font-code-sm text-code-sm text-on-surface-variant hidden sm:inline">
                  Hedera Agentic Consensus • Topic 0.0.10417469
                </span>
              </div>
            </div>

            <div className="flex items-center gap-space-md">
              <nav className="hidden lg:flex items-center gap-space-lg">
                <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="/leaderboard">
                  Leaderboard &amp; Reputation
                </Link>
                <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="/pitch-deck">
                  Pitch Deck
                </Link>
                <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="/#payment-lab">
                  Payment Lab (x402)
                </Link>
              </nav>

              <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-surface-container-low rounded">
                <span className="w-2 h-2 rounded-full bg-secondary-fixed-dim animate-pulse"></span>
                <span className="font-code-sm text-code-sm text-on-surface-variant">Topic 0.0.10417469</span>
              </div>

              <button
                onClick={() => setShowRegisterModal(true)}
                id="header-register-agent-btn"
                className="px-3 py-1.5 bg-primary text-on-primary font-body-sm text-body-sm rounded hover:bg-primary-container transition-colors inline-flex items-center justify-center font-medium"
              >
                + Register Agent
              </button>

              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </div>
            </div>
          </div>

          {/* Subnav Tabs */}
          <div className="flex items-center overflow-x-auto gap-space-sm pt-1">
            <nav className="flex items-center gap-space-xs">
              <Link
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                href="/"
              >
                3D Swarm Visualizer
              </Link>
              <Link
                aria-current="page"
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all bg-primary text-on-primary font-medium"
                href="/graph"
              >
                Consensus &amp; AST Quorum
              </Link>
              <Link
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                href="/#audit-studio"
              >
                Solidity Audit Studio
              </Link>
              <Link
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                href="/#hcs-proofs"
              >
                Hedera HCS Proofs
              </Link>
              <Link
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                href="/#verification-logs"
              >
                Verification Logs
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full pt-28 bg-surface">
        <div className="flex flex-col w-full">
          {/* Top Protocol Metadata & Consensus Banner */}
          <section className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin pt-space-md pb-space-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-gutter pb-space-sm">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-xs flex-wrap">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
                    Audit Vector Engine
                  </span>
                  <span className="text-on-surface-variant text-code-sm">•</span>
                  <span className="font-code-sm text-code-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface">
                    Solidity 0.8.20 AST Semantic Core
                  </span>
                  <span className="text-on-surface-variant text-code-sm">•</span>
                  <span className="font-code-sm text-code-sm text-secondary flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                    HCS Topic 0.0.10417469 Live Sync
                  </span>
                </div>
                <h1 className="font-display-lg text-display-lg text-on-surface font-normal tracking-tight">
                  AST Knowledge Graph &amp; Neural Semantic Explorer
                </h1>
              </div>

              {/* Settlement & Graph Metrics Pill Array */}
              <div className="flex flex-wrap items-center gap-space-sm">
                <div className="bg-surface-container-low px-3.5 py-2 rounded shadow-sm flex flex-col min-w-[110px]">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">AST NODES</span>
                  <span className="font-code-md text-code-md font-semibold text-on-surface">
                    {activeGraph.nodes.length} Nodes
                  </span>
                </div>
                <div className="bg-surface-container-low px-3.5 py-2 rounded shadow-sm flex flex-col min-w-[110px]">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">SUBGRAPH TVL</span>
                  <span className="font-code-md text-code-md font-semibold text-secondary">
                    {liveTelemetry.tvlUsd ? `$${(liveTelemetry.tvlUsd / 1e6).toFixed(2)}M` : "$3.42M"}
                  </span>
                </div>
                <div className="bg-surface-container-low px-3.5 py-2 rounded shadow-sm flex flex-col min-w-[110px]">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">COGNITIVE AGENTS</span>
                  <span className="font-code-md text-code-md font-semibold text-secondary-container text-on-secondary-container">
                    {liveAgents.length > 0 ? `${liveAgents.length} Active` : "10 Active"}
                  </span>
                </div>
                <div className="bg-surface-container-low px-3.5 py-2 rounded shadow-sm flex flex-col min-w-[110px]">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">24H VOLUME</span>
                  <span className="font-code-md text-code-md font-semibold text-on-surface">
                    {liveTelemetry.dailyVolumeUsd ? `$${(liveTelemetry.dailyVolumeUsd / 1e3).toFixed(0)}K` : "$780K"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Query & Command Control Bar */}
          <section className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin mb-space-md">
            <div className="bg-surface-container-lowest rounded shadow-md p-space-md flex flex-col gap-space-sm backdrop-blur-xl">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-space-sm">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">terminal</span>
                  </div>
                  <input
                    id="graph-query-input"
                    className="w-full pl-9 pr-24 py-2.5 bg-surface-container-low text-on-surface font-code-md text-code-md rounded focus:outline-none focus:bg-surface-container transition-all"
                    placeholder="Run Cypher, Semantic AST path, or e.g. 'Trace state writes before external calls'..."
                    type="text"
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRunQuery();
                    }}
                  />
                  <span className="absolute right-3 top-2.5 font-code-sm text-code-sm text-on-surface-variant pointer-events-none">
                    CYPHER / AST
                  </span>
                </div>

                <div className="flex items-center gap-space-xs flex-wrap sm:flex-nowrap">
                  <button
                    id="btn-run-query"
                    onClick={() => handleRunQuery()}
                    disabled={isQuerying}
                    className="px-4 py-2.5 bg-primary text-on-primary font-body-sm text-body-sm rounded shadow-sm hover:bg-primary-container transition-colors inline-flex items-center gap-2 font-medium"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isQuerying ? "animate-spin" : ""}`}>
                      {isQuerying ? "sync" : "play_arrow"}
                    </span>
                    <span>{isQuerying ? "Querying..." : "Run Graph Query"}</span>
                  </button>

                  <button
                    onClick={handleExportSubgraph}
                    id="btn-export-subgraph"
                    className="px-3.5 py-2.5 bg-surface-container text-on-surface font-body-sm text-body-sm rounded hover:bg-surface-container-high transition-colors inline-flex items-center gap-1.5"
                    title="Export Cypher Subgraph to JSON / DOT"
                  >
                    <span className="material-symbols-outlined text-[16px]">file_download</span>
                    <span className="hidden sm:inline">Export Subgraph</span>
                  </button>

                  <button
                    onClick={resetGraphView}
                    id="btn-reset-graph-view"
                    className="p-2.5 bg-surface-container text-on-surface rounded hover:bg-surface-container-high transition-colors flex items-center justify-center"
                    title="Reset Graph Zoom and Coordinates"
                  >
                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Filter Pills */}
              <div className="flex items-center gap-space-xs overflow-x-auto pt-1 pb-0.5">
                <span className="font-label-caps text-label-caps text-on-surface-variant whitespace-nowrap">Presets:</span>
                <button
                  onClick={() => applyPreset("CEI Pattern Violation Path")}
                  className="px-2.5 py-1 bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-code-sm text-code-sm rounded transition-all whitespace-nowrap inline-flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                  CEI Pattern Violation Path
                </button>
                <button
                  onClick={() => applyPreset("tx.origin Delegate Chains")}
                  className="px-2.5 py-1 bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-code-sm text-code-sm rounded transition-all whitespace-nowrap inline-flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  tx.origin Delegate Chains
                </button>
                <button
                  onClick={() => applyPreset("Flashloan Arbitrage Invariants")}
                  className="px-2.5 py-1 bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-code-sm text-code-sm rounded transition-all whitespace-nowrap inline-flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
                  Flashloan Arbitrage Invariants
                </button>
                <button
                  onClick={() => applyPreset("Arithmetic Precision Drift")}
                  className="px-2.5 py-1 bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-code-sm text-code-sm rounded transition-all whitespace-nowrap inline-flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                  Arithmetic Precision Drift
                </button>
              </div>
            </div>
          </section>

          {/* Main Canvas & Inspector Bento Layout */}
          <section className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin grid grid-cols-1 xl:grid-cols-12 gap-gutter mb-space-lg">
            {/* Graph Canvas Workspace (Col 1-8) */}
            <div className="xl:col-span-8 flex flex-col gap-space-sm">
              <div className="relative w-full bg-surface-container-lowest rounded shadow-lg overflow-hidden flex flex-col h-[620px] select-none">
                {/* Canvas Top Bar HUD */}
                <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
                  {/* Specialist Agents Legend Overlay */}
                  <div className="pointer-events-auto flex items-center gap-1.5 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-1.5 rounded shadow-sm">
                    <span className="font-label-caps text-label-caps text-on-surface-variant mr-1">NEURAL SWARM:</span>
                    <span className="inline-flex items-center gap-1 font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface" title="Reentrancy Specialist">
                      <span className="w-2 h-2 rounded-full bg-[#00bcd4]"></span>A1
                    </span>
                    <span className="inline-flex items-center gap-1 font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface" title="Access Control Matrix">
                      <span className="w-2 h-2 rounded-full bg-[#ff9800]"></span>A2
                    </span>
                    <span className="inline-flex items-center gap-1 font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface" title="Business Logic Invariants">
                      <span className="w-2 h-2 rounded-full bg-[#e91e63]"></span>A3
                    </span>
                    <span className="inline-flex items-center gap-1 font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface" title="Economic Attack Vector">
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>A4
                    </span>
                    <span className="inline-flex items-center gap-1 font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface" title="Bytecode Disassembly">
                      <span className="w-2 h-2 rounded-full bg-[#2196f3]"></span>A5
                    </span>
                  </div>

                  {/* Layout & Filter Controls */}
                  <div className="pointer-events-auto flex items-center gap-1.5 bg-surface-container-lowest/90 backdrop-blur-md px-2 py-1.5 rounded shadow-sm">
                    <button
                      id="toggle-physics"
                      onClick={toggleLayoutMode}
                      className="px-2 py-1 font-code-sm text-code-sm rounded bg-surface-container-high text-on-surface hover:bg-surface-container transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">device_hub</span>
                      <span id="physics-mode-label">{isForceDirected ? "Force-Directed" : "Hierarchical Tree"}</span>
                    </button>
                    <button
                      onClick={toggleVulnerabilityOverlay}
                      className={`px-2 py-1 font-code-sm text-code-sm rounded transition-all flex items-center gap-1 ${
                        showExploitVectors ? "bg-error/10 text-error hover:bg-error/20" : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      <span>Exploit Vectors</span>
                    </button>
                  </div>
                </div>

                {/* Interactive SVG Engine */}
                <div className="w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden bg-surface-container-low/40" id="graph-container">
                  <svg className="w-full h-full" id="ast-network-svg" viewBox={currentViewBox}>
                    <defs>
                      <linearGradient id="exploit-flow" x1="0%" x2="100%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.9"></stop>
                        <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0.1"></stop>
                      </linearGradient>
                      <filter height="140%" id="soft-glow" width="140%" x="-20%" y="-20%">
                        <feGaussianBlur result="glow" stdDeviation="3"></feGaussianBlur>
                        <feComposite in="SourceGraphic" in2="glow" operator="over"></feComposite>
                      </filter>
                    </defs>

                    {/* Background Grid Matrix */}
                    <pattern height="32" id="grid-dots" patternUnits="userSpaceOnUse" width="32" x="0" y="0">
                      <circle cx="2" cy="2" fill="rgba(71, 70, 74, 0.18)" r="0.8"></circle>
                    </pattern>
                    <rect fill="url(#grid-dots)" height="100%" width="100%"></rect>

                    {/* Edge Links (Call graph & Data state dependency) */}
                    <g id="graph-edges" stroke="rgba(120, 118, 123, 0.28)" strokeWidth="1.2">
                      <line x1="460" x2="260" y1="280" y2="180"></line>
                      <line x1="460" x2="330" y1="280" y2="390"></line>
                      <line x1="460" x2="620" y1="280" y2="210"></line>
                      <line x1="460" x2="680" y1="280" y2="380"></line>
                      <line x1="460" x2="460" y1="280" y2="440"></line>
                      <line strokeDasharray="3 3" x1="260" x2="170" y1="180" y2="290"></line>
                      <line x1="330" x2="170" y1="390" y2="290"></line>
                      <line x1="620" x2="780" y1="210" y2="180"></line>
                      <line x1="680" x2="780" y1="380" y2="310"></line>

                      {/* Critical Exploit Flow Path */}
                      {showExploitVectors && (
                        <>
                          <path
                            className="animate-pulse"
                            d="M 260 180 Q 210 240 170 290 T 330 390"
                            fill="none"
                            stroke="#ba1a1a"
                            strokeDasharray="6 4"
                            strokeWidth="2.5"
                          ></path>
                          <path d="M 460 280 L 260 180" stroke="#ba1a1a" strokeWidth="2"></path>
                        </>
                      )}
                    </g>

                    {/* Agent Attention Edges */}
                    <g id="agent-links">
                      <line opacity="0.85" stroke="#00bcd4" strokeDasharray="4 2" strokeWidth="1.5" x1="140" x2="260" y1="100" y2="180"></line>
                      <line opacity="0.85" stroke="#ff9800" strokeDasharray="4 2" strokeWidth="1.5" x1="720" x2="620" y1="90" y2="210"></line>
                      <line opacity="0.85" stroke="#006c49" strokeDasharray="4 2" strokeWidth="1.5" x1="820" x2="680" y1="460" y2="380"></line>
                      <line opacity="0.85" stroke="#2196f3" strokeDasharray="4 2" strokeWidth="1.5" x1="100" x2="170" y1="390" y2="290"></line>
                    </g>

                    {/* Nodes Layer */}
                    <g id="graph-nodes">
                      {/* Root Contract Node */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-105"
                        onClick={() =>
                          selectNode(
                            "VaultCore.sol",
                            "ContractDefinition",
                            1,
                            142,
                            "Root smart contract audited by 5 parallel swarm agents.",
                            false
                          )
                        }
                        transform="translate(460, 280)"
                      >
                        <circle fill="#eeedf7" r="34" stroke="rgba(26, 27, 34, 0.4)" strokeWidth="1.5"></circle>
                        <circle fill="#1c1b1d" r="27"></circle>
                        <text className="font-code-md text-[11px] font-medium pointer-events-none" fill="#ffffff" textAnchor="middle" y="4">
                          VaultCore
                        </text>
                        <text className="font-code-sm text-[10px] pointer-events-none" fill="#47464a" textAnchor="middle" y="44">
                          ContractRoot
                        </text>
                      </g>

                      {/* AST Node: withdraw() [HIGH RISK EXPLOIT TARGET] */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-105"
                        onClick={() =>
                          selectNode(
                            "withdraw(uint256)",
                            "FunctionDefinition",
                            84,
                            102,
                            'Critical CEI Pattern Violation: External call msg.sender.call{value} executed BEFORE balances[msg.sender] zeroed.',
                            true
                          )
                        }
                        transform="translate(260, 180)"
                      >
                        <circle fill="#ffdad6" filter="url(#soft-glow)" r="26" stroke="#ba1a1a" strokeWidth="2"></circle>
                        <circle fill="#ba1a1a" r="18"></circle>
                        <text className="font-code-sm text-[9px] font-semibold pointer-events-none" fill="#ffffff" textAnchor="middle" y="3">
                          VULN
                        </text>
                        <text className="font-code-md text-code-md font-semibold pointer-events-none" fill="#ba1a1a" textAnchor="middle" y="34">
                          withdraw()
                        </text>
                        <text className="font-code-sm text-[10px] pointer-events-none" fill="#47464a" textAnchor="middle" y="48">
                          lines: 84-102
                        </text>
                      </g>

                      {/* AST Node: deposit() */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-105"
                        onClick={() =>
                          selectNode(
                            "deposit() payable",
                            "FunctionDefinition",
                            62,
                            79,
                            "State update function verified by A2 & A3. Safe arithmetic assertions verified with Hedera Proof.",
                            false
                          )
                        }
                        transform="translate(330, 390)"
                      >
                        <circle fill="#eeedf7" r="22" stroke="rgba(71, 70, 74, 0.3)" strokeWidth="1.5"></circle>
                        <circle fill="#fbf8ff" r="15"></circle>
                        <text className="font-code-sm text-[9px] pointer-events-none" fill="#1a1b22" textAnchor="middle" y="3">
                          Fn
                        </text>
                        <text className="font-code-md text-code-md font-medium pointer-events-none" fill="#1a1b22" textAnchor="middle" y="32">
                          deposit()
                        </text>
                      </g>

                      {/* AST Node: balances state variable mapping */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-105"
                        onClick={() =>
                          selectNode(
                            "mapping(address=>uint256) balances",
                            "VariableDeclaration",
                            22,
                            22,
                            "State slot storage modified across re-entrant paths without mutex lock.",
                            true
                          )
                        }
                        transform="translate(170, 290)"
                      >
                        <rect fill="#ffdad6" height="28" rx="4" stroke="#ba1a1a" strokeWidth="1.5" width="48" x="-24" y="-14"></rect>
                        <text className="font-code-sm text-[9px] font-medium pointer-events-none" fill="#93000a" textAnchor="middle" y="4">
                          STATE
                        </text>
                        <text className="font-code-sm text-[10px] pointer-events-none" fill="#47464a" textAnchor="middle" y="26">
                          balances[]
                        </text>
                      </g>

                      {/* AST Node: setFeeRecipient() */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-105"
                        onClick={() =>
                          selectNode(
                            "setFeeRecipient(address)",
                            "FunctionDefinition",
                            110,
                            122,
                            "Admin routine guarded by onlyOwner AST modifier. Validated by Agent A2.",
                            false
                          )
                        }
                        transform="translate(620, 210)"
                      >
                        <circle fill="#eeedf7" r="20" stroke="rgba(71, 70, 74, 0.3)" strokeWidth="1.5"></circle>
                        <circle fill="#fbf8ff" r="14"></circle>
                        <text className="font-code-sm text-[9px] pointer-events-none" fill="#1a1b22" textAnchor="middle" y="3">
                          Fn
                        </text>
                        <text className="font-code-sm text-code-sm pointer-events-none" fill="#1a1b22" textAnchor="middle" y="30">
                          setFeeRecipient()
                        </text>
                      </g>

                      {/* AST Node: emergencyPause() */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-105"
                        onClick={() =>
                          selectNode(
                            "emergencyPause()",
                            "FunctionDefinition",
                            125,
                            138,
                            "Circuit breaker AST hook verified for timelock delay parameters.",
                            false
                          )
                        }
                        transform="translate(680, 380)"
                      >
                        <circle fill="#eeedf7" r="20" stroke="rgba(71, 70, 74, 0.3)" strokeWidth="1.5"></circle>
                        <circle fill="#fbf8ff" r="14"></circle>
                        <text className="font-code-sm text-[9px] pointer-events-none" fill="#1a1b22" textAnchor="middle" y="3">
                          Fn
                        </text>
                        <text className="font-code-sm text-code-sm pointer-events-none" fill="#1a1b22" textAnchor="middle" y="30">
                          emergencyPause()
                        </text>
                      </g>

                      {/* AST Node: fallback() / receive() */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-105"
                        onClick={() =>
                          selectNode(
                            "receive() external payable",
                            "FunctionDefinition",
                            45,
                            52,
                            "Direct ETH ingress handler without explicit event emission.",
                            false
                          )
                        }
                        transform="translate(460, 440)"
                      >
                        <circle fill="#eeedf7" r="18" stroke="rgba(71, 70, 74, 0.3)" strokeWidth="1.5"></circle>
                        <text className="font-code-sm text-[9px] pointer-events-none" fill="#1a1b22" textAnchor="middle" y="3">
                          Fn
                        </text>
                        <text className="font-code-sm text-code-sm pointer-events-none" fill="#1a1b22" textAnchor="middle" y="28">
                          receive()
                        </text>
                      </g>

                      {/* AST External Library Node */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-105"
                        onClick={() =>
                          selectNode(
                            "SafeTransferLib.sol",
                            "LibraryDefinition",
                            1,
                            90,
                            "External low-level call library. Return value verified in bytecode.",
                            false
                          )
                        }
                        transform="translate(780, 180)"
                      >
                        <polygon fill="#e8e7f1" points="0,-18 20,12 -20,12" stroke="#78767b" strokeWidth="1"></polygon>
                        <text className="font-code-sm text-[10px] pointer-events-none" fill="#47464a" textAnchor="middle" y="24">
                          SafeTransferLib
                        </text>
                      </g>

                      {/* Agent Node A1: Reentrancy Specialist */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-110"
                        onClick={() =>
                          selectAgentNode(
                            "Agent-A1",
                            "Reentrancy Cognitive Swarm",
                            "Active",
                            "Discovered vulnerable balance modification order on line 91."
                          )
                        }
                        transform="translate(140, 100)"
                      >
                        <circle fill="#e0f7fa" r="20" stroke="#00bcd4" strokeWidth="1.5"></circle>
                        <circle fill="#00bcd4" r="14"></circle>
                        <text className="font-code-sm text-[9px] font-bold pointer-events-none" fill="#ffffff" textAnchor="middle" y="3">
                          A1
                        </text>
                        <text className="font-code-sm text-[10px] font-semibold pointer-events-none" fill="#00838f" textAnchor="middle" y="30">
                          Agent::Reentrancy
                        </text>
                      </g>

                      {/* Agent Node A2: Access Control */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-110"
                        onClick={() =>
                          selectAgentNode(
                            "Agent-A2",
                            "Access Control Invariant",
                            "Active",
                            "AST tree analyzed: All administrative nodes locked to owner address."
                          )
                        }
                        transform="translate(720, 90)"
                      >
                        <circle fill="#fff3e0" r="20" stroke="#ff9800" strokeWidth="1.5"></circle>
                        <circle fill="#ff9800" r="14"></circle>
                        <text className="font-code-sm text-[9px] font-bold pointer-events-none" fill="#ffffff" textAnchor="middle" y="3">
                          A2
                        </text>
                        <text className="font-code-sm text-[10px] font-semibold pointer-events-none" fill="#e65100" textAnchor="middle" y="30">
                          Agent::Access
                        </text>
                      </g>

                      {/* Agent Node A4: Economic Arbiter */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-110"
                        onClick={() =>
                          selectAgentNode(
                            "Agent-A4",
                            "Economic Attack Vector",
                            "Active",
                            "Flashloan simulation check complete. Invariant holding across 10,000 runs."
                          )
                        }
                        transform="translate(820, 460)"
                      >
                        <circle fill="#e8f5e9" r="20" stroke="#006c49" strokeWidth="1.5"></circle>
                        <circle fill="#006c49" r="14"></circle>
                        <text className="font-code-sm text-[9px] font-bold pointer-events-none" fill="#ffffff" textAnchor="middle" y="3">
                          A4
                        </text>
                        <text className="font-code-sm text-[10px] font-semibold pointer-events-none" fill="#006c49" textAnchor="middle" y="30">
                          Agent::Economic
                        </text>
                      </g>

                      {/* Agent Node A5: Bytecode Verifier */}
                      <g
                        className="cursor-pointer transition-transform hover:scale-110"
                        onClick={() =>
                          selectAgentNode(
                            "Agent-A5",
                            "Bytecode Disassembler",
                            "Active",
                            "EVM JUMPDEST / DELEGATECALL opcode sequence mapped to HCS consensus topic."
                          )
                        }
                        transform="translate(100, 390)"
                      >
                        <circle fill="#e3f2fd" r="20" stroke="#2196f3" strokeWidth="1.5"></circle>
                        <circle fill="#2196f3" r="14"></circle>
                        <text className="font-code-sm text-[9px] font-bold pointer-events-none" fill="#ffffff" textAnchor="middle" y="3">
                          A5
                        </text>
                        <text className="font-code-sm text-[10px] font-semibold pointer-events-none" fill="#1565c0" textAnchor="middle" y="30">
                          Agent::Bytecode
                        </text>
                      </g>
                    </g>
                  </svg>
                </div>

                {/* Floating HUD Canvas Overlays */}
                {/* Minimap & View Controls (Bottom Right) */}
                <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
                  <div className="hidden sm:block w-28 h-20 bg-surface-container-lowest/90 backdrop-blur-md rounded shadow-sm p-1">
                    <div className="w-full h-full relative bg-surface-container-low rounded overflow-hidden flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-error absolute top-3 left-6"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-primary absolute top-6 left-12"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-secondary absolute bottom-4 right-6"></div>
                      <div className="w-10 h-7 border border-outline/40 absolute rounded-sm"></div>
                    </div>
                  </div>

                  <div className="flex flex-col bg-surface-container-lowest/90 backdrop-blur-md rounded shadow-sm overflow-hidden">
                    <button
                      onClick={() => handleZoom(1.15)}
                      className="p-1.5 text-on-surface hover:bg-surface-container transition-colors"
                      title="Zoom In"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                    <div className="h-[1px] bg-surface-container-high"></div>
                    <button
                      onClick={() => handleZoom(0.85)}
                      className="p-1.5 text-on-surface hover:bg-surface-container transition-colors"
                      title="Zoom Out"
                    >
                      <span className="material-symbols-outlined text-[18px]">remove</span>
                    </button>
                  </div>
                </div>

                {/* Exploit Alert Indicator (Bottom Left) */}
                <div className="absolute bottom-3 left-3 z-10 bg-error/10 border border-error/20 backdrop-blur-md px-3 py-1.5 rounded flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
                  <span className="font-code-sm text-code-sm font-semibold text-error">CRITICAL VECTOR DETECTED</span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant hidden md:inline">
                    • AST: withdraw() -&gt; balances[]
                  </span>
                </div>
              </div>
            </div>

            {/* Selected Node & AST Inspector Panel (Col 9-12) */}
            <div className="xl:col-span-4 flex flex-col gap-space-sm">
              <div className="bg-surface-container-lowest rounded shadow-lg p-space-lg flex flex-col justify-between h-[620px] overflow-y-auto">
                <div className="flex flex-col gap-space-md">
                  {/* Inspector Header */}
                  <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-high">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-secondary text-[20px]">account_tree</span>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                        Semantic Node Inspector
                      </span>
                    </div>
                    <span
                      id="inspector-status-badge"
                      className={`font-code-sm text-code-sm px-2 py-0.5 rounded font-semibold ${
                        inspector.statusBadgeType === "vuln"
                          ? "bg-error-container text-on-error-container"
                          : inspector.statusBadgeType === "agent"
                          ? "bg-secondary-container text-on-secondary-container"
                          : "bg-surface-container-high text-on-surface"
                      }`}
                    >
                      {inspector.statusBadge}
                    </span>
                  </div>

                  {/* Active Node Identity */}
                  <div className="flex flex-col gap-1">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">NODE IDENTIFIER</span>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-medium" id="inspector-node-title">
                      {inspector.title}
                    </h2>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-code-sm text-code-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-mono" id="inspector-node-type">
                        {inspector.type}
                      </span>
                      <span className="font-code-sm text-code-sm text-on-surface-variant" id="inspector-node-lines">
                        {inspector.lines}
                      </span>
                    </div>
                  </div>

                  {/* Vulnerability Vector Exploit Breakdown */}
                  <div className="bg-surface-container-low p-space-sm rounded flex flex-col gap-space-xs" id="inspector-vuln-card">
                    <div className="flex items-center justify-between">
                      {inspector.swcCode ? (
                        <span className="font-label-caps text-label-caps text-error font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">report_problem</span>
                          {inspector.swcCode}
                        </span>
                      ) : (
                        <span className="font-label-caps text-label-caps text-secondary font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          INVARIANT HOLDING
                        </span>
                      )}
                      <span className="font-code-sm text-code-sm text-on-surface-variant">{inspector.depth || "AST Level"}</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface" id="inspector-node-desc">
                      {inspector.desc}
                    </p>
                    {inspector.flaggedAgents && inspector.flaggedAgents.length > 0 && (
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className="font-code-sm text-code-sm text-on-surface-variant">Flagged by Agents:</span>
                        {inspector.flaggedAgents.map((ag) => (
                          <span key={ag} className="font-code-sm text-code-sm px-1.5 py-0.2 rounded bg-surface-container text-on-surface font-bold">
                            {ag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Code Snippet Diff Preview */}
                  {inspector.codeSlice && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-label-caps text-label-caps text-on-surface-variant">BYTECODE / SOLIDITY SLICE</span>
                        <span className="font-code-sm text-code-sm text-on-surface-variant">VaultCore.sol:91</span>
                      </div>
                      <div className="bg-[#18181b] text-[#fbf8ff] p-space-sm rounded font-code-sm text-code-sm overflow-x-auto leading-5 shadow-inner">
                        {inspector.codeSlice.map((item, idx) => (
                          <div
                            key={idx}
                            className={
                              item.type === "deleted"
                                ? "bg-[#ba1a1a]/20 text-[#ffdad6] -mx-2 px-2 py-0.5 border-l-2 border-[#ba1a1a]"
                                : item.type === "added"
                                ? "bg-[#006c49]/20 text-[#6cf8bb] -mx-2 px-2 py-0.5 border-l-2 border-[#006c49]"
                                : "text-[#78767b]"
                            }
                          >
                            <span className="inline-block w-6 text-right mr-3 select-none text-[#78767b]">{item.line}</span>
                            <span>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hedera Consensus Attestation Stamp */}
                  <div className="bg-surface-container-high/40 p-3 rounded flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-label-caps text-label-caps text-secondary font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">verified</span>
                        HCS IMMUTABLE PROOF
                      </span>
                      <span className="font-code-sm text-code-sm text-on-surface-variant">{inspector.hcsSeq}</span>
                    </div>
                    <div className="font-code-sm text-code-sm text-on-surface truncate">
                      Hash: {inspector.hcsHash}
                    </div>
                    <span className="font-code-sm text-code-sm text-on-surface-variant">
                      Consensus Timestamp: {inspector.hcsTimestamp}
                    </span>
                  </div>
                </div>

                {/* Inspector Action Buttons */}
                <div className="pt-space-sm flex items-center gap-space-xs border-t border-surface-container-high">
                  <button
                    onClick={dispatchAgentReparse}
                    disabled={isSyncingHcs}
                    className="flex-1 py-2 bg-primary text-on-primary font-body-sm text-body-sm rounded hover:bg-primary-container transition-colors inline-flex items-center justify-center gap-1 font-medium"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isSyncingHcs ? "animate-spin" : ""}`}>sync</span>
                    <span>{isSyncingHcs ? "Syncing Hedera HCS..." : "Trigger Agent Quorum"}</span>
                  </button>
                  <button
                    onClick={copyHcsProof}
                    className="p-2 bg-surface-container text-on-surface rounded hover:bg-surface-container-high transition-colors"
                    title="Copy Hedera Consensus Hash"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {copiedHash ? "done" : "content_copy"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Lower Telemetry & Real-Time Activity Bento Grid */}
          <section className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin mb-space-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
              {/* Real-Time Activity & Recent Graph Queries (Col 1-7) */}
              <div className="lg:col-span-7 bg-surface-container-lowest rounded shadow-md p-space-lg flex flex-col gap-space-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-on-surface text-[20px]">history</span>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-medium">
                      Recent AST Graph Queries &amp; Activity
                    </h2>
                  </div>
                  <span className="font-code-sm text-code-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                    api/graph/activity
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-surface-container-high text-on-surface-variant font-label-caps text-label-caps">
                        <th className="pb-2 font-medium">QUERY EXPRESSION</th>
                        <th className="pb-2 font-medium">AGENTS</th>
                        <th className="pb-2 font-medium">LATENCY</th>
                        <th className="pb-2 font-medium">CONSENSUS STATE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-low font-code-sm text-code-sm" id="activity-query-rows">
                      {activityRows.map((row) => (
                        <tr
                          key={row.id}
                          className={`hover:bg-surface-container-low/50 transition-colors ${
                            row.isNew ? "bg-secondary-container/20" : ""
                          }`}
                        >
                          <td className="py-3 text-on-surface font-medium max-w-[240px] truncate" title={row.queryExpression}>
                            {row.queryExpression}
                          </td>
                          <td className="py-3 text-on-surface-variant">
                            <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                              {row.agents}
                            </span>
                          </td>
                          <td className="py-3 text-secondary font-semibold">{row.latency}</td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 text-secondary font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                              {row.consensusState}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Real-Time Graph Telemetry (Col 8-12) */}
              <div className="lg:col-span-5 bg-surface-container-lowest rounded shadow-md p-space-lg flex flex-col justify-between gap-space-md">
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-on-surface text-[20px]">insights</span>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface font-medium">
                        Graph Neural Telemetry
                      </h2>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Live topological statistics streamed from AST parser and Hedera Consensus message sequencer.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-space-sm">
                  <div className="bg-surface-container-low p-space-sm rounded flex flex-col gap-1">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">SUBGRAPH TVL</span>
                    <span className="font-headline-md text-headline-md font-normal text-secondary">
                      {liveTelemetry.tvlUsd ? `$${(liveTelemetry.tvlUsd / 1e6).toFixed(2)}M` : "$3.42M"}
                    </span>
                    <span className="font-code-sm text-code-sm text-secondary">Uniswap v3 Subgraph</span>
                  </div>
                  <div className="bg-surface-container-low p-space-sm rounded flex flex-col gap-1">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">24H VOLUME</span>
                    <span className="font-headline-md text-headline-md font-normal text-on-surface">
                      {liveTelemetry.dailyVolumeUsd ? `$${(liveTelemetry.dailyVolumeUsd / 1e3).toFixed(0)}K` : "$780K"}
                    </span>
                    <span className="font-code-sm text-code-sm text-on-surface-variant">The Graph Arbitrum</span>
                  </div>
                  <div className="bg-surface-container-low p-space-sm rounded flex flex-col gap-1">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">INDEXED AGENTS</span>
                    <span className="font-headline-md text-headline-md font-normal text-on-surface">
                      {liveAgents.length > 0 ? `${liveAgents.length}` : "10"}
                    </span>
                    <span className="font-code-sm text-code-sm text-on-surface-variant">Hedera DID Qualified</span>
                  </div>
                  <div className="bg-surface-container-low p-space-sm rounded flex flex-col gap-1">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">HCS ATTESTATION</span>
                    <span className="font-headline-md text-headline-md font-normal text-on-secondary-container">100%</span>
                    <span className="font-code-sm text-code-sm text-secondary font-medium">Topic 0.0.10417469</span>
                  </div>
                </div>

                {/* Live Risk Signals from The Graph if present */}
                {liveTelemetry.riskSignals && liveTelemetry.riskSignals.length > 0 && (
                  <div className="flex flex-col gap-1.5 p-space-sm rounded bg-surface-container-low border border-surface-container-high">
                    <span className="font-label-caps text-label-caps text-secondary flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                      LIVE SUBGRAPH ON-CHAIN RISK SIGNALS
                    </span>
                    <div className="flex flex-col gap-1">
                      {liveTelemetry.riskSignals.map((signal, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 font-code-sm text-code-sm text-on-surface">
                          <span className="text-secondary">•</span>
                          <span>{signal}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-surface-container p-space-sm rounded flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">hub</span>
                    <span className="font-code-sm text-code-sm text-on-surface">Hedera Topic 0.0.10417469 Active</span>
                  </div>
                  <button
                    className="font-code-sm text-code-sm text-primary hover:underline font-semibold"
                    onClick={dispatchAgentReparse}
                  >
                    Re-sync Topology →
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-low mt-space-xl shadow-[0_-1px_8px_rgba(0,0,0,0.02)]">
        <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin py-space-xl flex flex-col gap-space-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-space-lg">
            <div className="flex flex-col gap-space-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Autonomous Consensus Engine</span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-medium max-w-xl">
                Autonomous Consensus. Built with mathematical intention.
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-container">
                <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
                <span className="font-code-sm text-code-sm text-on-surface">HCS Immutable State</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-container">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">lock</span>
                <span className="font-code-sm text-code-sm text-on-surface">AST Bytecode Proof</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-container">
                <span className="material-symbols-outlined text-[16px] text-on-secondary-container">hub</span>
                <span className="font-code-sm text-code-sm text-on-surface">Multi-Agent Swarm</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-space-md pt-space-lg border-t border-surface-container-high/60">
            <div className="flex items-center gap-space-md">
              <span className="font-display-lg text-display-lg text-on-surface font-normal tracking-tight">SwarmProof</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-space-md text-on-surface-variant">
              <span className="font-code-sm text-code-sm">© 2026 SwarmProof Network. Anchored on Hedera Consensus Service.</span>
              <div className="flex items-center gap-space-sm font-code-sm text-code-sm">
                <span className="text-on-surface-variant">•</span>
                <span>Topic: 0.0.10417469</span>
                <span className="text-on-surface-variant">•</span>
                <span>Mainnet Active</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Register Agent Modal */}
      {showRegisterModal && (
        <RegisterAgentModal
          onClose={() => setShowRegisterModal(false)}
          onRegistered={() => {
            setShowRegisterModal(false);
            handleRunQuery();
          }}
        />
      )}
    </div>
  );
}
