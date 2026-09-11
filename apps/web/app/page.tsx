"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AgentInspectorModal } from "./components/AgentInspectorModal";
import { RegisterAgentModal } from "./components/RegisterAgentModal";
import { AuditPoolModal } from "./components/AuditPoolModal";
import { FullAuditReportModal } from "./components/FullAuditReportModal";
import { SwarmSimulation3D } from "./components/SwarmSimulation3D";
import { SPECIALIST_AGENTS, createAgentMetaFromBackend, type SpecialistAgentMeta } from "./components/agentData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

interface PresetItem {
  file: string;
  name: string;
  category: string;
  lines: string;
  severity: string;
  severityClass: string;
  title: string;
  code: string;
  rawCode: string;
  desc: string;
  fix: string;
  verdict: "verified" | "failed";
}

const PRESETS: Record<string, PresetItem> = {
  reentrancy: {
    file: "EtherVault.sol",
    name: "Classic Reentrancy Vault",
    category: "SWC-107",
    lines: "21 lines • 784 bytes",
    severity: "CRITICAL SEVERITY",
    severityClass: "bg-error-container text-on-error-container",
    title: "SWC-107: Reentrancy",
    verdict: "verified",
    code: `<span class="text-zinc-500"> 1</span> <span class="text-purple-400">// SPDX-License-Identifier: MIT</span>
<span class="text-zinc-500"> 2</span> <span class="text-blue-400">pragma</span> <span class="text-yellow-300">solidity</span> ^0.8.20;
<span class="text-zinc-500"> 3</span> 
<span class="text-zinc-500"> 4</span> <span class="text-blue-400">contract</span> <span class="text-emerald-400 font-semibold">EtherVault</span> {
<span class="text-zinc-500"> 5</span>     <span class="text-blue-400">mapping</span>(<span class="text-blue-300">address</span> =&gt; <span class="text-blue-300">uint256</span>) <span class="text-blue-400">public</span> balances;
<span class="text-zinc-500"> 6</span> 
<span class="text-zinc-500"> 7</span>     <span class="text-blue-400">function</span> <span class="text-yellow-200">deposit</span>() <span class="text-blue-400">external payable</span> {
<span class="text-zinc-500"> 8</span>         balances[<span class="text-red-400">msg.sender</span>] += <span class="text-red-400">msg.value</span>;
<span class="text-zinc-500"> 9</span>     }
<span class="text-zinc-500">10</span> 
<span class="text-zinc-500">11</span>     <span class="text-blue-400">function</span> <span class="text-yellow-200">withdraw</span>() <span class="text-blue-400">external</span> {
<span class="text-zinc-500">12</span>         <span class="text-blue-300">uint256</span> bal = balances[<span class="text-red-400">msg.sender</span>];
<span class="text-zinc-500">13</span>         <span class="text-yellow-400">require</span>(bal &gt; 0, <span class="text-emerald-300">"Insufficient balance"</span>);
<span class="text-zinc-500">14</span> 
<span class="text-zinc-500">15</span>         <span class="text-purple-400">// [CRITICAL] External transfer before state update (CEI violation)</span>
<span class="text-zinc-500">16</span>         (<span class="text-blue-300">bool</span> success, ) = <span class="text-red-400">msg.sender</span>.<span class="text-yellow-200">call</span>{<span class="text-emerald-400">value</span>: bal}(<span class="text-emerald-300">""</span>);
<span class="text-zinc-500">17</span>         <span class="text-yellow-400">require</span>(success, <span class="text-emerald-300">"Transfer failed"</span>);
<span class="text-zinc-500">18</span> 
<span class="text-zinc-500">19</span>         balances[<span class="text-red-400">msg.sender</span>] = 0;
<span class="text-zinc-500">20</span>     }
<span class="text-zinc-500">21</span> }`,
    rawCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EtherVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "Insufficient balance");

        // [CRITICAL] External transfer before state update (CEI violation)
        (bool success, ) = msg.sender.call{value: bal}("");
        require(success, "Transfer failed");

        balances[msg.sender] = 0;
    }
}`,
    desc: "Line 16 transfers ether via raw low-level call{.value: bal}(\"\") prior to zeroing sender balance on Line 19. An adversarial recipient contract can execute recursive callbacks into withdraw() to drain contract reserves.",
    fix: "Adopt Checks-Effects-Interactions: set balances[msg.sender] = 0; before calling external address, or implement OpenZeppelin ReentrancyGuard.nonReentrant.",
  },
  txorigin: {
    file: "MultiSigAuth.sol",
    name: "Privilege Bypass & tx.origin",
    category: "SWC-115",
    lines: "18 lines • 592 bytes",
    severity: "HIGH SEVERITY",
    severityClass: "bg-error-container text-on-error-container",
    title: "SWC-115: tx.origin Authorization",
    verdict: "verified",
    code: `<span class="text-zinc-500"> 1</span> <span class="text-purple-400">// SPDX-License-Identifier: MIT</span>
