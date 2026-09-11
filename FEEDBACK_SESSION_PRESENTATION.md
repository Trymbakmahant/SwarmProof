# 🎙️ SwarmProof — Project Feedback Session & Presentation Guide

> **Cheat Sheet for Mentors & Judges Check-in**  
> *ETHGlobal Online 2026 · Target Tracks: Hedera AI & Agentic Payments ($6,000) · Decentralized AI & Multi-Agent Swarms*

---

## ⏱️ 1. The 60-Second Elevator Pitch

> *"Hi everyone! We are building **SwarmProof** — a decentralized smart contract security platform powered by an adversarial swarm of specialized AI agents that debate, reach consensus, and anchor verifiable proofs on **Hedera**.*
>
> *Single-LLM audit tools hallucinate and miss complex DeFi math bugs. SwarmProof splits auditing across **5 parallel specialist agents** (Reentrancy, Access Control, Business Logic, Economic/MEV, and Low-Level Static Calls). They run independently, cross-examine findings, and reach a weighted quorum consensus.*
>
> *We solved agent monetization and identity natively on Hedera:*
> 1. *Audits are gated by **x402 machine-to-machine micropayments** settled live on Hedera Testnet via the **Blocky402 facilitator** — zero API keys, zero subscriptions.*
> 2. *Every AI agent is an official **W3C sovereign digital citizen** with a canonical **`did:hedera` Decentralized Identifier** and **W3C Verifiable Credential** anchored to Hedera Consensus Service.*
> 3. *We provide both an official **MCP (Model Context Protocol)** server for Cursor/Claude Desktop and a **Bring-Your-Own-Agent Plugin SDK** so external developers can plug in their own security models."*

---

## 🛠️ 2. What We Have in the SDK Layer (`@swarmproof/*`)

When mentors ask: *"What SDKs or developer abstractions have you built?"*

### A. `@swarmproof/plugins` — The Bring-Your-Own-Agent SDK
* **What it is:** A plug-and-play SDK allowing any AI researcher or security firm to register their own custom security agent into the SwarmProof pipeline.
* **Executor Types:**
  1. `llm`: Run a model directly through our universal provider (OpenAI, Claude, Ollama, DeepSeek, Groq).
  2. `http`: Point to any remote API endpoint running an agent anywhere on the web (POST JSON $\rightarrow$ receive typed finding).
  3. `function`: In-process TypeScript functions for deterministic static analysis or rulesets.
* **Consensus Weighting:** External plugins can define their own `manifest.weight` (0.0 to 2.0) to participate in quorum voting.
* **Code highlight:**
  ```typescript
  import { AgentRegistry } from "@swarmproof/plugins";

  const registry = new AgentRegistry();
  registry.register({
    manifest: { id: "mev-sentinel", name: "MEV Guard", role: "analyzer", weight: 1.2 },
    executor: { type: "http", url: "https://my-sec-agent.ai/audit" }
  });
  ```

### B. `@swarmproof/x402` — Hedera Native x402 v2 Payment SDK
* **What it is:** The official Hedera implementation of the x402 v2 HTTP payment protocol.
* **Core Components:**
  * `X402Client`: Consumer agent client that intercepts `402 Payment Required`, parses `WWW-Authenticate: X402`, fetches quotes, and signs Hedera `TransferTransaction` payloads using `@x402/hedera` & `@hiero-ledger/sdk`.
  * `X402FacilitatorClient`: Connects to Blocky402 (`api.testnet.blocky402.com`) for `/verify` and `/settle`.
  * `X402Server`: Service middleware validating `X-PAYMENT` headers, expiry, and tinybar amounts.
  * Integer-only conversion math: converts USD $\leftrightarrow$ tinybars with zero floating-point rounding errors.

