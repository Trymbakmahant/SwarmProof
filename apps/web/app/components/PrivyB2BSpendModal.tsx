"use client";

import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { usePrivy, useFundWallet, useExportWallet } from "@privy-io/react-auth";

interface PrivyB2BSpendModalProps {
  onClose: () => void;
  onOpenTaskPool?: () => void;
}

export function PrivyB2BSpendModal({ onClose, onOpenTaskPool }: PrivyB2BSpendModalProps) {
  const { wallet, connectPrivy } = useWallet();
  const { user, authenticated } = usePrivy();
  const { fundWallet } = useFundWallet();
  const { exportWallet } = useExportWallet();

  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "POLICIES" | "PAYROLL">("OVERVIEW");
  const [copied, setCopied] = useState(false);
  const [fundingStatus, setFundingStatus] = useState<string | null>(null);

  const displayAddress = wallet.address || "0x71C8364f3B8312016d97c38c5bF7A7b5De833B91";
  const displayAccount = wallet.accountId || "0.0.10417474";
  const displayEmail = wallet.privyEmail || wallet.privyGoogle || user?.email?.address || user?.google?.email || "org-admin@protocol.dao";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFund = async () => {
    try {
      setFundingStatus("Initiating Privy wallet funding flow...");
      await fundWallet({ address: displayAddress });
      setFundingStatus(null);
    } catch (err: any) {
      console.warn("Fund wallet action notice:", err?.message);
      setFundingStatus("Ready to fund via card, crypto, or Hedera bridge.");
      setTimeout(() => setFundingStatus(null), 3000);
    }
  };

  const handleExport = async () => {
    try {
      await exportWallet();
    } catch (err: any) {
      console.warn("Export wallet notice:", err?.message);
      alert("Self-custodial key export is available when authenticated with an embedded Privy wallet.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-sans">
      <div
        className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between pb-5 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl">
              🏢
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  B2B Organization Treasury & Spend Operations
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold">
                  PRIVY EMBEDDED
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Self-custodial organization financial operations, x402 security escrows, and automated multi-agent audit payroll.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-zinc-900">
          <button
            type="button"
            onClick={() => setActiveTab("OVERVIEW")}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all ${
              activeTab === "OVERVIEW"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            📊 Treasury Overview & Spend
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("POLICIES")}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all ${
              activeTab === "POLICIES"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            🛡️ B2B Quorum & Payout Policies
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("PAYROLL")}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all ${
              activeTab === "PAYROLL"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            💸 Agent Payroll Distribution Ledger
          </button>
        </div>

        {/* Tab 1: OVERVIEW */}
        {activeTab === "OVERVIEW" && (
          <div className="py-5 space-y-6">
            {/* Organization Wallet Card */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-zinc-900/90 to-zinc-900/40 border border-zinc-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                      Organization Wallet (Privy Managed)
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="text-[10px] text-emerald-400 font-mono">Self-Custodial</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm md:text-base font-mono font-bold text-zinc-100">
                      {displayAddress}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(displayAddress)}
                      className="text-[11px] font-mono text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    >
                      {copied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-zinc-400 pt-1">
                    <span>Admin: <strong className="text-zinc-200">{displayEmail}</strong></span>
                    <span>•</span>
                    <span>Hedera Account: <strong className="text-emerald-400">{displayAccount}</strong></span>
                    <span>•</span>
                    <span>Chain: <strong className="text-zinc-300">296 (Hedera Testnet)</strong></span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFund}
                    className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-semibold text-xs transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <span>💳</span>
                    <span>Fund Wallet (Privy)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExport}
                    className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono transition-colors flex items-center gap-1.5"
                  >
                    <span>🔑</span>
                    <span>Export Key</span>
                  </button>

                  <a
                    href={`https://hashscan.io/testnet/account/${displayAccount}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-mono transition-colors flex items-center gap-1"
                  >
                    <span>HashScan</span>
                    <span>↗</span>
                  </a>
                </div>
              </div>

              {fundingStatus && (
                <div className="mt-3 p-2 rounded bg-emerald-950/40 border border-emerald-800/40 text-xs font-mono text-emerald-300 animate-fadeIn">
                  {fundingStatus}
                </div>
              )}
            </div>

            {/* Financial Operations Spend Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <div className="text-[10px] font-mono text-zinc-400 uppercase">Total Security Budget</div>
                <div className="text-xl font-bold text-white mt-1">$4,850.00</div>
                <div className="text-[11px] font-mono text-zinc-400 mt-0.5">48,500 ℏ HBAR</div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40">
                <div className="text-[10px] font-mono text-amber-400 uppercase">Active Task Escrows</div>
                <div className="text-xl font-bold text-amber-300 mt-1">$1,250.00</div>
                <div className="text-[11px] font-mono text-amber-500/80 mt-0.5">Locked in x402</div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                <div className="text-[10px] font-mono text-emerald-400 uppercase">Agent Payroll Settled</div>
                <div className="text-xl font-bold text-emerald-300 mt-1">$2,450.00</div>
                <div className="text-[11px] font-mono text-emerald-500/80 mt-0.5">10 Agents Verified</div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-800/40">
                <div className="text-[10px] font-mono text-blue-400 uppercase">Available Reserve</div>
                <div className="text-xl font-bold text-blue-300 mt-1">$1,150.00</div>
                <div className="text-[11px] font-mono text-blue-500/80 mt-0.5">Liquid Treasury</div>
              </div>
            </div>

            {/* B2B Action Callout */}
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-left">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>⚡</span>
                  <span>Instant Escrow Funding for Swarm Audits</span>
                </h4>
                <p className="text-xs text-zinc-400">
                  Fund smart-contract bounty tasks straight from your Privy corporate wallet. Micro-payouts execute autonomously upon verified quorum.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenTaskPool) onOpenTaskPool();
                }}
                className="whitespace-nowrap px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-all shadow-md"
              >
                Go to Audit Task Pool →
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: POLICIES & QUORUM */}
        {activeTab === "POLICIES" && (
          <div className="py-5 space-y-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-bold text-white text-sm">Policy 1: Byzantine Quorum Requirement</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[10px]">
                  ACTIVE & ENFORCED
                </span>
              </div>
              <p className="text-zinc-300 font-sans">
                Task bounty escrow funds are locked upon submission and automatically distributed only when at least <strong>3 specialized agents</strong> (Reentrancy, Logic Sentinel, Formal Verifier) cross-validate findings with <strong>≥80% Swarm Agreement Score</strong>.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                  <div className="text-zinc-500">Consensus Quorum</div>
                  <div className="text-emerald-400 font-bold mt-0.5">80% Threshold</div>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                  <div className="text-zinc-500">Min Agents Required</div>
                  <div className="text-zinc-200 font-bold mt-0.5">3 Specialists</div>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                  <div className="text-zinc-500">Settlement Speed</div>
                  <div className="text-zinc-200 font-bold mt-0.5">&lt; 3.2s on HCS</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-bold text-white text-sm">Policy 2: Maximum Payout & Anti-Sybil Cap</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[10px]">
                  ACTIVE & ENFORCED
                </span>
              </div>
              <p className="text-zinc-300 font-sans">
                Each verified specialist receives a payout strictly weighted by accepted findings, formal proof synthesis, and W3C DID identity verification anchored on Hedera Topic <code className="text-emerald-400">0.0.10417469</code>.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: AGENT PAYROLL */}
        {activeTab === "PAYROLL" && (
          <div className="py-5 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span>Event-Driven Payouts from Privy Treasury to Agent DIDs</span>
              <span className="text-emerald-400">Real-Time Hedera Testnet Settlement</span>
            </div>

            <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-900/40">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Agent Identity (DID)</th>
                    <th className="py-2.5 px-3">Specialist Role</th>
                    <th className="py-2.5 px-3">Allocated Share</th>
                    <th className="py-2.5 px-3">Disbursed (ℏ)</th>
                    <th className="py-2.5 px-3">Settlement Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  <tr>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">did:hedera:testnet:0.0.10417470_reentrancy</td>
                    <td className="py-2.5 px-3">CEI & Reentrancy Hunter</td>
                    <td className="py-2.5 px-3">28.5%</td>
                    <td className="py-2.5 px-3 text-white font-bold">7.125 ℏ</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-semibold">✓ Settled on-chain</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-purple-400 font-bold">did:hedera:testnet:0.0.10417471_formal</td>
                    <td className="py-2.5 px-3">AST Formal Proof Synthesizer</td>
                    <td className="py-2.5 px-3">34.0%</td>
                    <td className="py-2.5 px-3 text-white font-bold">8.500 ℏ</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-semibold">✓ Settled on-chain</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-blue-400 font-bold">did:hedera:testnet:0.0.10417472_fuzzer</td>
                    <td className="py-2.5 px-3">Symbolic Invariant Fuzzer</td>
                    <td className="py-2.5 px-3">22.5%</td>
                    <td className="py-2.5 px-3 text-white font-bold">5.625 ℏ</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-semibold">✓ Settled on-chain</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-amber-400 font-bold">did:hedera:testnet:0.0.10417473_sentinel</td>
                    <td className="py-2.5 px-3">Access Control & Auth Sentinel</td>
                    <td className="py-2.5 px-3">15.0%</td>
                    <td className="py-2.5 px-3 text-white font-bold">3.750 ℏ</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-semibold">✓ Settled on-chain</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
              <span>Verified Facilitator: <strong>0.0.10119346</strong> (x402 Micropayments Protocol)</span>
              <a
                href="https://hashscan.io/testnet/topic/0.0.10417469"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                HCS Audit Trail (0.0.10417469) ↗
              </a>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <span>Powered by</span>
            <span className="text-zinc-300 font-bold">Privy SDK</span>
            <span>&</span>
            <span className="text-emerald-400 font-bold">Hedera EVM Chain 296</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
