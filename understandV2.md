# 🐝 SwarmProof — understandV2

A comprehensive, plain-English architectural and implementation guide to **SwarmProof** as of Milestone 9 / P0-A: what it does, the core ideas driving it, current working capabilities, progress achieved vs. work remaining, and a complete folder-by-folder breakdown.

> **Status:** Post-P0 / x402 Integration (`understandV1` documented M0; this document covers the leap to 5 parallel specialists, x402 payment gating, Blocky402 facilitator settlement, Hedera HCS anchoring, plugin ecosystem, and the Payment Lab UI).

---

## 1. Executive Summary & TL;DR

- **What is SwarmProof?**
  SwarmProof is a **decentralized smart-contract auditing platform** where a **swarm of specialized AI agents** (Reentrancy, Access Control, Business Logic, Economic Security, Static Analysis, plus third-party plugin agents) independently audit Solidity code in parallel, cluster their findings, reach **weighted consensus**, independently reproduce vulnerabilities, and anchor immutable audit proofs on the **Hedera Consensus Service (HCS)**.
- **Pay-Per-Call Agentic Economy (x402 + Blocky402):**
  Audits require **no API keys, user logins, or subscriptions**. Every audit is an **HTTP 402 Payment Required** resource governed by the **x402 v2 protocol**. Client agents or users receive an exact tinybar quote, sign an `ExactHederaScheme` transaction via `@x402/hedera`, verify and settle through the **Blocky402 facilitator** on Hedera testnet, and replay their request with an `X-PAYMENT` header. Fees are transparently split across the specialist agents, the verifier, and the gateway.
- **Where the Codebase Stands Today (V1 vs V2):**
  - **In `understandV1.md` (M0):** The repo was a bare skeleton where LLM calls were deterministic string-length echoes (`StubProvider`), verification was a regex mock, Hedera was an in-memory mock, payments were in-memory, and only 9 tests existed.
  - **In `understandV2.md` (Today):** The repo now has **46 passing tests**, **5 working parallel specialist agents** with genuine code-level vulnerability detection heuristics, an **AST/scope-aware finding clustering engine**, a **fully functional x402 v2 payment gateway** integrated with Blocky402 and the Hedera Mirror Node, **HCS-14 agent identity registration**, **HCS payment audit trails**, a **third-party agent plugin registry**, an interactive **browser-based Payment Lab**, and an end-to-end **MCP client**.

---

## 2. The Core Idea & Hackathon Context

### 2.1 The Problem
1. **Centralized & Slow:** Traditional human audits cost $30,000–$150,000 and take weeks to months.
2. **Single-Agent AI Hallucination:** Single-prompt AI auditors suffer from severe false positives and cannot rigorously verify their own claims.
3. **No Verifiable Proof:** Audit reports are static PDFs. There is no cryptographic link between the source code analyzed, the consensus of the auditors, and an immutable public ledger.
4. **Opaque & Friction-Heavy Monetization:** Using security APIs typically requires creating accounts, managing proprietary API keys, or paying flat monthly retainers.

### 2.2 The SwarmProof Solution
- **The "Courtroom" Multi-Agent Model:** Instead of one LLM guessing vulnerabilities, multiple independent specialist agents examine specific vulnerability surfaces simultaneously.
- **Clustering & Consensus:** Duplicate or related findings across independent agents are clustered by category and function scope. Quorum and confidence math decide whether a finding is accepted, rejected, or escalated as a dispute.
- **Independent Verification:** Findings that pass consensus are handed to a verification engine that reproduces the bug with concrete artifacts.
- **Immutable Ledger Anchoring (Hedera HCS):** The final report is serialized into deterministic, key-sorted JSON, hashed with SHA-256, and submitted to Hedera Consensus Service. Anyone can verify the authenticity of an audit report using the mirror node.
- **x402 Micro-Payments on Hedera:** Utilizing the HTTP 402 status code and the Blocky402 facilitator, external agents pay exactly for the compute they consume in HBAR or HTS tokens, with payments automatically split among participating agents.

