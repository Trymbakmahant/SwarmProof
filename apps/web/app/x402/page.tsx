"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getApiBase } from "../lib/api";

/* ------------------------------------------------------------------ */
/* Sample contracts (mirror of contracts/vulnerable)                  */
/* ------------------------------------------------------------------ */
const SAMPLES: Record<string, { name: string; source: string }> = {
  "ReentrancyVault.sol": {
    name: "ReentrancyVault",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Classic reentrancy: state updated AFTER external call.
contract ReentrancyVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        // VULNERABILITY: external call before state update -> reentrancy
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
        balances[msg.sender] = 0;
    }

    receive() external payable {}
}`,
  },
  "AccessControlAdmin.sol": {
    name: "AccessControlAdmin",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Missing access control: anyone can set the owner.
contract AccessControlAdmin {
    address public owner;

    function setOwner(address newOwner) external {
        // VULNERABILITY: no onlyOwner check
        owner = newOwner;
    }
}`,
  },
};

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
interface StepLog {
  id: string;
  title: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
  data?: unknown;
}

type StatusResp = {
  network: string;
  facilitator: { mode: "real" | "mock"; baseUrl: string; feePayer?: string };
  signer: { configured: boolean; accountId: string | null; mode: "live" | "mock" };
  gateway: { address: string; share: number; valid?: boolean };
  quote: { total: string; currency: string; asset?: string };
};

const e = (v: unknown, fallback = "—") => (v === undefined || v === null || v === "" ? fallback : String(v));
const hashscan = (tx: string) => `https://hashscan.io/testnet/transaction/${tx}`;
const tinybarsToHbar = (tinybars: string) => `${(Number(tinybars) / 1e8).toFixed(6)} ℏ`;