<span class="text-zinc-500"> 2</span> <span class="text-blue-400">pragma</span> <span class="text-yellow-300">solidity</span> ^0.8.20;
<span class="text-zinc-500"> 3</span> 
<span class="text-zinc-500"> 4</span> <span class="text-blue-400">contract</span> <span class="text-emerald-400 font-semibold">MultiSigAuth</span> {
<span class="text-zinc-500"> 5</span>     <span class="text-blue-300">address</span> <span class="text-blue-400">public</span> owner;
<span class="text-zinc-500"> 6</span>     <span class="text-blue-400">constructor</span>() { owner = <span class="text-red-400">msg.sender</span>; }
<span class="text-zinc-500"> 7</span> 
<span class="text-zinc-500"> 8</span>     <span class="text-blue-400">function</span> <span class="text-yellow-200">transferOwnership</span>(<span class="text-blue-300">address</span> newOwner) <span class="text-blue-400">external</span> {
<span class="text-zinc-500"> 9</span>         <span class="text-purple-400">// [HIGH] tx.origin can be spoofed by phishing contract</span>
<span class="text-zinc-500">10</span>         <span class="text-yellow-400">require</span>(<span class="text-red-400">tx.origin</span> == owner, <span class="text-emerald-300">"Not authorized"</span>);
<span class="text-zinc-500">11</span>         owner = newOwner;
<span class="text-zinc-500">12</span>     }
<span class="text-zinc-500">13</span> }`,
    rawCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MultiSigAuth {
    address public owner;
    constructor() { owner = msg.sender; }

    function transferOwnership(address newOwner) external {
        // [HIGH] tx.origin can be spoofed by phishing contract
        require(tx.origin == owner, "Not authorized");
        owner = newOwner;
    }
}`,
    desc: "Authorization utilizes global tx.origin on Line 10. If the authorized owner calls an intermediate malicious contract, the attacker can hijack control by masquerading as the root transaction initiator.",
    fix: "Replace tx.origin with msg.sender to ensure caller verification happens at the immediate contract boundary.",
  },
  precision: {
    file: "StakingPool.sol",
    name: "Precision Loss & Reward Drift",
    category: "SWC-101",
    lines: "19 lines • 610 bytes",
    severity: "MEDIUM SEVERITY",
    severityClass: "bg-surface-container-highest text-on-surface",
    title: "SWC-101: Integer Division Loss",
    verdict: "verified",
    code: `<span class="text-zinc-500"> 1</span> <span class="text-purple-400">// SPDX-License-Identifier: MIT</span>
<span class="text-zinc-500"> 2</span> <span class="text-blue-400">pragma</span> <span class="text-yellow-300">solidity</span> ^0.8.20;
<span class="text-zinc-500"> 3</span> 
<span class="text-zinc-500"> 4</span> <span class="text-blue-400">contract</span> <span class="text-emerald-400 font-semibold">StakingPool</span> {
<span class="text-zinc-500"> 5</span>     <span class="text-blue-300">uint256</span> <span class="text-blue-400">public constant</span> REWARD_RATE = 5;
<span class="text-zinc-500"> 6</span>     <span class="text-blue-400">function</span> <span class="text-yellow-200">calcYield</span>(<span class="text-blue-300">uint256</span> amount, <span class="text-blue-300">uint256</span> timeElapsed) <span class="text-blue-400">external pure returns</span> (<span class="text-blue-300">uint256</span>) {
<span class="text-zinc-500"> 7</span>         <span class="text-purple-400">// [MEDIUM] Division before multiplication yields truncation to 0</span>
<span class="text-zinc-500"> 8</span>         <span class="text-blue-300">uint256</span> base = amount / 10000;
<span class="text-zinc-500"> 9</span>         <span class="text-blue-400">return</span> base * REWARD_RATE * timeElapsed;
<span class="text-zinc-500">10</span>     }
<span class="text-zinc-500">11</span> }`,
    rawCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StakingPool {
    uint256 public constant REWARD_RATE = 5;
    function calcYield(uint256 amount, uint256 timeElapsed) external pure returns (uint256) {
        // [MEDIUM] Division before multiplication yields truncation to 0
        uint256 base = amount / 10000;
        return base * REWARD_RATE * timeElapsed;
    }
}`,
    desc: "Integer arithmetic truncates prematurely on Line 8 when amount is less than 10,000 wei, zeroing out all yield accumulations for micropool depositors.",
    fix: "Multiply operands before division: (amount * REWARD_RATE * timeElapsed) / 10000, or leverage fixed-point math libraries (PRBMath).",
  },
  oracle: {
    file: "LendingPair.sol",
    name: "Spot Price Oracle Manipulation",
    category: "SWC-120",
    lines: "22 lines • 712 bytes",
    severity: "CRITICAL SEVERITY",
    severityClass: "bg-error-container text-on-error-container",
    title: "SWC-120: Spot Price Oracle",
    verdict: "verified",
    code: `<span class="text-zinc-500"> 1</span> <span class="text-purple-400">// SPDX-License-Identifier: MIT</span>
<span class="text-zinc-500"> 2</span> <span class="text-blue-400">pragma</span> <span class="text-yellow-300">solidity</span> ^0.8.20;
<span class="text-zinc-500"> 3</span> 
<span class="text-zinc-500"> 4</span> <span class="text-blue-400">contract</span> <span class="text-emerald-400 font-semibold">LendingPair</span> {
<span class="text-zinc-500"> 5</span>     <span class="text-blue-400">function</span> <span class="text-yellow-200">getAssetPrice</span>(<span class="text-blue-300">address</span> pool) <span class="text-blue-400">public view returns</span> (<span class="text-blue-300">uint256</span>) {
<span class="text-zinc-500"> 6</span>         <span class="text-purple-400">// [CRITICAL] Spot balance ratio manipulable via Flash Loans</span>
<span class="text-zinc-500"> 7</span>         <span class="text-blue-400">return</span> <span class="text-blue-300">IERC20</span>(tokenA).<span class="text-yellow-200">balanceOf</span>(pool) / <span class="text-blue-300">IERC20</span>(tokenB).<span class="text-yellow-200">balanceOf</span>(pool);
<span class="text-zinc-500"> 8</span>     }
<span class="text-zinc-500"> 9</span> }`,
    rawCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LendingPair {
    function getAssetPrice(address pool) public view returns (uint256) {
        // [CRITICAL] Spot balance ratio manipulable via Flash Loans
        return IERC20(tokenA).balanceOf(pool) / IERC20(tokenB).balanceOf(pool);
    }
}`,
    desc: "Calculates asset collateral valuation directly against pool reserves in a single block. Susceptible to flash-loan pool skew attacks that bypass liquidation barriers.",
    fix: "Migrate from instantaneous reserve ratios to a Time-Weighted Average Price (TWAP) or integrate Chainlink AggregatorV3 price feeds with freshness checks.",
  },
  guarded: {
    file: "SecureVault.sol",
    name: "Guarded Vault [CEI Compliant - Secure]",
    category: "VERIFIED",
    lines: "24 lines • 820 bytes",
    severity: "PASS 0 DETECTED",
    severityClass: "bg-secondary-fixed text-on-secondary-fixed",
    title: "Invariants Verified: Safe CEI",
    verdict: "verified",
    code: `<span class="text-zinc-500"> 1</span> <span class="text-purple-400">// SPDX-License-Identifier: MIT</span>
<span class="text-zinc-500"> 2</span> <span class="text-blue-400">pragma</span> <span class="text-yellow-300">solidity</span> ^0.8.20;
<span class="text-zinc-500"> 3</span> 
<span class="text-zinc-500"> 4</span> <span class="text-blue-400">contract</span> <span class="text-emerald-400 font-semibold">SecureVault</span> {
<span class="text-zinc-500"> 5</span>     <span class="text-blue-400">mapping</span>(<span class="text-blue-300">address</span> =&gt; <span class="text-blue-300">uint256</span>) <span class="text-blue-400">private</span> _balances;
<span class="text-zinc-500"> 6</span> 
<span class="text-zinc-500"> 7</span>     <span class="text-blue-400">function</span> <span class="text-yellow-200">withdraw</span>() <span class="text-blue-400">external</span> {
<span class="text-zinc-500"> 8</span>         <span class="text-blue-300">uint256</span> amount = _balances[<span class="text-red-400">msg.sender</span>];
<span class="text-zinc-500"> 9</span>         <span class="text-yellow-400">require</span>(amount &gt; 0, <span class="text-emerald-300">"Empty"</span>);
<span class="text-zinc-500">10</span>         
<span class="text-zinc-500">11</span>         <span class="text-purple-400">// Checks-Effects-Interactions strictly maintained</span>
<span class="text-zinc-500">12</span>         _balances[<span class="text-red-400">msg.sender</span>] = 0;
<span class="text-zinc-500">13</span>         
<span class="text-zinc-500">14</span>         (<span class="text-blue-300">bool</span> ok, ) = <span class="text-red-400">msg.sender</span>.<span class="text-yellow-200">call</span>{<span class="text-emerald-400">value</span>: amount}(<span class="text-emerald-300">""</span>);
<span class="text-zinc-500">15</span>         <span class="text-yellow-400">require</span>(ok, <span class="text-emerald-300">"Fail"</span>);
<span class="text-zinc-500">16</span>     }
<span class="text-zinc-500">17</span> }`,
    rawCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SecureVault {
    mapping(address => uint256) private _balances;

    function withdraw() external {
        uint256 amount = _balances[msg.sender];
        require(amount > 0, "Empty");
        
        // Checks-Effects-Interactions strictly maintained
        _balances[msg.sender] = 0;
        
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Fail");
    }
}`,
    desc: "State variables are modified strictly prior to calling external execution environments. No reentrancy paths, tx.origin spoofing, or arithmetic truncation anomalies detected by the 5-agent swarm.",
    fix: "No remediation required. Invariant graph matches formal verification specifications for safe vault custody.",
  },
};

const AGENT_INFO: Record<string, { title: string; desc: string; id: string }> = {
  reentrancy: {
    id: "reentrancy",
    title: "Agent: Reentrancy Invariant (A1)",
    desc: "Synthesizes state-access trace graphs prior to external ether transfers. Flagged CEI sequence anomaly on line 12.",
  },
  access: {
    id: "access",
    title: "Agent: Access Control Logic (A2)",
    desc: "Validates caller invariants, tx.origin spoofing surface, and multi-signature quorum authority thresholds.",
  },
  logic: {
    id: "logic",
    title: "Agent: Business Logic & State (A3)",
    desc: "Detects invariant drift between storage variables and function dispatch execution order.",
  },
  econ: {
    id: "econ",
    title: "Agent: Economic Security (A4)",
    desc: "Simulates flash loans, liquidity pool skew, and collateral oracle price divergence.",
  },
  static: {
    id: "static",
    title: "Agent: Static AST-IR Scanner (A5)",
    desc: "Slither & Mythril intermediate bytecode compilation rule validation.",
  },
};

export default function Home() {
  // Preset state
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>("reentrancy");
  const fallbackPreset = PRESETS["reentrancy"]!;
  const activePreset = PRESETS[selectedPresetKey] ?? fallbackPreset;

  // Active agent inspection hover/selection
  const [activeInspectorKey, setActiveInspectorKey] = useState<string>("reentrancy");
  const fallbackInspector = AGENT_INFO["reentrancy"]!;
  const inspectorData = AGENT_INFO[activeInspectorKey] ?? fallbackInspector;

  // Visualizer interactive controls
  const [beamsActive, setBeamsActive] = useState(false);
  const [autoOrbitActive, setAutoOrbitActive] = useState(false);
  const [activeSpecTab, setActiveSpecTab] = useState<number>(1);
  const [viewMode3D, setViewMode3D] = useState<"svg" | "webgl">("svg");
  const [is3DFullscreen, setIs3DFullscreen] = useState(false);

  // Live execution pipeline states
  const [isAuditing, setIsAuditing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(5); // default 5 (finalized)
  const [pipelineStatus, setPipelineStatus] = useState<"READY" | "VERIFYING" | "FINALIZED">("FINALIZED");
  const [auditResult, setAuditResult] = useState<any>(null);

  // Modal states
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [isFullReportOpen, setIsFullReportOpen] = useState(false);
  const [inspectAgentId, setInspectAgentId] = useState<string | null>(null);

  // Dynamic Agent Registry
  const [allAgents, setAllAgents] = useState<Record<string, SpecialistAgentMeta>>(SPECIALIST_AGENTS);

  // Fetch backend agents
  useEffect(() => {
    async function loadAgents() {
      try {
        const res = await fetch(`${API_BASE}/agents`);
        if (res.ok) {
          const data = (await res.json()) as { agents: any[] };
          if (Array.isArray(data.agents)) {
            setAllAgents((prev) => {
              const nextMap = { ...prev };
              for (const a of data.agents) {
                nextMap[a.agentId] = createAgentMetaFromBackend(a);
              }
              return nextMap;
            });
          }
        }
      } catch (err) {
        console.warn("Using default agent registry", err);
      }
    }
    loadAgents();
  }, []);

  // Trigger Beam animation
  const handleTriggerBeams = () => {
    setBeamsActive(true);
    setTimeout(() => {
      setBeamsActive(false);
    }, 1200);
  };

  // Toggle Auto-Orbit
  const handleToggleOrbit = () => {
    setAutoOrbitActive((prev) => !prev);
  };

  // Reset visualizer stage
  const handleResetStage = () => {
    setAutoOrbitActive(false);
    setBeamsActive(false);
    setActiveInspectorKey("reentrancy");
  };

  // Smooth scroll to studio
  const scrollToStudio = () => {
    const el = document.getElementById("interactive-telemetry");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Run multi-agent consensus sequence
  const handleRunAudit = async () => {
    setIsAuditing(true);
    setPipelineStatus("VERIFYING");
    setPipelineStep(1);

    try {
      // Step progression simulation with optional API dispatch
      for (let s = 1; s <= 5; s++) {
        setPipelineStep(s);
        await new Promise((r) => setTimeout(r, 450));
      }

      // Try calling live backend API if available
      try {
        const createRes = await fetch(`${API_BASE}/audits`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contractName: activePreset.file.replace(".sol", ""),
            source: activePreset.rawCode,
          }),
        });
        if (createRes.ok) {
          const { id } = (await createRes.json()) as { id: string };
          // Poll for real result
          for (let p = 0; p < 15; p++) {
            await new Promise((r) => setTimeout(r, 800));
            const pollRes = await fetch(`${API_BASE}/audits/${id}`);
            if (pollRes.ok) {
              const rec = await pollRes.json();
              if (rec.status === "done") {
                setAuditResult(rec);
                break;
              }
            }
          }
        }
      } catch (apiErr) {
        console.log("Local simulation mode active", apiErr);
      }

      setPipelineStatus("FINALIZED");
      setPipelineStep(5);
    } catch (err) {
      console.error(err);
      setPipelineStatus("FINALIZED");
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface selection:bg-secondary-container selection:text-on-secondary-container min-h-screen">
      {/* ── Fixed Editorial Header ───────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-28 max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex flex-col justify-between pt-3 pb-2">
          {/* Top Header Row */}
          <div className="flex items-center justify-between gap-gutter">
            <div className="flex items-center gap-space-md">
              <div className="w-9 h-9 bg-primary flex items-center justify-center rounded">
                <span className="font-code-md text-code-md font-semibold text-on-primary tracking-tight">SP</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface font-medium">
                    SwarmProof
                  </span>
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
                <Link
                  className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
                  href="/leaderboard"
                >
                  Leaderboard &amp; Reputation
                </Link>
                <Link
                  className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
                  href="/feedback"
                >
                  Pitch Deck
                </Link>
                <Link
                  className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
                  href="/x402"
                >
                  Payment Lab (x402)
                </Link>
                <button
                  type="button"
                  onClick={() => setIsPoolModalOpen(true)}
                  className="font-body-sm text-body-sm text-secondary hover:text-on-surface transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>⚡ Live Audit Pool</span>
                </button>
              </nav>

              <a
                href="https://hashscan.io/testnet/topic/0.0.10417469"
                target="_blank"
                rel="noreferrer"
                className="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-surface-container-low rounded hover:bg-surface-container transition-colors cursor-pointer"
                title="View Topic on Hedera HashScan"
              >
                <span className="w-2 h-2 rounded-full bg-secondary-fixed-dim animate-pulse"></span>
                <span className="font-code-sm text-code-sm text-on-surface-variant">Topic 0.0.10417469</span>
              </a>

              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(true)}
                className="px-3 py-1.5 bg-primary text-on-primary font-body-sm text-body-sm rounded hover:bg-primary-container transition-colors inline-flex items-center justify-center cursor-pointer shadow-sm"
              >
                + Register Agent
              </button>

              <div
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer"
                onClick={() => setIsPoolModalOpen(true)}
                title="Open Swarm Audit Pool"
              >
                <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </div>
            </div>
          </div>

          {/* Subnav Navigation Bar */}
          <div className="flex items-center overflow-x-auto gap-space-sm pt-1">
            <nav className="flex items-center gap-space-xs">
              <a
                aria-current="page"
                className="px-3 py-1 font-code-sm rounded transition-all bg-primary text-on-primary cursor-pointer"
                href="#quorum-sim"
              >
                3D Swarm Visualizer
              </a>
              <a
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface cursor-pointer"
                href="#quorum-sim"
              >
                Consensus &amp; AST Quorum
              </a>
              <a
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface cursor-pointer"
                href="#interactive-telemetry"
              >
                Solidity Audit Studio
              </a>
              <a
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface cursor-pointer"
                href="https://hashscan.io/testnet/topic/0.0.10417469"
                target="_blank"
                rel="noreferrer"
              >
                Hedera HCS Proofs ↗
              </a>
              <Link
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                href="/leaderboard"
              >
                Verification Logs
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* ── Main Landing Body ─────────────────────────────────────── */}
      <main className="w-full pt-28 bg-surface">
        <div className="flex flex-col w-full">
          {/* SECTION 1: EDITORIAL HERO TITLE */}
          <section className="relative max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin pt-space-lg md:pt-space-xl pb-space-xl">
            <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-lg md:p-space-xl shadow-sm">
              {/* Ambient chromatic bloom contained in card */}
              <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-secondary-fixed opacity-40 blur-3xl pointer-events-none"></div>
              <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-surface-container-high opacity-70 blur-2xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col items-start max-w-4xl">
                {/* Monospaced Category Tag */}
                <div className="flex items-center gap-space-xs mb-space-md">
                  <span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                    The Consensus Protocol • Architecture Spec v4.2
                  </span>
                </div>

                {/* Grand Serif Display Headline */}
                <h1 className="font-display-xl text-display-xl text-on-surface tracking-tight font-normal mb-space-md">
                  Autonomous Consensus &amp; Verification in the Multi-Agent Era.
                </h1>

                {/* High-contrast Editorial Subtitle */}
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-space-lg">
                  Decentralized smart-contract auditing powered by a sovereign AI agent swarm, mathematically validated through concurrent AST graph reasoning and immutably anchored on Hedera Consensus Service.
                </p>

                {/* Interactive Editorial Actions */}
                <div className="flex flex-wrap items-center gap-space-sm">
                  <button
                    type="button"
                    onClick={scrollToStudio}
                    className="px-space-md py-3 rounded bg-primary text-on-primary font-body-sm text-body-sm tracking-normal hover:bg-primary-container transition-colors inline-flex items-center gap-space-xs shadow-sm cursor-pointer"
                    id="heroLaunchBtn"
                  >
                    <span>Launch Swarm Audit</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>

                  <a
                    className="px-space-md py-3 rounded bg-surface-container-low text-on-surface font-code-sm text-code-sm hover:bg-surface-container transition-colors inline-flex items-center gap-2 cursor-pointer backdrop-blur-xl"
                    href="https://hashscan.io/testnet/topic/0.0.10417469"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span>
                    <span>Explore Live Topic 0.0.10417469</span>
                    <span className="material-symbols-outlined text-[15px] text-on-surface-variant">open_in_new</span>
                  </a>
                </div>

                {/* Metric strip inside hero */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-md mt-space-xl pt-space-lg w-full bg-surface-container-low/60 rounded-lg p-space-md">
                  <div>
                    <div className="font-code-sm text-code-sm text-on-surface-variant uppercase">Settlement Latency</div>
                    <div className="font-headline-sm text-headline-sm text-on-surface font-medium mt-0.5">1.42s</div>
                    <div className="font-code-sm text-code-sm text-secondary">Hedera Finality</div>
                  </div>
                  <div>
                    <div className="font-code-sm text-code-sm text-on-surface-variant uppercase">Quorum Consensus</div>
                    <div className="font-headline-sm text-headline-sm text-on-surface font-medium mt-0.5">5/5 Nodes</div>
                    <div className="font-code-sm text-code-sm text-on-surface-variant">Byzantine Fault Proof</div>
                  </div>
                  <div>
                    <div className="font-code-sm text-code-sm text-on-surface-variant uppercase">AST Signatures</div>
                    <div className="font-headline-sm text-headline-sm text-on-surface font-medium mt-0.5">184,290</div>
                    <div className="font-code-sm text-code-sm text-on-surface-variant">Slither • Mythril Core</div>
                  </div>
                  <div>
                    <div className="font-code-sm text-code-sm text-on-surface-variant uppercase">Identity Layer</div>
                    <div className="font-headline-sm text-headline-sm text-on-surface font-medium mt-0.5">W3C DID</div>
                    <div className="font-code-sm text-code-sm text-on-surface-variant">Hedera DID:HCS</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: ARCHITECTURAL MARQUEE TICKER */}
          <section className="w-full bg-surface-container-lowest py-space-sm overflow-hidden relative border-y border-outline-variant/30">
            <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex items-center">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant shrink-0 mr-space-lg hidden md:inline">
                Audited Standards •
              </span>
              <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
                <div className="flex items-center gap-space-xl whitespace-nowrap animate-[marquee_28s_linear_infinite]">
                  <span className="font-code-md text-code-md text-on-surface-variant hover:text-on-surface transition-colors cursor-default tracking-wider">
                    HEDERA HCS 0.0.10417469
                  </span>
                  <span className="text-surface-container-highest text-sm">•</span>
                  <span className="font-code-md text-code-md text-on-surface-variant hover:text-on-surface transition-colors cursor-default tracking-wider">
                    SOLIDITY AST V0.8.28
                  </span>
                  <span className="text-surface-container-highest text-sm">•</span>
                  <span className="font-code-md text-code-md text-on-surface-variant hover:text-on-surface transition-colors cursor-default tracking-wider">
                    W3C DID:HEDERA
                  </span>
                  <span className="text-surface-container-highest text-sm">•</span>
                  <span className="font-code-md text-code-md text-on-surface-variant hover:text-on-surface transition-colors cursor-default tracking-wider">
                    ETHEREUM VIRTUAL MACHINE
                  </span>
                  <span className="text-surface-container-highest text-sm">•</span>
                  <span className="font-code-md text-code-md text-on-surface-variant hover:text-on-surface transition-colors cursor-default tracking-wider">
                    ERC-4337 ACCOUNT ABSTRACTION
                  </span>
                  <span className="text-surface-container-highest text-sm">•</span>
                  <span className="font-code-md text-code-md text-on-surface-variant hover:text-on-surface transition-colors cursor-default tracking-wider">
                    CHAINLINK CCIP &amp; DATA FEEDS
                  </span>
                  <span className="text-surface-container-highest text-sm">•</span>
                  <span className="font-code-md text-code-md text-on-surface-variant hover:text-on-surface transition-colors cursor-default tracking-wider">
                    OPENZEPPELIN UPGRADES
                  </span>
                  <span className="text-surface-container-highest text-sm">•</span>
                  <span className="font-code-md text-code-md text-on-surface-variant hover:text-on-surface transition-colors cursor-default tracking-wider">
                    ARBITRUM STYLUS WASM
                  </span>
                  {/* Duplicated for smooth loop */}
                  <span className="text-surface-container-highest text-sm">•</span>
                  <span className="font-code-md text-code-md text-on-surface-variant hover:text-on-surface transition-colors cursor-default tracking-wider">
                    HEDERA HCS 0.0.10417469
                  </span>
                  <span className="text-surface-container-highest text-sm">•</span>
                  <span className="font-code-md text-code-md text-on-surface-variant hover:text-on-surface transition-colors cursor-default tracking-wider">
                    SOLIDITY AST V0.8.28
                  </span>
                  <span className="text-surface-container-highest text-sm">•</span>
                  <span className="font-code-md text-code-md text-on-surface-variant hover:text-on-surface transition-colors cursor-default tracking-wider">
                    W3C DID:HEDERA
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: INTERACTIVE QUORUM SIMULATION (3D VISUALIZER & HUD) */}
          <section className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin py-space-xl" id="quorum-sim">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
              {/* Left Column: Editorial & Revealing Accordion */}
              <div className="lg:col-span-5 flex flex-col">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-space-xs">
                  Core Capabilities
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface font-medium tracking-tight mb-space-md">
                  Multi-Agent Security Quorum Simulation.
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mb-space-lg">
                  Instead of relying on a solitary auditor or static linters, SwarmProof instantiates five specialized cognitive agents. Each agent generates isolated AST semantic graphs, challenges opposing counter-theses, and converges into a single cryptographic verdict.
                </p>

                {/* Interactive Spec Accordion with sliding indicators */}
                <div className="flex flex-col gap-space-sm" id="specAccordion">
                  {/* Accordion 01 */}
                  <div
                    className={`spec-card group cursor-pointer p-space-md rounded-lg transition-all ${
                      activeSpecTab === 1
                        ? "bg-surface-container-low border-l-2 border-secondary"
                        : "bg-surface-container-lowest hover:bg-surface-container-low"
                    }`}
                    onClick={() => {
                      setActiveSpecTab(1);
                      setActiveInspectorKey("reentrancy");
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-code-sm text-code-sm text-secondary font-medium">01 // QUORUM SPECIALISTS</span>
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:translate-x-1 transition-transform">
                        arrow_forward
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-[18px] text-on-surface font-normal">Autonomous Multi-Angle AST Ingestion</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                      Specialist agents evaluate Reentrancy, Access Bypass, Business Logic, Economic Security, and Bytecode invariants concurrently.
                    </p>
                    <div className="mt-space-sm h-0.5 w-full bg-surface-container-highest overflow-hidden rounded-full">
                      <div
                        className={`h-full bg-secondary transition-all duration-300 ${activeSpecTab === 1 ? "w-full" : "w-1/3"}`}
                      ></div>
                    </div>
                  </div>

                  {/* Accordion 02 */}
                  <div
                    className={`spec-card group cursor-pointer p-space-md rounded-lg transition-all ${
                      activeSpecTab === 2
                        ? "bg-surface-container-low border-l-2 border-primary"
                        : "bg-surface-container-lowest hover:bg-surface-container-low"
                    }`}
                    onClick={() => {
                      setActiveSpecTab(2);
                      setActiveInspectorKey("access");
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-code-sm text-code-sm text-on-surface-variant font-medium">02 // ADVERSARIAL DISPUTE</span>
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:translate-x-1 transition-transform">
                        arrow_forward
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-[18px] text-on-surface font-normal">Neural Disagreement &amp; Resolution</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                      Agents cross-challenge vulnerabilities to eliminate false positives. A consensus threshold of 4/5 or 5/5 is required for HCS attestation.
                    </p>
                    <div className="mt-space-sm h-0.5 w-full bg-surface-container-highest overflow-hidden rounded-full">
                      <div
                        className={`h-full bg-primary transition-all duration-300 ${activeSpecTab === 2 ? "w-full" : "w-2/3"}`}
                      ></div>
                    </div>
                  </div>

                  {/* Accordion 03 */}
                  <div
                    className={`spec-card group cursor-pointer p-space-md rounded-lg transition-all ${
                      activeSpecTab === 3
                        ? "bg-surface-container-low border-l-2 border-surface-tint"
                        : "bg-surface-container-lowest hover:bg-surface-container-low"
                    }`}
                    onClick={() => {
                      setActiveSpecTab(3);
                      setActiveInspectorKey("logic");
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-code-sm text-code-sm text-on-surface-variant font-medium">03 // CRYPTOGRAPHIC FINALITY</span>
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:translate-x-1 transition-transform">
                        arrow_forward
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-[18px] text-on-surface font-normal">Immutable Settlement on Hedera HCS</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                      Every debate log, signature vote, and final bytecode hash is permanently recorded to Topic{" "}
                      <code className="font-code-sm text-on-surface">0.0.10417469</code>.
                    </p>
                    <div className="mt-space-sm h-0.5 w-full bg-surface-container-highest overflow-hidden rounded-full">
                      <div
                        className={`h-full bg-surface-tint transition-all duration-300 ${activeSpecTab === 3 ? "w-full" : "w-1/3"}`}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Reputation Micro-Card */}
                <div className="mt-space-md p-space-md rounded-lg bg-surface-container-high/60 flex items-center justify-between">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-code-sm">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </div>
                    <div>
                      <div className="font-code-sm text-code-sm font-semibold text-on-surface">Network Stake Verified</div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">5 Active Agents Staked • 250k HBAR</div>
                    </div>
                  </div>
                  <span className="font-label-caps text-label-caps text-secondary font-medium">PASS 99.4%</span>
                </div>
              </div>

              {/* Right Column: Interactive 3D Visualizer & HUD */}
              <div className="lg:col-span-7 flex flex-col gap-space-sm">
                <div className="relative bg-surface-container-lowest rounded-xl overflow-hidden p-space-md md:p-space-lg shadow-sm">
                  {/* Stage Controls / Header */}
                  <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-md mb-space-md bg-surface-container-low/60 -mx-space-md md:-mx-space-lg -mt-space-md md:-mt-space-lg px-space-md md:px-space-lg py-space-sm">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
                      <span className="font-code-sm text-code-sm font-semibold text-on-surface">swarm_quorum_core.io</span>
                      <span className="font-code-sm text-code-sm text-on-surface-variant ml-2 hidden sm:inline">
                        • 60 FPS Canvas
                      </span>
                    </div>

                    {/* Interactive HUD Actions */}
                    <div className="flex items-center gap-space-xs">
                      <button
                        type="button"
                        onClick={handleTriggerBeams}
                        className="px-2.5 py-1 rounded bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-code-sm text-code-sm transition-colors flex items-center gap-1 cursor-pointer"
                        id="triggerBeamsBtn"
                      >
                        <span>⚡ Trigger Beams</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleOrbit}
                        className={`px-2.5 py-1 rounded font-code-sm text-code-sm transition-colors flex items-center gap-1 cursor-pointer ${
                          autoOrbitActive
                            ? "bg-secondary-fixed text-on-secondary-fixed font-semibold"
                            : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                        }`}
                        id="toggleOrbitBtn"
                      >
                        <span>🔄 Auto-Orbit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode3D((prev) => (prev === "svg" ? "webgl" : "svg"))}
                        className="px-2.5 py-1 rounded bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-code-sm text-code-sm transition-colors flex items-center gap-1 cursor-pointer"
                        title="Toggle WebGL 3D / Vector HUD"
                      >
                        <span>{viewMode3D === "svg" ? "🌌 WebGL Mode" : "📐 Vector HUD"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetStage}
                        className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant transition-colors cursor-pointer"
                        id="resetStageBtn"
                        title="Reset View"
                      >
                        <span className="material-symbols-outlined text-[18px]">fit_screen</span>
                      </button>
                    </div>
                  </div>

                  {/* Visualizer Canvas Area: Vector HUD or WebGL 3D */}
                  {viewMode3D === "svg" ? (
                    <div className="relative w-full h-[380px] bg-surface-container-high/40 rounded-lg overflow-hidden flex items-center justify-center select-none">
                      {/* Grid Underlay */}
                      <div className="absolute inset-0 bg-[radial-gradient(#78767b_1px,transparent_1px)] [background-size:20px_20px] opacity-15"></div>

                      {/* SVG 3D Node Constellation */}
                      <svg
                        className={`w-full h-full relative z-10 transition-transform duration-700 ease-out ${
                          autoOrbitActive ? "rotate-12 scale-[1.03]" : ""
                        }`}
                        id="swarmCanvasSvg"
                        viewBox="0 0 600 360"
                      >
                        {/* Animated Consensus Beams */}
                        <g
                          className={`text-secondary transition-all ${
                            beamsActive ? "opacity-90 stroke-secondary" : "opacity-40"
                          }`}
                          stroke="currentColor"
                          strokeDasharray="4 4"
                          strokeWidth={beamsActive ? "2.5" : "1.5"}
                        >
                          <line className="animate-pulse" x1="300" x2="160" y1="180" y2="90"></line>
                          <line className="animate-pulse" x1="300" x2="440" y1="180" y2="80"></line>
                          <line className="animate-pulse" x1="300" x2="470" y1="180" y2="250"></line>
                          <line className="animate-pulse" x1="300" x2="300" y1="180" y2="300"></line>
                          <line className="animate-pulse" x1="300" x2="130" y1="180" y2="240"></line>

                          {/* Cross Quorum Validation Rings */}
                          <line opacity="0.3" stroke="#78767b" strokeDasharray="2 2" strokeWidth="0.75" x1="160" x2="440" y1="90" y2="80"></line>
                          <line opacity="0.3" stroke="#78767b" strokeDasharray="2 2" strokeWidth="0.75" x1="440" x2="470" y1="80" y2="250"></line>
                          <line opacity="0.3" stroke="#78767b" strokeDasharray="2 2" strokeWidth="0.75" x1="470" x2="300" y1="250" y2="300"></line>
                          <line opacity="0.3" stroke="#78767b" strokeDasharray="2 2" strokeWidth="0.75" x1="300" x2="130" y1="300" y2="240"></line>
                          <line opacity="0.3" stroke="#78767b" strokeDasharray="2 2" strokeWidth="0.75" x1="130" x2="160" y1="240" y2="90"></line>
                        </g>

                        {/* Central AST Consensus Core */}
                        <g
                          className="cursor-pointer"
                          id="coreNode"
                          onClick={() => {
                            setActiveInspectorKey("reentrancy");
                            handleTriggerBeams();
                          }}
                        >
                          <circle className="fill-surface-container-lowest" cx="300" cy="180" r="44"></circle>
                          <circle className="fill-primary" cx="300" cy="180" r="38"></circle>
                          <circle
                            className="text-secondary animate-[spin_8s_linear_infinite]"
                            cx="300"
                            cy="180"
                            fill="none"
                            r="48"
                            stroke="currentColor"
                            strokeDasharray="10 15"
                            strokeWidth="1.5"
                          ></circle>
                          <text className="fill-on-primary font-code-sm text-[10px] font-bold uppercase tracking-wider" textAnchor="middle" x="300" y="176">
                            HCS CORE
                          </text>
                          <text className="fill-secondary-container font-code-sm text-[9px]" textAnchor="middle" x="300" y="190">
                            0.0.10417469
                          </text>
                        </g>

                        {/* Node 1: Reentrancy Specialist */}
                        <g
                          className="agent-node cursor-pointer transition-transform hover:scale-110"
                          id="node-reentrancy"
                          transform="translate(160, 90)"
                          onMouseEnter={() => setActiveInspectorKey("reentrancy")}
                          onClick={() => {
                            setActiveInspectorKey("reentrancy");
                            setInspectAgentId("agent-reentrancy");
                          }}
                        >
                          <circle className="fill-surface-container-lowest shadow" cx="0" cy="0" r="24"></circle>
                          <circle className="fill-surface-container" cx="0" cy="0" r="20"></circle>
                          <circle cx="0" cy="0" fill="none" r="24" stroke="#00dce5" strokeWidth="2"></circle>
                          <text className="fill-on-surface font-code-sm text-[9px] font-bold" textAnchor="middle" x="0" y="3">
                            RE-ENT
                          </text>
                          <text className="fill-on-surface-variant font-code-sm text-[9px]" textAnchor="middle" x="0" y="36">
                            Agent A1
                          </text>
                        </g>

                        {/* Node 2: Access Control Specialist */}
                        <g
                          className="agent-node cursor-pointer transition-transform hover:scale-110"
                          id="node-access"
                          transform="translate(440, 80)"
                          onMouseEnter={() => setActiveInspectorKey("access")}
                          onClick={() => {
                            setActiveInspectorKey("access");
                            setInspectAgentId("agent-access-control");
                          }}
                        >
                          <circle className="fill-surface-container-lowest shadow" cx="0" cy="0" r="24"></circle>
                          <circle className="fill-surface-container" cx="0" cy="0" r="20"></circle>
                          <circle cx="0" cy="0" fill="none" r="24" stroke="#ffb703" strokeWidth="2"></circle>
                          <text className="fill-on-surface font-code-sm text-[9px] font-bold" textAnchor="middle" x="0" y="3">
                            AUTH
                          </text>
                          <text className="fill-on-surface-variant font-code-sm text-[9px]" textAnchor="middle" x="0" y="36">
                            Agent A2
                          </text>
                        </g>

                        {/* Node 3: Business Logic Specialist */}
                        <g
                          className="agent-node cursor-pointer transition-transform hover:scale-110"
                          id="node-logic"
                          transform="translate(470, 250)"
                          onMouseEnter={() => setActiveInspectorKey("logic")}
                          onClick={() => {
                            setActiveInspectorKey("logic");
                            setInspectAgentId("agent-logic-invariants");
                          }}
                        >
                          <circle className="fill-surface-container-lowest shadow" cx="0" cy="0" r="24"></circle>
                          <circle className="fill-surface-container" cx="0" cy="0" r="20"></circle>
                          <circle cx="0" cy="0" fill="none" r="24" stroke="#d946ef" strokeWidth="2"></circle>
                          <text className="fill-on-surface font-code-sm text-[9px] font-bold" textAnchor="middle" x="0" y="3">
                            LOGIC
                          </text>
                          <text className="fill-on-surface-variant font-code-sm text-[9px]" textAnchor="middle" x="0" y="36">
                            Agent A3
                          </text>
                        </g>

                        {/* Node 4: Economic Security Specialist */}
                        <g
                          className="agent-node cursor-pointer transition-transform hover:scale-110"
                          id="node-econ"
                          transform="translate(300, 300)"
                          onMouseEnter={() => setActiveInspectorKey("econ")}
                          onClick={() => {
                            setActiveInspectorKey("econ");
                            setInspectAgentId("agent-economic-exploit");
                          }}
                        >
                          <circle className="fill-surface-container-lowest shadow" cx="0" cy="0" r="24"></circle>
                          <circle className="fill-surface-container" cx="0" cy="0" r="20"></circle>
                          <circle cx="0" cy="0" fill="none" r="24" stroke="#10b981" strokeWidth="2"></circle>
                          <text className="fill-on-surface font-code-sm text-[9px] font-bold" textAnchor="middle" x="0" y="3">
                            ECON
                          </text>
                          <text className="fill-on-surface-variant font-code-sm text-[9px]" textAnchor="middle" x="0" y="36">
                            Agent A4
                          </text>
                        </g>

                        {/* Node 5: Static Scanner Agent */}
                        <g
                          className="agent-node cursor-pointer transition-transform hover:scale-110"
                          id="node-static"
                          transform="translate(130, 240)"
                          onMouseEnter={() => setActiveInspectorKey("static")}
                          onClick={() => {
                            setActiveInspectorKey("static");
                            setInspectAgentId("agent-slither-mythril");
                          }}
                        >
                          <circle className="fill-surface-container-lowest shadow" cx="0" cy="0" r="24"></circle>
                          <circle className="fill-surface-container" cx="0" cy="0" r="20"></circle>
                          <circle cx="0" cy="0" fill="none" r="24" stroke="#3b82f6" strokeWidth="2"></circle>
                          <text className="fill-on-surface font-code-sm text-[9px] font-bold" textAnchor="middle" x="0" y="3">
                            AST-IR
                          </text>
                          <text className="fill-on-surface-variant font-code-sm text-[9px]" textAnchor="middle" x="0" y="36">
                            Agent A5
                          </text>
                        </g>
                      </svg>

                      {/* Floating Overlay Card: Agent Inspector */}
                      <div
                        className="absolute bottom-3 left-3 bg-surface-container-lowest/90 backdrop-blur-xl p-space-sm rounded shadow-md max-w-xs transition-opacity duration-300 z-20 cursor-pointer"
                        id="inspectorCard"
                        onClick={() => {
                          const agentKeyMap: Record<string, string> = {
                            reentrancy: "agent-reentrancy",
                            access: "agent-access-control",
                            logic: "agent-logic-invariants",
                            econ: "agent-economic-exploit",
                            static: "agent-slither-mythril",
                          };
                          setInspectAgentId(agentKeyMap[activeInspectorKey] || "agent-reentrancy");
                        }}
                      >
                        <div className="flex items-center justify-between gap-space-sm mb-1">
                          <span className="font-code-sm text-code-sm font-semibold text-on-surface" id="activeAgentLabel">
                            {inspectorData.title}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-secondary"></span>
                        </div>
                        <div className="font-code-sm text-[10px] text-on-surface-variant leading-relaxed" id="activeAgentDesc">
                          {inspectorData.desc}
                        </div>
                        <div className="mt-1 font-code-sm text-[9px] text-secondary font-semibold">
                          Click to inspect DID &amp; Neural Stream →
                        </div>
                      </div>

                      {/* Quorum badge pill */}
                      <div className="absolute top-3 right-3 bg-surface-container-lowest/90 backdrop-blur-xl px-2.5 py-1 rounded shadow-sm flex items-center gap-2 z-20">
                        <span className="font-code-sm text-[10px] text-on-surface-variant">CONSENSUS STATE:</span>
                        <span className="font-code-sm text-[10px] font-semibold text-secondary">5/5 UNANIMOUS</span>
                      </div>
                    </div>
                  ) : (
                    /* WebGL 3D Canvas View */
                    <div className="h-[380px] w-full rounded-lg overflow-hidden relative">
                      <SwarmSimulation3D
                        activeAgentId={inspectAgentId}
                        onSelectAgent={(agentId) => {
                          setInspectAgentId(agentId);
                        }}
                        isAuditing={isAuditing}
                        auditPhase={pipelineStatus === "VERIFYING" ? "analyzing" : "anchored"}
                        agents={allAgents}
                        onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
                        isFullscreen={is3DFullscreen}
                        onToggleFullscreen={setIs3DFullscreen}
                      />
                    </div>
                  )}

                  {/* Active Swarm Agent Pills Row */}
                  <div className="flex flex-wrap items-center gap-space-xs mt-space-md pt-space-xs">
                    <span className="font-code-sm text-code-sm text-on-surface-variant mr-1">Active Swarm:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveInspectorKey("reentrancy");
                        setInspectAgentId("agent-reentrancy");
                      }}
                      className={`agent-filter-btn px-2.5 py-1 rounded-full font-code-sm text-code-sm text-on-surface transition-colors flex items-center gap-1.5 cursor-pointer ${
                        activeInspectorKey === "reentrancy" ? "bg-surface-container-high font-semibold" : "bg-surface-container hover:bg-surface-container-highest"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-[#00dce5]"></span>
                      <span>Reentrancy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveInspectorKey("access");
                        setInspectAgentId("agent-access-control");
                      }}
                      className={`agent-filter-btn px-2.5 py-1 rounded-full font-code-sm text-code-sm text-on-surface transition-colors flex items-center gap-1.5 cursor-pointer ${
                        activeInspectorKey === "access" ? "bg-surface-container-high font-semibold" : "bg-surface-container hover:bg-surface-container-highest"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-[#ffb703]"></span>
                      <span>Access Control</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveInspectorKey("logic");
                        setInspectAgentId("agent-logic-invariants");
                      }}
                      className={`agent-filter-btn px-2.5 py-1 rounded-full font-code-sm text-code-sm text-on-surface transition-colors flex items-center gap-1.5 cursor-pointer ${
                        activeInspectorKey === "logic" ? "bg-surface-container-high font-semibold" : "bg-surface-container hover:bg-surface-container-highest"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-[#d946ef]"></span>
                      <span>Business Logic</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveInspectorKey("econ");
                        setInspectAgentId("agent-economic-exploit");
                      }}
                      className={`agent-filter-btn px-2.5 py-1 rounded-full font-code-sm text-code-sm text-on-surface transition-colors flex items-center gap-1.5 cursor-pointer ${
                        activeInspectorKey === "econ" ? "bg-surface-container-high font-semibold" : "bg-surface-container hover:bg-surface-container-highest"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                      <span>Economic Security</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveInspectorKey("static");
                        setInspectAgentId("agent-slither-mythril");
                      }}
                      className={`agent-filter-btn px-2.5 py-1 rounded-full font-code-sm text-code-sm text-on-surface transition-colors flex items-center gap-1.5 cursor-pointer ${
                        activeInspectorKey === "static" ? "bg-surface-container-high font-semibold" : "bg-surface-container hover:bg-surface-container-highest"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span>
                      <span>Static Scanner</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRegisterModalOpen(true)}
                      className="px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-surface-container font-code-sm text-code-sm text-on-surface-variant transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>Register Agent</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: AUDIT TARGET STUDIO & LIVE TELEMETRY */}
          <section className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin py-space-xl" id="interactive-telemetry">
            <div className="flex flex-col mb-space-lg">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Audit Target Studio</span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-medium tracking-tight">
                Target Bytecode &amp; Real-Time Telemetry.
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
                Select a canonical vulnerability target or paste your Solidity source code to trigger distributed AST parsing and watch the 5-agent verification sequence execute.
              </p>
            </div>

            {/* Split Studio Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
              {/* Left Card: Smart Contract Code Editor */}
              <div className="lg:col-span-6 flex flex-col bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm">
                {/* Preset Selector Strip */}
                <div className="flex flex-col gap-space-xs mb-space-md">
                  <label className="font-code-sm text-code-sm text-on-surface-variant uppercase">Target Vulnerability Preset</label>
                  <div className="relative">
                    <select
                      className="w-full bg-surface-container-low text-on-surface font-code-sm text-code-sm px-3 py-2 rounded focus:outline-none focus:bg-surface-container cursor-pointer transition-colors appearance-none pr-8"
                      id="contractPresetSelect"
                      value={selectedPresetKey}
                      onChange={(e) => setSelectedPresetKey(e.target.value)}
                    >
                      <option value="reentrancy">Classic Reentrancy Vault (EtherVault.sol)</option>
                      <option value="txorigin">Privilege Bypass &amp; tx.origin (MultiSigAuth.sol)</option>
                      <option value="precision">Precision Loss &amp; Reward Drift (StakingPool.sol)</option>
                      <option value="oracle">Spot Price Oracle Manipulation (LendingPair.sol)</option>
                      <option value="guarded">Guarded Vault [CEI Compliant - Secure] (SecureVault.sol)</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-on-surface-variant text-[18px] pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>

                {/* File Header Tab */}
                <div className="flex items-center justify-between bg-surface-container-low px-space-md py-2 rounded-t-lg">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">code</span>
                    <span className="font-code-sm text-code-sm font-semibold text-on-surface" id="contractFileName">
                      {activePreset.file}
                    </span>
                    <span className="font-code-sm text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                      Solidity 0.8.20
                    </span>
                  </div>
                  <span className="font-code-sm text-[10px] text-on-surface-variant" id="lineCountBadge">
                    {activePreset.lines}
                  </span>
                </div>

                {/* High-Contrast Syntax Highlight Code Editor */}
                <div className="relative bg-[#18181b] text-white rounded-b-lg p-space-md font-code-sm text-code-sm overflow-x-auto min-h-[320px] max-h-[420px]">
                  <pre
                    className="font-code-sm text-code-sm leading-relaxed text-zinc-300"
                    id="solidityEditor"
                    dangerouslySetInnerHTML={{ __html: activePreset.code }}
                  />
                </div>

                {/* Action Row */}
                <div className="flex items-center justify-between mt-space-md pt-space-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedPresetKey("reentrancy")}
                    className="px-space-md py-2 rounded bg-surface-container text-on-surface hover:bg-surface-container-high font-body-sm text-body-sm transition-colors cursor-pointer"
                    id="resetCodeBtn"
                  >
                    Reset Preset
                  </button>
                  <button
                    type="button"
                    onClick={handleRunAudit}
                    disabled={isAuditing}
                    className="px-space-md py-2 rounded bg-primary text-on-primary hover:bg-primary-container font-body-sm text-body-sm transition-colors flex items-center gap-space-xs cursor-pointer shadow-sm"
                    id="executeAuditBtn"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isAuditing ? "sync" : "play_arrow"}
                    </span>
                    <span id="auditBtnText">
                      {isAuditing ? "Swarm Reasoning Active..." : "Run Multi-Agent Consensus"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Card: Telemetry Pipeline & Findings */}
              <div className="lg:col-span-6 flex flex-col gap-space-md">
                {/* Execution Pipeline Card */}
                <div className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm">
                  <div className="flex items-center justify-between mb-space-md">
                    <span className="font-code-sm text-code-sm uppercase text-on-surface-variant font-semibold">
                      Hedera Execution Pipeline
                    </span>
                    <span
                      className={`font-code-sm text-[10px] px-2 py-0.5 rounded font-semibold ${
                        pipelineStatus === "VERIFYING"
                          ? "bg-surface-container-highest text-on-surface animate-pulse"
                          : "bg-secondary-fixed text-on-secondary-fixed"
                      }`}
                      id="pipelineStatusBadge"
                    >
                      STATE: {pipelineStatus}
                    </span>
                  </div>

                  {/* Step Progression Indicator */}
                  <div className="grid grid-cols-5 gap-space-xs text-center">
                    {[
                      { num: "01", label: "Quote", step: 1 },
                      { num: "02", label: "5 Agents", step: 2 },
                      { num: "03", label: "Quorum", step: 3 },
                      { num: "04", label: "Verifier", step: 4 },
                      { num: "05", label: "HCS Proof", step: 5 },
                    ].map((st) => {
                      const isActive = pipelineStep >= st.step;
                      return (
                        <div
                          key={st.num}
                          className={`flex flex-col items-center gap-1 p-2 rounded transition-all ${
                            isActive ? "bg-secondary-fixed" : "bg-surface-container"
                          }`}
                        >
                          <span className="font-code-sm text-[10px] text-secondary font-bold">{st.num}</span>
                          <span className="font-code-sm text-[10px] text-on-surface font-medium">{st.label}</span>
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-secondary" : "bg-outline"}`}
                          ></span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Consensus Findings Report Card */}
                <div className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-space-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-code-sm text-[11px] font-bold uppercase ${activePreset.severityClass}`}
                          id="vulnSeverityBadge"
                        >
                          {activePreset.severity}
                        </span>
                        <span className="font-headline-sm text-[16px] text-on-surface font-medium" id="vulnTypeTitle">
                          {activePreset.title}
                        </span>
                      </div>
                      <span className="font-code-sm text-code-sm text-on-surface-variant">Quorum: 5/5</span>
                    </div>

                    {/* Finding Detail Box */}
                    <div className="p-space-md rounded bg-surface-container-low mb-space-md" id="findingContentBox">
                      <p className="font-body-sm text-body-sm text-on-surface">{activePreset.desc}</p>
                      {/* Proposed Remediation */}
                      <div className="mt-space-sm pt-space-sm bg-surface-container-lowest p-space-sm rounded">
                        <div className="font-code-sm text-[11px] text-secondary font-semibold uppercase mb-1">
                          Recommended Remediation:
                        </div>
                        <p className="font-code-sm text-code-sm text-on-surface-variant">{activePreset.fix}</p>
                      </div>
                    </div>

                    {/* View Full Report Trigger */}
                    <button
                      type="button"
                      onClick={() => setIsFullReportOpen(true)}
                      className="w-full py-2 px-3 rounded bg-surface-container text-on-surface hover:bg-surface-container-high font-body-sm text-body-sm transition-colors flex items-center justify-center gap-2 mb-3 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">description</span>
                      <span>View Full Formal Audit Report &amp; PDF</span>
                    </button>
                  </div>

                  {/* Hedera Attestation Footnote Card */}
                  <div className="p-space-sm rounded bg-surface-container flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-code-sm text-[10px] text-on-surface-variant uppercase">
                        Hedera Consensus Transaction
                      </span>
                      <span className="font-code-sm text-[10px] text-secondary font-medium">
                        Verified • Consensus Timestamped
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <a
                        href="https://hashscan.io/testnet/topic/0.0.10417469"
                        target="_blank"
                        rel="noreferrer"
                        className="font-code-sm text-code-sm font-semibold text-on-surface hover:underline truncate"
                      >
                        0.0.10417469@1711728391.849204003
                      </a>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">lock</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: EDITORIAL CAPABILITY GRID */}
          <section className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin py-space-xl">
            <div className="flex flex-col mb-space-lg">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Architectural Pillars</span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-medium tracking-tight">
                Engineered for Institutional Verification.
              </h2>
            </div>

            {/* 4-Column High-Contrast Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
              {/* Feature 1 */}
              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center mb-space-md text-on-surface">
                    <span className="material-symbols-outlined text-[20px]">account_tree</span>
                  </div>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">01 // PARSER</span>
                  <h3 className="font-headline-sm text-[18px] text-on-surface font-normal mt-1 mb-2">Structured AST Parsing</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Deconstructs raw bytecode and Solidity contracts into Abstract Syntax Trees for semantic invariant validation without heuristic guesswork.
                  </p>
                </div>
                <div className="mt-space-lg pt-space-sm font-code-sm text-code-sm text-secondary font-medium">
                  AST v0.8.28 Compliant
                </div>
              </div>

              {/* Feature 2 */}
              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center mb-space-md text-on-surface">
                    <span className="material-symbols-outlined text-[20px]">badge</span>
                  </div>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">02 // IDENTITY</span>
                  <h3 className="font-headline-sm text-[18px] text-on-surface font-normal mt-1 mb-2">Sovereign did:hedera</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Each agent operates with an on-chain W3C Decentralized Identifier. Reputation scores and validation track records are cryptographically pinned.
                  </p>
                </div>
                <div className="mt-space-lg pt-space-sm font-code-sm text-code-sm text-on-surface font-medium">
                  W3C DID Standard
                </div>
              </div>

              {/* Feature 3 */}
              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center mb-space-md text-on-surface">
                    <span className="material-symbols-outlined text-[20px]">payments</span>
                  </div>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">03 // RAILS</span>
                  <h3 className="font-headline-sm text-[18px] text-on-surface font-normal mt-1 mb-2">x402 Micropayment Rails</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Automated machine-to-machine streaming micro-settlement in HBAR. Agents receive instant bounties only upon verified consensus settlement.
                  </p>
                </div>
                <div className="mt-space-lg pt-space-sm font-code-sm text-code-sm text-on-surface font-medium">
                  Sub-second Payment
                </div>
              </div>

              {/* Feature 4 */}
              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center mb-space-md text-on-surface">
                    <span className="material-symbols-outlined text-[20px]">verified_user</span>
                  </div>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">04 // ANCHOR</span>
                  <h3 className="font-headline-sm text-[18px] text-on-surface font-normal mt-1 mb-2">Immutable HCS Proofs</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Audit outputs, agent dispute hashes, and remediation approvals are sequenced onto Hedera Hashgraph with nanosecond timestamp ordering.
                  </p>
                </div>
                <div className="mt-space-lg pt-space-sm font-code-sm text-code-sm text-secondary font-medium">
                  Topic 0.0.10417469
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 6: POETIC STATEMENT INTERSTITIAL BANNER */}
          <section className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin pt-space-md pb-space-xl">
            <div className="relative overflow-hidden rounded-xl bg-primary text-on-primary p-space-lg md:p-space-xl flex flex-col items-center text-center shadow-lg">
              {/* Minimalist geometric ring accent */}
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border border-surface-variant/20 pointer-events-none"></div>
              <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full border border-surface-variant/10 pointer-events-none"></div>

              <div className="relative z-10 max-w-2xl flex flex-col items-center">
                <span className="font-label-caps text-label-caps uppercase text-secondary-container mb-space-xs tracking-widest">
                  The Consensus Manifesto
                </span>
                <blockquote className="font-headline-md text-headline-md font-normal leading-relaxed text-on-primary my-space-md">
                  “Embrace mathematical certainty and find sovereign security in consensus.”
                </blockquote>
                <p className="font-body-sm text-body-sm text-primary-fixed-dim max-w-lg mb-space-lg">
                  No centralized auditor. No blind trust. Only distributed intelligence challenged and ordered by Hedera Consensus Service.
                </p>

                <div className="flex items-center gap-space-sm">
                  <button
                    type="button"
                    onClick={() => setIsPoolModalOpen(true)}
                    className="px-space-md py-2.5 rounded bg-surface-container-lowest text-on-surface font-body-sm text-body-sm hover:bg-surface-container transition-colors cursor-pointer"
                    id="bannerDeployBtn"
                  >
                    Deploy New Swarm
                  </button>
                  <Link
                    className="px-space-md py-2.5 rounded bg-primary-container text-on-primary font-body-sm text-body-sm hover:bg-primary-container/80 transition-colors"
                    href="/feedback"
                  >
                    Read Whitepaper v1.0
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ── Publication-Grade Editorial Footer ────────────────────── */}
      <footer className="w-full bg-surface-container-low mt-space-xl shadow-[0_-1px_8px_rgba(0,0,0,0.02)] border-t border-outline-variant/30">
        <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin py-space-xl flex flex-col gap-space-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-space-lg">
            <div className="flex flex-col gap-space-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                Autonomous Consensus Engine
              </span>
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

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-space-md pt-space-lg border-t border-outline-variant/20">
            <div className="flex items-center gap-space-md">
              <span className="font-display-lg text-display-lg text-on-surface font-normal tracking-tight">SwarmProof</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-space-md text-on-surface-variant">
              <span className="font-code-sm text-code-sm">
                © 2026 SwarmProof Network. Anchored on Hedera Consensus Service.
              </span>
              <div className="flex items-center gap-space-sm font-code-sm text-code-sm">
                <span className="text-on-surface-variant">•</span>
                <a
                  href="https://hashscan.io/testnet/topic/0.0.10417469"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  Topic: 0.0.10417469
                </a>
                <span className="text-on-surface-variant">•</span>
                <span className="text-secondary font-medium">Testnet Active</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Modals Retained & Connected ────────────────────────────── */}
      {/* 1. Agent Detail Inspector Modal */}
      {inspectAgentId && (
        <AgentInspectorModal
          agentId={inspectAgentId}
          onClose={() => setInspectAgentId(null)}
          isAuditing={isAuditing}
          actualFindings={
            auditResult?.report?.findings || [
              {
                id: activePreset.category,
                category: activePreset.category,
                severity: activePreset.severity,
                title: activePreset.title,
                locations: ["lines 12-16"],
                evidence: [activePreset.desc],
              },
            ]
          }
          onRunSingleAgentSimulation={handleTriggerBeams}
          agents={allAgents}
        />
      )}

      {/* 2. Register New Agent Modal */}
      {isRegisterModalOpen && (
        <RegisterAgentModal
          onClose={() => setIsRegisterModalOpen(false)}
          onRegistered={(newAgent) => {
            setAllAgents((prev) => ({ ...prev, [newAgent.id]: newAgent }));
            setInspectAgentId(newAgent.id);
          }}
        />
      )}

      {/* 3. Live Audit Task Pool Modal */}
      {isPoolModalOpen && <AuditPoolModal onClose={() => setIsPoolModalOpen(false)} />}

      {/* 4. Full Formal Audit Report Modal */}
      {isFullReportOpen && (
        <FullAuditReportModal
          auditResult={
            (auditResult || {
              id: "audit-demo-latest",
              status: "done",
              task: {
                contractName: activePreset.file.replace(".sol", ""),
                source: activePreset.rawCode,
                network: "hedera-testnet",
              },
              report: {
                result: activePreset.verdict,
                consensusSummary: activePreset.desc,
                findings: [
                  {
                    id: activePreset.category,
                    category: activePreset.category,
                    severity: activePreset.severity,
                    title: activePreset.title,
                    locations: ["lines 12-16"],
                    evidence: [activePreset.desc],
                  },
                ],
                reportHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
              },
              proof: {
                hcsTopicId: "0.0.10417469",
                sequenceNumber: 42,
                consensusTimestamp: "1711728391.849204003",
                reportHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                verified: true,
              },
            }) as any
          }
          onClose={() => setIsFullReportOpen(false)}
        />
      )}
    </div>
  );
}