### 2.3 Hackathon Focus: ETHGlobal Online 2026
SwarmProof is targeted at:
- **Primary Target:** **Hedera — AI & Agentic Payments ($6,000 prize track)**
  - Pay-per-call compute metering (per-audit exact payment)
  - Live x402-gated service and client consumption
  - Settlement via Blocky402 on `hedera:testnet`
  - On-chain agent identity registration (**HCS-14**)
  - Agent discovery directory (`GET /supported` and `GET /agents`)
  - HTS token support (`0.0.0` for HBAR or custom HTS token IDs)
  - Verifiable payment audit trails on HCS
- **Secondary Target:** Decentralized Multi-Agent AI & Automated Security Infrastructure

---

## 3. High-Level Architecture & End-to-End Workflow

```
                        ┌─────────────────────────────────────────────────────────┐
                        │ Consumer (Web Dashboard / Payment Lab / MCP Tool / Bot) │
                        └─────────────────────────────────────────────────────────┘
                                                     │
                             1. POST /audit (No payment)
                                                     ▼
                        ┌─────────────────────────────────────────────────────────┐
                        │                   apps/api (Hono)                       │
                        │    Returns HTTP 402 + WWW-Authenticate: X402            │
                        └─────────────────────────────────────────────────────────┘
                                                     │
                             2. GET /x402/audits/:id (Accept: application/x402+json)
                                                     ▼
                        ┌─────────────────────────────────────────────────────────┐
                        │           Payment Quote Issued (tinybars, payTo,        │
                        │       recipients split: 5 specialists + verifier + gw)  │
                        └─────────────────────────────────────────────────────────┘
                                                     │
                             3. Sign TransferTransaction (@x402/hedera)
                                Settle through Blocky402 Facilitator
                                                     ▼
                        ┌─────────────────────────────────────────────────────────┐
                        │                 Hedera Testnet Ledger                   │
                        │         (Facilitator co-signs fee, settles tx)          │
                        └─────────────────────────────────────────────────────────┘
                                                     │
                             4. Replay POST /audit with X-PAYMENT header
                                                     ▼
                        ┌─────────────────────────────────────────────────────────┐
                        │               apps/api verifies payment                 │
                        │          (Anchors HCS Payment Proof Message)            │
                        │                  Fires AuditOrchestrator                │
                        └─────────────────────────────────────────────────────────┘
                                                     │
                             5. Parallel Specialist Agents (Promise.all)
                    ┌───────────────┬────────────────┬───────────────┬──────────────┐
                    ▼               ▼                ▼               ▼              ▼
              Reentrancy      Access Control   Business Logic    Economic        Static
                Agent             Agent            Agent          Agent          Agent
              (AST regex)      (AST regex)      (AST regex)    (AST regex)    (AST regex)
                    │               │                │               │              │
                    └───────────────┴────────────────┼───────────────┴──────────────┘
                                                     │
                                                     ▼
                                       Plugin Agents (if registered)
                                                     │
                                                     ▼
                                     packages/consensus: normalize & cluster
                                                     │
                                                     ▼
                                     reachConsensus() (weighted voting + quorum)
                                                     │
                                                     ▼
                                     packages/verification: verifyFindings()
                                                     │
                                                     ▼
                               Deterministic JSON Report -> SHA-256 Hash
                                                     │
                                                     ▼
                                  packages/hedera: Anchor to HCS Topic
                                                     │
                                                     ▼
                                    GET /audits/:id/proof -> HashScan Proof
```

---

## 4. What This Repo is Currently Capable Of

### 4.1 Live x402 Gating & Payment Settlement
- **HTTP 402 Gate:** Calling `POST /audit` without credentials returns standard HTTP 402 with `WWW-Authenticate: X402 resource="http://localhost:3001/x402/audits/<id>"`.
- **Exact Quotes:** The resource endpoint serves an exact quote in tinybars, calculating exchange rates and designating the gateway payee account and facilitator fee-payer.
- **Blocky402 Facilitator Integration:** Can connect to `https://api.testnet.blocky402.com` (or run in offline mock mode) to execute `/verify` and `/settle`.
- **Payment Verification:** Validates payment payloads via facilitator verification and on-chain Mirror Node transfer verification (`MirrorNodeClient.verifyTransfer`).
- **Payment Revenue Splitting:** Automatically calculates split allocations across 5 specialists, 1 verification agent, and the gateway, validating addresses, checksums, and shares.

