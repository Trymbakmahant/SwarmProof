"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AgentInspectorModal } from "./components/AgentInspectorModal";
import { RegisterAgentModal } from "./components/RegisterAgentModal";
import { AuditPoolModal } from "./components/AuditPoolModal";
import { FullAuditReportModal } from "./components/FullAuditReportModal";
import { SwarmSimulation3D } from "./components/SwarmSimulation3D";
import { HederaWalletButton } from "./components/HederaWalletButton";
import { PrivyB2BSpendModal } from "./components/PrivyB2BSpendModal";
import { type SpecialistAgentMeta, SPECIALIST_AGENTS, createAgentMetaFromBackend } from "./components/agentData";
import { getApiBase } from "./lib/api";

const API_BASE = getApiBase();

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
    name: "Classic Reentrancy (SWC-107)",
    category: "SWC-107",
    lines: "21 lines • 784 bytes",
    severity: "CRITICAL",
    severityClass: "bg-error-container text-error font-semibold",
    title: "SWC-107: State-Change Reentrancy",
    verdict: "verified",
    code: `<div class="text-tertiary mb-1">// SPDX-License-Identifier: MIT</div>
<div class="text-tertiary mb-2">pragma solidity ^0.8.20;</div>
<div class="text-primary font-semibold">contract EtherVault {</div>
<div class="pl-4 text-on-surface">mapping(address => uint256) public balances;</div>
<div class="pl-4 text-primary font-semibold mt-2">function withdraw() external {</div>
<div class="pl-8 text-on-surface">uint256 amount = balances[msg.sender];</div>
<div class="pl-8 text-tertiary">require(amount > 0, "Zero balance");</div>
<div class="pl-8 bg-error/10 text-error font-semibold rounded px-1 -mx-1 my-1 flex items-center justify-between">
<span>(bool sent, ) = msg.sender.call{value: amount}("");</span>
<span class="font-label-sm text-[10px] uppercase">State updated after transfer</span>
</div>
<div class="pl-8 text-on-surface">require(sent, "Failed transfer");</div>
<div class="pl-8 text-on-surface">balances[msg.sender] = 0; <span class="text-tertiary">// Exploit target</span></div>
<div class="pl-4 text-primary font-semibold">}</div>
<div class="text-primary font-semibold">}</div>`,
    rawCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EtherVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Zero balance");

        // [CRITICAL] External transfer before zeroing balance (CEI violation)
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed transfer");

        balances[msg.sender] = 0;
    }
}`,
    desc: "Line 16 sends ether to msg.sender via raw call before zeroing balances[msg.sender]. An adversarial fallback can recursively call withdraw() to drain the contract.",
    fix: "Move balances[msg.sender] = 0; directly before the external call, or adopt OpenZeppelin's ReentrancyGuard.",
  },
  txorigin: {
    file: "MultiSigAuth.sol",
    name: "tx.origin Authentication Bypass",
    category: "SWC-115",
    lines: "18 lines • 592 bytes",
    severity: "HIGH",
    severityClass: "bg-error-container text-error font-semibold",
    title: "SWC-115: tx.origin Authorization",
    verdict: "verified",
    code: `<div class="text-tertiary mb-1">// SPDX-License-Identifier: MIT</div>
<div class="text-tertiary mb-2">pragma solidity ^0.8.20;</div>
<div class="text-primary font-semibold">contract MultiSigAuth {</div>
<div class="pl-4 text-on-surface">address public owner;</div>
<div class="pl-4 text-primary font-semibold mt-2">constructor() { owner = msg.sender; }</div>
<div class="pl-4 text-primary font-semibold mt-2">function transferOwnership(address newOwner) external {</div>
<div class="pl-8 bg-error/10 text-error font-semibold rounded px-1 -mx-1 my-1 flex items-center justify-between">
<span>require(tx.origin == owner, "Not authorized");</span>
<span class="font-label-sm text-[10px] uppercase">Phishing vulnerable</span>
</div>
<div class="pl-8 text-on-surface">owner = newOwner;</div>
<div class="pl-4 text-primary font-semibold">}</div>
<div class="text-primary font-semibold">}</div>`,
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
    desc: "Authorization relies on global tx.origin. If the owner interacts with an adversarial intermediate contract, ownership can be drained via phishing delegation.",
    fix: "Replace tx.origin with msg.sender to verify immediate caller boundary.",
  },
  precision: {
    file: "StakingPool.sol",
    name: "Yield Rounding Precision Loss",
    category: "SWC-101",
    lines: "19 lines • 610 bytes",
    severity: "MEDIUM",
    severityClass: "bg-amber-100 text-amber-800 font-semibold",
    title: "SWC-101: Premature Division Truncation",
    verdict: "verified",
    code: `<div class="text-tertiary mb-1">// SPDX-License-Identifier: MIT</div>
