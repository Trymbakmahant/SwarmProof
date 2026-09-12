"use client";

import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";

export function HederaWalletButton() {
  const {
    wallet,
    isConnecting,
    connectPrivy,
    connectMetaMask,
    connectHashPack,
    connectBlade,
    connectTreasury,
    disconnect,
    isModalOpen,
    openWalletModal,
    closeWalletModal,
  } = useWallet();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const getWalletIcon = () => {
    switch (wallet.type) {
      case "privy":
        return "✨";
      case "metamask":
        return "🦊";
      case "hashpack":
        return "⚡";
      case "blade":
        return "🗡️";
      case "treasury":
        return "🏦";
      default:
        return "👛";
    }
  };

  const getWalletName = () => {
    switch (wallet.type) {
      case "privy":
        return wallet.privyEmail || wallet.privyGoogle
          ? `Privy: ${wallet.privyEmail || wallet.privyGoogle}`
          : "Privy Embedded Wallet";
      case "metamask":
        return "MetaMask (EVM 296)";
      case "hashpack":
        return "HashPack Wallet";
      case "blade":
        return "Blade Wallet";
      case "treasury":
        return "Operator Treasury";
      default:
        return "Hedera Wallet";
    }
  };

  const handleCopy = () => {
    const textToCopy = wallet.address || wallet.accountId;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* ── Main Trigger Button ────────────────────────────────────────── */}
      <div className="relative">
        {wallet.isConnected ? (
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-700/80 hover:border-emerald-500/60 text-xs font-mono text-zinc-200 transition-all shadow-sm"
          >
            <span className="text-sm">{getWalletIcon()}</span>
            <span className="font-semibold text-emerald-400">
              {wallet.address
                ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
                : wallet.accountId}
            </span>
            {wallet.balanceHbar && (
              <span className="text-[11px] text-zinc-400 border-l border-zinc-700 pl-2">
                {wallet.balanceHbar} ℏ
              </span>
            )}
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>
        ) : (
          <button
            type="button"
            onClick={openWalletModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-semibold text-xs transition-all shadow-sm"
          >
            <span>⚡</span>
            <span>Connect Wallet</span>
          </button>
        )}

        {/* ── Connected Dropdown ────────────────────────────────────────── */}
        {isDropdownOpen && wallet.isConnected && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsDropdownOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-72 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl p-4 z-50 text-left font-mono">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-base">{getWalletIcon()}</span>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {getWalletName()}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                  Testnet
                </span>
              </div>

              <div className="py-3 space-y-2 text-xs">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Hedera Account ID</div>
                  <div className="flex items-center justify-between text-zinc-200 mt-0.5">
                    <span className="font-bold">{wallet.accountId}</span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="text-[10px] text-zinc-400 hover:text-white"
                    >
                      {copied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                {wallet.address && (
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase">EVM Address (Chain 296)</div>
                    <div className="text-zinc-300 text-[11px] truncate">
                      {wallet.address}
                    </div>
                  </div>
                )}

                {wallet.type === "privy" && (
                  <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/40 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-semibold">
                      <span>✨</span>
                      <span>Privy Self-Custodial Account</span>
                    </div>
                    {wallet.privyEmail && (
                      <div className="text-[10px] text-zinc-300 truncate">
                        Email: {wallet.privyEmail}
                      </div>
                    )}
                    {wallet.privyGoogle && (
                      <div className="text-[10px] text-zinc-300 truncate">
                        Google: {wallet.privyGoogle}
                      </div>
                    )}
                    <div className="text-[10px] text-emerald-400/80">
                      B2B Organization Wallet Active
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Balance</div>
                  <div className="text-emerald-400 font-bold text-sm">
                    {wallet.balanceHbar ?? "0.0"} ℏ HBAR
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800/80 flex flex-col gap-2 text-xs">
                <a
                  href={`https://hashscan.io/testnet/account/${wallet.accountId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full text-center py-1.5 px-2 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors flex items-center justify-center gap-1"
                >
                  <span>View on HashScan</span>
                  <span>↗</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    openWalletModal();
                  }}
                  className="w-full text-center py-1.5 px-2 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                >
                  Switch Wallet Provider
                </button>

                <button
                  type="button"
                  onClick={() => {
                    disconnect();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full text-center py-1.5 px-2 rounded bg-red-950/30 hover:bg-red-950/60 border border-red-900/50 text-red-400 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Wallet Selector Modal ────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-6 relative font-sans text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>👛</span>
                  <span>Connect Web3 Wallet</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select an embedded or Web3 wallet to fund bounties & authorize x402 escrows.
                </p>
              </div>
              <button
                type="button"
                onClick={closeWalletModal}
                className="text-zinc-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-3">
              {/* Option 0 (Recommended): Privy 1-Click Login */}
              <button
                type="button"
                onClick={connectPrivy}
                disabled={isConnecting}
                className="w-full flex items-center justify-between p-3.5 rounded-lg bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-zinc-900 border border-emerald-500/50 hover:border-emerald-400 transition-all text-left group shadow-lg shadow-emerald-950/30"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✨</span>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors flex items-center gap-2">
                      <span>Privy 1-Click Login</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold">
                        RECOMMENDED
                      </span>
                    </div>
                    <div className="text-xs text-zinc-300 mt-0.5">
                      Email, Google, Passkey • Embedded Self-Custodial Wallet
                    </div>
                    <div className="text-[11px] text-emerald-400/80 font-mono mt-0.5 flex items-center gap-1.5">
                      <span>🛡️ No seed phrase required</span>
                      <span>•</span>
                      <span>Hedera EVM Chain 296</span>
                    </div>
                  </div>
                </div>
                <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform text-lg">→</span>
              </button>

              {/* Option 1: MetaMask (Hedera EVM) */}
              <button
                type="button"
                onClick={connectMetaMask}
                disabled={isConnecting}
                className="w-full flex items-center justify-between p-3.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🦊</span>
                  <div>
                    <div className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors flex items-center gap-2">
                      <span>MetaMask</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-950/80 border border-orange-800 text-orange-300">
                        Hedera EVM Chain 296
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400">
                      Auto-switches to Hedera Testnet (0x128) JSON-RPC
                    </div>
                  </div>
                </div>
                <span className="text-zinc-500 group-hover:text-white transition-colors">→</span>
              </button>

              {/* Option 2: HashPack */}
              <button
                type="button"
                onClick={connectHashPack}
                disabled={isConnecting}
                className="w-full flex items-center justify-between p-3.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <div className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                      <span>HashPack Wallet</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                        Native Hedera
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400">
                      Standard extension for Hedera dApps & HCS
                    </div>
                  </div>
                </div>
                <span className="text-zinc-500 group-hover:text-white transition-colors">→</span>
              </button>

              {/* Option 3: Blade Wallet */}
              <button
                type="button"
                onClick={connectBlade}
                disabled={isConnecting}
                className="w-full flex items-center justify-between p-3.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-blue-500/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🗡️</span>
                  <div>
                    <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                      <span>Blade Wallet</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-800 text-blue-300">
                        Hedera Browser
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400">
                      High-speed Web3 Hedera extension
                    </div>
                  </div>
                </div>
                <span className="text-zinc-500 group-hover:text-white transition-colors">→</span>
              </button>

              {/* Option 4: Operator Treasury (One-Click Live Demo) */}
              <button
                type="button"
                onClick={connectTreasury}
                disabled={isConnecting}
                className="w-full flex items-center justify-between p-3.5 rounded-lg bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-800/60 hover:border-emerald-500 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏦</span>
                  <div>
                    <div className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                      <span>Operator Treasury (Demo Mode)</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-200">
                        ~979 ℏ Funded
                      </span>
                    </div>
                    <div className="text-xs text-emerald-500/80 font-mono">
                      Account: 0.0.10119346 • Ready for immediate testnet payouts
                    </div>
                  </div>
                </div>
                <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform">✓</span>
              </button>
            </div>

            <div className="pt-3 border-t border-zinc-800/80 text-center">
              <span className="text-[11px] text-zinc-500 font-mono">
                Hedera Testnet (Chain 296) • Non-custodial x402 Micropayments
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