### 4.2 Working Multi-Specialist Analysis Engine
Unlike V1's dummy stub echoes, the 5 specialist agents in `packages/agents/src/specialists.ts` run real code analysis:
1. **`reentrancy-agent`:** Detects external value calls (`.call{value:}`, `.transfer`, `.send`) followed by state writes without `nonReentrant` or mutex guards. Correctly flags `ReentrancyVault.sol` as a **critical** vulnerability.
2. **`access-control-agent`:** Scans function bodies for privileged actions (ETH outflows, ownership changes, admin setters) lacking `onlyOwner` or `require` modifier checks, and identifies dangerous `tx.origin` patterns. Correctly flags `AccessControlAdmin.sol` as a **high** vulnerability.
3. **`business-logic-agent`:** Identifies input variables (`msg.value`, `amount`) mutating balances without boundary or zero checks, and detects gas-draining `assert()` calls.
4. **`economic-agent`:** Identifies oracle manipulation hazards (Chainlink, Uniswap `getReserves`, `latestRoundData`), AMM flash-loan vectors (`donate`, `skim`, `sync`), and timestamp dependencies (`block.timestamp`).
5. **`static-agent`:** Flags dangerous low-level EVM operations including `delegatecall`, `selfdestruct`, `unchecked` arithmetic blocks, `abi.encodePacked` hash collision risks, inline assembly, and cross-confirms reentrancy.

### 4.3 Clustering & Weighted Consensus
- **Normalization & Scope Clustering:** Merges identical bug reports from different agents into a single cluster based on `${category}::${functionScope}`.
- **Severity Escalation:** Takes the highest severity among agreeing agents.
- **Weighted Voting & Quorum:** Calculates confidence scores based on agent roles and reputation weights. Requires a minimum quorum of distinct agents (default: 2) to accept a finding, while escalating unconfirmed critical findings as disputes.

### 4.4 Hedera Consensus Service (HCS) & Mirror Node Verification
- **Tamper-Evident Report Proofs:** Computes a SHA-256 hash over deterministically key-sorted JSON and submits `swarmproof.audit` messages to HCS topics.
- **HCS Payment Trails:** Submits `swarmproof.payment` messages recording audit ID, payment ID, payer, total, and recipient breakdown.
- **HCS-14 Agent Identity:** Submits `hcs-14.identity` messages recording agent capabilities and payout addresses, queryable via `GET /agents`.
- **Mirror Node Client:** Re-verifies anchored audit messages, inspects topic message history, and verifies HBAR/HTS transfers directly against Hedera testnet mirror nodes with no API keys required.

### 4.5 Agent Plugin Ecosystem
- Allows third parties to register custom agents into the swarm via in-process TS functions (`function`), external LLM endpoints (`llm`), or remote microservices (`http`).
- Plugins register custom consensus weights and run seamlessly during audits.

### 4.6 Developer & User Interfaces
- **Next.js Payment Lab (`apps/web/app/x402/page.tsx`):** A step-by-step UI that demonstrates the full 402 flow: Requesting an audit, fetching the quote, signing and settling, submitting the `X-PAYMENT` header, and watching the swarm produce an HCS proof.
- **MCP Tool Interface (`packages/mcp`):** Thin-client tool suite providing `audit_contract`, `get_audit_status`, `get_findings`, `verify_finding`, `get_audit_proof`, and `list_agents`.
- **46 Automated Tests:** Complete test coverage across consensus math, payment allocation, x402 wire formats, plugin execution, MCP tools, and e2e audit flows.

---

## 5. Progress Scorecard: Achieved vs. Remaining

```
┌─────────────────────────────────────────────────────────────┐
│ OVERALL PROJECT COMPLETION: ~75% (Core Architecture Ready)  │
└─────────────────────────────────────────────────────────────┘
 [████████████████████████████████████████░░░░░░░░░░] 75%
```