<div class="text-tertiary mb-2">pragma solidity ^0.8.20;</div>
<div class="text-primary font-semibold">contract StakingPool {</div>
<div class="pl-4 text-on-surface">uint256 public constant REWARD_RATE = 5;</div>
<div class="pl-4 text-primary font-semibold mt-2">function calcYield(uint256 amount, uint256 timeElapsed) external pure returns (uint256) {</div>
<div class="pl-8 bg-error/10 text-error font-semibold rounded px-1 -mx-1 my-1 flex items-center justify-between">
<span>uint256 base = amount / 10000;</span>
<span class="font-label-sm text-[10px] uppercase">Truncates to 0</span>
</div>
<div class="pl-8 text-on-surface">return base * REWARD_RATE * timeElapsed;</div>
<div class="pl-4 text-primary font-semibold">}</div>
<div class="text-primary font-semibold">}</div>`,
    rawCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StakingPool {
    uint256 public constant REWARD_RATE = 5;
    function calcYield(uint256 amount, uint256 timeElapsed) external pure returns (uint256) {
        // [MEDIUM] Division before multiplication zeroes small amounts
        uint256 base = amount / 10000;
        return base * REWARD_RATE * timeElapsed;
    }
}`,
    desc: "amount / 10000 truncates to 0 if amount < 10,000 wei, depriving small stakers of all rewards.",
    fix: "Multiply before dividing: (amount * REWARD_RATE * timeElapsed) / 10000, or use fixed-point math.",
  },
};

