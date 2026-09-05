"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

const DEMO_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// DEMO: paste any contract here, or use contracts/vulnerable examples.
contract Vault {
    mapping(address => uint256) public balances;
    function deposit() external payable { balances[msg.sender] += msg.value; }
    function withdraw() external {
        uint256 amt = balances[msg.sender];
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok);
        balances[msg.sender] = 0;
    }
}`;

export default function Home() {
  const [source, setSource] = useState(DEMO_CONTRACT);
  const [name, setName] = useState("Vault");
  const [status, setStatus] = useState<string | null>(null);
  const [report, setReport] = useState<unknown>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Submitting…");
    const res = await fetch(`${API_BASE}/audits`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contractName: name, source }),
    });
    const { id } = (await res.json()) as { id: string };
    setStatus(`Queued ${id}… polling`);

    // Simple poll loop — M4 upgrades to SSE live stream.
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const r = await fetch(`${API_BASE}/audits/${id}`);
      const rec = (await r.json()) as { status: string; report?: unknown };
      if (rec.status === "done") {
        setStatus(`Done — ${id}`);
        setReport(rec.report);
        return;
      }
    }
    setStatus("Timed out");
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 32, fontFamily: "system-ui" }}>
      <h1>🐝 SwarmProof</h1>
      <p>Submit a contract — a swarm of AI agents audits it and reaches consensus.</p>
      <form onSubmit={submit}>
        <label>
          Contract name
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginLeft: 8 }} />
        </label>
        <br />
        <br />
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={14}
          style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
        />
        <br />
        <br />
        <button type="submit" disabled={status !== null && status.startsWith("Submitted")}>
          Run swarm audit
        </button>
      </form>
      {status && <p>Status: {status}</p>}
      {report !== null && <pre style={{ background: "#0f1115", color: "#7ee787", padding: 16, borderRadius: 8 }}>{JSON.stringify(report, null, 2)}</pre>}
    </main>
  );
}