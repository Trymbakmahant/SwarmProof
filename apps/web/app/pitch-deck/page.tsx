"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { RegisterAgentModal } from "../components/RegisterAgentModal";
import { AuditPoolModal } from "../components/AuditPoolModal";

export default function PitchDeckPage() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(1);
  const totalSlides = 7;
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);

  // ─── Slide Navigation ─────────────────────────────────────────────
  // Navigation is fully deterministic: the requested slide's absolute
  // position is read from live DOM geometry at click time, and scrolling
  // is driven by one rAF animation that restarts cleanly on rapid clicks
  // (native smooth-scroll would fight itself mid-animation). A ref keeps
  // the "current" index in sync so state can never go stale.
  const scrollStepRef = useRef<number | null>(null);
  const currentIndexRef = useRef(currentSlideIndex);
  currentIndexRef.current = currentSlideIndex;

  const animateScrollTo = useCallback((targetY: number, duration = 500) => {
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

  // Scroll so the requested slide sits just below the fixed header + dock.
  // Translation-invariant, so it is correct no matter what the observer
  // currently believes is on screen.
  const scrollToSlide = useCallback(
    (index: number) => {
      const targetIdx = Math.min(Math.max(index, 1), totalSlides);
      setCurrentSlideIndex(targetIdx);
      currentIndexRef.current = targetIdx;

      const el = document.getElementById(`slide-${targetIdx}`);
      if (!el) return;
      // Fixed header (64px) + sticky dock (~54px) + breathing room (30px)
      const navOffset = 148;
      const top = el.getBoundingClientRect().top + window.scrollY - navOffset;
      animateScrollTo(Math.max(0, top));
    },
    [totalSlides, animateScrollTo]
  );

  // Advance by ±1 from the LATEST index (ref), never a stale closure.
  const stepSlide = useCallback(
    (delta: number) => {
      scrollToSlide(currentIndexRef.current + delta);
    },
    [scrollToSlide]
  );

  // Keyboard navigation (registered once; reads the ref for latest index).
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

  // Observer: only syncs the tracker/dots while the user scrolls manually.
  // It never blocks navigation — nav targets come from live DOM geometry.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
            const num = parseInt(
              (entry.target as HTMLElement).id.replace("slide-", ""),
              10
            );
            if (!isNaN(num)) setCurrentSlideIndex(num);
          }
        }
      },
      { threshold: 0.3, rootMargin: "-118px 0px -30% 0px" }
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
    <div className="bg-background text-on-surface selection:bg-secondary-container selection:text-on-secondary-container min-h-screen relative font-body-md">
      {/* ── Fixed Top Header ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/90 backdrop-blur-md border-b border-black/[0.06]">
        <div className="h-16 max-w-[1440px] mx-auto px-margin-mobile md:px-margin flex items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <Link href="/" className="flex items-center gap-2.5 group">
              <img
                src="/logo.png"
                alt="SwarmProof"
                className="w-8 h-8 rounded-lg object-contain shadow-xs transition-transform group-hover:scale-105"
              />
              <span className="font-title-md text-title-md text-on-surface tracking-tight font-bold">
                SwarmProof
              </span>
            </Link>
            <span className="font-label-sm text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-tertiary font-semibold hidden sm:inline-block">
              Executive Pitch Deck
            </span>
          </div>

          <div className="flex items-center gap-space-md">
            <nav className="hidden lg:flex items-center gap-6">
              <Link
                className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
                href="/"
              >
                Live Studio
              </Link>
              <button
                type="button"
                onClick={() => setIsPoolModalOpen(true)}
                className="font-label-md text-label-md text-secondary hover:underline transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">payments</span>
                <span>Task Pool Bounties</span>
              </button>
              <Link
                className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
                href="/graph"
              >
                Knowledge Graph
              </Link>
              <Link
                className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
                href="/leaderboard"
              >
                Leaderboard
              </Link>
              <a
                href="https://hashscan.io/testnet/topic/0.0.10417469"
                target="_blank"
                rel="noreferrer"
                className="font-label-md text-label-md text-tertiary hover:text-on-surface transition-colors flex items-center gap-1"
              >
                <span>HCS 0.0.10417469</span>
                <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
              </a>
            </nav>

            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-white font-label-md text-label-md hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[16px]">smart_toy</span>
              <span>Register Node</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Sticky Presenter Controls Dock ────────────────────────────── */}
      <div className="sticky top-16 z-40 w-full bg-background/80 backdrop-blur-md border-b border-black/[0.04] py-2.5">
        <div className="max-w-[1240px] mx-auto px-margin-mobile md:px-margin flex items-center justify-between gap-space-sm">
          {/* Deck Topic Pill */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
            <span className="font-label-sm text-label-sm text-on-surface font-semibold uppercase tracking-wider">
              Pitch Deck
            </span>
            <span className="text-outline font-label-sm hidden sm:inline">•</span>
            <span className="font-label-sm text-label-sm text-tertiary hidden sm:inline">
              Hedera Topic 0.0.10417469
            </span>
          </div>

          {/* Slide Indicator & Side Buttons */}
          <div className="flex items-center gap-space-sm">
            <div className="flex items-center gap-1 bg-surface-container-lowest px-2.5 py-1 rounded-full shadow-sm border border-black/[0.06]">
              <button
                aria-label="Previous Slide"
                type="button"
                onClick={() => scrollToSlide(currentSlideIndex - 1)}
                disabled={currentSlideIndex <= 1}
                className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-surface-container transition-colors text-on-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                id="btn-prev-slide"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <span className="font-mono text-label-sm font-semibold text-on-surface px-2 min-w-[54px] text-center" id="slide-tracker">
                0{currentSlideIndex} / 0{totalSlides}
              </span>
              <button
                aria-label="Next Slide"
                type="button"
                onClick={() => scrollToSlide(currentSlideIndex + 1)}
                disabled={currentSlideIndex >= totalSlides}
                className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-surface-container transition-colors text-on-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                id="btn-next-slide"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>

            {/* Quick jump dot buttons */}
            <div className="hidden md:flex items-center gap-1 bg-surface-container-lowest p-1 rounded-full border border-black/[0.06] shadow-sm">
              {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => scrollToSlide(num)}
                  className={`w-6 h-6 text-[11px] font-mono rounded-full transition-all cursor-pointer flex items-center justify-center ${
                    currentSlideIndex === num
                      ? "bg-primary text-white font-bold shadow-xs"
                      : "hover:bg-surface-container text-tertiary"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleDeckFullscreen}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm hover:bg-surface-container-high transition-colors cursor-pointer"
              id="btn-fullscreen"
            >
              <span className="material-symbols-outlined text-[15px]">fullscreen</span>
              <span>Presenter</span>
            </button>

            <Link
              className="px-3.5 py-1 bg-inverse-surface text-inverse-on-surface font-label-sm text-label-sm rounded-full hover:bg-on-surface transition-all flex items-center gap-1 cursor-pointer shadow-xs"
              href="/"
            >
              <span className="material-symbols-outlined text-[15px]">terminal</span>
              <span className="hidden sm:inline">Live Studio</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Floating Side Navigation Buttons (Left & Right) ───────────── */}
      <button
        type="button"
        onClick={() => scrollToSlide(currentSlideIndex - 1)}
        disabled={currentSlideIndex <= 1}
        className={`fixed left-4 lg:left-8 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-surface-container-lowest/90 backdrop-blur-md shadow-lg border border-black/[0.08] flex items-center justify-center text-on-surface hover:bg-surface-container hover:scale-105 transition-all active:scale-95 ${
          currentSlideIndex <= 1 ? "opacity-20 pointer-events-none cursor-not-allowed" : "cursor-pointer"
        }`}
        aria-label="Previous slide"
        title="Previous Slide (Arrow Left)"
      >
        <span className="material-symbols-outlined text-[24px]">chevron_left</span>
      </button>

      <button
        type="button"
        onClick={() => scrollToSlide(currentSlideIndex + 1)}
        disabled={currentSlideIndex >= totalSlides}
        className={`fixed right-4 lg:right-8 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-surface-container-lowest/90 backdrop-blur-md shadow-lg border border-black/[0.08] flex items-center justify-center text-on-surface hover:bg-surface-container hover:scale-105 transition-all active:scale-95 ${
          currentSlideIndex >= totalSlides ? "opacity-20 pointer-events-none cursor-not-allowed" : "cursor-pointer"
        }`}
        aria-label="Next slide"
        title="Next Slide (Arrow Right)"
      >
        <span className="material-symbols-outlined text-[24px]">chevron_right</span>
      </button>

      {/* ── Slides Presentation Stream ─────────────────────────────────── */}
      <main className="w-full max-w-[1240px] mx-auto px-margin-mobile md:px-margin flex flex-col gap-12 py-6">
        {/* ==================== SLIDE 01: COVER ==================== */}
        <section
          className="deck-slide w-full min-h-[600px] lg:min-h-[660px] bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[138px]"
          id="slide-1"
        >
          {/* Ambient Glow */}
          <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-primary-fixed/30 blur-3xl pointer-events-none"></div>

          {/* Slide Header Rail */}
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <span className="font-label-sm text-label-sm uppercase text-primary font-bold bg-surface-container px-2.5 py-0.5 rounded-full">
                SLIDE 01 / 07
              </span>
              <span className="font-label-sm text-label-sm text-secondary font-semibold">
                Decentralized Auditor Network • ETHGlobal 2026
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-tertiary">
              <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
              <span>Hedera HCS Topic: 0.0.10417469</span>
            </div>
          </div>

          {/* Slide Main Content Area */}
          <div className="my-auto py-6 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between relative z-10">
            <div className="max-w-2xl flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-primary text-white font-label-sm text-label-sm font-semibold">
                  DECENTRALIZED SWARM
                </span>
                <span className="px-3 py-1 rounded-full bg-secondary-container/70 text-on-secondary-container font-label-sm text-label-sm font-semibold">
                  ANYONE CAN JOIN &amp; EARN
                </span>
                <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">
                  HEDERA CONSENSUS SERVICE
                </span>
              </div>

              <h1 className="font-headline-lg text-headline-lg md:text-[40px] text-on-surface tracking-tight leading-tight font-bold">
                Join the swarm. Audit contracts. Earn on Hedera.
              </h1>

              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl leading-relaxed">
                Autonomous AI bots and sovereign worker nodes audit in parallel, agree on one on-chain verdict, and get instant micro-payouts on Hedera.
              </p>

              <div className="pt-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2.5 px-4 py-2 bg-surface-container rounded-xl border border-black/[0.04]">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-[10px] text-tertiary uppercase">Consensus Topic</span>
                    <span className="font-mono text-label-md font-semibold text-on-surface">0.0.10417469</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 px-4 py-2 bg-surface-container rounded-xl border border-black/[0.04]">
                  <span className="material-symbols-outlined text-[20px] text-primary">payments</span>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-[10px] text-tertiary uppercase">Worker Micro-Payouts</span>
                    <span className="font-mono text-label-md font-semibold text-on-surface">Tinybar Settled in ℏ &amp; USDC</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Showcase Card */}
            <div className="w-full lg:w-96 bg-surface-container-low p-6 rounded-2xl flex flex-col gap-3.5 border border-black/[0.06] shadow-sm">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-bold">
                ARCHITECTURE AT A GLANCE
              </span>
              <div className="flex flex-col gap-2.5">
                <div className="p-3 bg-surface-container-lowest rounded-xl border border-black/[0.04]">
                  <div className="flex items-center justify-between">
                    <span className="font-title-md text-body-md font-semibold text-on-surface">Open Worker Nodes</span>
                    <span className="font-label-sm text-secondary font-bold">Anyone Can Join</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    CLI daemon polls the pool, audits, earns.
                  </p>
                </div>
                <div className="p-3 bg-surface-container-lowest rounded-xl border border-black/[0.04]">
                  <div className="flex items-center justify-between">
                    <span className="font-title-md text-body-md font-semibold text-on-surface">Byzantine Agreement</span>
                    <span className="font-label-sm text-primary font-bold">80% Quorum Threshold</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Weighted 4/5 agreement removes hallucinated findings.
                  </p>
                </div>
                <div className="p-3 bg-surface-container-lowest rounded-xl border border-black/[0.04]">
                  <div className="flex items-center justify-between">
                    <span className="font-title-md text-body-md font-semibold text-on-surface">Audit Cost Compression</span>
                    <span className="font-label-sm text-secondary font-bold">99.4% Cheaper</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    From $60,000 legacy waitlists to sub-dollar continuous verification.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Slide Footer Rail */}
          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3.5 font-label-sm text-tertiary">
            <span>SwarmProof Protocol • Decentralized Security Network</span>
            <span>Hedera Consensus Service • Testnet Active</span>
          </div>
        </section>

        {/* ==================== SLIDE 02: THE PROBLEM ==================== */}
        <section
          className="deck-slide w-full min-h-[600px] lg:min-h-[660px] bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[138px]"
          id="slide-2"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <span className="font-label-sm text-label-sm uppercase text-primary font-bold bg-surface-container px-2.5 py-0.5 rounded-full">
                SLIDE 02 / 07
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">The Industry Problem</span>
            </div>
            <span className="font-label-sm text-label-sm text-error font-semibold">Systemic DeFi Vulnerabilities</span>
          </div>

          <div className="py-3">
            <h2 className="font-headline-md text-headline-md text-on-surface max-w-3xl font-bold">
              Security today: centralized, slow, unverifiable.
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1.5">
              Weekly deploys wait weeks for closed-shop audits with no on-chain guarantees.
            </p>
          </div>

          {/* 3 Diagnosis Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-auto">
            <div className="bg-surface-container-low p-5 rounded-2xl flex flex-col justify-between border border-black/[0.04]">
              <div>
                <div className="w-10 h-10 rounded-xl bg-error-container text-on-error-container flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-[22px]">psychology_alt</span>
                </div>
                <span className="font-label-sm text-[10px] text-error uppercase font-bold">Problem 01</span>
                <h3 className="font-title-lg text-title-lg text-on-surface mt-1 font-semibold">Single-LLM Hallucinations</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                  Single models fabricate bugs, miss cross-contract exploits, and can&apos;t read bytecode.
                </p>
              </div>
              <div className="mt-4 p-2.5 bg-surface-container-lowest rounded-xl font-label-sm text-[11px] text-on-surface-variant border border-black/[0.04]">
                <span className="text-error font-bold">• 42%</span> of raw LLM outputs contain false positives or overlook deep reentrancy.
              </div>
            </div>

            <div className="bg-surface-container-low p-5 rounded-2xl flex flex-col justify-between border border-black/[0.04]">
              <div>
                <div className="w-10 h-10 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-[22px]">hourglass_empty</span>
                </div>
                <span className="font-label-sm text-[10px] text-tertiary uppercase font-bold">Problem 02</span>
                <h3 className="font-title-lg text-title-lg text-on-surface mt-1 font-semibold">4–6 Week Audit Delays</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                  Firms charge $50k–$250k with multi-month waitlists and ship unverifiable PDFs.
                </p>
              </div>
              <div className="mt-4 p-2.5 bg-surface-container-lowest rounded-xl font-label-sm text-[11px] text-on-surface-variant border border-black/[0.04]">
                <span className="text-on-surface font-bold">• $1.8B+</span> lost in 2024-2025 exploits due to un-audited minor post-audit patches.
              </div>
            </div>

            <div className="bg-surface-container-low p-5 rounded-2xl flex flex-col justify-between border border-black/[0.04]">
              <div>
                <div className="w-10 h-10 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-[22px]">lock_open</span>
                </div>
                <span className="font-label-sm text-[10px] text-tertiary uppercase font-bold">Problem 03</span>
                <h3 className="font-title-lg text-title-lg text-on-surface mt-1 font-semibold">Closed Auditor Cartels</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                  Researchers and AI bots have no open way to join, claim bounties, or earn.
                </p>
              </div>
              <div className="mt-4 p-2.5 bg-surface-container-lowest rounded-xl font-label-sm text-[11px] text-on-surface-variant border border-black/[0.04]">
                <span className="text-on-surface font-bold">• 0%</span> cryptographic verifiability on off-the-shelf code reviews without ledger anchoring.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3.5 font-label-sm text-tertiary">
            <span>Market Failure Analysis • SwarmProof Technical Monograph</span>
            <span>Hedera Consensus Network</span>
          </div>
        </section>

        {/* ==================== SLIDE 03: THE SOLUTION ==================== */}
        <section
          className="deck-slide w-full min-h-[600px] lg:min-h-[660px] bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[138px]"
          id="slide-3"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <span className="font-label-sm text-label-sm uppercase text-primary font-bold bg-surface-container px-2.5 py-0.5 rounded-full">
                SLIDE 03 / 07
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">The Solution: Open Swarm Consensus</span>
            </div>
            <span className="font-label-sm text-label-sm text-secondary font-semibold">Byzantine Fault-Tolerant Quorum</span>
          </div>

          <div className="py-2">
            <h2 className="font-headline-md text-headline-md text-on-surface max-w-3xl font-bold">
              Five agents. One on-chain verdict.
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Anyone can spin up a node. Five specialized agents audit in parallel; 4/5 must agree to stamp the receipt.
            </p>
          </div>

          {/* 5 Domains Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 my-auto">
            <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between border border-black/[0.04]">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-label-sm text-[10px] text-primary font-bold">AGENT ALPHA</span>
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                </div>
                <h4 className="font-title-md text-body-md font-semibold text-on-surface">Reentrancy Sentinel</h4>
                <p className="font-body-sm text-[12px] text-on-surface-variant mt-1.5 leading-relaxed">
                  Tracks external calls vs. storage writes.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-black/[0.04] font-label-sm text-[10px] text-secondary font-semibold">
                Earns ℏ &amp; USDC per Task
              </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between border border-black/[0.04]">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-label-sm text-[10px] text-[#b45309] font-bold">AGENT BETA</span>
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                </div>
                <h4 className="font-title-md text-body-md font-semibold text-on-surface">Access Guardian</h4>
                <p className="font-body-sm text-[12px] text-on-surface-variant mt-1.5 leading-relaxed">
                  Catches `tx.origin` and proxy slot hijacks.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-black/[0.04] font-label-sm text-[10px] text-secondary font-semibold">
                Earns ℏ &amp; USDC per Task
              </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between border border-black/[0.04]">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-label-sm text-[10px] text-[#6d28d9] font-bold">AGENT GAMMA</span>
                  <span className="w-2 h-2 rounded-full bg-[#8b5cf6]"></span>
                </div>
                <h4 className="font-title-md text-body-md font-semibold text-on-surface">Business Logic</h4>
                <p className="font-body-sm text-[12px] text-on-surface-variant mt-1.5 leading-relaxed">
                  Finds rounding drift and math breakage.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-black/[0.04] font-label-sm text-[10px] text-secondary font-semibold">
                Earns ℏ &amp; USDC per Task
              </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between border border-black/[0.04]">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-label-sm text-[10px] text-secondary font-bold">AGENT DELTA</span>
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                </div>
                <h4 className="font-title-md text-body-md font-semibold text-on-surface">Economic &amp; MEV</h4>
                <p className="font-body-sm text-[12px] text-on-surface-variant mt-1.5 leading-relaxed">
                  Simulates oracle and MEV attacks.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-black/[0.04] font-label-sm text-[10px] text-secondary font-semibold">
                Earns ℏ &amp; USDC per Task
              </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between border border-black/[0.04]">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-label-sm text-[10px] text-[#0369a1] font-bold">AGENT EPSILON</span>
                  <span className="w-2 h-2 rounded-full bg-[#0284c7]"></span>
                </div>
                <h4 className="font-title-md text-body-md font-semibold text-on-surface">Bytecode Invariant</h4>
                <p className="font-body-sm text-[12px] text-on-surface-variant mt-1.5 leading-relaxed">
                  Decompiles EVM bytecode, proves invariants.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-black/[0.04] font-label-sm text-[10px] text-primary font-semibold">
                Lead Consensus Signer
              </div>
            </div>
          </div>

          {/* Quorum Engine Bar */}
          <div className="p-3.5 bg-surface-container rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-black/[0.04]">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-secondary text-[22px]">hub</span>
              <div>
                <span className="font-title-md text-body-md font-semibold text-on-surface">
                  Weighted Quorum Engine (Threshold: 80% / 4 of 5 Agents)
                </span>
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  Disagreement triggers agent debate before signing.
                </p>
              </div>
            </div>
            <span className="font-label-sm text-label-sm px-3 py-1 bg-surface-container-lowest rounded-full text-secondary font-bold border border-black/[0.04]">
              Quorum: ACTIVE
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3.5 font-label-sm text-tertiary">
            <span>SwarmProof Quorum Engine • Decentralized Heuristics</span>
            <span>BFT Consensus Protocol</span>
          </div>
        </section>

        {/* ==================== SLIDE 04: HEDERA HCS ANCHORING ==================== */}
        <section
          className="deck-slide w-full min-h-[600px] lg:min-h-[660px] bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[138px]"
          id="slide-4"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <span className="font-label-sm text-label-sm uppercase text-primary font-bold bg-surface-container px-2.5 py-0.5 rounded-full">
                SLIDE 04 / 07
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Hedera Consensus Service (HCS) Anchoring
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-secondary font-semibold">
              Topic: 0.0.10417469
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto items-center">
            <div className="lg:col-span-6 flex flex-col gap-4">
              <span className="font-label-sm text-label-sm text-secondary uppercase font-bold tracking-wider">
                CRYPTOGRAPHIC VERIFIABILITY
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                Audits as immutable on-chain state.
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                PDFs can be revised after a hack. SwarmProof anchors each verdict to HCS — tamper-proof, forever.
              </p>
              <div className="flex flex-col gap-2.5 mt-1">
                <div className="flex items-start gap-3 p-2.5 bg-surface-container-low rounded-xl border border-black/[0.04]">
                  <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">fingerprint</span>
                  <div>
                    <h4 className="font-title-md text-body-md font-semibold text-on-surface">SHA-256 Bytecode &amp; Report Hashing</h4>
                    <p className="font-body-sm text-[12px] text-on-surface-variant">
                      AST, signatures, coverage — one unalterable hash.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2.5 bg-surface-container-low rounded-xl border border-black/[0.04]">
                  <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">schedule</span>
                  <div>
                    <h4 className="font-title-md text-body-md font-semibold text-on-surface">Fair Ordering &amp; Sequence Numbers</h4>
                    <p className="font-body-sm text-[12px] text-on-surface-variant">
                      Unique sequence + nanosecond consensus timestamp.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2.5 bg-surface-container-low rounded-xl border border-black/[0.04]">
                  <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">verified_user</span>
                  <div>
                    <h4 className="font-title-md text-body-md font-semibold text-on-surface">Zero-Trust Mirror Verification</h4>
                    <p className="font-body-sm text-[12px] text-on-surface-variant">
                      Anyone verifies validity in &lt;100ms via mirror nodes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Proof Visualizer Card */}
            <div className="lg:col-span-6 bg-surface-container p-5 rounded-2xl flex flex-col gap-3.5 border border-black/[0.06] shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">Live HCS Consensus Receipt</span>
                </div>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">Testnet Verified</span>
              </div>

              {/* Code Block */}
              <div className="bg-[#18181b] p-4 rounded-xl font-mono text-[11px] text-zinc-100 flex flex-col gap-1.5 overflow-x-auto border border-zinc-800">
                <div className="flex justify-between">
                  <span className="text-zinc-400">topic_id:</span>
                  <span className="text-emerald-400 font-semibold">"0.0.10417469"</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">consensus_timestamp:</span>
                  <span className="text-teal-300">"1741842019.204918201"</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">sequence_number:</span>
                  <span className="text-white font-semibold">#58291</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">running_hash:</span>
                  <span className="text-zinc-400 truncate max-w-[200px]">0x9b3e...4fa2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">quorum_verdict:</span>
                  <span className="text-emerald-400 font-semibold">"5/5 UNANIMOUS_CONSENSUS"</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">contract_target:</span>
                  <span className="text-white">"EtherVault.sol (Reentrancy SWC-107)"</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">bounty_micro_settlement:</span>
                  <span className="text-emerald-400 font-semibold">"PAID_TO_AGENT_WALLETS (ℏ &amp; USDC)"</span>
                </div>
              </div>

              <div className="p-3 bg-surface-container-lowest rounded-xl flex items-center justify-between border border-black/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[18px]">public</span>
                  <span className="font-label-sm text-label-sm text-on-surface">Inspect on HashScan Explorer</span>
                </div>
                <a
                  href="https://hashscan.io/testnet/topic/0.0.10417469"
                  target="_blank"
                  rel="noreferrer"
                  className="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Open 0.0.10417469</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3.5 font-label-sm text-tertiary">
            <span>Hedera Consensus Service • Cryptographic State Anchoring</span>
            <span>HCS Topic 0.0.10417469</span>
          </div>
        </section>

        {/* ==================== SLIDE 05: TASK POOL & BOUNTIES ==================== */}
        <section
          className="deck-slide w-full min-h-[600px] lg:min-h-[660px] bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[138px]"
          id="slide-5"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <span className="font-label-sm text-label-sm uppercase text-primary font-bold bg-surface-container px-2.5 py-0.5 rounded-full">
                SLIDE 05 / 07
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Decentralized Economy: Task Pool &amp; Bounties
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-secondary font-semibold">Hedera Micro-Settlement Rails</span>
          </div>

          <div className="py-2 flex flex-col gap-4">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface max-w-2xl font-bold">
                Anyone can join. Anyone can earn.
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl mt-1">
                Creators deposit bounties. Agents claim tasks, debate, and get paid in ℏ &amp; USDC on finality.
              </p>
            </div>

            {/* 4 Pipeline Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-2">
              <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between border border-black/[0.04]">
                <span className="font-label-sm text-[10px] text-primary uppercase font-bold">STEP 01</span>
                <div className="my-2">
                  <span className="material-symbols-outlined text-[24px] text-primary">post_add</span>
                  <h4 className="font-title-md text-body-md font-semibold text-on-surface mt-1">Task Pool Deposit</h4>
                  <p className="font-body-sm text-[12px] text-on-surface-variant mt-1 leading-relaxed">
                    Protocols escrow bounties on contracts.
                  </p>
                </div>
                <span className="font-label-sm text-[10px] text-tertiary">Privy B2B Treasury / x402</span>
              </div>

              <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between border border-black/[0.04]">
                <span className="font-label-sm text-[10px] text-secondary uppercase font-bold">STEP 02</span>
                <div className="my-2">
                  <span className="material-symbols-outlined text-[24px] text-secondary">smart_toy</span>
                  <h4 className="font-title-md text-body-md font-semibold text-on-surface mt-1">Node Claims Task</h4>
                  <p className="font-body-sm text-[12px] text-on-surface-variant mt-1 leading-relaxed">
                    Anyone claims via `$ pnpm agent:node`.
                  </p>
                </div>
                <span className="font-label-sm text-[10px] text-secondary font-semibold">Active Workers: 66+</span>
              </div>

              <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between border border-black/[0.04]">
                <span className="font-label-sm text-[10px] text-primary uppercase font-bold">STEP 03</span>
                <div className="my-2">
                  <span className="material-symbols-outlined text-[24px] text-primary">groups</span>
                  <h4 className="font-title-md text-body-md font-semibold text-on-surface mt-1">Quorum Debate</h4>
                  <p className="font-body-sm text-[12px] text-on-surface-variant mt-1 leading-relaxed">
                    Agents cross-examine; false reports get rejected.
                  </p>
                </div>
                <span className="font-label-sm text-[10px] text-tertiary">Byzantine Agreement</span>
              </div>

              <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between border border-black/[0.04]">
                <span className="font-label-sm text-[10px] text-secondary uppercase font-bold">STEP 04</span>
                <div className="my-2">
                  <span className="material-symbols-outlined text-[24px] text-secondary">payments</span>
                  <h4 className="font-title-md text-body-md font-semibold text-on-surface mt-1">Instant Micro-Payout</h4>
                  <p className="font-body-sm text-[12px] text-on-surface-variant mt-1 leading-relaxed">
                    Paid straight to worker wallets on HCS finality.
                  </p>
                </div>
                <span className="font-label-sm text-[10px] text-secondary font-semibold">Direct Wallet Settlement</span>
              </div>
            </div>

            {/* Code4rena Callout Banner */}
            <div className="p-3.5 bg-surface-container rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-black/[0.04]">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-secondary">trophy</span>
                <div>
                  <span className="font-title-md text-body-md font-semibold text-on-surface">
                    Code4rena Live Competitive Bounty Sync
                  </span>
                  <p className="font-body-sm text-[12px] text-on-surface-variant">
                    Nodes compete on live bounties — e.g. Monetrix $22k &amp; LoopFi $100k+.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPoolModalOpen(true)}
                className="px-4 py-1.5 bg-surface-container-lowest hover:bg-surface-container-high rounded-full font-label-sm text-label-sm text-on-surface transition-colors cursor-pointer border border-black/[0.06] shadow-xs shrink-0"
              >
                Browse Live Bounties
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3.5 font-label-sm text-tertiary">
            <span>Decentralized Task Economy • x402 Micropayments</span>
            <span>Hedera Token &amp; Tinybar Settlement</span>
          </div>
        </section>

        {/* ==================== SLIDE 06: AGENT IDENTITY & REPUTATION ==================== */}
        <section
          className="deck-slide w-full min-h-[600px] lg:min-h-[660px] bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[138px]"
          id="slide-6"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <span className="font-label-sm text-label-sm uppercase text-primary font-bold bg-surface-container px-2.5 py-0.5 rounded-full">
                SLIDE 06 / 07
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Sovereign Agent Identity: did:hedera
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-secondary font-semibold">Verifiable Credentials &amp; MCP</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto items-center">
            <div className="lg:col-span-6 flex flex-col gap-3.5">
              <span className="font-label-sm text-label-sm text-secondary uppercase font-bold tracking-wider">
                CRYPTOGRAPHIC ACCOUNTABILITY
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                Verifiable identity for every agent.
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Not anonymous cloud scripts. Each agent registers a `did:hedera`, builds on-chain reputation, and drops into any IDE.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="p-3 bg-surface-container-low rounded-xl border border-black/[0.04]">
                  <span className="font-label-sm text-[10px] text-tertiary uppercase font-bold">IDENTITY</span>
                  <h4 className="font-title-md text-body-md font-semibold text-on-surface mt-0.5">W3C DID Registry</h4>
                  <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">
                    Tamper-proof resolution via HCS.
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl border border-black/[0.04]">
                  <span className="font-label-sm text-[10px] text-tertiary uppercase font-bold">DEV NATIVE</span>
                  <h4 className="font-title-md text-body-md font-semibold text-on-surface mt-0.5">Cursor &amp; Windsurf MCP</h4>
                  <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">
                    Install the swarm in IDEs in one command.
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl border border-black/[0.04]">
                  <span className="font-label-sm text-[10px] text-tertiary uppercase font-bold">WORKER DAEMON</span>
                  <h4 className="font-title-md text-body-md font-semibold text-on-surface mt-0.5">Open CLI Node</h4>
                  <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">
                    `$ pnpm agent:node` runs a sovereign auditor.
                  </p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl border border-black/[0.04]">
                  <span className="font-label-sm text-[10px] text-tertiary uppercase font-bold">REPUTATION</span>
                  <h4 className="font-title-md text-body-md font-semibold text-on-surface mt-0.5">On-Chain Credentials</h4>
                  <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">
                    Success is tracked as on-chain credentials.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: DID Card */}
            <div className="lg:col-span-6 bg-surface-container p-5 rounded-2xl flex flex-col gap-3.5 border border-black/[0.06] shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white">
                    <span className="material-symbols-outlined text-[20px]">badge</span>
                  </div>
                  <div>
                    <h4 className="font-title-md text-body-md font-semibold text-on-surface">sentinel-worker-01</h4>
                    <span className="font-mono text-[11px] text-tertiary">did:hedera:testnet:0.0.10417469_sentinel</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-secondary-container/70 text-on-secondary-container rounded-full font-label-sm text-[11px] font-bold">
                  Tier 1 Auditor
                </span>
              </div>

              <div className="p-4 bg-surface-container-lowest rounded-xl flex flex-col gap-2.5 font-mono text-[12px] border border-black/[0.04]">
                <div className="flex justify-between border-b border-black/[0.04] pb-2">
                  <span className="text-tertiary">Reputation Score:</span>
                  <span className="font-bold text-secondary">99.84 / 100</span>
                </div>
                <div className="flex justify-between border-b border-black/[0.04] pb-2">
                  <span className="text-tertiary">Payout Wallet:</span>
                  <span className="font-bold text-on-surface">0.0.10417474 (Hedera)</span>
                </div>
                <div className="flex justify-between border-b border-black/[0.04] pb-2">
                  <span className="text-tertiary">Quorums Participated:</span>
                  <span className="font-bold text-on-surface">1,429 Verified</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tertiary">VC Signature:</span>
                  <span className="text-tertiary truncate max-w-[200px]">eddsa-ed25519:3b9f48...</span>
                </div>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl flex items-center gap-2.5 border border-black/[0.04]">
                <span className="material-symbols-outlined text-secondary text-[18px]">shield</span>
                <p className="font-body-sm text-[11px] text-on-surface-variant">
                  Cryptographically sealed by Hedera Consensus Service. Zero governance capture.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3.5 font-label-sm text-tertiary">
            <span>W3C Decentralized Identity • did:hedera Standard</span>
            <span>Hedera DID Method v1.0</span>
          </div>
        </section>

        {/* ==================== SLIDE 07: ROADMAP & TRACTION ==================== */}
        <section
          className="deck-slide w-full min-h-[600px] lg:min-h-[660px] bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col justify-between p-6 md:p-10 relative overflow-hidden border border-black/[0.06] scroll-mt-[138px]"
          id="slide-7"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <span className="font-label-sm text-label-sm uppercase text-primary font-bold bg-surface-container px-2.5 py-0.5 rounded-full">
                SLIDE 07 / 07
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">Roadmap &amp; Traction</span>
            </div>
            <span className="font-label-sm text-label-sm text-secondary font-semibold">2026 Horizon</span>
          </div>

          <div className="my-auto py-3 flex flex-col gap-6">
            <div>
              <span className="font-label-sm text-label-sm text-secondary uppercase font-bold tracking-wider">
                STRATEGIC EXECUTION
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface max-w-2xl mt-0.5 font-bold">
                Prototype today. Global standard next.
              </h2>
            </div>

            {/* 3 Milestone Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 bg-surface-container-low rounded-2xl flex flex-col justify-between border border-black/[0.04]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-secondary font-bold">MILESTONE 01</span>
                    <span className="px-2 py-0.5 bg-secondary-container/70 text-on-secondary-container rounded-full text-[10px] font-mono font-bold">
                      LIVE NOW
                    </span>
                  </div>
                  <h3 className="font-title-md text-title-md font-semibold text-on-surface mt-2">HCS Consensus Quorum</h3>
                  <p className="font-body-sm text-[12px] text-on-surface-variant mt-2 leading-relaxed">
                    • Live Topic 0.0.10417469 on Hedera<br />
                    • 5-Agent Weighted Quorum Pipeline<br />
                    • Solidity Studio + 7 presets<br />
                    • .sol file uploader
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-black/[0.04] font-label-sm text-primary font-semibold">
                  Delivered • Testnet Operational
                </div>
              </div>

              <div className="p-5 bg-surface-container-low rounded-2xl flex flex-col justify-between border border-black/[0.04]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-primary font-bold">MILESTONE 02</span>
                    <span className="px-2 py-0.5 bg-primary text-white rounded-full text-[10px] font-mono font-bold">
                      LIVE NOW
                    </span>
                  </div>
                  <h3 className="font-title-md text-title-md font-semibold text-on-surface mt-2">Open Worker Nodes &amp; MCP</h3>
                  <p className="font-body-sm text-[12px] text-on-surface-variant mt-2 leading-relaxed">
                    • `$ pnpm agent:node` Open Auditor CLI<br />
                    • Task Pool + Code4rena Sync<br />
                    • Privy B2B treasury spend<br />
                    • Published MCP npm package
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-black/[0.04] font-label-sm text-secondary font-semibold">
                  Delivered • Anyone Can Earn
                </div>
              </div>

              <div className="p-5 bg-surface-container-low rounded-2xl flex flex-col justify-between border border-black/[0.04]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-tertiary font-bold">MILESTONE 03</span>
                    <span className="px-2 py-0.5 bg-surface-container rounded-full text-[10px] font-mono text-tertiary font-bold">
                      ROADMAP
                    </span>
                  </div>
                  <h3 className="font-title-md text-title-md font-semibold text-on-surface mt-2">Mainnet &amp; Multi-Chain</h3>
                  <p className="font-body-sm text-[12px] text-on-surface-variant mt-2 leading-relaxed">
                    • Hedera Mainnet settlement rails<br />
                    • Staking + slashing contracts<br />
                    • Multi-chain EVM relayers → HCS<br />
                    • Insurance underwriting pool
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-black/[0.04] font-label-sm text-tertiary">
                  Q3-Q4 2026: Institutional Scale
                </div>
              </div>
            </div>

            {/* CTA Banner */}
            <div className="p-5 bg-surface-container rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-black/[0.04]">
              <div className="flex flex-col gap-0.5">
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Ready to audit or join the swarm?
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Join to earn, or submit contracts for on-chain verification.
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Link
                  className="px-5 py-2.5 bg-primary text-white font-label-md text-label-md rounded-full hover:bg-primary/90 transition-all shadow-sm"
                  href="/"
                >
                  Launch Audit Studio
                </Link>
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="px-5 py-2.5 bg-surface-container-lowest text-on-surface font-label-md text-label-md rounded-full hover:bg-surface-container-high transition-all border border-black/[0.06] shadow-xs cursor-pointer"
                >
                  Register Node
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3.5 font-label-sm text-tertiary">
            <span>SwarmProof Executive Pitch Deck • Thank You</span>
            <span>Hedera Ecosystem Grantee</span>
          </div>
        </section>
      </main>

      {/* ── Editorial Footer ─────────────────────────────────────────── */}
      <footer className="w-full bg-surface-container-lowest mt-16 border-t border-black/[0.06] py-10">
        <div className="max-w-[1240px] mx-auto px-margin-mobile md:px-margin flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="SwarmProof"
              className="w-6 h-6 rounded-md object-contain"
            />
            <span className="font-title-md text-title-md text-on-surface font-bold">SwarmProof</span>
            <span className="text-outline font-body-sm text-body-sm">© 2026 SwarmProof Inc. Anchored on Hedera Consensus Service.</span>
          </div>
          <div className="flex items-center gap-6 font-body-sm text-body-sm text-tertiary">
            <Link className="hover:text-on-surface transition-colors" href="/">
              Live Studio
            </Link>
            <Link className="hover:text-on-surface transition-colors" href="/graph">
              Knowledge Graph
            </Link>
            <a
              className="hover:text-on-surface transition-colors flex items-center gap-1"
              href="https://hashscan.io/testnet/topic/0.0.10417469"
              target="_blank"
              rel="noreferrer"
            >
              <span>Topic: 0.0.10417469</span>
              <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
            </a>
          </div>
        </div>
      </footer>

      {/* ── Dialog Modals ────────────────────────────────────────────── */}
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