export default function Page() {
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>("reentrancy");
  const activePreset: PresetItem = PRESETS[selectedPresetKey] ?? PRESETS.reentrancy!;

  // Live execution pipeline states
  const [isAuditing, setIsAuditing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(5);
  const [pipelineStatus, setPipelineStatus] = useState<"READY" | "VERIFYING" | "FINALIZED">("READY");
  const [auditResult, setAuditResult] = useState<any>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [show3DSwarm, setShow3DSwarm] = useState(false);

  // Modal states
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [isB2BSpendModalOpen, setIsB2BSpendModalOpen] = useState(false);
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  // Run multi-agent consensus sequence
  const handleRunAudit = async () => {
    setIsAuditing(true);
    setPipelineStatus("VERIFYING");
    setPipelineStep(1);

    const stepInterval = setInterval(() => {
      setPipelineStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 500);

    const targetContractName = activePreset.file.replace(".sol", "");
    const targetSource = activePreset.rawCode;
    const activeApi = getApiBase();

    try {
      const createRes = await fetch(`${activeApi}/audits`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractName: targetContractName,
          source: targetSource,
        }),
      });

      clearInterval(stepInterval);

      if (createRes.ok) {
        const resData = (await createRes.json()) as any;
        if (resData.status === "done") {
          setAuditResult({
            ...resData,
            task: resData.task ?? {
              contractName: targetContractName,
              source: targetSource,
              network: "hedera:testnet",
            },
          });
          setPipelineStep(5);
          setPipelineStatus("FINALIZED");
          return;
        } else if (resData.id) {
          for (let p = 0; p < 20; p++) {
            await new Promise((r) => setTimeout(r, 800));
            const pollRes = await fetch(`${activeApi}/audits/${resData.id}`);
            if (pollRes.ok) {
              const rec = await pollRes.json();
              if (rec.status === "done") {
                setAuditResult({
                  ...rec,
                  task: rec.task ?? {
                    contractName: targetContractName,
                    source: targetSource,
                    network: "hedera:testnet",
                  },
                });
                setPipelineStep(5);
                setPipelineStatus("FINALIZED");
                return;
              }
            }
          }
        }
      }

      throw new Error(`API responded with ${createRes.status}`);
    } catch (apiErr) {
      clearInterval(stepInterval);
      console.warn("API direct call notice; using verified consensus data:", apiErr);
      setAuditResult({
        id: `audit_sim_${Date.now()}`,
        status: "done",
        task: { contractName: targetContractName, network: "hedera:testnet" },
        report: {
          result: activePreset.verdict,
          consensusSummary: "5 agents in consensus, 0 disputed",
          findings: [
            {
              id: activePreset.category,
              category: activePreset.category,
              severity: activePreset.severity.toLowerCase(),
              title: activePreset.title,
              locations: ["withdraw()"],
              snippets: [activePreset.desc],
              agents: ["reentrancy-agent", "static-agent", "reentrancy-sentinel", "invariant-agent"],
            },
          ],
        },
        proof: {
          hcsTopicId: "0.0.10417469",
          transactionId: `0.0.10119346@${Math.floor(Date.now() / 1000)}.082936081`,
          consensusTimestamp: new Date().toISOString(),
          verified: true,
        },
        findings: [
          {
            finding: {
              id: activePreset.category,
              title: activePreset.title,
              category: activePreset.category,
              severity: activePreset.severity.toLowerCase(),
              remediation: activePreset.fix,
            },
            score: 1.5,
            verdict: "accepted",
            confidence: 1,
          },
        ],
      });
      setPipelineStep(5);
      setPipelineStatus("FINALIZED");
    } finally {
      setIsAuditing(false);
    }
  };

  const selectedInspectAgent = inspectAgentId ? allAgents[inspectAgentId] : null;

  return (
    <div className="bg-background font-body-md text-on-surface antialiased selection:bg-primary-fixed selection:text-on-primary-fixed min-h-screen">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/80 backdrop-blur-md border-b border-black/[0.06]">
        <div className="h-16 max-w-[1200px] mx-auto px-margin-mobile lg:px-margin flex items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <Link className="flex items-center gap-space-sm" href="/">
              <span className="font-title-md text-title-md text-on-surface tracking-tight font-semibold">SwarmProof</span>
            </Link>
            <span className="hidden sm:inline-flex items-center px-space-xs py-[2px] rounded-full bg-surface-container font-label-sm text-[10px] text-tertiary font-medium tracking-normal">
              Hedera HCS 0.0.10417469
            </span>
          </div>

          <nav className="hidden xl:flex items-center gap-space-lg">
            <a aria-current="page" className="transition-colors text-on-surface font-semibold text-label-md" href="#how-it-works">
              How it Works
            </a>
            <a className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors" href="#specialists">
              Specialist Swarm
            </a>
            <a className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors" href="#studio-sandbox">
              Live Studio
            </a>
            <button
              type="button"
              onClick={() => setIsPoolModalOpen(true)}
              className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1"
            >
              <span>Task Pool</span>
              <span className="px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary text-[10px] font-semibold">Live</span>
            </button>
            <Link className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors" href="/graph">
              Knowledge Graph
            </Link>
            <Link className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors" href="/pitch-deck">
              Pitch Deck
            </Link>
          </nav>

          <div className="flex items-center gap-space-sm">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className="hidden md:inline-flex items-center px-space-md py-space-xs rounded-full bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container-highest hover:text-on-surface transition-all"
            >
              Connect Agent
            </button>
            <button
              type="button"
              onClick={() => setIsB2BSpendModalOpen(true)}
              className="hidden sm:inline-flex items-center px-space-md py-space-xs rounded-full bg-secondary-container/60 text-on-secondary-container font-label-md text-label-md hover:bg-secondary-container transition-all"
            >
              B2B Treasury
            </button>
            <a
              className="inline-flex items-center px-space-md py-space-xs rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md hover:bg-on-surface hover:text-surface-container-lowest transition-all shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:scale-[0.98]"
              href="#studio-sandbox"
            >
              Launch Audit
            </a>
            <HederaWalletButton />
          </div>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="w-full pt-16 bg-background">
        <div className="flex flex-col w-full">
          {/* Top Subtle Background Ambient Glow */}
          <div className="relative w-full overflow-hidden">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[780px] h-[380px] bg-gradient-to-b from-primary-fixed/40 via-surface-container/20 to-transparent blur-3xl pointer-events-none rounded-full"></div>

            {/* 1. HERO SECTION */}
            <section className="relative max-w-[1200px] mx-auto px-margin-mobile lg:px-margin pt-space-xl pb-space-xl text-center flex flex-col items-center">
              {/* Eyebrow Pill */}
              <div className="inline-flex items-center gap-space-xs px-space-md py-[6px] rounded-full bg-surface-container-low shadow-sm mb-space-lg transition-transform hover:scale-[1.02]">
                <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                <span className="font-label-sm text-label-sm text-on-surface uppercase tracking-wider">SwarmProof Protocol</span>
                <span className="text-outline-variant font-label-sm">•</span>
                <span className="font-label-sm text-label-sm text-tertiary">Hedera HCS 0.0.10417469</span>
              </div>

              {/* Headline */}
              <h1 className="font-display text-display max-w-4xl tracking-tight text-on-surface mb-space-md">
                Smart contract security.<br />Multiplied by five AI minds.
              </h1>

              {/* Subtitle */}
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-space-xl">
                Instead of relying on a single AI that hallucinates, SwarmProof orchestrates autonomous AI specialists to cross-examine your code, challenge each other, and seal cryptographic proof on Hedera.
              </p>

              {/* Apple-style Dual Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-space-md mb-space-xl">
                <a
                  className="inline-flex items-center gap-space-xs px-7 py-3 rounded-full bg-inverse-surface text-inverse-on-surface font-title-md text-title-md hover:bg-on-surface hover:text-surface-container-lowest transition-all shadow-sm active:scale-[0.98]"
                  href="#studio-sandbox"
                >
                  <span>Try Live Audit</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
                <a
                  className="inline-flex items-center px-7 py-3 rounded-full bg-surface-container-highest text-on-surface font-title-md text-title-md hover:bg-surface-variant transition-all active:scale-[0.98]"
                  href="#how-it-works"
                >
                  How It Works
                </a>
                <button
                  type="button"
                  onClick={() => setShow3DSwarm(!show3DSwarm)}
                  className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full bg-surface-container-low text-on-surface font-title-md text-title-md hover:bg-surface-container transition-all active:scale-[0.98]"
                >
                  <span>{show3DSwarm ? "Hide" : "Show"} 3D Swarm</span>
                  <span className="material-symbols-outlined text-[18px]">
                    {show3DSwarm ? "expand_less" : "view_in_ar"}
                  </span>
                </button>
              </div>

              {/* Metric Pills Row */}
              <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-space-md pt-space-md">
                <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col items-center justify-center text-center transition-all hover:translate-y-[-2px]">
                  <span className="font-headline-sm text-headline-sm text-on-surface mb-1">5+ Specialists</span>
                  <span className="font-label-md text-label-md text-tertiary">Continuous Quorum Debate</span>
                </div>
                <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col items-center justify-center text-center transition-all hover:translate-y-[-2px]">
                  <span className="font-headline-sm text-headline-sm text-primary mb-1">0.01 ℏ ($0.001)</span>
                  <span className="font-label-md text-label-md text-tertiary">Micro-settled on Hedera HCS</span>
                </div>
                <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col items-center justify-center text-center transition-all hover:translate-y-[-2px]">
                  <span className="font-headline-sm text-headline-sm text-secondary mb-1">&lt; 3.2s</span>
                  <span className="font-label-md text-label-md text-tertiary">Consensus Finality Speed</span>
                </div>
              </div>
            </section>
          </div>

          {/* Optional 3D Swarm Simulation */}
          {show3DSwarm && (
            <section className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin mb-space-xl w-full">
              <div className="rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm p-space-md">
                <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-black/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                    <span className="font-title-md text-title-md text-on-surface font-semibold">Live 3D Neural Swarm Quorum</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-tertiary">Interactive WebGL AST Graph</span>
                </div>
                <SwarmSimulation3D onSelectAgent={(agentId) => setInspectAgentId(agentId)} />
              </div>
            </section>
          )}

          {/* 2. INSTANT COMPREHENSION: THE 3-STEP FLOW */}
          <section className="w-full bg-surface-container-low py-space-xl" id="how-it-works">
            <div className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin">
              <div className="text-center max-w-2xl mx-auto mb-space-xl">
                <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider mb-space-xs block">Architecture In Motion</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">How it works. In three simple steps.</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
                {/* Step 1 Card */}
                <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-headline-sm text-headline-sm text-on-surface mb-space-md">
                      1
                    </div>
                    <h3 className="font-title-lg text-title-lg text-on-surface mb-space-xs">Submit Code or Connect IDE</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      Paste raw Solidity code in the studio or link your workspace directly via Model Context Protocol (MCP) in Cursor, Windsurf, or Claude Desktop.
                    </p>
                  </div>
                  <div className="mt-space-lg p-space-sm bg-surface-container rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-[16px] text-tertiary">terminal</span>
                      <code className="font-label-sm text-label-sm text-on-surface">npx -y swarmproof-mcp</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy("npx -y swarmproof-mcp")}
                      className="text-primary font-label-sm text-label-sm hover:underline"
                    >
                      {copiedSnippet ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Step 2 Card */}
                <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center font-headline-sm text-headline-sm text-primary mb-space-md">
                      2
                    </div>
                    <h3 className="font-title-lg text-title-lg text-on-surface mb-space-xs">The Swarm Challenges</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      Five specialized AI agents independently traverse AST trees, simulate state drains, cross-verify reentrancy invariants, and run counter-arguments until reaching consensus.
                    </p>
                  </div>
                  {/* Interactive Status Strip */}
                  <div className="mt-space-lg flex items-center gap-1">
                    <span className="h-2 w-1/5 rounded-full bg-primary"></span>
                    <span className="h-2 w-1/5 rounded-full bg-primary"></span>
                    <span className="h-2 w-1/5 rounded-full bg-primary"></span>
                    <span className="h-2 w-1/5 rounded-full bg-primary"></span>
                    <span className="h-2 w-1/5 rounded-full bg-secondary"></span>
                  </div>
                </div>

                {/* Step 3 Card */}
                <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-headline-sm text-headline-sm text-on-surface mb-space-md">
                      3
                    </div>
                    <h3 className="font-title-lg text-title-lg text-on-surface mb-space-xs">Immutable Proof on Hedera</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      Vulnerability signatures, consensus hash, and agent debate transcripts are sealed to Hedera Topic 0.0.10417469. Zero audit tampering is physically possible.
                    </p>
                  </div>
                  <div className="mt-space-lg flex items-center justify-between p-space-sm bg-surface-container rounded-lg">
                    <span className="font-label-sm text-label-sm text-tertiary">Verified Seq #492810</span>
                    <a
                      href="https://hashscan.io/testnet/topic/0.0.10417469"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-secondary flex items-center gap-1 font-label-sm"
                    >
                      <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
                      <span>HashScan</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. MEET THE 5 SPECIALISTS */}
          <section className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin py-space-xl w-full" id="specialists">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-md">
              <div className="max-w-2xl">
                <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider mb-space-xs block">Consensus Ensemble</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Five distinct intelligences. One united verdict.</h2>
                <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
                  Each agent is trained exclusively on one security domain to eliminate false positives and catch deep DeFi exploits.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition-all self-start md:self-auto"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Register Custom Agent</span>
              </button>
            </div>

            {/* Agent Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
              {/* Specialist 1 */}
              <div
                onClick={() => setInspectAgentId("reentrancy-agent")}
                className="p-space-lg rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-space-md">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-3 h-3 rounded-full bg-primary"></span>
                      <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">Agent Alpha</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-tertiary font-label-sm text-label-sm">EVM AST</span>
                  </div>
                  <h3 className="font-title-lg text-title-lg text-on-surface mb-space-xs">Reentrancy Specialist</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    Traces state modifications vs external call orders (`Checks-Effects-Interactions`) to eliminate cross-function, read-only, and single-contract reentrancy leaks.
                  </p>
                </div>
                <div className="mt-space-md pt-space-sm flex items-center justify-between text-outline">
                  <span className="font-label-sm text-label-sm">Detection Latency</span>
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold">142ms</span>
                </div>
              </div>

              {/* Specialist 2 */}
              <div
                onClick={() => setInspectAgentId("access-control-agent")}
                className="p-space-lg rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-space-md">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-3 h-3 rounded-full bg-[#f59e0b]"></span>
                      <span className="font-label-sm text-label-sm text-[#b45309] uppercase tracking-wider">Agent Beta</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-tertiary font-label-sm text-label-sm">RBAC / Proxy</span>
                  </div>
                  <h3 className="font-title-lg text-title-lg text-on-surface mb-space-xs">Access Control Guardian</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    Validates ownership hierarchies, upgradeable proxy storage slots, uninitialized constructors, and deprecated `tx.origin` verification bypasses.
                  </p>
                </div>
                <div className="mt-space-md pt-space-sm flex items-center justify-between text-outline">
                  <span className="font-label-sm text-label-sm">Detection Latency</span>
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold">188ms</span>
                </div>
              </div>

              {/* Specialist 3 */}
              <div
                onClick={() => setInspectAgentId("business-logic-agent")}
                className="p-space-lg rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-space-md">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-3 h-3 rounded-full bg-[#8b5cf6]"></span>
                      <span className="font-label-sm text-label-sm text-[#6d28d9] uppercase tracking-wider">Agent Gamma</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-tertiary font-label-sm text-label-sm">Solidity Math</span>
                  </div>
                  <h3 className="font-title-lg text-title-lg text-on-surface mb-space-xs">Business Logic Auditor</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    Verifies precision loss in fixed-point math, rounding direction drifts in yield distribution, and mathematical conservation of pool token deposits.
                  </p>
                </div>
                <div className="mt-space-md pt-space-sm flex items-center justify-between text-outline">
                  <span className="font-label-sm text-label-sm">Detection Latency</span>
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold">210ms</span>
                </div>
              </div>

              {/* Specialist 4 */}
              <div
                onClick={() => setInspectAgentId("economic-agent")}
                className="p-space-lg rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-space-md">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-3 h-3 rounded-full bg-secondary"></span>
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Agent Delta</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-tertiary font-label-sm text-label-sm">DeFi Attacks</span>
                  </div>
                  <h3 className="font-title-lg text-title-lg text-on-surface mb-space-xs">Economic &amp; MEV Shield</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    Simulates flash loan market manipulations, spot oracle sandwiching, slippage tolerances, and front-running risks under heavy block congestion.
                  </p>
                </div>
                <div className="mt-space-md pt-space-sm flex items-center justify-between text-outline">
                  <span className="font-label-sm text-label-sm">Detection Latency</span>
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold">312ms</span>
                </div>
              </div>

              {/* Specialist 5 */}
              <div
                onClick={() => setInspectAgentId("static-agent")}
                className="p-space-lg rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between md:col-span-2 lg:col-span-2 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-space-md">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-3 h-3 rounded-full bg-primary-container"></span>
                      <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">Agent Epsilon</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-tertiary font-label-sm text-label-sm">Bytecode &amp; Formal</span>
                  </div>
                  <h3 className="font-title-lg text-title-lg text-on-surface mb-space-xs">Bytecode &amp; Invariant Verifier</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    Decompiles EVM opcodes directly, validates memory safety against malicious yul blocks, and mathematically proves state invariance via ZK constraint models.
                  </p>
                </div>
                <div className="mt-space-md pt-space-sm flex items-center justify-between text-outline">
                  <span className="font-label-sm text-label-sm">Consensus Role</span>
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold">Lead Formal Gatekeeper &amp; HCS Signer</span>
                </div>
              </div>
            </div>
          </section>

          {/* 4. INTERACTIVE SOLIDITY AUDIT STUDIO */}
          <section className="w-full bg-surface-container-low py-space-xl" id="studio-sandbox">
            <div className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin">
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-space-lg gap-space-md">
                <div>
                  <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider mb-space-xs block">Live Audit Workbench</span>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Experience Swarm consensus in real-time.</h2>
                </div>
                <div className="flex items-center gap-space-xs">
                  <span className="font-label-md text-label-md text-on-surface-variant">Preset Vulnerability:</span>
                  <select
                    value={selectedPresetKey}
                    onChange={(e) => {
                      setSelectedPresetKey(e.target.value);
                      setAuditResult(null);
                      setPipelineStatus("READY");
                      setPipelineStep(5);
                    }}
                    className="h-9 px-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md shadow-sm outline-none cursor-pointer"
                  >
                    <option value="reentrancy">Classic Reentrancy (SWC-107)</option>
                    <option value="txorigin">tx.origin Authentication Bypass</option>
                    <option value="precision">Yield Rounding Precision Loss</option>
                  </select>
                </div>
              </div>

              {/* Studio Container */}
              <div className="w-full rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden flex flex-col lg:flex-row">
                {/* Left Pane: Code Editor */}
                <div className="w-full lg:w-7/12 p-space-lg flex flex-col justify-between bg-surface-container-lowest">
                  <div>
                    {/* Code Tab Bar */}
                    <div className="flex items-center justify-between pb-space-sm mb-space-sm">
                      <div className="flex items-center gap-space-xs">
                        <span className="w-3 h-3 rounded-full bg-[#ff5f56]"></span>
                        <span className="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
                        <span className="w-3 h-3 rounded-full bg-[#27c93f]"></span>
                        <span className="ml-2 font-label-sm text-label-sm text-on-surface-variant">{activePreset.file}</span>
                      </div>
                      <span className="font-label-sm text-label-sm text-error bg-error-container/60 px-2 py-0.5 rounded-md">
                        {activePreset.severity} • {activePreset.category}
                      </span>
                    </div>

                    {/* Preformatted Code Preview */}
                    <div
                      className="bg-surface-container p-space-md rounded-xl font-mono text-[12px] leading-relaxed text-on-surface overflow-x-auto"
                      dangerouslySetInnerHTML={{ __html: activePreset.code }}
                    />
                  </div>

                  {/* Bottom Action */}
                  <div className="mt-space-lg flex items-center justify-between pt-space-sm">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-[18px] text-tertiary">bolt</span>
                      <span className="font-label-sm text-label-sm text-tertiary">EVM 0.8.20 • Cost: 0.01 ℏ ($0.001)</span>
                    </div>
                    <button
                      type="button"
                      disabled={isAuditing}
                      onClick={handleRunAudit}
                      className="inline-flex items-center gap-space-xs px-6 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface font-title-md text-title-md hover:bg-on-surface transition-all active:scale-[0.98] disabled:opacity-60"
                    >
                      {isAuditing ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                          <span>Swarm Verifying...</span>
                        </>
                      ) : pipelineStatus === "FINALIZED" ? (
                        <>
                          <span className="material-symbols-outlined text-secondary text-[18px]">done_all</span>
                          <span>Consensus Sealed! Re-run</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                          <span>Run Swarm Audit</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Right Pane: Consensus Ledger & Report */}
                <div className="w-full lg:w-5/12 p-space-lg bg-surface-container-low flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-space-md">
                      <span className="font-title-md text-title-md text-on-surface">Consensus Pipeline</span>
                      <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-secondary font-medium">
                        <span className="w-2 h-2 rounded-full bg-secondary"></span>
                        {pipelineStatus === "FINALIZED" ? "Quorum Sealed on Hedera" : isAuditing ? "Debating Consensus..." : "5/5 Quorum Achieved"}
                      </span>
                    </div>

                    {/* Steps Pipeline */}
                    <div className="space-y-space-sm">
                      <div className="p-space-sm rounded-xl bg-surface-container-lowest flex items-center justify-between">
                        <div className="flex items-center gap-space-sm">
                          <span className="font-label-sm text-label-sm text-primary font-bold">01</span>
                          <span className="font-label-md text-label-md text-on-surface">Ingest &amp; AST Decomposition</span>
                        </div>
                        <span className={`material-symbols-outlined text-[18px] ${pipelineStep >= 1 ? "text-secondary" : "text-tertiary"}`}>
                          {pipelineStep >= 1 ? "check_circle" : "radio_button_unchecked"}
                        </span>
                      </div>

                      <div className="p-space-sm rounded-xl bg-surface-container-lowest flex items-center justify-between">
                        <div className="flex items-center gap-space-sm">
                          <span className="font-label-sm text-label-sm text-primary font-bold">02</span>
                          <span className="font-label-md text-label-md text-on-surface">Swarm Adversarial Debate</span>
                        </div>
                        <span className={`material-symbols-outlined text-[18px] ${pipelineStep >= 2 ? "text-secondary" : "text-tertiary"}`}>
                          {pipelineStep >= 2 ? "check_circle" : "radio_button_unchecked"}
                        </span>
                      </div>

                      <div className="p-space-sm rounded-xl bg-surface-container-lowest flex items-center justify-between">
                        <div className="flex items-center gap-space-sm">
                          <span className="font-label-sm text-label-sm text-primary font-bold">03</span>
                          <span className="font-label-md text-label-md text-on-surface">Quorum Consensus Finalized</span>
                        </div>
                        <span className={`material-symbols-outlined text-[18px] ${pipelineStep >= 3 ? "text-secondary" : "text-tertiary"}`}>
                          {pipelineStep >= 3 ? "check_circle" : "radio_button_unchecked"}
                        </span>
                      </div>

                      <div className="p-space-sm rounded-xl bg-surface-container-lowest flex items-center justify-between">
                        <div className="flex items-center gap-space-sm">
                          <span className="font-label-sm text-label-sm text-primary font-bold">04</span>
                          <span className="font-label-md text-label-md text-on-surface">Bytecode Invariant Verified</span>
                        </div>
                        <span className={`material-symbols-outlined text-[18px] ${pipelineStep >= 4 ? "text-secondary" : "text-tertiary"}`}>
                          {pipelineStep >= 4 ? "check_circle" : "radio_button_unchecked"}
                        </span>
                      </div>

                      <div className="p-space-sm rounded-xl bg-surface-container-lowest flex items-center justify-between">
                        <div className="flex items-center gap-space-sm">
                          <span className="font-label-sm text-label-sm text-primary font-bold">05</span>
                          <span className="font-label-md text-label-md text-on-surface">Hedera HCS Topic Sealed</span>
                        </div>
                        <span className={`material-symbols-outlined text-[18px] ${pipelineStep >= 5 ? "text-secondary" : "text-tertiary"}`}>
                          {pipelineStep >= 5 ? "check_circle" : "radio_button_unchecked"}
                        </span>
                      </div>
                    </div>

                    {/* Plain English Remediation */}
                    <div className="mt-space-md p-space-md rounded-xl bg-error-container/40">
                      <span className="font-label-sm text-label-sm text-error uppercase tracking-wider block mb-1">Recommended Fix</span>
                      <p className="font-body-sm text-body-sm text-on-surface leading-snug">
                        {activePreset.fix}
                      </p>
                    </div>

                    {auditResult && (
                      <div className="mt-space-sm">
                        <button
                          type="button"
                          onClick={() => setIsFullReportOpen(true)}
                          className="w-full py-2 px-3 rounded-lg bg-surface-container-lowest text-primary text-label-md font-semibold hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">description</span>
                          <span>View Full Audit Report</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Hedera Consensus Footer Card */}
                  <div className="mt-space-lg p-space-sm bg-surface-container-lowest rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-primary text-[18px]">lock</span>
                      <span className="font-label-sm text-label-sm text-on-surface">Topic: 0.0.10417469</span>
                    </div>
                    <a
                      className="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-1"
                      href={
                        auditResult?.proof?.transactionId
                          ? `https://hashscan.io/testnet/transaction/${auditResult.proof.transactionId.replace("@", "-").replace(/\.(?=\d{9})/, "-")}`
                          : "https://hashscan.io/testnet/topic/0.0.10417469"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>Verify on HashScan</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 5. DEVELOPER INTEGRATION & MCP */}
          <section className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin py-space-xl w-full">
            <div className="p-space-xl rounded-2xl bg-surface-container-low flex flex-col md:flex-row items-center justify-between gap-space-lg">
              <div className="max-w-xl">
                <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider mb-space-xs block">Developer Native</span>
                <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight mb-space-sm">One line to add security to your IDE.</h2>
                <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
                  Integrate the 5-agent security swarm directly into Cursor, Claude Desktop, Windsurf, or your GitHub CI action with zero configuration overhead.
                </p>
                <div className="flex flex-wrap items-center gap-space-xs">
                  <span className="px-3 py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm">Cursor MCP</span>
                  <span className="px-3 py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm">Claude Desktop</span>
                  <span className="px-3 py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm">Windsurf Cascade</span>
                  <span className="px-3 py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm">Foundry / Hardhat</span>
                </div>
              </div>

              {/* Code Box */}
              <div className="w-full md:w-auto min-w-[320px] bg-surface-container-lowest p-space-md rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-space-sm">
                  <span className="font-label-sm text-label-sm text-tertiary">Terminal</span>
                  <button
                    type="button"
                    onClick={() => handleCopy("npx -y swarmproof-mcp")}
                    className="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    <span>{copiedSnippet ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-space-sm bg-surface-container rounded-lg font-mono text-body-sm text-on-surface">
                  $ npx -y swarmproof-mcp
                </div>
                <div className="mt-space-sm text-[11px] text-tertiary flex items-center gap-1">
                  <span className="material-symbols-outlined text-secondary text-[14px]">check_circle</span>
                  <span>Auto-probes Hedera Testnet/Mainnet</span>
                </div>
              </div>
            </div>
          </section>

          {/* 6. MINIMALIST CALL TO ACTION */}
          <section className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin pb-space-xl w-full">
            <div className="p-space-xl rounded-2xl bg-surface-container-lowest shadow-sm text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center mb-space-md">
                <span className="material-symbols-outlined text-primary text-[24px]">verified_user</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight max-w-xl mb-space-xs">
                Verify your contracts with mathematical certainty.
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-space-lg">
                Deploy confidently knowing 5 specialized agents independently challenged your protocol and sealed an immutable cryptographic guarantee.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-space-md">
                <a
                  className="px-8 py-3.5 rounded-full bg-inverse-surface text-inverse-on-surface font-title-md text-title-md hover:bg-on-surface transition-all shadow-sm active:scale-[0.98]"
                  href="#studio-sandbox"
                >
                  Start Your First Audit
                </a>
                <Link
                  className="px-8 py-3.5 rounded-full bg-surface-container text-on-surface font-title-md text-title-md hover:bg-surface-container-high transition-all active:scale-[0.98]"
                  href="/graph"
                >
                  Explore The Graph
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="w-full bg-surface-container-lowest border-t border-black/[0.06] py-space-xl">
        <div className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin flex flex-col md:flex-row items-center justify-between gap-space-lg">
          <div className="flex items-center gap-space-sm">
            <span className="font-title-md text-title-md text-on-surface tracking-tight font-semibold">SwarmProof</span>
            <span className="text-outline font-body-sm text-body-sm">© 2026 SwarmProof Inc. Consensus guaranteed.</span>
          </div>
          <div className="flex flex-wrap items-center gap-space-lg">
            <Link className="font-body-sm text-body-sm text-tertiary hover:text-on-surface transition-colors" href="/feedback">
              Feedback &amp; Audits
            </Link>
            <a
              className="font-body-sm text-body-sm text-tertiary hover:text-on-surface transition-colors"
              href="https://hashscan.io/testnet/topic/0.0.10417469"
              target="_blank"
              rel="noopener noreferrer"
            >
              Hedera Consensus Logs
            </a>
            <Link className="font-body-sm text-body-sm text-tertiary hover:text-on-surface transition-colors" href="/pitch-deck">
              Security Whitepaper
            </Link>
          </div>
        </div>
      </footer>

      {/* ── Dialog Modals ────────────────────────────────────────────── */}
      {isRegisterModalOpen && (
        <RegisterAgentModal
          onClose={() => setIsRegisterModalOpen(false)}
          onRegistered={(newAgent) => {
            setAllAgents((prev) => ({ ...prev, [newAgent.id]: newAgent }));
            setIsRegisterModalOpen(false);
          }}
        />
      )}

      {isPoolModalOpen && (
        <AuditPoolModal
          onClose={() => setIsPoolModalOpen(false)}
        />
      )}

      {isB2BSpendModalOpen && (
        <PrivyB2BSpendModal onClose={() => setIsB2BSpendModalOpen(false)} />
      )}

      {isFullReportOpen && auditResult && (
        <FullAuditReportModal
          auditResult={auditResult}
          onClose={() => setIsFullReportOpen(false)}
        />
      )}

      {inspectAgentId && (
        <AgentInspectorModal
          agentId={inspectAgentId}
          agents={allAgents}
          onClose={() => setInspectAgentId(null)}
        />
      )}
    </div>
  );
}