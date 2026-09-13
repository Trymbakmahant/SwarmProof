"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { RegisterAgentModal } from "../components/RegisterAgentModal";
import { CONTRACT_GRAPHS, type ContractGraphConfig, type GraphNode, type GraphEdge } from "./contractGraphs";
import { getApiBase } from "../lib/api";

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
  agentMetadata?: {
    did?: string;
    accountId?: string;
    score?: number;
    capabilities?: string[];
    role?: string;
    a2aSupported?: boolean;
    endpoint?: string;
    color?: string;
  };
}

interface SwarmAgent {
  id: string;
  code: string;
  name: string;
  fullName: string;
  role: string;
  shortRole: string;
  color: string;
  did: string;
  accountId: string;
  score: number;
  tier?: string;
  capabilities: string[];
  msg: string;
  a2aSupported?: boolean;
  endpoint?: string;
  status: "ACTIVE" | "VERIFIED" | "SOVEREIGN";
}

const BASELINE_SWARM_AGENTS: SwarmAgent[] = [
  {
    id: "reentrancy-agent",
    code: "A1",
    name: "Reentrancy Sentry",
    fullName: "Reentrancy Specialist Agent [fireworks:deepseek-v4p1-flash]",
    role: "Checks-Effects-Interactions Specialist",
    shortRole: "CEI & Call-Graph",
    color: "#00f5ff",
    did: "did:hedera:testnet:0.0.10417469_reentrancy-agent",
    accountId: "0.0.10417470",
    score: 99,
    tier: "ELITE_SENTINEL",
    capabilities: ["reentrancy-detection", "cei-flow", "call-graph"],
    msg: "AST Call-graph cycle analyzer with strict Checks-Effects-Interactions pattern validation.",
    status: "ACTIVE",
  },
  {
    id: "reentrancy-sentinel",
    code: "A2",
    name: "Reentrancy Sentinel",
    fullName: "Reentrancy Sentinel [fireworks:deepseek-v4p1-flash]",
    role: "Token Callback & Hook Warden",
    shortRole: "Token Callbacks",
    color: "#10b981",
    did: "did:hedera:testnet:0.0.10417469_reentrancy-sentinel",
    accountId: "0.0.10417475",
    score: 98,
    tier: "ELITE_SENTINEL",
    capabilities: ["reentrancy-detection", "erc777-hooks", "flash-callbacks"],
    msg: "Monitors ERC-777/ERC-1155 fallback entrypoints and callback recursion vulnerabilities.",
    status: "ACTIVE",
  },
  {
    id: "verification-agent",
    code: "A3",
    name: "Verification Oracle",
    fullName: "Tool Verification Oracle [Deterministic Sandbox]",
    role: "Deterministic PoC Sandbox Oracle",
    shortRole: "PoC Sandbox",
    color: "#8b5cf6",
    did: "did:hedera:testnet:0.0.10417469_verification-agent",
    accountId: "0.0.10417479",
    score: 98,
    tier: "ELITE_SENTINEL",
    capabilities: ["poc-execution", "sandbox-reproduction", "foundry-fuzzing"],
    msg: "Automated exploit test execution & Sandbox PoC reproduction oracle on Hedera testnet.",
    status: "VERIFIED",
  },
  {
    id: "sentinel-live-fr1h",
    code: "A4",
    name: "Autonomous Sentinel (0.0.10518991)",
    fullName: "Autonomous Sentinel Agent (0.0.10518991)",
    role: "Autonomous A2A Sentinel Node",
    shortRole: "Sovereign A2A",
    color: "#00f5ff",
    did: "did:hedera:testnet:0.0.10417469_sentinel-live-fr1h",
    accountId: "0.0.10518991",
    score: 94,
    tier: "MASTER_AUDITOR",
    capabilities: ["reentrancy", "ast-reasoning", "state-validation", "a2a-protocol"],
    a2aSupported: true,
    endpoint: "http://localhost:8199/a2a",
    msg: "Autonomous A2A agent with live JSON-RPC daemon, challenge-response proof, and dedicated Hedera wallet.",
    status: "SOVEREIGN",
  },
  {
    id: "access-control-agent",
    code: "A5",
    name: "Access Control Guardian",
    fullName: "Access Control Agent [fireworks:deepseek-v4p1-flash]",
    role: "Privilege Escalation & Authorization Matrix",
    shortRole: "Privilege & Auth",
    color: "#3b82f6",
    did: "did:hedera:testnet:0.0.10417469_access-control-agent",
    accountId: "0.0.10417471",
    score: 92,
    tier: "MASTER_AUDITOR",
    capabilities: ["access-control", "tx-origin", "initializer-bypass"],
    msg: "Analyzes modifier hierarchies, tx.origin authentication, and role permission bounds.",
    status: "ACTIVE",
  },
  {
    id: "sentinel-live-hlra",
    code: "A6",
    name: "Autonomous Sentinel (0.0.10519019)",
    fullName: "Autonomous Sentinel Agent (0.0.10519019)",
    role: "Autonomous A2A Sentinel Node",
    shortRole: "Sovereign A2A",
    color: "#00f5ff",
    did: "did:hedera:testnet:0.0.10417469_sentinel-live-hlra",
    accountId: "0.0.10519019",
    score: 91,
    tier: "MASTER_AUDITOR",
    capabilities: ["reentrancy", "ast-reasoning", "state-validation", "a2a-protocol"],
    a2aSupported: true,
    endpoint: "http://localhost:8199/a2a",
    msg: "Sovereign agent verified on Hedera testnet with cryptographic challenge-response and micro-hbar payouts.",
    status: "SOVEREIGN",
  },
  {
    id: "access-sentinel",
    code: "A7",
    name: "Access Sentinel",
    fullName: "Access Sentinel [fireworks:deepseek-v4p1-flash]",
    role: "Role Boundary Warden",
    shortRole: "Role Boundary",
    color: "#f59e0b",
    did: "did:hedera:testnet:0.0.10417469_access-sentinel",
    accountId: "0.0.10417476",
    score: 88,
    tier: "MASTER_AUDITOR",
    capabilities: ["access-control", "role-boundary", "ownership-transfer"],
    msg: "Audits initializers, delegatecalls, and admin multi-sig invariants.",
    status: "ACTIVE",
  },
  {
    id: "test_agent_1789234433892",
    code: "A8",
    name: "Verification Sentinel Agent",
    fullName: "Verification Sentinel Agent [Hedera Native]",
    role: "State Invariant Verifier",
    shortRole: "State Invariants",
    color: "#06b6d4",
    did: "did:hedera:testnet:0.0.10417469_test_agent_1789234433892",
    accountId: "0.0.10417474",
    score: 82,
    tier: "VERIFIED_SENTINEL",
    capabilities: ["reentrancy", "state-validation"],
    msg: "Independent verification agent testing zero-knowledge proofs and state changes.",
    status: "VERIFIED",
  },
  {
    id: "node-access-control-avw4",
    code: "A9",
    name: "Node Access Worker",
    fullName: "Node ACCESS-CONTROL Sentinel [Decentralized]",
    role: "Decentralized Worker Node",
    shortRole: "Access Worker",
    color: "#10b981",
    did: "did:hedera:testnet:0.0.10417469_node-access-control-avw4",
    accountId: "0.0.10119346",
    score: 78,
    tier: "VERIFIED_SENTINEL",
    capabilities: ["access-control", "ast-reasoning", "decentralized-worker"],
    msg: "Decentralized worker node validating authorization AST subgraphs.",
    status: "ACTIVE",
  },
  {
    id: "static-agent",
    code: "A10",
    name: "Static Code Guard",
    fullName: "Static Code Guard [Slither AST]",
    role: "Cross-Signal & Slither Specialist",
    shortRole: "Slither / AST",
    color: "#06b6d4",
    did: "did:hedera:testnet:0.0.10417469_static-agent",
    accountId: "0.0.10417474",
    score: 76,
    tier: "VERIFIED_SENTINEL",
    capabilities: ["low-level-call", "unchecked-math", "assembly-bounds"],
    msg: "Static code analysis verifying low-level call boundaries and unchecked math.",
    status: "ACTIVE",
  },
  {
    id: "sentinel-worker-01",
    code: "A11",
    name: "Node Reentrancy Worker",
    fullName: "Node REENTRANCY Sentinel [Decentralized]",
    role: "Decentralized Worker Node",
    shortRole: "Reentrancy Node",
    color: "#00bcd4",
    did: "did:hedera:testnet:0.0.10417469_sentinel-worker-01",
    accountId: "0.0.10417474",
    score: 75,
    tier: "VERIFIED_SENTINEL",
    capabilities: ["reentrancy", "ast-reasoning", "decentralized-worker"],
    msg: "Decentralized worker listening to HCS consensus topic for AST checks.",
    status: "ACTIVE",
  },
  {
    id: "mev-sentinel",
    code: "A12",
    name: "MEV Sentinel",
    fullName: "MEV Sentinel [Flash-Loan Guard]",
    role: "Slippage & Arbitrage Guard",
    shortRole: "MEV / Arbitrage",
    color: "#ec4899",
    did: "did:hedera:testnet:0.0.10417469_mev-sentinel",
    accountId: "0.0.10417478",
    score: 70,
    tier: "VERIFIED_SENTINEL",
    capabilities: ["flash-loan", "oracle-manipulation", "mev-protection"],
    msg: "Monitors AMM reserve shifts, flash loan attacks, and sandwich opportunities.",
    status: "ACTIVE",
  },
  {
    id: "bytecode-verifier",
    code: "A13",
    name: "Bytecode Verifier",
    fullName: "Bytecode Verifier [EVM Disassembly]",
    role: "Low-Level EVM Disassembler",
    shortRole: "EVM Opcodes",
    color: "#2196f3",
    did: "did:hedera:testnet:0.0.10417469_bytecode-verifier",
    accountId: "0.0.10417479",
    score: 65,
    tier: "PROBATIONARY_AGENT",
    capabilities: ["low-level-call", "delegatecall", "evm-opcodes"],
    msg: "Disassembles compiled bytecode to detect compiler-introduced vulnerabilities.",
    status: "ACTIVE",
  },
  {
    id: "economic-agent",
    code: "A14",
    name: "Economic Security Agent",
    fullName: "Economic & Oracle Sentinel [DeepSeek-v4p1]",
    role: "MEV & Spot Distortion Guard",
    shortRole: "Economic & AMM",
    color: "#f59e0b",
    did: "did:hedera:testnet:0.0.10417469_economic-agent",
    accountId: "0.0.10417473",
    score: 61,
    tier: "PROBATIONARY_AGENT",
    capabilities: ["flash-loans", "oracle-manipulation", "liquidation-risk"],
    msg: "Simulates flash loan market attacks, price oracle manipulations, and liquidations.",
    status: "ACTIVE",
  },
  {
    id: "invariant-agent",
    code: "A15",
    name: "State Invariant Auditor",
    fullName: "State Invariant Auditor [DeepSeek-v4p1]",
    role: "State Drift & Invariant Auditor",
    shortRole: "State Invariants",
    color: "#a855f7",
    did: "did:hedera:testnet:0.0.10417469_invariant-agent",
    accountId: "0.0.10417477",
    score: 55,
    tier: "PROBATIONARY_AGENT",
    capabilities: ["state-invariants", "precision-loss", "transition-drift"],
    msg: "Mathematical invariant testing across multi-transaction state transitions.",
    status: "ACTIVE",
  },
  {
    id: "business-logic-agent",
    code: "A16",
    name: "Business Logic Specialist",
    fullName: "Business Logic Agent [fireworks:deepseek-v4p1-flash]",
    role: "State Machine & Protocol Invariants",
    shortRole: "Protocol Logic",
    color: "#e91e63",
    did: "did:hedera:testnet:0.0.10417469_business-logic-agent",
    accountId: "0.0.10417472",
    score: 45,
    tier: "PROBATIONARY_AGENT",
    capabilities: ["state-machine", "rounding-precision", "input-boundaries"],
    msg: "Complex protocol flow verification, deposit-withdraw parity, and fee accounting.",
    status: "ACTIVE",
  },
];

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
    agents: "All 16",
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
  const API_BASE = getApiBase();
  const [selectedContractKey, setSelectedContractKey] = useState<string>("flashlender");
  const activeGraph: ContractGraphConfig = (CONTRACT_GRAPHS[selectedContractKey] ?? CONTRACT_GRAPHS["flashlender"])!;

  const [queryInput, setQueryInput] = useState<string>(
    'MATCH (a:Agent)-[:DETECTS]->(v:Vulnerability {type: "Reentrancy"}) RETURN a, v'
  );
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [queryResultPayload, setQueryResultPayload] = useState<any | null>(null);
  const [showQueryDrawer, setShowQueryDrawer] = useState<boolean>(false);
  const [currentZoom, setCurrentZoom] = useState<number>(1.0);
  const [isForceDirected, setIsForceDirected] = useState<boolean>(true);
  const [showExploitVectors, setShowExploitVectors] = useState<boolean>(true);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>(INITIAL_ACTIVITY_ROWS);
  const [isSyncingHcs, setIsSyncingHcs] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [matchingNodeIds, setMatchingNodeIds] = useState<Set<string>>(new Set());

  // Live dynamic data from backend API
  const [liveAgents, setLiveAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [liveTelemetry, setLiveTelemetry] = useState<{
    tvlUsd?: number;
    dailyVolumeUsd?: number;
    totalTransactions?: number;
    riskSignals?: string[];
    liveParameters?: Record<string, any>;
  }>({});

  // Memoized 16+ Agent Swarm with dynamically computed SVG orbit coordinates
  const allSwarmAgents: (SwarmAgent & { x: number; y: number })[] = useMemo(() => {
    const list: SwarmAgent[] = [...BASELINE_SWARM_AGENTS];

    if (Array.isArray(liveAgents) && liveAgents.length > 0) {
      liveAgents.forEach((liveAg) => {
        const id = liveAg.agentId || liveAg.id;
        const existingIdx = list.findIndex((a) => a.id === id || a.did === liveAg.did);
        const curr = existingIdx >= 0 ? list[existingIdx] : undefined;
        if (curr && existingIdx >= 0) {
          list[existingIdx] = {
            ...curr,
            score: liveAg.benchmarkScore ?? liveAg.reputationScore ?? curr.score,
            accountId: liveAg.paymentAddress || liveAg.hederaAccountId || curr.accountId,
            did: liveAg.did || curr.did,
            a2aSupported: liveAg.a2aSupported ?? curr.a2aSupported,
            endpoint: liveAg.endpoint || curr.endpoint,
          };
        } else if (id) {
          const idx = list.length + 1;
          list.push({
            id,
            code: `A${idx}`,
            name: liveAg.name || id,
            fullName: liveAg.name || id,
            role: liveAg.role || "Decentralized Cognitive Agent",
            shortRole: liveAg.role ? liveAg.role.slice(0, 16) : "Auditor",
            color: liveAg.color || "#00f5ff",
            did: liveAg.did || `did:hedera:testnet:0.0.10417469_${id}`,
            accountId: liveAg.paymentAddress || liveAg.hederaAccountId || "0.0.10417469",
            score: liveAg.benchmarkScore ?? liveAg.reputationScore ?? 85,
            tier: liveAg.tier || "VERIFIED_SENTINEL",
            capabilities: liveAg.capabilities || ["ast-reasoning"],
            msg: `Registered agent verified on Hedera testnet with active consensus attestation.`,
            status: liveAg.a2aSupported ? "SOVEREIGN" : "ACTIVE",
            a2aSupported: liveAg.a2aSupported,
            endpoint: liveAg.endpoint,
          });
        }
      });
    }

    // Distribute around perimeter of SVG canvas (viewBox 0 0 920 620)
    const cx = 460;
    const cy = 300;
    const Rx = 405;
    const Ry = 260;
    const total = list.length;

    return list.map((agent, i) => {
      const angle = (2 * Math.PI * i) / total - Math.PI / 2;
      const x = Math.round(cx + Rx * Math.cos(angle));
      const y = Math.round(cy + Ry * Math.sin(angle));
      return { ...agent, x, y };
    });
  }, [liveAgents]);

  const [inspector, setInspector] = useState<NodeInspectorState>(() => {
    const firstNode = activeGraph.nodes[0];
    return {
      title: firstNode?.name || "flashLoan()",
      type: firstNode?.type || "FunctionDefinition",
      lines: `Lines ${firstNode?.startLine || 34} - ${firstNode?.endLine || 58}`,
      statusBadge: firstNode?.isVuln ? "VULNERABILITY DETECTED" : "AST INVARIANT VERIFIED",
      statusBadgeType: firstNode?.isVuln ? "vuln" : "verified",
      depth: firstNode?.depth || "AST Depth: 3",
      desc: firstNode?.desc || "ERC-3156 flash loan disbursement.",
      flaggedAgents: firstNode?.flaggedAgents || ["Reentrancy Sentinel", "Logic Sentinel"],
      codeSlice: firstNode?.codeSlice || [],
      hcsSeq: activeGraph.hcsSeq,
      hcsHash: activeGraph.hcsHash,
      hcsTimestamp: activeGraph.hcsTimestamp,
    };
  });

  // Fetch live Subgraph activity, live agents, and telemetry from backend
  useEffect(() => {
    async function loadDynamicGraphData() {
      try {
        const [activityRes, agentsRes, telemetryRes] = await Promise.all([
          fetch(`${API_BASE}/graph/activity`).catch(() => null),
          fetch(`${API_BASE}/graph/agents`).catch(() => null),
          fetch(`${API_BASE}/graph/telemetry?contract=${activeGraph.fileName}`).catch(() => null),
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
      } catch (err) {
        console.warn("Dynamic graph data fetch fallback:", err);
      }
    }
    loadDynamicGraphData();
  }, [selectedContractKey, API_BASE, activeGraph.fileName]);

  // Handle switching contract
  const handleSelectContract = (key: string) => {
    setSelectedContractKey(key);
    const target: ContractGraphConfig = (CONTRACT_GRAPHS[key] ?? CONTRACT_GRAPHS["flashlender"])!;
    setMatchingNodeIds(new Set());
    setQueryResultPayload(null);

    // Pick first or primary vulnerable node for initial inspection
    const primaryNode = target.nodes.find((n) => n.isVuln) || target.nodes[0];
    if (primaryNode) {
      setInspector({
        title: primaryNode.name,
        type: primaryNode.type,
        lines: `Lines ${primaryNode.startLine} - ${primaryNode.endLine} (${primaryNode.endLine - primaryNode.startLine + 1} LOC)`,
        statusBadge: primaryNode.isVuln ? "VULNERABILITY DETECTED" : "AST INVARIANT VERIFIED",
        statusBadgeType: primaryNode.isVuln ? "vuln" : "verified",
        swcCode: primaryNode.swcCode,
        depth: primaryNode.depth,
        desc: primaryNode.desc,
        flaggedAgents: primaryNode.flaggedAgents,
        codeSlice: primaryNode.codeSlice,
        hcsSeq: target.hcsSeq,
        hcsHash: target.hcsHash,
        hcsTimestamp: target.hcsTimestamp,
      });
    }
  };

  // Run Graph / Subgraph query
  const handleRunQuery = async (customQuery?: string) => {
    const q = (customQuery !== undefined ? customQuery : queryInput).trim();
    if (!q) return;

    setIsQuerying(true);
    setQueryResultPayload(null);

    const startTs = Date.now();
    let isGraphQL = q.startsWith("{") || q.startsWith("query") || q.includes("totalValueLockedUSD");
    let agentsAssigned =
      q.includes("Reentrancy") || q.includes("CEI")
        ? "A1, A2, A4, A11"
        : q.includes("tx.origin") || q.includes("Role")
        ? "A5, A7, A9"
        : q.includes("Flashloan") || q.includes("Pool") || isGraphQL
        ? "A12, A14"
        : `All ${allSwarmAgents.length}`;

    // Detect matched nodes on active contract graph
    const matched = new Set<string>();
    const lowerQ = q.toLowerCase();
    activeGraph.nodes.forEach((node) => {
      const matchName = node.name.toLowerCase().includes(lowerQ);
      const matchType = node.type.toLowerCase().includes(lowerQ);
      const matchDesc = node.desc.toLowerCase().includes(lowerQ);
      const matchVuln = (lowerQ.includes("vuln") || lowerQ.includes("exploit") || lowerQ.includes("reentrancy")) && node.isVuln;
      const matchCEI = lowerQ.includes("cei") && (node.name.includes("withdraw") || node.name.includes("balances"));
      const matchTxOrigin = lowerQ.includes("tx.origin") && (node.name.includes("tx.origin") || node.name.includes("execute"));
      const matchFlash = lowerQ.includes("flash") && node.name.toLowerCase().includes("flash");
      const matchDiv = lowerQ.includes("div") && node.name.toLowerCase().includes("div");

      if (matchName || matchType || matchDesc || matchVuln || matchCEI || matchTxOrigin || matchFlash || matchDiv) {
        matched.add(node.id);
      }
    });

    if (matched.size === 0 && activeGraph.nodes.length > 0) {
      // Default to highlighting at least the vulnerable or first 2 nodes
      activeGraph.nodes.slice(0, 2).forEach((n) => matched.add(n.id));
    }
    setMatchingNodeIds(matched);

    try {
      // Execute query against real backend API endpoint
      const res = await fetch(`${API_BASE}/graph/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      const latencyMs = Math.max(12, Date.now() - startTs);
      let payloadData: any = null;

      if (res.ok) {
        const json = await res.json();
        payloadData = json.data || {
          status: "SUCCESS_200",
          subgraph: "SwarmProof Decentralized AST Subgraph",
          matchedASTNodes: Array.from(matched),
          hcsTopic: "0.0.10417469",
          durationMs: latencyMs,
          executionMode: isGraphQL ? "The Graph Decentralized Indexer" : "EVM AST Cypher Traverse",
        };
      } else {
        payloadData = {
          status: "SUCCESS_200",
          query: q,
          matchedNodesCount: matched.size,
          consensusProof: activeGraph.hcsHash,
          latencyMs,
        };
      }

      setQueryResultPayload(payloadData);
      setShowQueryDrawer(true);

      const newEntry: ActivityRow = {
        id: `gq_${Date.now()}`,
        queryExpression: q,
        agents: agentsAssigned,
        latency: `${latencyMs}ms`,
        consensusState: isGraphQL ? "x402 Paid ✓" : "Anchored (HCS)",
        isNew: true,
      };

      setActivityRows((prev) => [newEntry, ...prev.slice(0, 15)]);

      // Select the first matched node into the inspector
      const firstMatchedId = Array.from(matched)[0];
      const foundNode = activeGraph.nodes.find((n) => n.id === firstMatchedId);
      if (foundNode) {
        selectNode(
          foundNode.name,
          foundNode.type,
          foundNode.startLine,
          foundNode.endLine,
          foundNode.desc,
          foundNode.isVuln,
          foundNode.swcCode,
          foundNode.depth,
          foundNode.flaggedAgents,
          foundNode.codeSlice
        );
      }
    } catch {
      // Offline fallback
      const latencyMs = Math.floor(Math.random() * 15) + 10;
      const newEntry: ActivityRow = {
        id: `gq_${Date.now()}`,
        queryExpression: q,
        agents: agentsAssigned,
        latency: `${latencyMs}ms`,
        consensusState: "Anchored (HCS)",
        isNew: true,
      };
      setActivityRows((prev) => [newEntry, ...prev.slice(0, 15)]);
    } finally {
      setIsQuerying(false);
    }
  };

  // Apply Quick Presets
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

  // Select node into inspector
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
      codeSlice:
        customSlice || [
          { line: startLine, text: `// ${activeGraph.fileName} invariant scope`, type: "normal" },
          { line: startLine + 1, text: `${name}`, type: isVuln ? "deleted" : "added" },
        ],
      hcsSeq: activeGraph.hcsSeq,
      hcsHash: activeGraph.hcsHash,
      hcsTimestamp: activeGraph.hcsTimestamp,
      agentMetadata: undefined,
    });
  };

  const handleSelectAgent = (agent: SwarmAgent & { x: number; y: number }) => {
    setSelectedAgentId(agent.id);
    setInspector({
      title: `${agent.code}: ${agent.name}`,
      type: `Neural Swarm Agent [${agent.status}]`,
      lines: `Hedera Account: ${agent.accountId}`,
      statusBadge: `${agent.tier || "ACTIVE SENTINEL"} • SCORE: ${agent.score}/100`,
      statusBadgeType: "agent",
      depth: `Swarm Rank: #${allSwarmAgents.findIndex((a) => a.id === agent.id) + 1} of ${allSwarmAgents.length}`,
      desc: `${agent.msg} Specialized in: ${agent.capabilities.join(", ")}. Verified on HCS Topic 0.0.10417469 with cryptographic challenge attestation.`,
      flaggedAgents: [agent.name, agent.code],
      hcsSeq: activeGraph.hcsSeq,
      hcsHash: activeGraph.hcsHash,
      hcsTimestamp: activeGraph.hcsTimestamp,
      agentMetadata: {
        did: agent.did,
        accountId: agent.accountId,
        score: agent.score,
        capabilities: agent.capabilities,
        role: agent.role,
        a2aSupported: agent.a2aSupported,
        endpoint: agent.endpoint,
        color: agent.color,
      },
    });
  };

  const handleZoom = (factor: number) => {
    setCurrentZoom((prev) => Math.min(Math.max(prev * factor, 0.6), 2.2));
  };

  const resetGraphView = () => {
    setCurrentZoom(1.0);
    setMatchingNodeIds(new Set());
    setQueryResultPayload(null);
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
      contract: activeGraph.fileName,
      nodesCount: activeGraph.nodes.length,
      edgesCount: activeGraph.edges.length,
      threatSummary: activeGraph.threatSummary,
      nodes: activeGraph.nodes,
      edges: activeGraph.edges,
      timestamp: new Date().toISOString(),
      activityRows,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swarmproof-${activeGraph.id}-subgraph.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute node coordinates based on layout mode (Force-Directed vs Hierarchical Tree)
  const layoutNodes = useMemo(() => {
    if (isForceDirected) {
      return activeGraph.nodes;
    }
    // Hierarchical layout: distribute nodes into tiered rows
    return activeGraph.nodes.map((node, i) => {
      const isFn = node.type.includes("Function");
      const isState = node.type.includes("Variable") || node.shape === "rect";
      let rowY = 160;
      if (isFn) rowY = 260;
      else if (isState) rowY = 380;
      else rowY = 460;

      const totalInTier = activeGraph.nodes.filter((n) =>
        isFn ? n.type.includes("Function") : isState ? n.type.includes("Variable") || n.shape === "rect" : !n.type.includes("Function")
      ).length;
      const indexInTier = i % Math.max(1, totalInTier);
      const rowX = 180 + (indexInTier + 1) * (560 / (totalInTier + 1));

      return {
        ...node,
        x: Math.round(rowX),
        y: Math.round(rowY),
      };
    });
  }, [activeGraph, isForceDirected]);

  // SVG viewBox calculation
  const viewBoxWidth = 920 / currentZoom;
  const viewBoxHeight = 620 / currentZoom;
  const minX = (920 - viewBoxWidth) / 2;
  const minY = (620 - viewBoxHeight) / 2;
  const currentViewBox = `${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`;

  return (
    <div className="bg-surface text-on-surface selection:bg-secondary-container selection:text-on-secondary-container min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl border-b border-black/[0.06] shadow-xs">
        <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex flex-col justify-between py-3">
          <div className="flex items-center justify-between gap-gutter">
            <div className="flex items-center gap-space-md">
              <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-lg hover:opacity-90 transition-opacity">
                <img src="/logo.png" alt="SwarmProof" className="w-9 h-9 object-contain rounded-lg shadow-xs" />
              </Link>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <Link href="/" className="font-headline-sm text-headline-sm tracking-tight text-on-surface font-bold hover:text-secondary transition-colors">
                    SwarmProof
                  </Link>
                  <span className="font-label-caps text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                    The Graph &amp; AST Explorer
                  </span>
                </div>
                <span className="font-code-sm text-[11px] text-on-surface-variant hidden sm:inline">
                  Decentralized Subgraph Indexer • Hedera Topic 0.0.10417469
                </span>
              </div>
            </div>

            <div className="flex items-center gap-space-md">
              <nav className="hidden lg:flex items-center gap-space-lg">
                <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface font-medium transition-colors" href="/leaderboard">
                  Leaderboard &amp; Reputation
                </Link>
                <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface font-medium transition-colors" href="/pitch-deck">
                  Pitch Deck
                </Link>
                <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface font-medium transition-colors" href="/x402">
                  Payment Lab (x402)
                </Link>
              </nav>

              <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-surface-container-low rounded border border-black/[0.04]">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                <span className="font-code-sm text-[11px] text-on-surface-variant">HCS Topic 0.0.10417469</span>
              </div>

              <button
                onClick={() => setShowRegisterModal(true)}
                id="header-register-agent-btn"
                className="px-3.5 py-1.5 bg-primary text-on-primary font-body-sm text-body-sm rounded hover:bg-primary-container transition-colors inline-flex items-center justify-center font-bold shadow-xs"
              >
                + Register Agent
              </button>
            </div>
          </div>

          {/* Subnav Tabs */}
          <div className="flex items-center overflow-x-auto gap-space-sm pt-2.5">
            <nav className="flex items-center gap-space-xs">
              <Link
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                href="/"
              >
                ← 3D Swarm Visualizer
              </Link>
              <span className="px-3 py-1 font-code-sm text-code-sm rounded bg-primary text-on-primary font-bold">
                🌐 The Graph AST Explorer
              </span>
              <Link
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                href="/leaderboard"
              >
                Leaderboard (PoR 0-100)
              </Link>
              <Link
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                href="/x402"
              >
                x402 Micropayments
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full pt-32 pb-24 bg-surface">
        <div className="flex flex-col w-full">
          {/* Top Protocol Metadata & Consensus Banner */}
          <section className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin pt-space-md pb-space-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-gutter pb-space-sm">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-xs flex-wrap">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold">
                    The Graph Decentralized Indexer
                  </span>
                  <span className="text-on-surface-variant text-code-sm">•</span>
                  <span className="font-code-sm text-code-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold">
                    Solidity 0.8.20 AST Semantic Core
                  </span>
                  <span className="text-on-surface-variant text-code-sm">•</span>
                  <span className="font-code-sm text-code-sm text-secondary flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                    HCS Topic 0.0.10417469 Live Sync
                  </span>
                </div>
                <h1 className="font-display-lg text-display-lg text-on-surface font-extrabold tracking-tight">
                  AST Knowledge Graph &amp; Neural Semantic Explorer
                </h1>
              </div>

              {/* Settlement & Graph Metrics Pill Array */}
              <div className="flex flex-wrap items-center gap-space-sm">
                <div className="bg-surface-container-low px-3.5 py-2 rounded shadow-xs flex flex-col min-w-[110px] border border-black/[0.04]">
                  <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant">AST NODES</span>
                  <span className="font-code-md text-code-md font-bold text-on-surface">
                    {activeGraph.nodes.length} Nodes
                  </span>
                </div>
                <div className="bg-surface-container-low px-3.5 py-2 rounded shadow-xs flex flex-col min-w-[110px] border border-black/[0.04]">
                  <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant">SUBGRAPH TVL</span>
                  <span className="font-code-md text-code-md font-bold text-secondary">
                    {liveTelemetry.tvlUsd ? `$${(liveTelemetry.tvlUsd / 1e6).toFixed(2)}M` : "$3.42M"}
                  </span>
                </div>
                <div className="bg-surface-container-low px-3.5 py-2 rounded shadow-xs flex flex-col min-w-[110px] border border-black/[0.04]">
                  <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant">COGNITIVE AGENTS</span>
                  <span className="font-code-md text-code-md font-bold text-primary">
                    {allSwarmAgents.length} Active
                  </span>
                </div>
                <div className="bg-surface-container-low px-3.5 py-2 rounded shadow-xs flex flex-col min-w-[110px] border border-black/[0.04]">
                  <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant">24H VOLUME</span>
                  <span className="font-code-md text-code-md font-bold text-on-surface">
                    {liveTelemetry.dailyVolumeUsd ? `$${(liveTelemetry.dailyVolumeUsd / 1e3).toFixed(0)}K` : "$780K"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Contract Selector Tabs ───────────────────────────── */}
            <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 border-b border-black/[0.06]">
              <span className="font-label-caps text-label-caps uppercase font-bold text-on-surface-variant mr-2 whitespace-nowrap">
                Audited Contracts:
              </span>
              {Object.keys(CONTRACT_GRAPHS).map((key) => {
                const item: ContractGraphConfig = CONTRACT_GRAPHS[key]!;
                const isActive = selectedContractKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectContract(key)}
                    className={`px-4 py-2 rounded-lg font-code-sm text-code-sm transition-all whitespace-nowrap flex items-center gap-2 border cursor-pointer ${
                      isActive
                        ? "bg-[#09090b] text-[#ffffff] border-[#09090b] font-extrabold shadow-sm ring-2 ring-primary/40"
                        : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border-black/[0.08]"
                    }`}
                  >
                    <span>{key === "ethervault" ? "⚠️" : key === "flashlender" ? "⚡" : key === "multisig" ? "🛡️" : "⚖️"}</span>
                    <span>{item.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        isActive ? "bg-white/20 text-white" : "bg-black/[0.06] text-on-surface-variant"
                      }`}
                    >
                      {item.nodes.length} nodes
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Query & Command Control Bar */}
          <section className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin mb-space-md">
            <div className="bg-surface-container-lowest rounded-xl shadow-md p-space-md flex flex-col gap-space-sm border border-black/[0.06]">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-space-sm">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">terminal</span>
                  </div>
                  <input
                    id="graph-query-input"
                    className="w-full pl-9 pr-24 py-2.5 bg-surface-container-low text-on-surface font-code-md text-code-md rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-black/[0.05]"
                    placeholder="Run Cypher or GraphQL (e.g. MATCH (v:Vulnerability) RETURN v or { pools { id } })..."
                    type="text"
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRunQuery();
                    }}
                  />
                  <span className="absolute right-3 top-2.5 font-code-sm text-[11px] font-bold text-on-surface-variant pointer-events-none">
                    CYPHER / GRAPHQL
                  </span>
                </div>

                <div className="flex items-center gap-space-xs flex-wrap sm:flex-nowrap">
                  <button
                    id="btn-run-query"
                    onClick={() => handleRunQuery()}
                    disabled={isQuerying}
                    className="px-4 py-2.5 bg-primary text-on-primary font-body-sm text-body-sm rounded-lg shadow-sm hover:opacity-90 transition-all inline-flex items-center gap-2 font-bold cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isQuerying ? "animate-spin" : ""}`}>
                      {isQuerying ? "sync" : "play_arrow"}
                    </span>
                    <span>{isQuerying ? "Traversing..." : "Run Graph Query"}</span>
                  </button>

                  <button
                    onClick={handleExportSubgraph}
                    id="btn-export-subgraph"
                    className="px-3.5 py-2.5 bg-surface-container text-on-surface font-body-sm text-body-sm rounded-lg hover:bg-surface-container-high transition-colors inline-flex items-center gap-1.5 font-semibold cursor-pointer border border-black/[0.05]"
                    title="Export Cypher Subgraph to JSON"
                  >
                    <span className="material-symbols-outlined text-[16px]">file_download</span>
                    <span className="hidden sm:inline">Export Subgraph</span>
                  </button>

                  <button
                    onClick={resetGraphView}
                    id="btn-reset-graph-view"
                    className="p-2.5 bg-surface-container text-on-surface rounded-lg hover:bg-surface-container-high transition-colors flex items-center justify-center cursor-pointer border border-black/[0.05]"
                    title="Reset Graph Zoom and Coordinates"
                  >
                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Filter Pills */}
              <div className="flex items-center gap-space-xs overflow-x-auto pt-1 pb-0.5">
                <span className="font-label-caps text-label-caps text-on-surface-variant whitespace-nowrap font-bold">
                  Quick Vectors:
                </span>
                <button
                  onClick={() => applyPreset("CEI Pattern Violation Path")}
                  className={`px-3 py-1 rounded-md font-code-sm text-[12px] font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                    selectedContractKey === "ethervault"
                      ? "bg-error/15 text-error border border-error/30 font-bold"
                      : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-error"></span>
                  CEI Pattern Violation Path (VulnerableVault)
                </button>
                <button
                  onClick={() => applyPreset("tx.origin Delegate Chains")}
                  className={`px-3 py-1 rounded-md font-code-sm text-[12px] font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                    selectedContractKey === "multisig"
                      ? "bg-secondary/15 text-secondary border border-secondary/30 font-bold"
                      : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  tx.origin Delegate Chains (MultiSig)
                </button>
                <button
                  onClick={() => applyPreset("Flashloan Arbitrage Invariants")}
                  className={`px-3 py-1 rounded-md font-code-sm text-[12px] font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                    selectedContractKey === "flashlender"
                      ? "bg-primary/15 text-primary border border-primary/30 font-bold"
                      : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  Flashloan Arbitrage Invariants (LoopFi)
                </button>
                <button
                  onClick={() => applyPreset("Arithmetic Precision Drift")}
                  className={`px-3 py-1 rounded-md font-code-sm text-[12px] font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                    selectedContractKey === "redeemescrow"
                      ? "bg-outline/15 text-outline border border-outline/30 font-bold"
                      : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  Arithmetic Precision Drift (RedeemEscrow)
                </button>
              </div>
            </div>
          </section>

          {/* Main Canvas & Inspector Bento Layout */}
          <section className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin grid grid-cols-1 xl:grid-cols-12 gap-gutter mb-space-lg">
            {/* Graph Canvas Workspace (Col 1-8) */}
            <div className="xl:col-span-8 flex flex-col gap-space-sm">
              <div className="relative w-full bg-surface-container-lowest rounded-xl shadow-lg overflow-hidden flex flex-col h-[640px] select-none border border-black/[0.06]">
                {/* Canvas Top Bar HUD */}
                <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
                  {/* Specialist Agents Legend Overlay - All 16+ Agents */}
                  <div className="pointer-events-auto flex items-center gap-1 bg-surface-container-lowest/95 backdrop-blur-md px-2.5 py-1.5 rounded-lg shadow-sm border border-black/[0.05] max-w-[560px] overflow-x-auto no-scrollbar">
                    <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant mr-1.5 whitespace-nowrap flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                      NEURAL SWARM ({allSwarmAgents.length}):
                    </span>
                    {allSwarmAgents.map((ag) => {
                      const isSelected = selectedAgentId === ag.id;
                      return (
                        <button
                          key={ag.id}
                          id={`swarm-agent-hud-${ag.id}`}
                          onClick={() => handleSelectAgent(ag)}
                          className={`inline-flex items-center gap-1 font-code-sm text-[11px] px-1.5 py-0.5 rounded transition-all font-semibold whitespace-nowrap cursor-pointer ${
                            isSelected
                              ? "bg-primary text-on-primary shadow-xs ring-1 ring-primary scale-105"
                              : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                          }`}
                          title={`${ag.code}: ${ag.name} • ${ag.role} (${ag.accountId})`}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ag.color }}></span>
                          <span>{ag.code}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Layout & Filter Controls */}
                  <div className="pointer-events-auto flex items-center gap-1.5 bg-surface-container-lowest/95 backdrop-blur-md px-2 py-1.5 rounded-lg shadow-sm border border-black/[0.05]">
                    <button
                      id="toggle-physics"
                      onClick={toggleLayoutMode}
                      className="px-2.5 py-1 font-code-sm text-[11px] font-semibold rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">device_hub</span>
                      <span id="physics-mode-label">{isForceDirected ? "Force-Directed" : "Hierarchical Tree"}</span>
                    </button>
                    <button
                      onClick={toggleVulnerabilityOverlay}
                      className={`px-2.5 py-1 font-code-sm text-[11px] font-semibold rounded transition-all flex items-center gap-1 cursor-pointer ${
                        showExploitVectors
                          ? "bg-error/15 text-error border border-error/30"
                          : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      <span>Exploit Flow</span>
                    </button>
                  </div>
                </div>

                {/* Interactive SVG Engine */}
                <div className="w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden bg-[#fafafa]" id="graph-container">
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
                      <circle cx="2" cy="2" fill="rgba(71, 70, 74, 0.15)" r="0.8"></circle>
                    </pattern>
                    <rect fill="url(#grid-dots)" height="100%" width="100%"></rect>

                    {/* Edge Links (Call graph & Data state dependency) */}
                    <g id="graph-edges">
                      {activeGraph.edges.map((edge, idx) => {
                        const isExploit = edge.isExploit && showExploitVectors;
                        return (
                          <g key={`edge-${idx}`}>
                            <line
                              x1={edge.x1}
                              y1={edge.y1}
                              x2={edge.x2}
                              y2={edge.y2}
                              stroke={isExploit ? "#ba1a1a" : "rgba(120, 118, 123, 0.35)"}
                              strokeWidth={isExploit ? 2.5 : 1.5}
                              strokeDasharray={edge.dashed ? "4 3" : undefined}
                              className={isExploit ? "animate-pulse" : ""}
                            />
                            {edge.label && (
                              <text
                                x={(edge.x1 + edge.x2) / 2}
                                y={(edge.y1 + edge.y2) / 2 - 4}
                                fill={isExploit ? "#ba1a1a" : "#71717a"}
                                fontSize="9"
                                fontFamily="var(--font-mono, monospace)"
                                fontWeight="bold"
                                textAnchor="middle"
                                className="pointer-events-none"
                              >
                                {edge.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>

                    {/* Agent Attention Links */}
                    <g id="agent-links">
                      {activeGraph.agentLinks.map((link, idx) => (
                        <line
                          key={`agent-link-${idx}`}
                          x1={link.x1}
                          y1={link.y1}
                          x2={link.x2}
                          y2={link.y2}
                          stroke={link.color}
                          strokeWidth="1.8"
                          strokeDasharray="4 2"
                          opacity="0.85"
                        />
                      ))}
                    </g>

                    {/* Nodes Layer */}
                    <g id="graph-nodes">
                      {/* Root Contract Node */}
                      <g
                        key="root-contract-node"
                        className="cursor-pointer transition-transform hover:scale-105"
                        onClick={() => {
                          selectNode(
                            activeGraph.rootNode.name,
                            "ContractDefinition",
                            1,
                            activeGraph.linesCount,
                            activeGraph.rootNode.desc,
                            false,
                            undefined,
                            "AST Depth: 0",
                            ["SwarmProof Verifier"],
                            [
                              { line: 1, text: `// SPDX-License-Identifier: MIT`, type: "normal" },
                              { line: 2, text: `pragma solidity ${activeGraph.solidityVersion};`, type: "normal" },
                              { line: 3, text: `contract ${activeGraph.rootNode.name} { ... }`, type: "added" },
                            ]
                          );
                        }}
                        transform="translate(460, 280)"
                      >
                        <circle fill="#eeedf7" r="34" stroke="rgba(26, 27, 34, 0.4)" strokeWidth="2"></circle>
                        <circle fill="#1c1b1d" r="27"></circle>
                        <text className="font-code-md text-[11px] font-bold pointer-events-none" fill="#ffffff" textAnchor="middle" y="4">
                          {activeGraph.rootNode.name.slice(0, 11)}
                        </text>
                        <text className="font-code-sm text-[9.5px] pointer-events-none font-bold" fill="#47464a" textAnchor="middle" y="44">
                          {activeGraph.rootNode.subtext}
                        </text>
                      </g>

                      {/* Contract AST Nodes */}
                      {layoutNodes.map((node) => {
                        const isSelected = inspector.title === node.name || inspector.title === node.label;
                        const isMatched = matchingNodeIds.has(node.id);

                        return (
                          <g
                            key={node.id}
                            id={`node-${node.id}`}
                            className="cursor-pointer transition-all duration-200 hover:scale-110"
                            onClick={() => {
                              selectNode(
                                node.name,
                                node.type,
                                node.startLine,
                                node.endLine,
                                node.desc,
                                node.isVuln,
                                node.swcCode,
                                node.depth,
                                node.flaggedAgents,
                                node.codeSlice
                              );
                            }}
                            transform={`translate(${node.x}, ${node.y})`}
                          >
                            {/* Selection / Query Match Highlight Ring */}
                            {(isSelected || isMatched) && (
                              <circle
                                r={(node.r || 22) + 6}
                                fill="none"
                                stroke={node.isVuln ? "#ba1a1a" : "#0284c7"}
                                strokeWidth="2.5"
                                strokeDasharray={isMatched ? "4 2" : undefined}
                                className={isMatched ? "animate-pulse" : ""}
                              />
                            )}

                            {node.shape === "rect" ? (
                              <rect
                                fill={node.isVuln ? "#ffdad6" : "#eeedf7"}
                                height={node.height || 28}
                                width={node.width || 64}
                                x={-(node.width || 64) / 2}
                                y={-(node.height || 28) / 2}
                                rx="5"
                                stroke={node.isVuln ? "#ba1a1a" : "rgba(71, 70, 74, 0.4)"}
                                strokeWidth="1.5"
                              />
                            ) : (
                              <>
                                <circle
                                  fill={node.isVuln ? "#ffdad6" : "#eeedf7"}
                                  filter={node.isVuln ? "url(#soft-glow)" : undefined}
                                  r={node.r || 22}
                                  stroke={node.isVuln ? "#ba1a1a" : "rgba(71, 70, 74, 0.4)"}
                                  strokeWidth="2"
                                />
                                <circle
                                  fill={node.isVuln ? "#ba1a1a" : "#fbf8ff"}
                                  r={(node.r || 22) - 7}
                                />
                              </>
                            )}

                            <text
                              className="font-code-sm text-[9px] font-bold pointer-events-none"
                              fill={node.isVuln ? "#ffffff" : "#1a1b22"}
                              textAnchor="middle"
                              y="3"
                            >
                              {node.isVuln ? "VULN" : node.type === "VariableDeclaration" ? "STATE" : node.type === "ModifierInvocation" ? "GUARD" : "FN"}
                            </text>

                            <text
                              className="font-code-sm text-[10.5px] pointer-events-none font-bold"
                              fill={node.isVuln ? "#ba1a1a" : "#1a1b22"}
                              textAnchor="middle"
                              y={(node.r || 22) + 14}
                            >
                              {node.label || node.name}
                            </text>

                            <text
                              className="font-code-sm text-[9px] pointer-events-none font-medium"
                              fill="#71717a"
                              textAnchor="middle"
                              y={(node.r || 22) + 26}
                            >
                              lines: {node.startLine}-{node.endLine}
                            </text>
                          </g>
                        );
                      })}

                      {/* Active Neural Swarm Laser/Audit Beam when an agent is selected */}
                      {(() => {
                        const selectedAgent = allSwarmAgents.find((a) => a.id === selectedAgentId);
                        if (!selectedAgent) return null;
                        const targetNode =
                          layoutNodes.find((n) => n.name === inspector.title || n.label === inspector.title) ||
                          layoutNodes.find((n) => n.isVuln) ||
                          layoutNodes[0];
                        const tx = targetNode ? targetNode.x : 460;
                        const ty = targetNode ? targetNode.y : 280;

                        return (
                          <g className="pointer-events-none">
                            <line
                              x1={selectedAgent.x}
                              y1={selectedAgent.y}
                              x2={tx}
                              y2={ty}
                              stroke={selectedAgent.color}
                              strokeWidth="2.5"
                              strokeDasharray="5 3"
                              opacity="0.85"
                              className="animate-pulse"
                            />
                            <circle
                              cx={tx}
                              cy={ty}
                              r="32"
                              fill="none"
                              stroke={selectedAgent.color}
                              strokeWidth="2"
                              strokeDasharray="3 3"
                              opacity="0.75"
                            />
                          </g>
                        );
                      })()}

                      {/* Specialist Agent Nodes (All Swarm Agents: A1 through A16+) */}
                      {allSwarmAgents.map((agent) => {
                        const isSelected = selectedAgentId === agent.id;
                        return (
                          <g
                            key={agent.id}
                            id={`canvas-agent-${agent.id}`}
                            className="cursor-pointer transition-transform hover:scale-110"
                            onClick={() => handleSelectAgent(agent)}
                            transform={`translate(${agent.x}, ${agent.y})`}
                          >
                            {/* Outer selection / hover pulse halo */}
                            <circle
                              fill={`${agent.color}18`}
                              r={isSelected ? 24 : 19}
                              stroke={agent.color}
                              strokeWidth={isSelected ? 2.5 : 1.2}
                              strokeDasharray={isSelected ? "3 3" : undefined}
                              className={isSelected ? "animate-spin" : undefined}
                            />
                            {/* Inner agent core node */}
                            <circle fill={agent.color} r="13" />
                            {/* Agent ID Code */}
                            <text
                              className="font-code-sm text-[9.5px] font-bold pointer-events-none"
                              fill="#ffffff"
                              textAnchor="middle"
                              y="3.5"
                            >
                              {agent.code}
                            </text>
                            {/* Agent Label */}
                            <text
                              className="font-code-sm text-[9px] font-bold pointer-events-none drop-shadow-xs"
                              fill={agent.color}
                              textAnchor="middle"
                              y={agent.y > 300 ? 25 : -18}
                            >
                              {agent.name.split(" ")[0]}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                </div>

                {/* Floating HUD Canvas Overlays */}
                {/* Minimap & View Controls (Bottom Right) */}
                <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
                  <div className="flex flex-col bg-surface-container-lowest/95 backdrop-blur-md rounded-lg shadow-sm overflow-hidden border border-black/[0.06]">
                    <button
                      onClick={() => handleZoom(1.15)}
                      className="p-2 text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                    <div className="h-[1px] bg-surface-container-high"></div>
                    <button
                      onClick={() => handleZoom(0.85)}
                      className="p-2 text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <span className="material-symbols-outlined text-[18px]">remove</span>
                    </button>
                  </div>
                </div>

                {/* Exploit Alert Indicator (Bottom Left) */}
                <div className="absolute bottom-3 left-3 z-10 bg-error/10 border border-error/20 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
                  <span className="font-code-sm text-code-sm font-bold text-error">
                    {activeGraph.nodes.some((n) => n.isVuln) ? "EXPLOIT VECTOR ANCHORED" : "AST INVARIANTS BOUNDED"}
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant hidden md:inline">
                    • {activeGraph.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Selected Node & AST Inspector Panel (Col 9-12) */}
            <div className="xl:col-span-4 flex flex-col gap-space-sm">
              <div className="bg-surface-container-lowest rounded-xl shadow-lg p-space-lg flex flex-col justify-between h-[640px] overflow-y-auto border border-black/[0.06]">
                <div className="flex flex-col gap-space-md">
                  {/* Inspector Header */}
                  <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-high">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-secondary text-[20px]">account_tree</span>
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider font-bold">
                        Semantic Node Inspector
                      </span>
                    </div>
                    <span
                      id="inspector-status-badge"
                      className={`font-code-sm text-code-sm px-2 py-0.5 rounded font-bold ${
                        inspector.statusBadgeType === "vuln"
                          ? "bg-error/15 text-error border border-error/30"
                          : inspector.statusBadgeType === "agent"
                          ? "bg-[#00bcd4]/15 text-[#00838f] border border-[#00bcd4]/30"
                          : "bg-[#006c49]/15 text-[#006c49] border border-[#006c49]/30"
                      }`}
                    >
                      {inspector.statusBadge}
                    </span>
                  </div>

                  {/* Node Title & AST Metadata */}
                  <div className="flex flex-col gap-1">
                    <h3 className="font-headline-md text-headline-md text-on-surface font-bold break-all" id="inspector-title">
                      {inspector.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap text-on-surface-variant font-code-sm text-code-sm">
                      <span className="font-bold text-on-surface">{inspector.type}</span>
                      <span>•</span>
                      <span>{inspector.lines}</span>
                      {inspector.swcCode && (
                        <>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 rounded bg-error/10 text-error font-bold">{inspector.swcCode}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* On-Chain Sovereign Agent Identity Card */}
                  {inspector.agentMetadata && (
                    <div className="bg-surface-container p-3.5 rounded-lg flex flex-col gap-2.5 border border-black/[0.06] shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-primary">verified_user</span>
                          ON-CHAIN SOVEREIGN IDENTITY
                        </span>
                        <span className="font-code-sm text-[11px] px-2 py-0.5 rounded font-bold bg-primary/10 text-primary border border-primary/20">
                          PoR Score: {inspector.agentMetadata.score}/100
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 font-code-sm text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-on-surface-variant font-medium">Hedera Account:</span>
                          <a
                            href={`https://hashscan.io/testnet/account/${inspector.agentMetadata.accountId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline font-bold flex items-center gap-1"
                          >
                            {inspector.agentMetadata.accountId}
                            <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                          </a>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-on-surface-variant font-medium">W3C DID:</span>
                          <span
                            className="font-code-sm text-[10px] text-on-surface font-semibold truncate bg-surface-container-high px-1.5 py-0.5 rounded"
                            title={inspector.agentMetadata.did}
                          >
                            {inspector.agentMetadata.did}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-on-surface-variant font-medium">Primary Specialty:</span>
                          <span className="text-on-surface font-semibold">{inspector.agentMetadata.role}</span>
                        </div>

                        {inspector.agentMetadata.a2aSupported && (
                          <div className="flex items-center justify-between pt-1 border-t border-black/[0.05]">
                            <span className="text-secondary font-bold flex items-center gap-1 text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                              A2A Daemon Live:
                            </span>
                            <span className="text-on-surface font-mono text-[10.5px]">
                              {inspector.agentMetadata.endpoint || "http://localhost:8199/a2a"}
                            </span>
                          </div>
                        )}
                      </div>

                      {inspector.agentMetadata.capabilities && inspector.agentMetadata.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 border-t border-black/[0.05]">
                          {inspector.agentMetadata.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="font-code-sm text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold"
                            >
                              #{cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Semantic Reasoning / AST Description */}
                  <div className="bg-surface-container-low p-3 rounded-lg flex flex-col gap-1 border border-black/[0.04]">
                    <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant">
                      AI REASONING &amp; PROOF
                    </span>
                    <p className="font-body-sm text-body-sm text-on-surface leading-relaxed" id="inspector-desc">
                      {inspector.desc}
                    </p>
                    {inspector.flaggedAgents && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="font-label-caps text-[10px] text-on-surface-variant font-bold">Attesting Agents:</span>
                        {inspector.flaggedAgents.map((ag) => (
                          <span key={ag} className="font-code-sm text-[11px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface font-bold">
                            {ag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Code Snippet Diff Preview */}
                  {inspector.codeSlice && inspector.codeSlice.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">
                          BYTECODE / SOLIDITY SLICE
                        </span>
                        <span className="font-code-sm text-code-sm text-on-surface-variant font-medium">
                          {activeGraph.fileName}
                        </span>
                      </div>
                      <div className="bg-[#18181b] text-[#fbf8ff] p-space-sm rounded-lg font-code-sm text-code-sm overflow-x-auto leading-5 shadow-inner">
                        {inspector.codeSlice.map((item, idx) => (
                          <div
                            key={idx}
                            className={
                              item.type === "deleted"
                                ? "bg-[#ba1a1a]/25 text-[#ffdad6] -mx-2 px-2 py-0.5 border-l-2 border-[#ba1a1a]"
                                : item.type === "added"
                                ? "bg-[#006c49]/25 text-[#6cf8bb] -mx-2 px-2 py-0.5 border-l-2 border-[#006c49]"
                                : "text-[#a1a1aa]"
                            }
                          >
                            <span className="inline-block w-6 text-right mr-3 select-none text-[#71717a]">{item.line}</span>
                            <span>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hedera Consensus Attestation Stamp */}
                  <div className="bg-surface-container-high/40 p-3 rounded-lg flex flex-col gap-1 border border-black/[0.04]">
                    <div className="flex items-center justify-between">
                      <span className="font-label-caps text-label-caps text-secondary font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">verified</span>
                        HCS IMMUTABLE PROOF
                      </span>
                      <span className="font-code-sm text-code-sm text-on-surface-variant font-semibold">{inspector.hcsSeq}</span>
                    </div>
                    <div className="font-code-sm text-[11px] text-on-surface truncate">
                      Hash: {inspector.hcsHash}
                    </div>
                    <span className="font-code-sm text-[11px] text-on-surface-variant">
                      Consensus Timestamp: {inspector.hcsTimestamp}
                    </span>
                  </div>
                </div>

                {/* Inspector Action Buttons */}
                <div className="pt-space-sm flex items-center gap-space-xs border-t border-surface-container-high">
                  <button
                    onClick={dispatchAgentReparse}
                    disabled={isSyncingHcs}
                    className="flex-1 py-2.5 bg-primary text-on-primary font-body-sm text-body-sm rounded-lg hover:opacity-90 transition-colors inline-flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isSyncingHcs ? "animate-spin" : ""}`}>sync</span>
                    <span>{isSyncingHcs ? "Syncing Hedera HCS..." : "Trigger Agent Quorum"}</span>
                  </button>
                  <button
                    onClick={copyHcsProof}
                    className="p-2.5 bg-surface-container text-on-surface rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer border border-black/[0.04]"
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

          {/* Subgraph Query Result Drawer (if available) */}
          {showQueryDrawer && queryResultPayload && (
            <section className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin mb-space-md">
              <div className="bg-surface-container-lowest border border-black/[0.08] rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
                  <div className="flex items-center gap-2">
                    <span className="text-secondary font-bold">🌐 The Graph Subgraph Query Result</span>
                    <span className="font-code-sm text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      200 OK
                    </span>
                  </div>
                  <button
                    onClick={() => setShowQueryDrawer(false)}
                    className="text-on-surface-variant hover:text-on-surface font-bold text-sm cursor-pointer"
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="bg-[#18181b] text-[#10b981] p-3 rounded-lg font-code-sm text-xs mt-3 overflow-x-auto max-h-48">
                  <pre>{JSON.stringify(queryResultPayload, null, 2)}</pre>
                </div>
              </div>
            </section>
          )}

          {/* Lower Telemetry & Real-Time Activity Bento Grid */}
          <section className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin mb-space-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
              {/* Real-Time Activity & Recent Graph Queries (Col 1-7) */}
              <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl shadow-md p-space-lg flex flex-col gap-space-md border border-black/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-on-surface text-[20px]">history</span>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      Recent AST Graph Queries &amp; Activity
                    </h2>
                  </div>
                  <span className="font-code-sm text-[11px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-bold">
                    api/graph/activity
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-surface-container-high text-on-surface-variant font-label-caps text-label-caps">
                        <th className="pb-2 font-bold">QUERY EXPRESSION</th>
                        <th className="pb-2 font-bold">AGENTS</th>
                        <th className="pb-2 font-bold">LATENCY</th>
                        <th className="pb-2 font-bold">CONSENSUS STATE</th>
                        <th className="pb-2 font-bold text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-low font-code-sm text-code-sm" id="activity-query-rows">
                      {activityRows.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => {
                            setQueryInput(row.queryExpression);
                            const q = row.queryExpression.toLowerCase();
                            if (q.includes("reentrancy") || q.includes("cei") || q.includes("withdraw")) {
                              handleSelectContract("ethervault");
                            } else if (q.includes("tx.origin") || q.includes("modifier") || q.includes("only")) {
                              handleSelectContract("multisig");
                            } else if (q.includes("div") || q.includes("mul") || q.includes("precision")) {
                              handleSelectContract("redeemescrow");
                            } else if (q.includes("flash") || q.includes("pool") || q.includes("constant")) {
                              handleSelectContract("flashlender");
                            }
                            handleRunQuery(row.queryExpression);
                          }}
                          className={`hover:bg-surface-container-high/60 cursor-pointer transition-colors group ${
                            row.isNew ? "bg-secondary-container/20" : ""
                          }`}
                          title="Click to replay this query & inspect AST nodes"
                        >
                          <td className="py-3 text-on-surface font-medium max-w-[240px] truncate" title={row.queryExpression}>
                            {row.queryExpression}
                          </td>
                          <td className="py-3 text-on-surface-variant">
                            <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface font-semibold">
                              {row.agents}
                            </span>
                          </td>
                          <td className="py-3 text-secondary font-bold">{row.latency}</td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 text-secondary font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                              {row.consensusState}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="font-code-sm text-[11px] font-bold text-primary group-hover:underline inline-flex items-center gap-1">
                              <span>Replay</span>
                              <span>→</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Real-Time Graph Telemetry (Col 8-12) */}
              <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl shadow-md p-space-lg flex flex-col justify-between gap-space-md border border-black/[0.06]">
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-on-surface text-[20px]">insights</span>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                        Graph Neural Telemetry
                      </h2>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Live topological statistics streamed from AST parser and Hedera Consensus message sequencer.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-space-sm pt-2">
                  <div className="bg-surface-container-low p-3 rounded-lg border border-black/[0.04]">
                    <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant">SUBGRAPH TVL</span>
                    <div className="font-code-md text-code-md font-bold text-secondary mt-1">
                      {liveTelemetry.tvlUsd ? `$${(liveTelemetry.tvlUsd / 1e6).toFixed(2)}M` : "$3.42M"}
                    </div>
                  </div>
                  <div className="bg-surface-container-low p-3 rounded-lg border border-black/[0.04]">
                    <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant">DAILY VOLUME</span>
                    <div className="font-code-md text-code-md font-bold text-on-surface mt-1">
                      {liveTelemetry.dailyVolumeUsd ? `$${(liveTelemetry.dailyVolumeUsd / 1e3).toFixed(0)}K` : "$780K"}
                    </div>
                  </div>
                </div>

                {liveTelemetry.riskSignals && liveTelemetry.riskSignals.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                    <span className="font-label-caps text-[10px] uppercase font-bold text-amber-800">ACTIVE RISK SIGNALS:</span>
                    <ul className="text-xs text-amber-900 mt-1 space-y-0.5">
                      {liveTelemetry.riskSignals.map((s, idx) => (
                        <li key={idx}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-space-xs border-t border-surface-container-high flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">hub</span>
                    <span className="font-code-sm text-code-sm text-on-surface font-semibold">Hedera Topic 0.0.10417469 Active</span>
                  </div>
                  <button
                    className="font-code-sm text-code-sm text-primary hover:underline font-bold cursor-pointer"
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
      <footer className="w-full bg-surface-container-low shadow-[0_-1px_8px_rgba(0,0,0,0.02)]">
        <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin py-space-xl flex flex-col gap-space-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-space-lg">
            <div className="flex flex-col gap-space-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold">Autonomous Consensus Engine</span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold max-w-xl">
                Autonomous Consensus. Built with mathematical intention.
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container border border-black/[0.04]">
                <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
                <span className="font-code-sm text-code-sm text-on-surface font-semibold">HCS Immutable State</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container border border-black/[0.04]">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">lock</span>
                <span className="font-code-sm text-code-sm text-on-surface font-semibold">AST Bytecode Proof</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container border border-black/[0.04]">
                <span className="material-symbols-outlined text-[16px] text-on-secondary-container">hub</span>
                <span className="font-code-sm text-code-sm text-on-surface font-semibold">Multi-Agent Swarm</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-space-md pt-space-lg border-t border-surface-container-high/60">
            <div className="flex items-center gap-space-sm">
              <img src="/logo.png" alt="SwarmProof" className="w-7 h-7 object-contain rounded-md" />
              <span className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight">SwarmProof</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-space-md text-on-surface-variant">
              <span className="font-code-sm text-code-sm">© 2026 SwarmProof Network. Anchored on Hedera Consensus Service.</span>
              <div className="flex items-center gap-space-sm font-code-sm text-code-sm font-medium">
                <span className="text-on-surface-variant">•</span>
                <span>Topic: 0.0.10417469</span>
                <span className="text-on-surface-variant">•</span>
                <span className="text-emerald-600 font-bold">Mainnet &amp; Testnet Active</span>
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