### 5.1 What Has Been Achieved (Finished & Verified)
| Feature / Milestone | Status | Details |
|---|---|---|
| **Workspace & Monorepo** | ✅ 100% | pnpm workspaces, strict TS, project references, vitest tooling. |
| **Data Contracts & Shared Types** | ✅ 100% | Zod-validated findings, agent messages, roles, severities, and x402 wire formats. |
| **AST/Heuristic Specialist Agents** | ✅ 100% | 5 parallel detectors with genuine vulnerability heuristics. |
| **Clustering & Consensus Math** | ✅ 100% | Normalization by category/scope, severity escalation, quorum, disputes. |
| **x402 Payment Gateway** | ✅ 100% | HTTP 402 challenge, exact quote endpoint, `@x402/hedera` signing, Blocky402 facilitator client, `X-PAYMENT` validation. |
| **Hedera Consensus Service (HCS)** | ✅ 100% | Audit proof messages, SHA-256 report hashing, real `@hashgraph/sdk` submitter, offline mock fallback. |
| **HCS-14 Agent Identity** | ✅ 100% | Specialist identity registration and discovery via `GET /agents`. |
| **HCS Payment Audit Trails** | ✅ 100% | Verifiable payment receipts anchored on HCS. |
| **Hedera Mirror Node Integration** | ✅ 100% | Credential-free verification of token transfers, transaction status, and topic messages. |
| **Agent Plugin Ecosystem** | ✅ 100% | Third-party agent registry supporting `function`, `http`, and `llm` runners. |
| **Payment Lab Web Interface** | ✅ 100% | Interactive 5-step payment and audit runner at `/x402`. |
| **MCP Tool Registry** | ✅ 90% | Thin-client tools over API with full e2e testing. |
| **Automated Test Suite** | ✅ 100% | 46 tests passing green in <1 second offline. |

---

### 5.2 What is Left to Do (Gaps & Next Steps)

| Feature / Area | Completion | What is Left to Build |
|---|---|---|
| **Real Tool Verification (M3)** | 25% | `MockVerifier` works; `ToolVerifier` (calling `solc`, `slither`, `forge test` in Docker/child process) throws `not yet wired`. |
| **Live Web Swarm Visualizer (M4)** | 35% | Main `/` page is a basic form with JSON output; needs an animated node graph, real-time message feed, and severity badges (Payment Lab `/x402` is ahead of main page). |
| **Automated Payouts via Scheduled Tx (P1)** | 30% | `packages/hedera/src/hts.ts` builds signed token transfers; automated trigger of Hedera Scheduled Transactions to distribute funds from gateway to specialist accounts upon audit completion is not wired. |
| **Live LLM Providers (OpenAI / Claude / Ollama)** | 20% | Interface exists; specialists currently use deterministic AST heuristics. Wiring an optional live LLM flag for deeper conversational exploitation/reasoning is pending. |
| **MCP Transports (M6)** | 40% | In-memory MCP tool registry and API client exist; stdio and SSE server transports using `@modelcontextprotocol/sdk` for Cursor/Claude Desktop integration need wrapping. |
| **Corpus Expansion & Calibration** | 60% | 3 sample contracts exist; need 3–5 more classic contracts (flash loans, oracle manipulation, signature replay) and comment clarification in `OverflowAuction.sol`. |
| **Hackathon Deliverables & Polish (M7)** | 10% | Video demo recording, slide deck, deployed testnet URLs, HashScan transaction links. |

---

## 6. Complete Folder-by-Folder & Package-by-Package Breakdown