### C. `@swarmproof/hedera` — Hedera Consensus & Identity Toolkit
* **`HederaTopicClient`:** Submits deterministic SHA-256 report hashes to HCS Topic `0.0.10417469`.
* **`HederaMirrorNodeClient`:** Public read-only mirror node client that verifies HBAR and HTS transfers on-chain with **zero credentials needed**.
* **`PaymentProofClient`:** Anchors an immutable allocation table to HCS after every settled payment for audit trails.
* **`HederaIdentityRegistrar`:** Formats W3C DIDs (`did:hedera`), builds W3C DID Core 1.0 JSON-LD documents, and generates `SwarmSecurityAuditorCredential` Verifiable Credentials.
* **`HTS Helpers`:** Token association and signed transfer builders for HTS tokens.

### D. `@swarmproof/agents` — Universal LLM Provider Layer
* Unifies **Anthropic Claude 3.5 Sonnet**, **OpenAI GPT-4o**, and **local Ollama** behind a single interface with JSON block parsing and automatic fallback to deterministic AST detectors if an LLM is rate-limited.

---

## 🤖 3. What We Have in the MCP (Model Context Protocol) Layer

When mentors ask: *"How does MCP integrate into this?"*

* **Package:** `@swarmproof/mcp`
* **Why it matters:** MCP is the open standard backed by Anthropic and OpenAI for connecting AI models to external tools. Developers in **Cursor**, **Windsurf**, or **Claude Desktop** can invoke SwarmProof directly while writing Solidity code:
  > *"@swarmproof audit this ReentrancyVault contract and verify on Hedera"*

### The 6 MCP Tools Implemented:
1. **`audit_contract`**: Submits Solidity code, creates payment requirement, runs the 5-agent swarm, clusters findings, reaches consensus, and returns verified vulnerabilities with the Hedera HCS proof.
2. **`get_audit_status`**: Polls real-time lifecycle status (`analyzing`, `consensus`, `verifying`, `anchored`) and payment settlement.
3. **`get_findings`**: Retrieves accepted findings with severity, line numbers, vulnerable snippets, and suggested fixes.
4. **`verify_finding`**: Triggers targeted reproduction of a specific finding.
5. **`get_audit_proof`**: Fetches the immutable Hedera HCS anchor (`reportHash`, `hcsTopicId`, `transactionId`, `consensusTimestamp`).
6. **`list_agents`**: Inspects all active specialist agents, their W3C DIDs, capabilities, and consensus voting weights.

---

## 🆔 4. W3C Decentralized Identity & Verifiable Credentials (`did:hedera`)

When mentors ask: *"Why W3C? What makes your agent identity special?"*

* **The Problem:** 99% of AI agent projects use arbitrary strings (`"agent_123"`) in an ephemeral SQL table. Anyone can spoof an agent or falsify reputation.
* **The SwarmProof Solution:**
  1. **Canonical W3C DID:** Every agent gets a permanent identifier:  
     `did:hedera:testnet:0.0.10417469_reentrancy-agent`
  2. **W3C DID Core 1.0 Document (`GET /agents/:id/did`):** Resolves in `application/did+ld+json` with Ed25519 verification keys and a direct cryptographic link to its Hedera payout account (`blockchainAccountId: hedera:testnet:0.0.10417474`).
  3. **W3C Verifiable Credentials (`GET /agents/:id/credential`):** Issues a `SwarmSecurityAuditorCredential` proving the agent's role, voting weight, and consensus authority, backed by an immutable Hedera consensus timestamp and transaction ID.
  4. **Dynamic Registration:** Anyone can onboard a custom specialist via `POST /agents/register` or the Web UI, which broadcasts its DID to HCS and immediately attaches it into the live swarm.

---

## 🎨 5. The Interactive 3D Visualizer & Web Experience

When demonstrating on screen (`http://localhost:3000`):

1. **Three.js 3D Orbital Swarm Deck:**
   * Each specialist agent is rendered as a distinct 3D mathematical primitive:
     * 💎 **Octahedron Diamond** — Reentrancy Guard
     * 🛡️ **Dodecahedron Shield** — Access Control Guard
     * ♾️ **Torus Knot Loop** — Business Logic Sentinel
     * 💠 **Icosahedron Prism** — Economic & MEV Sentinel
     * ⚙️ **Gyroscopic Scanner** — Low-Level Static Call Inspector
   * **Real-time Particle Beams:** Glowing data packets animate between agents and the Hedera core during analysis.
