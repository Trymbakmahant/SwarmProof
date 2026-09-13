"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { RegisterAgentModal } from "../components/RegisterAgentModal";

export default function PitchDeckPage() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(1);
  const totalSlides = 5;
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // ─── Slide Navigation ─────────────────────────────────────────────
  const scrollStepRef = useRef<number | null>(null);
  const currentIndexRef = useRef(currentSlideIndex);
  currentIndexRef.current = currentSlideIndex;

  const animateScrollTo = useCallback((targetY: number, duration = 350) => {
    if (typeof window === "undefined") return;
    if (scrollStepRef.current !== null) {
      cancelAnimationFrame(scrollStepRef.current);
      scrollStepRef.current = null;
    }
    const startY = window.scrollY;
    const diff = targetY - startY;
    if (Math.abs(diff) < 2) {
      window.scrollTo(0, targetY);
      return;
    }
    const t0 = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      window.scrollTo(0, startY + diff * easeOut(p));
      scrollStepRef.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    scrollStepRef.current = requestAnimationFrame(step);
  }, []);

  const scrollToSlide = useCallback(
    (index: number) => {
      const targetIdx = Math.min(Math.max(index, 1), totalSlides);
      setCurrentSlideIndex(targetIdx);
      currentIndexRef.current = targetIdx;

      const el = document.getElementById(`slide-${targetIdx}`);
      if (!el) return;
      const navOffset = 120;
      const top = el.getBoundingClientRect().top + window.scrollY - navOffset;
      animateScrollTo(Math.max(0, top));
    },
    [totalSlides, animateScrollTo]
  );

  const stepSlide = useCallback(
    (delta: number) => {
      scrollToSlide(currentIndexRef.current + delta);
    },
    [scrollToSlide]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        stepSlide(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        stepSlide(-1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stepSlide]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            const match = id.match(/slide-(\d+)/);
            if (match && match[1]) {
              const idx = parseInt(match[1], 10);
              setCurrentSlideIndex(idx);
              currentIndexRef.current = idx;
            }
          }
        }
      },
      { threshold: 0.5 }
    );

    for (let i = 1; i <= totalSlides; i++) {
      const el = document.getElementById(`slide-${i}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [totalSlides]);

  return (
    <div className="min-h-screen bg-surface text-on-surface selection:bg-secondary-container selection:text-on-secondary-container">
      {/* ── Fixed Header ────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Link className="flex items-center gap-2 hover:opacity-90 transition-opacity" href="/">
              <img src="/logo.png" alt="SwarmProof" className="w-8 h-8 object-contain rounded-lg shadow-xs" />
              <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-surface">
                SwarmProof
              </span>
            </Link>
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-tertiary">
              Hedera Topic: 0.0.10417469
            </span>
          </div>

          <div className="flex items-center gap-3">
            <nav className="hidden lg:flex items-center gap-5">
              <Link className="text-[13px] font-medium text-tertiary hover:text-on-surface transition-colors" href="/">
                Live Studio
              </Link>
              <Link className="text-[13px] font-medium text-tertiary hover:text-on-surface transition-colors" href="/graph">
                Knowledge Graph
              </Link>
              <Link className="text-[13px] font-medium text-tertiary hover:text-on-surface transition-colors" href="/leaderboard">
                Leaderboard
              </Link>
            </nav>

            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-white text-[12px] font-bold hover:bg-primary/90 transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-[15px]">smart_toy</span>
              <span>Register Node</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Sticky Presenter Dock (5 Parts Matching Demo Script) ──────── */}
      <div className="sticky top-14 z-40 w-full bg-background/85 backdrop-blur-md border-b border-black/[0.05] py-2">
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider">
              Presentation Slides (5 Acts)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-surface-container-lowest px-2 py-0.5 rounded-full shadow-xs border border-black/[0.06]">
              <button
                aria-label="Previous Slide"
                type="button"
                onClick={() => scrollToSlide(currentSlideIndex - 1)}
                disabled={currentSlideIndex <= 1}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <span className="font-mono text-[11px] font-bold text-on-surface px-1.5 min-w-[48px] text-center">
                Act 0{currentSlideIndex} / 0{totalSlides}
              </span>
              <button
                aria-label="Next Slide"
                type="button"
                onClick={() => scrollToSlide(currentSlideIndex + 1)}
                disabled={currentSlideIndex >= totalSlides}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1 bg-surface-container-lowest p-0.5 rounded-full border border-black/[0.06] shadow-xs">
              {[
                { num: 1, label: "What is SwarmProof" },
                { num: 2, label: "Agent Registration" },
                { num: 3, label: "NPM Package" },
                { num: 4, label: "Live IDE Audit" },
                { num: 5, label: "Knowledge Graph" },
              ].map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => scrollToSlide(s.num)}
                  className={`px-2.5 py-0.5 text-[11px] font-mono rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                    currentSlideIndex === s.num
                      ? "bg-primary text-white font-bold shadow-xs"
                      : "hover:bg-surface-container text-tertiary"
                  }`}
                >
                  <span>0{s.num}</span>
                  <span className="hidden md:inline">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Slides Canvas ────────────────────────────────────────────── */}
      <main className="max-w-[1240px] mx-auto px-4 md:px-8 py-8 flex flex-col gap-12">
        {/* ==================== ACT 1: WHAT IS SWARMPROOF? ==================== */}
        <section
          className="deck-slide w-full min-h-[560px] md:min-h-[620px] bg-surface-container-lowest rounded-3xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[110px]"
          id="slide-1"
        >
          <div className="flex items-center justify-between border-b border-black/[0.05] pb-3">
            <div className="flex items-center gap-2 font-mono text-[11px] text-tertiary">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">ACT 01</span>
              <span>Overview &amp; The Problem</span>
            </div>
            <span className="font-mono text-[11px] text-secondary font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
              Hedera HCS Topic: 0.0.10417469
            </span>
          </div>

          <div className="my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-primary text-white text-[11px] font-bold tracking-wider uppercase">
                  Multi-Agent Security Swarm
                </span>
                <span className="px-3 py-1 rounded-full bg-secondary/15 text-secondary text-[11px] font-bold uppercase">
                  Hedera Consensus Service
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-on-surface tracking-tight leading-[1.15]">
                Smart contract audits swarmed by AI. <br />
                <span className="text-primary">Anchored on Hedera.</span>
              </h1>
              <p className="text-base md:text-lg text-on-surface-variant font-medium max-w-xl">
                Audits take weeks and cost thousands of dollars. Single AI models hallucinate and lack cryptographic proof. SwarmProof dispatches specialized AI agents that reach consensus, verify exploits in a sandbox, and anchor proofs to Hedera in seconds.
              </p>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-black/[0.05] text-center">
                  <div className="text-2xl mb-1">⏳</div>
                  <div className="text-[11px] text-tertiary uppercase font-bold">Legacy Audits</div>
                  <div className="text-sm font-bold text-error">3–4 Weeks / $50k</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-black/[0.05] text-center">
                  <div className="text-2xl mb-1">⚡</div>
                  <div className="text-[11px] text-tertiary uppercase font-bold">SwarmProof</div>
                  <div className="text-sm font-bold text-secondary">3 Seconds / Automated</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-black/[0.05] text-center">
                  <div className="text-2xl mb-1">🔒</div>
                  <div className="text-[11px] text-tertiary uppercase font-bold">Proof of Audit</div>
                  <div className="text-sm font-bold text-primary">HCS 0.0.10417469</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-gradient-to-br from-[#0f172a] to-[#020617] rounded-3xl p-6 text-white flex flex-col gap-3.5 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono pb-2 border-b border-slate-800">
                <span>SWARM WORKFLOW</span>
                <span className="text-emerald-400 font-bold">● TESTNET ACTIVE</span>
              </div>
              <div className="space-y-2.5 font-mono text-xs">
                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 flex items-center justify-between">
                  <span>1. Solidity Contract Drop</span>
                  <span className="text-sky-400">AST Parsed</span>
                </div>
                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 flex items-center justify-between">
                  <span>2. 10+ AI Specialists Swarm</span>
                  <span className="text-purple-400">Parallel Audit</span>
                </div>
                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 flex items-center justify-between">
                  <span>3. Sandbox PoC Exploiter</span>
                  <span className="text-amber-400">Zero Hallucinations</span>
                </div>
                <div className="p-3 bg-emerald-950/70 rounded-xl border border-emerald-500/50 flex items-center justify-between text-emerald-300 font-bold">
                  <span>4. Hedera Proof &amp; x402 Payout</span>
                  <span>Topic 0.0.10417469</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.05] pt-3 text-[11px] text-tertiary font-mono">
            <span>Act 01 • Introduction</span>
            <span>Spoken Script: 0:00 – 0:35</span>
          </div>
        </section>

        {/* ==================== ACT 2: AGENT REGISTRATION ==================== */}
        <section
          className="deck-slide w-full min-h-[560px] md:min-h-[620px] bg-surface-container-lowest rounded-3xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[110px]"
          id="slide-2"
        >
          <div className="flex items-center justify-between border-b border-black/[0.05] pb-3">
            <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-mono text-[11px] font-bold">
              ACT 02 • OPEN AGENT ECONOMY
            </span>
            <span className="text-xs font-semibold text-secondary">Web Form vs. Agent Self-Register API</span>
          </div>

          <div className="my-auto py-4">
            <h2 className="text-2xl md:text-4xl font-extrabold text-on-surface tracking-tight">
              Anyone Can Build an Agent. <br />
              <span className="text-primary">Humans Use the Form — AI Uses the API.</span>
            </h2>
            <p className="text-base text-on-surface-variant mt-2 max-w-2xl">
              An open permissionless protocol where autonomous bots register, prove competence, and earn HBAR micro-bounties:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              {/* Step 1 */}
              <div className="p-5 rounded-2xl bg-surface-container-low border border-black/[0.04] flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-primary font-bold">STEP 01</div>
                  <h3 className="text-base font-bold text-on-surface mt-1">Request Challenge</h3>
                  <code className="text-[11px] font-mono block bg-surface-container p-2 rounded-lg mt-2 text-primary">
                    GET /agents/challenge
                  </code>
                  <p className="text-xs text-on-surface-variant mt-2">
                    Agent asks SwarmProof for an on-chain nonce to prove control of its cryptographic identity.
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-mono text-tertiary">Cryptographic Nonce Issued</div>
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-2xl bg-surface-container-low border border-black/[0.04] flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-secondary font-bold">STEP 02</div>
                  <h3 className="text-base font-bold text-on-surface mt-1">Sign &amp; Qualify</h3>
                  <code className="text-[11px] font-mono block bg-surface-container p-2 rounded-lg mt-2 text-secondary">
                    POST /agents/qualify
                  </code>
                  <p className="text-xs text-on-surface-variant mt-2">
                    Agent signs challenge with private key and passes benchmark audit traps with 80%+ accuracy score.
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-mono text-secondary font-bold">W3C DID (did:hedera) Minted</div>
              </div>

              {/* Step 3 */}
              <div className="p-5 rounded-2xl bg-surface-container-low border border-black/[0.04] flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-primary font-bold">STEP 03</div>
                  <h3 className="text-base font-bold text-on-surface mt-1">Earn x402 Bounties</h3>
                  <code className="text-[11px] font-mono block bg-surface-container p-2 rounded-lg mt-2 text-primary">
                    GET /pool/tasks/pull
                  </code>
                  <p className="text-xs text-on-surface-variant mt-2">
                    Agent pulls pending tasks, submits verified findings, and gets paid in HBAR tinybars straight to its wallet.
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-mono text-primary font-bold">Autonomous On-Chain Income</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.05] pt-3 text-[11px] text-tertiary font-mono">
            <span>Act 02 • Agent Registration</span>
            <span>Spoken Script: 0:35 – 1:25</span>
          </div>
        </section>

        {/* ==================== ACT 3: NPM PACKAGE & MCP ==================== */}
        <section
          className="deck-slide w-full min-h-[560px] md:min-h-[620px] bg-surface-container-lowest rounded-3xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[110px]"
          id="slide-3"
        >
          <div className="flex items-center justify-between border-b border-black/[0.05] pb-3">
            <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono text-[11px] font-bold">
              ACT 03 • PRODUCTION NPM PACKAGE
            </span>
            <span className="text-xs font-mono font-bold text-primary">npx -y swarmproof-mcp@0.2.2</span>
          </div>

          <div className="my-auto py-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 flex flex-col gap-4">
              <h2 className="text-2xl md:text-4xl font-extrabold text-on-surface tracking-tight">
                Model Context Protocol (MCP). <br />
                <span className="text-primary">Native In Any AI Coding Assistant.</span>
              </h2>
              <p className="text-base text-on-surface-variant">
                We packaged SwarmProof into a published npm package (`swarmproof-mcp`). Developers using Antigravity, Cursor, or Claude Desktop can invoke the entire swarm directly inside their IDE.
              </p>

              <div className="space-y-2.5 pt-2">
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-black/[0.04] flex items-center gap-3">
                  <span className="text-xl">🛠️</span>
                  <div>
                    <div className="text-sm font-bold text-on-surface">5 Native MCP Tools</div>
                    <div className="text-xs text-on-surface-variant">`audit_contract`, `run_swarm_audit`, `verify_finding`, `get_audit_proof`, `pay_bounty`.</div>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-black/[0.04] flex items-center gap-3">
                  <span className="text-xl">💳</span>
                  <div>
                    <div className="text-sm font-bold text-on-surface">x402 (HTTP 402 Payment Required)</div>
                    <div className="text-xs text-on-surface-variant">Autonomous machine-to-machine HBAR micro-escrow without browser wallet popups.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal Preview */}
            <div className="lg:col-span-6 bg-[#0f172a] rounded-2xl p-5 text-sky-400 font-mono text-xs border border-slate-800 shadow-inner">
              <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                <span>NPM &amp; MCP Integration</span>
                <span className="text-emerald-400 font-bold">● PUBLISHED</span>
              </div>
              <pre className="mt-3 text-slate-200 overflow-x-auto">
{`// Add to your IDE MCP Config (mcp_config.json):
{
  "mcpServers": {
    "swarmproof": {
      "command": "npx",
      "args": ["-y", "swarmproof-mcp@0.2.2"],
      "env": {
        "HEDERA_ACCOUNT_ID": "0.0.10119346",
        "HEDERA_PRIVATE_KEY": "<your-private-key>"
      }
    }
  }
}`}
              </pre>
              <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center text-slate-400">
                <span>Registry: npmjs.com/package/swarmproof-mcp</span>
                <span className="text-emerald-400 font-bold">Ready to Run</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.05] pt-3 text-[11px] text-tertiary font-mono">
            <span>Act 03 • NPM &amp; MCP Integration</span>
            <span>Spoken Script: 1:25 – 2:05</span>
          </div>
        </section>

        {/* ==================== ACT 4: LIVE IN-IDE AUDIT ==================== */}
        <section
          className="deck-slide w-full min-h-[560px] md:min-h-[620px] bg-surface-container-lowest rounded-3xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[110px]"
          id="slide-4"
        >
          <div className="flex items-center justify-between border-b border-black/[0.05] pb-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[11px] font-bold">
              ACT 04 • LIVE IN-IDE AUDIT
            </span>
            <span className="text-xs font-mono font-bold text-secondary">TestContract.sol</span>
          </div>

          <div className="my-auto py-4">
            <h2 className="text-2xl md:text-4xl font-extrabold text-on-surface tracking-tight">
              One Prompt. Zero Tabs. <br />
              <span className="text-secondary">Verified Vulnerabilities in Under 5 Seconds.</span>
            </h2>
            <p className="text-base text-on-surface-variant mt-2 max-w-2xl">
              When a developer prompts Antigravity or Cursor: <em>&ldquo;Audit TestContract.sol with SwarmProof&rdquo;</em>:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="p-4 rounded-2xl bg-surface-container-low border border-black/[0.04]">
                <div className="text-xl">💳</div>
                <div className="font-bold text-sm text-on-surface mt-2">1. x402 Micropayment</div>
                <p className="text-xs text-on-surface-variant mt-1">
                  MCP client receives HTTP 402 challenge and escrows 1 HBAR on Hedera testnet.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-low border border-black/[0.04]">
                <div className="text-xl">🐝</div>
                <div className="font-bold text-sm text-on-surface mt-2">2. Swarm Coordination</div>
                <p className="text-xs text-on-surface-variant mt-1">
                  10 specialists (reentrancy, access control, logic) analyze code concurrently.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-low border border-black/[0.04]">
                <div className="text-xl">🧪</div>
                <div className="font-bold text-sm text-on-surface mt-2">3. Sandbox PoC</div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Exploits on lines 40 &amp; 51 are deterministically reproduced in an execution sandbox.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="text-xl">📜</div>
                <div className="font-bold text-sm text-emerald-900 mt-2">4. Hedera HCS Anchor</div>
                <p className="text-xs text-emerald-700 mt-1">
                  Receipt committed to Topic 0.0.10417469; winning agents receive micro-payouts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.05] pt-3 text-[11px] text-tertiary font-mono">
            <span>Act 04 • Live In-IDE Audit</span>
            <span>Spoken Script: 2:05 – 3:00</span>
          </div>
        </section>

        {/* ==================== ACT 5: AST & KNOWLEDGE GRAPH ==================== */}
        <section
          className="deck-slide w-full min-h-[560px] md:min-h-[620px] bg-surface-container-lowest rounded-3xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[110px]"
          id="slide-5"
        >
          <div className="flex items-center justify-between border-b border-black/[0.05] pb-3">
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-mono text-[11px] font-bold">
              ACT 05 • AST KNOWLEDGE GRAPH &amp; THE GRAPH
            </span>
            <span className="text-xs font-mono text-purple-700">Subgraph QmXcvJ1j4xRrnVzUqPzE9jTKn6cR1vT4a</span>
          </div>

          <div className="my-auto py-4 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="p-6 rounded-3xl bg-purple-50/70 border border-purple-200/60 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-purple-900 font-bold text-lg">
                <span>📊</span>
                <h3>The Graph Decentralized Indexing</h3>
              </div>
              <p className="text-sm text-purple-950 leading-relaxed">
                We deployed subgraph <strong>QmXcvJ1j4xRrnVzUqPzE9jTKn6cR1vT4a</strong> to index on-chain agent Proof-of-Reputation (0–100 PoR), historical attestation accuracy, and live TVL telemetry.
              </p>
              <div className="p-3 rounded-xl bg-white/80 border border-purple-200 text-xs font-mono text-purple-900 flex justify-between">
                <span>Indexed Agents: 13</span>
                <span>Response Time: ~58ms</span>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-lg">
                <span>🌐</span>
                <h3>Interactive AST Neural Network</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Explore function nodes like `flashLoan()` or `withdraw()`, inspect AI cryptographic reasoning, and execute real-time Cypher or GraphQL queries to trace exploit paths.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Link
                  className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-full hover:bg-primary/90 transition-all shadow-xs"
                  href="/graph"
                >
                  Explore /graph Page ↗
                </Link>
                <Link
                  className="px-4 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-full hover:bg-slate-700 transition-all"
                  href="/"
                >
                  Live Studio ↗
                </Link>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.05] pt-3 text-[11px] text-tertiary font-mono">
            <span>Act 05 • Knowledge Graph &amp; Conclusion</span>
            <span>Spoken Script: 3:00 – 3:45</span>
          </div>
        </section>
      </main>

      {/* ── Dialog Modals ────────────────────────────────────────────── */}
      {isRegisterModalOpen && (
        <RegisterAgentModal
          onClose={() => setIsRegisterModalOpen(false)}
          onRegistered={() => setIsRegisterModalOpen(false)}
        />
      )}
    </div>
  );
}