```
swarmproof/
├── apps/
│   ├── api/                 # Hono REST & x402 payment API server
│   └── web/                 # Next.js 15 dashboard & Payment Lab
├── packages/
│   ├── agents/              # Shared types, specialist agents, identity schemas
│   ├── consensus/           # Normalization, clustering, weighted voting
│   ├── hedera/              # HCS proof anchoring, HCS-14 identity, mirror node client
│   ├── mcp/                 # MCP client tool registry
│   ├── payments/            # Revenue allocation, payment gateway, provider abstraction
│   ├── plugins/             # Third-party agent plugin registry & executors
│   ├── swarm/               # Orchestrator & legacy sequential runner
│   ├── verification/        # Verification engine (mock + tool runners)
│   └── x402/                # x402 v2 protocol implementation (Hedera exact scheme)
├── contracts/
│   └── vulnerable/          # Solidity test corpus with ground truth metadata
├── tests/                   # 46 Vitest unit and integration tests
├── .env.example             # Comprehensive environment configuration template
├── package.json             # Root workspace configuration
└── pnpm-workspace.yaml      # Monorepo package declarations
```

---

### 6.1 `apps/api` — The Core Service Backend
- **Role:** The primary runtime process of SwarmProof. It acts as both the **x402-gated service** and the **orchestration gateway**.
- **Tech Stack:** Hono, TypeScript, `@swarmproof/*` packages.
- **Key Files:**
  - [`src/app.ts`](apps/api/src/app.ts): Main application factory (`createApp()`). Configures CORS, sets up the `PaymentGateway`, initializes specialist agents, wires `AuditOrchestrator`, and registers routes.
  - [`src/index.ts`](apps/api/src/index.ts): HTTP server entry point running on port 3001 (or `PORT`).
  - [`scripts/x402-live-testnet.ts`](apps/api/scripts/x402-live-testnet.ts): Standalone CLI script demonstrating the entire live testnet payment flow using a funded Hedera account.
- **Exposed Endpoints:**
  - `POST /audit`: The x402 gate. Returns 402 with challenge when unpaid; accepts `X-PAYMENT` header to verify and trigger the audit.
  - `GET /x402/audits/:id`: Resource endpoint serving x402 JSON payment quotes.
  - `GET /x402/status`: Readiness status of facilitator, payer signer, gateway address, and pricing.
  - `POST /x402/pay`: Server-side signer endpoint used by the Payment Lab to sign quotes without leaking private keys to the browser.
  - `GET /audits/:id/status`: Lifecycle status, payment confirmation, and HCS payment proof receipt.
  - `GET /audits/:id/findings`: Final accepted findings and verification status.
  - `GET /audits/:id/proof`: Tamper-evident HCS anchor details (`reportHash`, `hcsTopicId`, `transactionId`, `consensusTimestamp`).
  - `POST /audits/:id/verify`: On-demand verification of an individual finding.
  - `GET /agents`: List of specialist agents with HCS-14 on-chain identity references and payout addresses.
  - `GET /supported`: x402 discovery directory (capabilities, service descriptions, pricing, agents).

---

### 6.2 `apps/web` — The Frontend Dashboard & Payment Lab
- **Role:** User-facing frontend for submitting audits and testing agentic payments.
- **Tech Stack:** Next.js 15 (App Router), React 19, TypeScript.
- **Key Files:**
  - [`app/x402/page.tsx`](apps/web/app/x402/page.tsx): The **Payment Lab**. A full interactive 5-stage visualizer demonstrating:
    1. Requesting an audit and capturing HTTP 402 challenge headers.
    2. Fetching the x402 JSON quote.
    3. Signing with the consumer agent wallet and settling via Blocky402.
    4. Replaying the audit request with `X-PAYMENT`.
    5. Polling until completion and displaying the HCS proof with HashScan links.
  - [`app/page.tsx`](apps/web/app/page.tsx): The default quick-submission page for contract code with a polling loop and raw JSON output.
  - [`app/layout.tsx`](apps/web/app/layout.tsx): Root HTML structure.

---

### 6.3 `packages/agents` — Agent Types, Prompts & Specialists
- **Role:** Defines the shared data models, identity schemas, and working detection logic for the specialist swarm.
- **Key Files:**
  - [`src/index.ts`](packages/agents/src/index.ts): Zod schemas for `Finding`, `AgentMessage`, `Severity`, `AgentRole`, and the `LLMProvider` interface with `StubProvider`.
  - [`src/specialists.ts`](packages/agents/src/specialists.ts): Implementation of the 5 parallel specialist agents (`reentrancy-agent`, `access-control-agent`, `business-logic-agent`, `economic-agent`, `static-agent`) using AST and pattern heuristics. Defines default payment addresses.
  - [`src/identity.ts`](packages/agents/src/identity.ts): Defines `AgentIdentity` schema (agent ID, name, version, capabilities, payment address).