2. **Fullscreen Theater Mode:** Press **`F`** or click **`⛶ Fullscreen`** (exits with **`Esc`**). Uses `ResizeObserver` for zero-lag responsive rendering.
3. **Interactive Agent Inspector:** Click any 3D node to open the inspector with live toggle tabs for the **W3C DID Document** and **Verifiable Credential JSON-LD**.
4. **Vulnerable Contract Presets:** Instant 1-click loading of `ReentrancyVault`, `AccessControlAdmin`, and `OverflowAuction`.
5. **The Payment Lab (`/x402`):** Step-by-step interactive visualizer of the 5-stage x402 challenge, quote, signing, Blocky402 settlement, and HCS anchoring.

---

## 🔗 6. Live Testnet Proofs (Keep These Handy to Show Mentors)

If a mentor asks: *"Is this actually running on Hedera Testnet?"*  
**Yes! Show them these real HashScan explorer transactions:**

| Component | Testnet ID / Address | HashScan Link |
| :--- | :--- | :--- |
| **HCS Audit Topic** | `0.0.10417469` | [HashScan Topic 0.0.10417469](https://hashscan.io/testnet/topic/0.0.10417469) |
| **x402 Settlement Tx** | `0.0.7162784@1788849225.803231622` | [HashScan Settlement Tx](https://hashscan.io/testnet/transaction/0.0.7162784@1788849225.803231622) |
| **HCS Report Proof Anchor** | `0.0.10119346@1788849233.623260124` | [HashScan Report Anchor Tx](https://hashscan.io/testnet/transaction/0.0.10119346@1788849233.623260124) |
| **Agent Identity Anchor** | `0.0.10119346@1789021885.521714338` | [HashScan Identity Tx](https://hashscan.io/testnet/transaction/0.0.10119346@1789021885.521714338) |
| **Payee Account** | `0.0.10417474` | [HashScan Account 0.0.10417474](https://hashscan.io/testnet/account/0.0.10417474) |
| **Blocky402 Facilitator** | `https://api.testnet.blocky402.com` | Official Hedera Testnet Facilitator |

---

## ❓ 7. Smart Questions to Ask the Mentors in Your Session

*Engaging the mentors with thoughtful questions shows maturity, coachability, and deep understanding of the problem:*

1. **On Hedera Payments:**
   > *"We currently settle audits using the Blocky402 x402 facilitator for HBAR and HTS tokens. For our final demo, do you think judges would be more impressed by seeing an atomic multi-recipient `CryptoTransferTransaction` paying all 5 agents in a single transaction, or showing scheduled transactions with a challenge dispute window?"*
2. **On Agent Consensus:**
   > *"Our swarm currently runs 5 specialist agents with weighted quorum voting. Would you recommend showing the agents' debate transcript directly on the dashboard, or focusing on the verified HashScan cryptographic proofs?"*
3. **On Developer Tooling:**
   > *"We implemented both the Model Context Protocol (MCP) and a Bring-Your-Own-Agent Plugin SDK. What angle would you highlight more in a 3-minute pitch: the IDE developer workflow (Cursor/Claude Desktop), or the open multi-agent marketplace?"*

---

## ⚡ 8. Terminal Cheat Sheet (To Run Live in 5 Seconds)

If they ask to see a live demonstration in terminal:

```bash
# Run the live autonomous x402 testnet audit (real payment + HCS proof):
pnpm --filter @swarmproof/api x402:live

# Run all 60 unit, identity, MCP & e2e tests:
pnpm test

# Query live W3C DIDs from the API:
curl -s http://localhost:3001/dids | jq

# Query W3C DID Core 1.0 Document:
curl -s http://localhost:3001/agents/reentrancy-agent/did | jq

# Query W3C Verifiable Credential with HCS Proof:
curl -s http://localhost:3001/agents/reentrancy-agent/credential | jq
```