export default function X402Lab() {
  const [apiBase, setApiBase] = useState(getApiBase());
  const [sample, setSample] = useState<string>("ReentrancyVault.sol");
  const [total, setTotal] = useState("1.00");
  const [steps, setSteps] = useState<StepLog[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/x402/status`)
      .then((r) => r.json() as Promise<StatusResp>)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [apiBase]);

  const patchStep = useCallback((id: string, patch: Partial<StepLog>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const addLog = (id: string, data: unknown) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, data, detail: JSON.stringify(data).slice(0, 220) } : s)));
  };

  const reset = () => {
    setSteps([
      { id: "req", title: "1 · Request audit — expect HTTP 402", status: "pending" },
      { id: "quote", title: "2 · Fetch x402 quote (accept: application/x402+json)", status: "pending" },
      { id: "pay", title: "3 · Sign with wallet + settle via facilitator", status: "pending" },
      { id: "redeem", title: "4 · Replay request with X-PAYMENT header", status: "pending" },
      { id: "audit", title: "5 · Swarm runs → HCS proof", status: "pending" },
    ]);
    setAuditId(null);
  };

  async function runAll() {
    setRunning(true);
    reset();
    let active = "req";
    try {
      /* ---- 1. Request audit (expect 402 + challenge) ---- */
      active = "req";
      patchStep("req", { status: "active" });
      const reqRes = await fetch(`${apiBase}/audit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractName: SAMPLES[sample]!.name, source: SAMPLES[sample]!.source, total }),
      });
      const reqBody = await reqRes.json();
      const challenge = reqRes.headers.get("www-authenticate");
      addLog("req", { status: reqRes.status, body: reqBody, headers: { "www-authenticate": challenge } });
      patchStep("req", {
        status: reqRes.status === 402 ? "done" : "error",
        detail: `HTTP ${reqRes.status} · ${challenge ?? "no challenge"}`,
      });

      const resource = (reqBody as { x402Resource?: string }).x402Resource;
      if (!resource) throw new Error("no X402 resource URL in challenge");

      /* ---- 2. Quote ---- */
      active = "quote";
      patchStep("quote", { status: "active" });
      const quoteRes = await fetch(resource, { headers: { accept: "application/x402+json" } });
      const quoteEnvelope = await quoteRes.json();
      const quote = (quoteEnvelope as { accepts: unknown[] }).accepts?.[0];
      const quoteAmt = (quote as { amount?: string })?.amount;
      addLog("quote", quoteEnvelope);
      patchStep("quote", { status: "done", detail: `amount ${e(quoteAmt)} tinybars (${quoteAmt ? tinybarsToHbar(quoteAmt) : "?"}) → ${(quote as { payTo?: string })?.payTo ?? "?"}` });

      /* ---- 3. Sign + settle via /x402/pay ---- */
      active = "pay";
      patchStep("pay", { status: "active" });
      const payRes = await fetch(`${apiBase}/x402/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quote }),
      });
      const payBody = await payRes.json();
      addLog("pay", payBody);
      if (!(payBody as { ok?: boolean }).ok) throw new Error((payBody as { error?: string }).error ?? "pay failed");
      patchStep("pay", {
        status: "done",
        detail: `${e((payBody as { mode?: string }).mode)} · settled ${e((payBody as { settlement?: { transaction?: string } }).settlement?.transaction)} · payer ${e((payBody as { payer?: string }).payer)}`,
      });

      /* ---- 4. Replay with X-PAYMENT ---- */
      active = "redeem";
      patchStep("redeem", { status: "active" });
      const payload = (payBody as { paymentPayload: unknown }).paymentPayload;
      const xPayment = btoa(JSON.stringify(payload));
      const redeemRes = await fetch(`${apiBase}/audit`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-payment": xPayment },
        body: JSON.stringify({ contractName: SAMPLES[sample]!.name, source: SAMPLES[sample]!.source, total }),
      });
      const redeemBody = await redeemRes.json();
      addLog("redeem", { status: redeemRes.status, body: redeemBody });
      const id = (redeemBody as { auditId?: string }).auditId;
      if (!id) throw new Error("redemption did not return an auditId");
      setAuditId(id);
      patchStep("redeem", { status: redeemRes.status === 201 ? "done" : "error", detail: `HTTP ${redeemRes.status} · audit ${id}` });

      /* ---- 5. Poll + proof ---- */
      active = "audit";
      patchStep("audit", { status: "active" });
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const s = (await (await fetch(`${apiBase}/audits/${id}/status`)).json()) as { status: string; paymentStatus?: string; paymentProof?: unknown; findingCount?: number };
        addLog("audit", s);
        if (s.status === "done" || s.status === "failed") break;
      }
      const final = (await (await fetch(`${apiBase}/audits/${id}/status`)).json()) as { status: string; paymentProof?: unknown };
      const proof = await (await fetch(`${apiBase}/audits/${id}/proof`)).json();
      const findings = await (await fetch(`${apiBase}/audits/${id}/findings`)).json();
      addLog("audit", { status: final.status, paymentProof: final.paymentProof, proof, findings });
      patchStep("audit", { status: final.status === "done" ? "done" : "error", detail: `${final.status} · proof ${e((proof as { verified?: boolean }).verified)}` });
    } catch (err) {
      patchStep(active, { status: "error", detail: (err as Error).message });
    } finally {
      setRunning(false);
    }
  }

  const stepBody = (id: string) => steps.find((s) => s.id === id)?.data;

  const downloadLog = () => {
    const blob = new Blob([JSON.stringify(steps, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `swarmproof-x402-${auditId ?? "lab"}.json`;
    a.click();
  };

  const icon = {
    pending: "·",
    active: "◌",
    done: "✓",
    error: "✗",
  } as const;

  const std: React.CSSProperties = { fontFamily: "var(--font-mono)" };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "#18181b" }}>
      {/* ── Minimalist Editorial Header ─────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e4e4e7" }}>
        <div style={{ maxWidth: 1024, margin: "0 auto", padding: "14px 24px", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          {/* Brand & Metadata */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Brand Logo */}
              <Link href="/">
                <img
                  src="/logo.png"
                  alt="SwarmProof"
                  style={{ width: 32, height: 32, borderRadius: 6, objectFit: "contain", display: "block" }}
                />
              </Link>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#09090b", letterSpacing: -0.2 }}>SwarmProof</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, padding: "2px 6px", borderRadius: 4, backgroundColor: "#f4f4f5", color: "#52525b", border: "1px solid #e4e4e7" }}>
                    Payment Lab
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "#71717a", fontFamily: "var(--font-mono)", letterSpacing: -0.2 }}>
                  Hedera Agentic Payments / Live Facilitator Settlement
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a
              href="/"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#27272a",
                backgroundColor: "#f4f4f5",
                border: "1px solid #e4e4e7",
                borderRadius: 6,
                padding: "6px 12px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Visualizer
            </a>

            <a
              href="/feedback"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#27272a",
                backgroundColor: "#f4f4f5",
                border: "1px solid #e4e4e7",
                borderRadius: 6,
                padding: "6px 12px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
             Pitch Deck
            </a>

            <a
              href="https://hashscan.io/testnet/topic/0.0.10417469"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                color: "#09090b",
                backgroundColor: "#ffffff",
                border: "1px solid #d4d4d8",
                borderRadius: 6,
                padding: "6px 12px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#09090b" }} />
              <span>Topic 0.0.10417469</span>
              <svg style={{ width: 12, height: 12, color: "#a1a1aa" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>

        {/* Subtle Navigation Underline Bar */}
        <div style={{ borderTop: "1px solid #e4e4e7", backgroundColor: "rgba(250, 250, 250, 0.6)" }}>
          <div style={{ maxWidth: 1024, margin: "0 auto", padding: "4px 24px", display: "flex", alignItems: "center", gap: 4, overflowX: "auto" }}>
            <a
              href="/"
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                color: "#52525b",
                border: "1px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              3D Swarm Visualizer
            </a>
            <span
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                color: "#09090b",
                backgroundColor: "#ffffff",
                border: "1px solid #d4d4d8",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                whiteSpace: "nowrap",
              }}
            >
              Payment Lab (x402)
            </span>
            <a
              href="/feedback"
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                color: "#52525b",
                border: "1px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Executive Pitch
            </a>
            <a
              href="/feedback"
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                color: "#52525b",
                border: "1px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              SDK &amp; MCP Architecture
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ────────────────────────────────────────── */}
      <main style={{ maxWidth: 1024, margin: "0 auto", padding: "32px 24px 64px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Readiness Banner */}
        {status && (
          <div style={{ padding: 14, borderRadius: 8, border: "1px solid #e4e4e7", backgroundColor: "#ffffff", fontSize: 13, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: status.signer.configured ? "#16a34a" : "#ca8a04", marginRight: 8 }} />
            {status.signer.configured ? (
              <>Payer wallet <b style={std}>{status.signer.accountId}</b> · mode <b>{status.signer.mode}</b></>
            ) : (
              <>No payer wallet configured — running <b>offline mock</b> (add <code>X402_PAYER_ACCOUNT_ID</code> + <code>X402_PAYER_PRIVATE_KEY</code> to the API&apos;s .env to pay for real)</>
            )}
            {status.signer.configured && !status.gateway.valid && (
              <b style={{ marginLeft: 16, color: "#dc2626" }}>⚠ gateway address is a placeholder — set SWARMPROOF_GATEWAY_ADDRESS to a real Hedera account (e.g. your payer account)</b>
            )}
            <span style={{ marginLeft: 16, color: "#52525b" }}>facilitator <b>{status.facilitator.mode}</b> {status.facilitator.baseUrl !== "mock://" && `(${status.facilitator.baseUrl})`}</span>
            {status.facilitator.feePayer && (
              <>
                <span style={{ marginLeft: 16, color: "#52525b" }}>fee-payer <b>{status.facilitator.feePayer}</b></span>
              </>
            )}
          </div>
        )}

        {/* Config Box */}
        <div style={{ padding: 20, borderRadius: 10, border: "1px solid #e4e4e7", backgroundColor: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#52525b" }}>
              API base
              <br />
              <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} style={{ width: 230, marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#52525b" }}>
              Contract sample
              <br />
              <select value={sample} onChange={(e) => setSample(e.target.value)} style={{ marginTop: 4 }}>
                {Object.entries(SAMPLES).map(([k]) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#52525b" }}>
              Audit price (USD)
              <br />
              <input value={total} onChange={(e) => setTotal(e.target.value)} style={{ width: 80, marginTop: 4 }} />
            </label>
            <button onClick={runAll} disabled={running} className="btn-swarm-primary" style={{ padding: "8px 18px", fontSize: 13 }}>
              {running ? "Running…" : "▶ Run full x402 payment"}
            </button>
            <button onClick={reset} disabled={running} className="btn-swarm-secondary" style={{ fontSize: 13 }}>Reset</button>
            <button onClick={downloadLog} disabled={steps.length === 0} className="btn-swarm-secondary" style={{ fontSize: 13 }}>⬇ Log</button>
          </div>
          {auditId && (
            <p style={{ margin: "14px 0 0", fontSize: 13, borderTop: "1px solid #e4e4e7", paddingTop: 10 }}>
              Audit <b style={std}>{auditId}</b> ·{" "}
              <a href={`/audits/${auditId}`} style={{ color: "#09090b", textDecoration: "underline" }}>view record</a> ·{" "}
              <a href={`${apiBase}/audits/${auditId}/proof`} style={{ color: "#09090b", textDecoration: "underline" }}>HCS proof</a>
            </p>
          )}
        </div>

        {/* Step Logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {steps.map((s) => (
            <div key={s.id} style={{ borderRadius: 8, border: "1px solid #e4e4e7", backgroundColor: "#ffffff", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
                <span style={{ width: 18, color: s.status === "done" ? "#16a34a" : s.status === "error" ? "#dc2626" : s.status === "active" ? "#ca8a04" : "#a1a1aa", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                  {icon[s.status]}
                </span>
                <span style={{ fontSize: 13.5, flex: 1, fontWeight: 500, color: "#09090b" }}>{s.title}</span>
                {s.detail && <span style={{ fontSize: 11.5, color: "#71717a", fontFamily: "var(--font-mono)", textAlign: "right" }}>{s.detail}</span>}
              </div>
              {s.data !== undefined && (
                <details style={{ borderTop: "1px solid #e4e4e7" }}>
                  <summary style={{ padding: "6px 16px", fontSize: 11.5, color: "#71717a", cursor: "pointer", backgroundColor: "#fafafa" }}>payload (click to view)</summary>
                  <pre style={{ ...std, margin: 0, padding: 12, fontSize: 11.5, maxHeight: 320, overflow: "auto", color: "#f4f4f5", backgroundColor: "#09090b" }}>
                    {JSON.stringify(s.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
          {steps.length === 0 && (
            <p style={{ color: "#71717a", fontSize: 13 }}>Hit &quot;Run full x402 payment&quot; to walk through: HTTP 402 challenge → quote → sign → facilitator verify/settle → X-PAYMENT redeem → swarm audit → HCS proof.</p>
          )}
        </div>

        {/* settlement tx link */}
        {steps.some((s) => s.id === "pay" && s.status === "done") && status?.facilitator.mode === "real" && (() => {
          const pay = stepBody("pay") as { settlement?: { transaction?: string } };
          const tx = pay?.settlement?.transaction;
          return tx ? (
            <p style={{ marginTop: 12, fontSize: 13, color: "#18181b" }}>
              📡 On-chain: <a href={hashscan(tx)} target="_blank" rel="noreferrer" style={{ color: "#09090b", textDecoration: "underline", fontFamily: "var(--font-mono)" }}>{tx}</a> on Hedera testnet
            </p>
          ) : null;
        })()}

        <footer style={{ marginTop: 24, color: "#71717a", fontSize: 12, borderTop: "1px solid #e4e4e7", paddingTop: 16 }}>
          SwarmProof · Hedera x402 · fee-payer co-signed by Blocky402 facilitator ({e(status?.facilitator.feePayer)})
        </footer>
      </main>
    </div>
  );
}