---

### 6.4 `packages/consensus` — Normalization, Clustering & Weighted Voting
- **Role:** Pure mathematical and logical processing of raw agent outputs into clustered findings and consensus verdicts.
- **Key Files:**
  - [`src/index.ts`](packages/consensus/src/index.ts):
    - `normalizeFindings()` / `clusterFindings()`: Clusters findings across independent agents matching on `${category}::${functionScope}`.
    - `reachConsensus()`: Computes weighted scores (`score = Σ weight × confidence × artifactWeight`), evaluates quorum thresholds, handles exploiter rejections, and flags unconfirmed criticals as disputes.
    - `ROLE_WEIGHTS`: Analyzer (0.3), Exploiter (0.35), Verifier (1.0), Judge (0.4). Supports custom per-agent weight overrides.

---

### 6.5 `packages/hedera` — Consensus Service, Identity & Mirror Node
- **Role:** Hedera network integration covering HCS audit proof anchoring, HCS payment audit trails, HCS-14 agent identity, and read-only Mirror Node queries.
- **Key Files:**
  - [`src/proof.ts`](packages/hedera/src/proof.ts): Deterministic JSON stringification, SHA-256 hashing, `buildAuditProofMessage()`, `MockAuditProofClient`, and `HederaAuditProofClient` (using `@hashgraph/sdk`).
  - [`src/payment.ts`](packages/hedera/src/payment.ts): Anchors verifiable payment distribution messages to HCS after settlement.
  - [`src/identity.ts`](packages/hedera/src/identity.ts): Implements HCS-14 agent identity publishing and registrar.
  - [`src/mirrornode.ts`](packages/hedera/src/mirrornode.ts): Public Mirror Node REST client for verifying HBAR/HTS transfers, retrieving topic messages, and verifying anchors.
  - [`src/hts.ts`](packages/hedera/src/hts.ts): Token associate transactions and HTS transfer transaction builders.
  - [`src/topic.ts`](packages/hedera/src/topic.ts): Generic HCS topic submitter utility.
  - [`src/scripts/create-topic.ts`](packages/hedera/src/scripts/create-topic.ts): CLI script to create an HCS topic on testnet.

---

### 6.6 `packages/payments` — Revenue Allocation & Gateway
- **Role:** Computes payment splits across specialists and provides an injectable payment provider abstraction.
- **Key Files:**
  - [`src/allocator.ts`](packages/payments/src/allocator.ts): BigInt-based financial math splitting audit fees across recipients by percentage share. Validates recipient addresses, sums, zero amounts, and prevents rounding leakage.
  - [`src/gateway.ts`](packages/payments/src/gateway.ts): `PaymentGateway` managing audit payment requirements, guarding against duplicate payment confirmations, and checking underpayment.
  - [`src/providers/x402.ts`](packages/payments/src/providers/x402.ts): The real `X402PaymentProvider` integrating with `packages/x402` and mirror node transfer checks.
  - [`src/providers/mock.ts`](packages/payments/src/providers/mock.ts): In-memory mock provider enforcing identical nonce and audit ID semantics.

---

### 6.7 `packages/plugins` — Agent Plugin Ecosystem
- **Role:** Allows third parties to contribute custom audit agents to the SwarmProof ecosystem.
- **Key Files:**
  - [`src/index.ts`](packages/plugins/src/index.ts): `AgentPlugin` manifest schema, `AgentRegistry`, and executors for `function`, `http`, and `llm`.
  - [`src/examples.ts`](packages/plugins/src/examples.ts): Built-in example plugins (`keyword-analyzer` function plugin, HTTP remote auditor plugin).

---

