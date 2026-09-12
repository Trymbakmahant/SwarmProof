"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { RegisterAgentModal } from "../components/RegisterAgentModal";
import { AuditPoolModal } from "../components/AuditPoolModal";

export default function PitchDeckPage() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(1);
  const totalSlides = 7;
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);

  // Smooth scroll to specific slide
  const scrollToSlide = (index: number) => {
    let targetIdx = index;
    if (targetIdx < 1) targetIdx = 1;
    if (targetIdx > totalSlides) targetIdx = totalSlides;
    setCurrentSlideIndex(targetIdx);
    const target = document.getElementById(`slide-${targetIdx}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Keyboard navigation for presentation mode
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
        if (currentSlideIndex < totalSlides) {
          e.preventDefault();
          scrollToSlide(currentSlideIndex + 1);
        }
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        if (currentSlideIndex > 1) {
          e.preventDefault();
          scrollToSlide(currentSlideIndex - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, totalSlides]);

  // Observer to track which slide is currently centered in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            const num = parseInt(id.replace("slide-", ""), 10);
            if (!isNaN(num)) {
              setCurrentSlideIndex(num);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    const slides = document.querySelectorAll(".deck-slide");
    slides.forEach((s) => observer.observe(s));

    return () => observer.disconnect();
  }, []);

  // Fullscreen toggle for Presenter Mode
  const toggleDeckFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Fullscreen error: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="bg-surface text-on-surface selection:bg-secondary-container selection:text-on-secondary-container min-h-screen">
      {/* ── Fixed Header ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-28 max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex flex-col justify-between pt-3 pb-2">
          {/* Top Header Row */}
          <div className="flex items-center justify-between gap-gutter">
            <div className="flex items-center gap-space-md">
              <Link href="/" className="w-9 h-9 bg-primary flex items-center justify-center rounded text-decoration-none">
                <span className="font-code-md text-code-md font-semibold text-on-primary tracking-tight">SP</span>
              </Link>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <Link href="/" className="font-headline-sm text-headline-sm tracking-tight text-on-surface font-medium hover:opacity-80 transition-opacity text-decoration-none">
                    SwarmProof
                  </Link>
                  <span className="font-label-caps text-label-caps px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                    Pitch Deck
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
                  className="font-body-sm text-body-sm text-on-surface font-semibold"
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
              <Link
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                href="/"
              >
                3D Swarm Visualizer
              </Link>
              <Link
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                href="/#quorum-sim"
              >
                Consensus &amp; AST Quorum
              </Link>
              <Link
                className="px-3 py-1 font-code-sm text-code-sm rounded transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                href="/#interactive-telemetry"
              >
                Solidity Audit Studio
              </Link>
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

      {/* ── Main Presentation Canvas ─────────────────────────────── */}
      <main className="w-full pt-28 bg-surface">
        <div className="flex flex-col w-full">
          {/* Interactive Deck Presenter Controls Dock */}
          <div className="sticky top-28 z-40 w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin pt-4 pb-2">
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface-container-lowest/90 backdrop-blur-md rounded-xl shadow-md border border-outline-variant/30">
              <div className="flex items-center gap-space-md">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                  <span className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider">
                    PITCH DECK
                  </span>
                </div>
                <span className="text-on-surface-variant font-code-sm text-code-sm hidden sm:inline">•</span>
                <span className="font-code-sm text-code-sm text-on-surface-variant hidden sm:inline" id="deck-topic-ref">
                  Topic: 0.0.10417469
                </span>
              </div>

              {/* Slide Indicator & Rapid Jump Navigation */}
              <div className="flex items-center gap-space-sm">
                <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1 rounded-full border border-outline-variant/30">
                  <button
                    aria-label="Previous Slide"
                    type="button"
                    onClick={() => scrollToSlide(currentSlideIndex - 1)}
                    className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-surface-container transition-colors text-on-surface cursor-pointer"
                    id="btn-prev-slide"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>
                  <span className="font-code-sm text-code-sm font-semibold text-on-surface min-w-[50px] text-center" id="slide-tracker">
                    0{currentSlideIndex} / 0{totalSlides}
                  </span>
                  <button
                    aria-label="Next Slide"
                    type="button"
                    onClick={() => scrollToSlide(currentSlideIndex + 1)}
                    className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-surface-container transition-colors text-on-surface cursor-pointer"
                    id="btn-next-slide"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>

                {/* Dot pills */}
                <div className="hidden md:flex items-center gap-1 bg-surface-container-low p-1 rounded-full text-on-surface-variant border border-outline-variant/30">
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => scrollToSlide(num)}
                      className={`deck-dot px-2 py-0.5 text-[11px] font-code-sm rounded-full transition-all cursor-pointer ${
                        currentSlideIndex === num
                          ? "bg-primary text-on-primary font-semibold"
                          : "hover:bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={toggleDeckFullscreen}
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded bg-surface-container text-on-surface font-body-sm text-body-sm hover:bg-surface-container-high transition-colors cursor-pointer"
                  id="btn-fullscreen"
                >
                  <span className="material-symbols-outlined text-[16px]">slideshow</span>
                  <span>Presenter Mode</span>
                </button>

                <Link
                  className="px-3 py-1 bg-primary text-on-primary font-body-sm text-body-sm rounded hover:bg-primary-container transition-colors flex items-center gap-1 cursor-pointer"
                  href="/"
                >
                  <span className="material-symbols-outlined text-[15px]">terminal</span>
                  <span className="hidden sm:inline">Launch Demo</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Slides Presentation Stream */}
          <div className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex flex-col gap-space-xl py-space-md">
            {/* ==================== SLIDE 01: COVER ==================== */}
            <section
              className="deck-slide w-full min-h-[640px] lg:min-h-[720px] bg-surface-container-lowest rounded-xl shadow-xl flex flex-col justify-between p-6 md:p-12 relative overflow-hidden border border-outline-variant/30"
              id="slide-1"
            >
              {/* Ambient Decorative Geometry */}
              <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-secondary-container/25 blur-3xl pointer-events-none"></div>
              <div className="absolute right-12 bottom-12 opacity-5 pointer-events-none hidden lg:block">
                <span className="font-display-xl text-[180px] font-normal leading-none tracking-tighter">SP</span>
              </div>

              {/* Slide Header Rail */}
              <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                    SLIDE 01 / 07
                  </span>
                  <span className="font-code-sm text-code-sm text-secondary font-medium">
                    Hedera Ecosystem Grantee • ETHGlobal 2026
                  </span>
                </div>
                <div className="flex items-center gap-2 font-code-sm text-code-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[15px] text-secondary">verified</span>
                  <span>HCS Immutable State Quorum</span>
                </div>
              </div>

              {/* Slide Main Content Area */}
              <div className="my-auto py-8 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between relative z-10">
                <div className="max-w-3xl flex flex-col gap-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-label-caps text-label-caps px-2.5 py-1 rounded-full bg-primary text-on-primary">
                      SWARM ARCHITECTURE
                    </span>
                    <span className="font-label-caps text-label-caps px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface">
                      x402 MICROPAYMENTS
                    </span>
                    <span className="font-label-caps text-label-caps px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface">
                      W3C DID:HEDERA
                    </span>
                  </div>

                  <h1 className="font-display-xl text-display-xl text-on-surface tracking-tight leading-tight">
                    Reinventing Smart Contract Auditing on Hedera.
                  </h1>

                  <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
                    Autonomous multi-agent consensus verification with mathematical intention. Replacing single-LLM hallucination with weighted AST quorums, anchored immutably to Hedera Consensus Service (HCS).
                  </p>

                  <div className="pt-4 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-container rounded-lg shadow-sm border border-outline-variant/30">
                      <div className="w-2.5 h-2.5 rounded-full bg-secondary-fixed-dim animate-ping"></div>
                      <div className="flex flex-col">
                        <span className="font-code-sm text-code-sm text-on-surface-variant">Consensus Topic</span>
                        <span className="font-code-md text-code-md font-semibold text-on-surface">0.0.10417469</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-container rounded-lg shadow-sm border border-outline-variant/30">
                      <span className="material-symbols-outlined text-on-secondary-container">account_balance_wallet</span>
                      <div className="flex flex-col">
                        <span className="font-code-sm text-code-sm text-on-surface-variant">Fee Per Quorum</span>
                        <span className="font-code-md text-code-md font-semibold text-on-surface">0.01 ℏ (Tinybar Settled)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Visual Showcase / Key Metrics */}
                <div className="w-full lg:w-96 bg-surface-container-low/80 backdrop-blur p-6 rounded-xl shadow-md flex flex-col gap-4 border border-outline-variant/30">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">EXECUTIVE SUMMARY</span>
                  <div className="flex flex-col gap-3">
                    <div className="p-3 bg-surface-container-lowest rounded border border-outline-variant/20">
                      <div className="flex items-center justify-between">
                        <span className="font-body-sm text-body-sm font-semibold text-on-surface">Autonomous Quorum</span>
                        <span className="font-code-sm text-code-sm text-secondary font-medium">5 Agents</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 text-xs">
                        Cross-validates reentrancy, access control, AST, and tokenomics.
                      </p>
                    </div>
                    <div className="p-3 bg-surface-container-lowest rounded border border-outline-variant/20">
                      <div className="flex items-center justify-between">
                        <span className="font-body-sm text-body-sm font-semibold text-on-surface">Verification Velocity</span>
                        <span className="font-code-sm text-code-sm text-secondary font-medium">&lt; 3.2s</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 text-xs">
                        Nanosecond-stamped consensus attestation on Hedera.
                      </p>
                    </div>
                    <div className="p-3 bg-surface-container-lowest rounded border border-outline-variant/20">
                      <div className="flex items-center justify-between">
                        <span className="font-body-sm text-body-sm font-semibold text-on-surface">Audit Cost Compression</span>
                        <span className="font-code-sm text-code-sm text-secondary font-medium">99.4%</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 text-xs">
                        From $60,000 legacy audits to sub-dollar continuous verification.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide Footer Rail */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-surface-container-highest/60 pt-4 gap-2">
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  SwarmProof Confidential • Institutional Infrastructure Monograph
                </span>
                <div className="flex items-center gap-3 font-code-sm text-code-sm text-on-surface-variant">
                  <span>HCS Topic: 0.0.10417469</span>
                  <span>•</span>
                  <span>Hedera Mainnet Ready</span>
                </div>
              </div>
            </section>

            {/* ==================== SLIDE 02: THE PROBLEM ==================== */}
            <section
              className="deck-slide w-full min-h-[640px] lg:min-h-[720px] bg-surface-container-lowest rounded-xl shadow-xl flex flex-col justify-between p-6 md:p-12 relative overflow-hidden border border-outline-variant/30"
              id="slide-2"
            >
              {/* Slide Header */}
              <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                    SLIDE 02 / 07
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-medium">The Problem</span>
                </div>
                <span className="font-code-sm text-code-sm text-error font-medium">Systemic Industry Bottlenecks</span>
              </div>

              {/* Slide Title & Narrative */}
              <div className="py-4">
                <h2 className="font-headline-md text-headline-md text-on-surface max-w-2xl">
                  Smart contract auditing is broken: slow, hallucination-prone, and economically unscalable.
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  Modern DeFi releases code every sprint, but auditing remains manual, monolithic, and disconnected from runtime cryptographic consensus.
                </p>
              </div>

              {/* 3-Column Diagnostic Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-auto">
                {/* Failure Mode 1 */}
                <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between gap-4 shadow-sm border border-outline-variant/20">
                  <div>
                    <div className="w-10 h-10 rounded bg-error-container text-on-error-container flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-[20px]">psychology_alt</span>
                    </div>
                    <span className="font-label-caps text-label-caps text-error uppercase">Vulnerability Vector 01</span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">Single-LLM Hallucinations</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                      Standalone AI prompts miss multi-block state interactions, generate false confidence, and lack formal AST parsing logic. A single prompt agent cannot simulate Byzantine attack surfaces.
                    </p>
                  </div>
                  <div className="p-3 bg-surface-container-lowest rounded font-code-sm text-code-sm text-on-surface-variant border border-outline-variant/10">
                    <span className="text-error font-semibold">• 42%</span> of automated LLM reports exhibit non-existent vulnerability exploits or overlook cross-contract reentrancy.
                  </div>
                </div>

                {/* Failure Mode 2 */}
                <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between gap-4 shadow-sm border border-outline-variant/20">
                  <div>
                    <div className="w-10 h-10 rounded bg-surface-container-highest text-on-surface flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-[20px]">hourglass_empty</span>
                    </div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Market Friction 02</span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">4–6 Week Audit Bottlenecks</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                      Traditional auditing firms charge $50,000–$250,000 with multi-month scheduling queues. CI/CD teams must halt continuous deployment pipelines to wait for static, unanchored PDF deliverables.
                    </p>
                  </div>
                  <div className="p-3 bg-surface-container-lowest rounded font-code-sm text-code-sm text-on-surface-variant border border-outline-variant/10">
                    <span className="text-on-surface font-semibold">• $1.8B+</span> lost in 2024-2025 exploits due to un-audited minor patch deployments post-initial audit.
                  </div>
                </div>

                {/* Failure Mode 3 */}
                <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between gap-4 shadow-sm border border-outline-variant/20">
                  <div>
                    <div className="w-10 h-10 rounded bg-surface-container-highest text-on-surface flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-[20px]">no_accounts</span>
                    </div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Identity Vacuum 03</span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">Anonymous, Zero Accountability</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                      AI code generation tools provide no verifiable pedigree. Developers have no cryptographic receipt showing which model variant executed the audit, what AST checks ran, or who stands behind the attestation.
                    </p>
                  </div>
                  <div className="p-3 bg-surface-container-lowest rounded font-code-sm text-code-sm text-on-surface-variant border border-outline-variant/10">
                    <span className="text-on-surface font-semibold">• 0%</span> cryptographic verifiability on off-the-shelf AI code reviews without immutable ledger anchoring.
                  </div>
                </div>
              </div>

              {/* Slide Footer */}
              <div className="flex items-center justify-between border-t border-surface-container-highest/60 pt-4">
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  Audit Market Failure Analysis • SwarmProof Technical Dossier
                </span>
                <span className="font-code-sm text-code-sm text-on-surface-variant">Hedera Consensus Network</span>
              </div>
            </section>

            {/* ==================== SLIDE 03: THE SOLUTION ==================== */}
            <section
              className="deck-slide w-full min-h-[640px] lg:min-h-[720px] bg-surface-container-lowest rounded-xl shadow-xl flex flex-col justify-between p-6 md:p-12 relative overflow-hidden border border-outline-variant/30"
              id="slide-3"
            >
              {/* Slide Header */}
              <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                    SLIDE 03 / 07
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-medium">The Solution: SwarmProof Quorum</span>
                </div>
                <span className="font-code-sm text-code-sm text-secondary font-medium">Byzantine Fault-Tolerant AST Verification</span>
              </div>

              {/* Section Lead */}
              <div className="py-2">
                <h2 className="font-headline-md text-headline-md text-on-surface max-w-3xl">
                  Five Autonomous Cognitive Agents. One Immutable Consensus.
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Rather than relying on one general model, SwarmProof assigns contract bytecode to specialized neural agents running formal verification heuristics. A 4/5 Byzantine Quorum must agree before an on-chain receipt is stamped.
                </p>
              </div>

              {/* Agents Architecture Layout */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 my-auto">
                {/* Agent 1 */}
                <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between shadow-sm border border-outline-variant/20">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-code-sm text-code-sm text-secondary font-semibold">AGENT 01</span>
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    </div>
                    <h4 className="font-body-md text-body-md font-semibold text-on-surface">Reentrancy Sentinel</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 text-xs">
                      Analyzes Abstract Syntax Tree (AST) for cross-function state modifications occurring post external calls.
                    </p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-surface-container-highest font-code-sm text-[10px] text-on-surface-variant">
                    Weight: 25% • Checks mutex &amp; CEI pattern
                  </div>
                </div>

                {/* Agent 2 */}
                <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between shadow-sm border border-outline-variant/20">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-code-sm text-code-sm text-secondary font-semibold">AGENT 02</span>
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    </div>
                    <h4 className="font-body-md text-body-md font-semibold text-on-surface">Access Guardian</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 text-xs">
                      Detects `tx.origin` vulnerabilities, uninitialized proxy ownerships, and privilege escalation pathways.
                    </p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-surface-container-highest font-code-sm text-[10px] text-on-surface-variant">
                    Weight: 20% • RBAC / Ownable2Step validation
                  </div>
                </div>

                {/* Agent 3 */}
                <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between shadow-sm border border-outline-variant/20">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-code-sm text-code-sm text-secondary font-semibold">AGENT 03</span>
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    </div>
                    <h4 className="font-body-md text-body-md font-semibold text-on-surface">Tokenomics Auditor</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 text-xs">
                      Evaluates token inflation schedules, rounding-in-favor-of attacker flaws, and decimal precision mismatches.
                    </p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-surface-container-highest font-code-sm text-[10px] text-on-surface-variant">
                    Weight: 20% • Math overflow &amp; fee logic
                  </div>
                </div>

                {/* Agent 4 */}
                <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between shadow-sm border border-outline-variant/20">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-code-sm text-code-sm text-secondary font-semibold">AGENT 04</span>
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    </div>
                    <h4 className="font-body-md text-body-md font-semibold text-on-surface">MEV &amp; Oracle Shield</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 text-xs">
                      Simulates spot price oracle manipulations, flashloan attacks, and frontrunning / sandwich vulnerabilities.
                    </p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-surface-container-highest font-code-sm text-[10px] text-on-surface-variant">
                    Weight: 20% • TWAP &amp; pool manipulation
                  </div>
                </div>

                {/* Agent 5 */}
                <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between shadow-sm border border-outline-variant/20">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-code-sm text-code-sm text-secondary font-semibold">AGENT 05</span>
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    </div>
                    <h4 className="font-body-md text-body-md font-semibold text-on-surface">Bytecode Invariant</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 text-xs">
                      Executes deterministic symbolic analysis and bytecode parity checks against known exploit databases.
                    </p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-surface-container-highest font-code-sm text-[10px] text-on-surface-variant">
                    Weight: 15% • Slither &amp; Mythril bindings
                  </div>
                </div>
              </div>

              {/* Quorum Consensus Pipeline Bar */}
              <div className="p-4 bg-surface-container rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-outline-variant/30">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary text-[24px]">hub</span>
                  <div>
                    <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                      Weighted Quorum Engine (Threshold: 80% / 4 of 5 Agents)
                    </span>
                    <p className="font-code-sm text-code-sm text-on-surface-variant">
                      Discrepancies trigger automated cross-examination before signing the Hedera Consensus message.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-code-sm text-code-sm px-2.5 py-1 bg-surface-container-lowest rounded text-secondary font-semibold border border-outline-variant/20">
                    Consensus Status: ACTIVE
                  </span>
                </div>
              </div>

              {/* Slide Footer */}
              <div className="flex items-center justify-between border-t border-surface-container-highest/60 pt-4">
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  SwarmProof Cognitive Engine Specs • Multi-Agent Heuristics
                </span>
                <span className="font-code-sm text-code-sm text-on-surface-variant">BFT Byzantine Consensus Protocol</span>
              </div>
            </section>

            {/* ==================== SLIDE 04: HEDERA HCS ANCHORING ==================== */}
            <section
              className="deck-slide w-full min-h-[640px] lg:min-h-[720px] bg-surface-container-lowest rounded-xl shadow-xl flex flex-col justify-between p-6 md:p-12 relative overflow-hidden border border-outline-variant/30"
              id="slide-4"
            >
              {/* Slide Header */}
              <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                    SLIDE 04 / 07
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-medium">
                    Hedera Consensus Service (HCS)
                  </span>
                </div>
                <span className="font-code-sm text-code-sm text-secondary font-medium">
                  Immutable Microsecond Timestamping
                </span>
              </div>

              {/* Slide Content */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto items-center">
                {/* Left Column: Explanation */}
                <div className="lg:col-span-6 flex flex-col gap-5">
                  <span className="font-label-caps text-label-caps text-secondary uppercase">MATHEMATICAL PROOF LAYER</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Audit Reports As Immutable State. Forever Anchored on Hedera.
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Traditional PDF audits can be altered, faked, or quietly updated after a security breach. SwarmProof turns audit conclusions into cryptographic payload proofs submitted directly to a dedicated Hedera Consensus Service Topic.
                  </p>
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="flex items-start gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                      <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">fingerprint</span>
                      <div>
                        <h4 className="font-body-sm text-body-sm font-semibold text-on-surface">SHA-256 Bytecode &amp; Report Hashing</h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant text-xs">
                          Deterministic state digest links compiler AST, agent signatures, and test coverage into a single hash.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                      <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">schedule</span>
                      <div>
                        <h4 className="font-body-sm text-body-sm font-semibold text-on-surface">Hedera Fair Ordering &amp; Sequence Numbers</h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant text-xs">
                          Every audit receives an immutable HCS sequence number and consensus timestamp accurate to the nanosecond.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                      <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">verified_user</span>
                      <div>
                        <h4 className="font-body-sm text-body-sm font-semibold text-on-surface">Zero Trust Verification</h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant text-xs">
                          Institutional insurers and LPs can verify audit validity in 100ms via public Hedera Mirror Nodes.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Proof Visualizer Card */}
                <div className="lg:col-span-6 bg-surface-container p-6 rounded-xl flex flex-col gap-4 shadow-sm border border-outline-variant/30">
                  <div className="flex items-center justify-between pb-3 border-b border-surface-container-highest">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                      <span className="font-code-sm text-code-sm font-semibold text-on-surface">HCS Consensus Receipt Sample</span>
                    </div>
                    <span className="font-code-sm text-code-sm text-on-surface-variant">Mainnet Live</span>
                  </div>

                  {/* Code/Data Block */}
                  <div className="bg-[#18181b] p-4 rounded-lg font-code-sm text-code-sm text-zinc-100 flex flex-col gap-2 overflow-x-auto border border-zinc-800">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">topic_id:</span>
                      <span className="text-secondary-fixed font-semibold">"0.0.10417469"</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">consensus_timestamp:</span>
                      <span className="text-[#63f7ff]">"1740918420.301948201"</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">sequence_number:</span>
                      <span className="text-white font-semibold">#48192</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">running_hash:</span>
                      <span className="text-zinc-400 truncate max-w-[200px]">0x8f2d91b...e4a7</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">agent_quorum:</span>
                      <span className="text-secondary-fixed font-semibold">"5/5 (100% UNANIMOUS)"</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">contract_target:</span>
                      <span className="text-white truncate max-w-[200px]">0xHederaVaultV2</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">attestation_status:</span>
                      <span className="text-secondary-fixed font-semibold">"VERIFIED_SECURE"</span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-container-lowest rounded-lg flex items-center justify-between border border-outline-variant/20">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[18px]">public</span>
                      <span className="font-body-sm text-body-sm text-on-surface">Mirror Node Verification API</span>
                    </div>
                    <span className="font-code-sm text-code-sm text-on-surface-variant">REST / gRPC Ready</span>
                  </div>
                </div>
              </div>

              {/* Slide Footer */}
              <div className="flex items-center justify-between border-t border-surface-container-highest/60 pt-4">
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  Hedera Consensus Service • Cryptographic State Anchoring
                </span>
                <span className="font-code-sm text-code-sm text-on-surface-variant">HCS Topic 0.0.10417469</span>
              </div>
            </section>

            {/* ==================== SLIDE 05: MONETIZATION & X402 ==================== */}
            <section
              className="deck-slide w-full min-h-[640px] lg:min-h-[720px] bg-surface-container-lowest rounded-xl shadow-xl flex flex-col justify-between p-6 md:p-12 relative overflow-hidden border border-outline-variant/30"
              id="slide-5"
            >
              {/* Slide Header */}
              <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                    SLIDE 05 / 07
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-medium">
                    Monetization: x402 Micropayments
                  </span>
                </div>
                <span className="font-code-sm text-code-sm text-secondary font-medium">HTTP 402 + Tinybar Settlement</span>
              </div>

              {/* Content */}
              <div className="my-auto py-4 flex flex-col gap-6">
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface max-w-2xl">
                    Autonomous Machine-to-Machine Commerce with Zero Human Friction.
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl mt-1">
                    SwarmProof turns smart contract audits into an on-demand web utility via HTTP 402 "Payment Required" protocols. Agents stream tiny fractions of HBAR for instant analysis, incentivizing specialist models without SaaS subscriptions.
                  </p>
                </div>

                {/* 4-Stage Transaction Pipeline */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Step 1 */}
                  <div className="bg-surface-container-low p-5 rounded-xl flex flex-col justify-between shadow-sm relative border border-outline-variant/20">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">PHASE 01</span>
                    <div className="my-4">
                      <span className="material-symbols-outlined text-[28px] text-on-surface">send</span>
                      <h4 className="font-body-md text-body-md font-semibold text-on-surface mt-2">HTTP 402 Trigger</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-1">
                        Developer CI/CD triggers an audit request to `/verify`. API returns standard HTTP 402 with Hedera account header.
                      </p>
                    </div>
                    <span className="font-code-sm text-code-sm text-secondary">Status: 402 Required</span>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-surface-container-low p-5 rounded-xl flex flex-col justify-between shadow-sm relative border border-outline-variant/20">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">PHASE 02</span>
                    <div className="my-4">
                      <span className="material-symbols-outlined text-[28px] text-secondary">payments</span>
                      <h4 className="font-body-md text-body-md font-semibold text-on-surface mt-2">Tinybar Settlement</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-1">
                        Client automatically signs a 0.01 ℏ ($0.001) micro-transaction. Blocky402 facilitator verifies on-chain receipt in 800ms.
                      </p>
                    </div>
                    <span className="font-code-sm text-code-sm text-secondary">Fee: 1,000,000 tinybar</span>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-surface-container-low p-5 rounded-xl flex flex-col justify-between shadow-sm relative border border-outline-variant/20">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">PHASE 03</span>
                    <div className="my-4">
                      <span className="material-symbols-outlined text-[28px] text-on-surface">psychology</span>
                      <h4 className="font-body-md text-body-md font-semibold text-on-surface mt-2">Swarm Execution</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-1">
                        The 5 cognitive agents receive task instructions and parallel-process AST parsing and bytecode vulnerability scans.
                      </p>
                    </div>
                    <span className="font-code-sm text-code-sm text-secondary">5/5 Nodes Active</span>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-surface-container-low p-5 rounded-xl flex flex-col justify-between shadow-sm relative border border-outline-variant/20">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">PHASE 04</span>
                    <div className="my-4">
                      <span className="material-symbols-outlined text-[28px] text-on-secondary-container">call_split</span>
                      <h4 className="font-body-md text-body-md font-semibold text-on-surface mt-2">Agent Micro-Royalties</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-1">
                        Upon unanimous quorum, fees are split automatically to each agent's individual Hedera wallet based on consensus weight.
                      </p>
                    </div>
                    <span className="font-code-sm text-code-sm text-secondary">Automatic Payout</span>
                  </div>
                </div>

                {/* Revenue Model Projection Metric */}
                <div className="p-4 bg-surface-container rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-outline-variant/30">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">query_stats</span>
                    <div>
                      <span className="font-body-sm text-body-sm font-semibold text-on-surface">Unit Economics at Scale</span>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs">
                        100,000 CI/CD builds/mo @ 0.05 ℏ avg = Sustainable autonomous agent micro-economy.
                      </p>
                    </div>
                  </div>
                  <div className="font-code-sm text-code-sm bg-surface-container-lowest px-3 py-1.5 rounded font-medium text-on-surface border border-outline-variant/20">
                    Zero Platform Accounts • Pure On-Chain Utility
                  </div>
                </div>
              </div>

              {/* Slide Footer */}
              <div className="flex items-center justify-between border-t border-surface-container-highest/60 pt-4">
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  Autonomous Monetization Architecture • x402 Micropayments
                </span>
                <span className="font-code-sm text-code-sm text-on-surface-variant">Hedera Token &amp; Tinybar Rails</span>
              </div>
            </section>

            {/* ==================== SLIDE 06: AGENT IDENTITY & REPUTATION ==================== */}
            <section
              className="deck-slide w-full min-h-[640px] lg:min-h-[720px] bg-surface-container-lowest rounded-xl shadow-xl flex flex-col justify-between p-6 md:p-12 relative overflow-hidden border border-outline-variant/30"
              id="slide-6"
            >
              {/* Slide Header */}
              <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                    SLIDE 06 / 07
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-medium">
                    Agent Identity: W3C did:hedera
                  </span>
                </div>
                <span className="font-code-sm text-code-sm text-secondary font-medium">Verifiable Credentials &amp; Slashing</span>
              </div>

              {/* Slide Content */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto items-center">
                {/* Left Column: Specs */}
                <div className="lg:col-span-6 flex flex-col gap-4">
                  <span className="font-label-caps text-label-caps text-secondary uppercase">SOVEREIGN AGENT REPUTATION</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Cryptographic Accountability for Autonomous Auditors.
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    In SwarmProof, AI models are not anonymous cloud scripts. Each agent possesses a sovereign Decentralized Identifier (`did:hedera`), earns on-chain reputation for verified accuracy, and faces automatic staking slashing for false consensus.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                      <span className="font-label-caps text-label-caps text-on-surface-variant">STANDARD</span>
                      <h4 className="font-body-md text-body-md font-semibold text-on-surface mt-1">W3C DID Registry</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-1">
                        Anchored to Hedera Consensus Service topics for verifiable decentralized identity resolution.
                      </p>
                    </div>
                    <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                      <span className="font-label-caps text-label-caps text-on-surface-variant">STAKING</span>
                      <h4 className="font-body-md text-body-md font-semibold text-on-surface mt-1">Consensus Staking</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-1">
                        Agents stake collateral. Dissident or compromised responses result in immediate automated slashing.
                      </p>
                    </div>
                    <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                      <span className="font-label-caps text-label-caps text-on-surface-variant">CREDENTIALS</span>
                      <h4 className="font-body-md text-body-md font-semibold text-on-surface mt-1">Verifiable Credentials</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-1">
                        Cryptographic VCs issued for successful historical audits across top-tier DeFi protocols.
                      </p>
                    </div>
                    <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                      <span className="font-label-caps text-label-caps text-on-surface-variant">PORTABILITY</span>
                      <h4 className="font-body-md text-body-md font-semibold text-on-surface mt-1">Cross-Platform Trust</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-1">
                        Agent identity travels across IDEs, GitHub actions, and continuous integration pipelines seamlessly.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column: DID Identity Card */}
                <div className="lg:col-span-6 bg-surface-container p-6 rounded-xl flex flex-col gap-4 shadow-sm border border-outline-variant/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary">
                        <span className="material-symbols-outlined text-[20px]">badge</span>
                      </div>
                      <div>
                        <h4 className="font-body-md text-body-md font-semibold text-on-surface">Agent-Reentrancy-Alpha</h4>
                        <span className="font-code-sm text-code-sm text-on-surface-variant">did:hedera:testnet:0.0.10417469_1</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-secondary-container text-on-secondary-container rounded font-code-sm text-code-sm font-semibold">
                      Tier 1 Auditor
                    </span>
                  </div>

                  <div className="p-4 bg-surface-container-lowest rounded-lg flex flex-col gap-3 font-code-sm text-code-sm border border-outline-variant/20">
                    <div className="flex justify-between border-b border-surface-container-highest pb-2">
                      <span className="text-on-surface-variant">Reputation Score:</span>
                      <span className="font-semibold text-secondary">99.84 / 100</span>
                    </div>
                    <div className="flex justify-between border-b border-surface-container-highest pb-2">
                      <span className="text-on-surface-variant">Audits Completed:</span>
                      <span className="font-semibold text-on-surface">1,429 Verified</span>
                    </div>
                    <div className="flex justify-between border-b border-surface-container-highest pb-2">
                      <span className="text-on-surface-variant">Bonded Stake:</span>
                      <span className="font-semibold text-on-surface">50,000 ℏ</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">VC Signature:</span>
                      <span className="text-on-surface-variant truncate max-w-[220px]">eddsa-ed25519:3b9f48...</span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-container-low rounded-lg flex items-center gap-3 border border-outline-variant/20">
                    <span className="material-symbols-outlined text-secondary text-[20px]">shield</span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant text-xs">
                      Cryptographically verified by Hedera Consensus Service. Zero governance capture.
                    </p>
                  </div>
                </div>
              </div>

              {/* Slide Footer */}
              <div className="flex items-center justify-between border-t border-surface-container-highest/60 pt-4">
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  W3C Decentralized Identity Implementation • did:hedera Standard
                </span>
                <span className="font-code-sm text-code-sm text-on-surface-variant">Hedera DID Method v1.0</span>
              </div>
            </section>

            {/* ==================== SLIDE 07: ROADMAP & TRACTION ==================== */}
            <section
              className="deck-slide w-full min-h-[640px] lg:min-h-[720px] bg-surface-container-lowest rounded-xl shadow-xl flex flex-col justify-between p-6 md:p-12 relative overflow-hidden border border-outline-variant/30"
              id="slide-7"
            >
              {/* Slide Header */}
              <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                    SLIDE 07 / 07
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-medium">Roadmap &amp; Call to Action</span>
                </div>
                <span className="font-code-sm text-code-sm text-secondary font-medium">Next Horizon 2026</span>
              </div>

              {/* Main Content */}
              <div className="my-auto py-4 flex flex-col gap-8">
                <div>
                  <span className="font-label-caps text-label-caps text-secondary uppercase">STRATEGIC EXPANSION</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface max-w-2xl mt-1">
                    From Hackathon Proof of Concept to Global Hedera Standard.
                  </h2>
                </div>

                {/* 3-Phase Roadmap Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-5 bg-surface-container-low rounded-xl flex flex-col justify-between shadow-sm border border-outline-variant/20">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-label-caps text-label-caps text-secondary font-bold">MILESTONE 01</span>
                        <span className="px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded text-[10px] font-code-sm">
                          CURRENT
                        </span>
                      </div>
                      <h3 className="font-body-md text-body-md font-semibold text-on-surface mt-2">HCS Consensus Quorum</h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-2 leading-relaxed">
                        • Live Topic 0.0.10417469 on Hedera<br />
                        • 5-Agent Weighted Quorum Heuristics<br />
                        • x402 Micropayment Rails Demo
                      </p>
                    </div>
                    <div className="mt-4 pt-2 border-t border-surface-container-highest font-code-sm text-code-sm text-on-surface">
                      Q1 2026: Mainnet Alpha
                    </div>
                  </div>

                  <div className="p-5 bg-surface-container-low rounded-xl flex flex-col justify-between shadow-sm border border-outline-variant/20">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">MILESTONE 02</span>
                        <span className="px-2 py-0.5 bg-surface-container rounded text-[10px] font-code-sm text-on-surface-variant">
                          UPCOMING
                        </span>
                      </div>
                      <h3 className="font-body-md text-body-md font-semibold text-on-surface mt-2">IDE &amp; MCP Integration</h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-2 leading-relaxed">
                        • Cursor &amp; Windsurf Model Context Protocol<br />
                        • One-click verify on every git commit<br />
                        • GitHub Actions automated HCS attestation badge
                      </p>
                    </div>
                    <div className="mt-4 pt-2 border-t border-surface-container-highest font-code-sm text-code-sm text-on-surface">
                      Q2 2026: Developer SDK
                    </div>
                  </div>

                  <div className="p-5 bg-surface-container-low rounded-xl flex flex-col justify-between shadow-sm border border-outline-variant/20">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">MILESTONE 03</span>
                        <span className="px-2 py-0.5 bg-surface-container rounded text-[10px] font-code-sm text-on-surface-variant">
                          ROADMAP
                        </span>
                      </div>
                      <h3 className="font-body-md text-body-md font-semibold text-on-surface mt-2">Open Agent Marketplace</h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-2 leading-relaxed">
                        • Third-party security researchers register agents<br />
                        • Competitive staking &amp; reward distribution<br />
                        • Multi-chain verification settlement back to HCS
                      </p>
                    </div>
                    <div className="mt-4 pt-2 border-t border-surface-container-highest font-code-sm text-code-sm text-on-surface">
                      Q3-Q4 2026: Decentralized Network
                    </div>
                  </div>
                </div>

                {/* Strong Action Banner */}
                <div className="p-6 bg-surface-container rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-outline-variant/30">
                  <div className="flex flex-col gap-1">
                    <h4 className="font-headline-sm text-headline-sm text-on-surface font-medium">
                      Ready to inspect live SwarmProof consensus?
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Interact with our 3D agent visualizer, inspect live HCS consensus proofs, or test the x402 payment lab.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      className="px-4 py-2 bg-primary text-on-primary font-body-sm text-body-sm rounded hover:bg-primary-container transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                      href="/"
                    >
                      <span className="material-symbols-outlined text-[18px]">hub</span>
                      <span>Open 3D Swarm</span>
                    </Link>
                    <Link
                      className="px-4 py-2 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded hover:bg-surface-container-high transition-colors flex items-center gap-2 cursor-pointer border border-outline-variant/20 shadow-sm"
                      href="/x402"
                    >
                      <span className="material-symbols-outlined text-[18px]">wallet</span>
                      <span>Test x402 Lab</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Slide Footer */}
              <div className="flex items-center justify-between border-t border-surface-container-highest/60 pt-4">
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  SwarmProof Executive Pitch Deck • Thank You
                </span>
                <span className="font-code-sm text-code-sm text-secondary font-medium">Hedera Ecosystem Grantee</span>
              </div>
            </section>
          </div>
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

      {/* ── Modals Retained ───────────────────────────────────────── */}
      {isRegisterModalOpen && (
        <RegisterAgentModal
          onClose={() => setIsRegisterModalOpen(false)}
          onRegistered={() => setIsRegisterModalOpen(false)}
        />
      )}

      {isPoolModalOpen && <AuditPoolModal onClose={() => setIsPoolModalOpen(false)} />}
    </div>
  );
}