### 6.8 `packages/swarm` — Orchestration
- **Role:** Coordinates the execution of audits across agents, consensus, verification, and ledger anchoring.
- **Key Files:**
  - [`src/orchestrator.ts`](packages/swarm/src/orchestrator.ts): `AuditOrchestrator`. Runs the 5 specialist agents in parallel, clusters outputs, reaches consensus, runs verification, and anchors the final report hash on Hedera. (Contains zero payment logic).
  - [`src/index.ts`](packages/swarm/src/index.ts): `SwarmRunner`. Legacy sequential event-emitter loop supporting phase events, hooks, and registered third-party plugins.

---

### 6.9 `packages/verification` — Tool Runner
- **Role:** Independent reproduction of candidate vulnerabilities using static/dynamic analysis tools.
- **Key Files:**
  - [`src/index.ts`](packages/verification/src/index.ts):
    - `VerificationEngine` interface (`verify(req)`).
    - `MockVerifier`: Deterministic keyword/tool simulator for CI/offline use.
    - `ToolVerifier`: Seam for executing external binaries (`solc`, `slither`, `forge test`).
    - `verifyFindings()`: Batch verification helper.

---

### 6.10 `packages/x402` — x402 v2 Protocol Implementation
- **Role:** Full implementation of the x402 v2 payment specification for Hedera testnet and the Blocky402 facilitator.
- **Key Files:**
  - [`src/types.ts`](packages/x402/src/types.ts): Types for `X402PaymentRequirements`, `X402PaymentPayload`, `X402ResourceEnvelope`, Blocky402 `/supported`, `/verify`, `/settle` requests/responses, and `X-PAYMENT` header utilities.
  - [`src/client.ts`](packages/x402/src/client.ts): Consumer agent client: parses 402 challenge headers, fetches quotes, signs transactions using `@x402/hedera`, requests facilitator verification and settlement, and redeems `X-PAYMENT`.
  - [`src/facilitator.ts`](packages/x402/src/facilitator.ts): Wire client communicating with Blocky402 facilitator (`MockFacilitatorClient` and `X402FacilitatorClient`).
  - [`src/server.ts`](packages/x402/src/server.ts): Server-side helpers: generating 402 challenge headers, parsing `X-PAYMENT` and `PAYMENT-SIGNATURE` headers, and validating payment parameters.
  - [`src/money.ts`](packages/x402/src/money.ts): Precision integer USD-to-tinybar conversion (`usdToTinybars`, `tinybarsToUsd`).
  - [`src/jwt.ts`](packages/x402/src/jwt.ts) & [`src/keys.ts`](packages/x402/src/keys.ts): Ed25519 cryptographic signing utilities.

---

### 6.11 `packages/mcp` — Model Context Protocol Thin Client
- **Role:** Exposes SwarmProof's audit capabilities to MCP-compatible AI environments.
- **Key Files:**
  - [`src/index.ts`](packages/mcp/src/index.ts): Defines MCP tools (`audit_contract`, `get_audit_status`, `get_findings`, `verify_finding`, `get_audit_proof`, `list_agents`) wrapped around `SwarmProofApiClient`.

---

### 6.12 `contracts/vulnerable` — Vulnerable Contract Corpus
- **Role:** Ground-truth testing corpus used for verifying detectors, consensus calibration, and demo runs.
- **Key Files:**
  - [`ReentrancyVault.sol`](contracts/vulnerable/ReentrancyVault.sol): Classic reentrancy vulnerability (`.call{value:}` before balance zeroing).
  - [`AccessControlAdmin.sol`](contracts/vulnerable/AccessControlAdmin.sol): Missing access controls on critical state-changing functions.
  - [`OverflowAuction.sol`](contracts/vulnerable/OverflowAuction.sol): Integer arithmetic boundary conditions.
  - [`metadata.json`](contracts/vulnerable/metadata.json): Ground truth labels (expected categories, severities, locations) used to benchmark swarm precision and recall.

---

### 6.13 `tests/` — Automated Vitest Test Suite
- **Role:** Comprehensive offline unit and end-to-end testing (46 passing tests).
- **Key Files:**
  - [`consensus.unit.test.ts`](tests/consensus.unit.test.ts) (6 tests): Quorum verification, score thresholds, dispute escalation, clustering logic.
  - [`payments.test.ts`](tests/payments.test.ts) (9 tests): BigInt financial allocations, address validation, double-spend guarding, underpayment handling.
  - [`x402.unit.test.ts`](tests/x402.unit.test.ts) (11 tests): Conversion math, wire format parsing, mock facilitator behavior.
  - [`plugins.test.ts`](tests/plugins.test.ts) (8 tests): Plugin registration, function/HTTP/LLM execution, custom weights.
  - [`swarm.e2e.test.ts`](tests/swarm.e2e.test.ts) (5 tests): Full swarm run against corpus, mock verification, and ledger receipt verification.
  - [`x402.e2e.test.ts`](tests/x402.e2e.test.ts) (4 tests): In-process end-to-end test of the full HTTP 402 flow (challenge -> quote -> sign -> settle -> redeem -> audit).
  - [`mcp.test.ts`](tests/mcp.test.ts) (3 tests): Full execution of `audit_contract` and audit query tools.

---

## 7. How to Run, Test, and Demo

### 7.1 Running Offline (Zero Config)
The entire test suite and development servers run without requiring any external accounts, API keys, or funded wallets:

```bash
# 1. Install dependencies
pnpm install

# 2. Build all packages topologically
pnpm build

# 3. Run all 46 automated tests
pnpm test

# 4. Start the API server on :3001
pnpm dev:api

# 5. Start the Web Dashboard & Payment Lab on :3000
pnpm dev:web
```

Visit [http://localhost:3000/x402](http://localhost:3000/x402) to interact with the **Payment Lab**.

---

### 7.2 Running Live on Hedera Testnet
To execute live payments and anchor genuine messages on Hedera Consensus Service:

1. **Obtain Testnet Credentials:**
   - Create a free account on the [Hedera Developer Portal](https://portal.hedera.com/).
   - Copy your Account ID (e.g., `0.0.1234567`) and Private Key.
2. **Configure `.env`:**
   ```bash
   cp .env.example .env
   ```
   Fill in:
   ```env
   HEDERA_NETWORK=testnet
   HEDERA_ACCOUNT_ID=0.0.<your-account-id>
   HEDERA_PRIVATE_KEY=<your-der-encoded-private-key>
   X402_FACILITATOR_URL=https://api.testnet.blocky402.com
   X402_NETWORK=hedera:testnet
   ```
3. **Optionally Create an HCS Topic:**
   ```bash
   pnpm --filter @swarmproof/hedera create-topic
   # Add the output HEDERA_TOPIC_ID to your .env
   ```
4. **Run the Live Testnet Audit:**
   ```bash
   pnpm --filter @swarmproof/api x402:live
   ```
   This will execute the live 402 challenge, sign a Hedera `TransferTransaction`, settle via Blocky402, run the 5-agent swarm audit, and print the resulting HashScan transaction link!

---

## 8. Summary for Onboarding & Next Hackathon Moves

If you are picking up this repo to prepare for demo submission:
1. **The strongest asset of this repo** is the **Hedera AI & Agentic Payments flow**: you have working x402 v2 challenge headers, real `@x402/hedera` transaction signing, Blocky402 facilitator integration, HCS-14 agent identity publishing, and HCS-anchored audit trails.
2. **For the live demo / video recording:**
   - Use the **Payment Lab** (`http://localhost:3000/x402`) or the terminal script (`pnpm --filter @swarmproof/api x402:live`).
   - Highlight the 5 steps: `402 Challenge` ➔ `Quote in Tinybars` ➔ `Blocky402 Settlement` ➔ `5 Parallel Specialists Audit` ➔ `Immutable HCS Anchor on HashScan`.
3. **If you have extra time before submission:**
   - Add visual graph polish to the main web dashboard (`apps/web/app/page.tsx`).
   - Wire `ToolVerifier` to run a local `slither` Docker container or add extra vulnerable test contracts to `contracts/vulnerable/`.
