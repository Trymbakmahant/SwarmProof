# 🐝 SwarmProof — Creation Plan & Prompts

> **Event:** ETHGlobal Online 2026
> **Repo:** `swarmproof/` (pnpm monorepo)
> **Status:** Scaffold phase → MVP → Polish

---

## 1. Vision

**SwarmProof** is a decentralized smart-contract auditing platform driven by a **swarm of specialized AI agents** that collaborate, argue, and reach **consensus** on vulnerability findings. It combines:

- 🧠 **Agent swarm** — multiple LLM agents with distinct roles (Analyzer, Exploiter, Verifier, Judge)
- ⚖️ **Consensus** — weighted agreement over findings, with confidence + dispute resolution
- 🔬 **Verification** — every finding is reproduced with real tools (Slither, Foundry, Vyper, custom PoCs)
- 🛰️ **Hedera** — audit reports anchored on the Ledger (Consensus Service), payments via HTS tokens, on-chain bounty tracking
- 🔌 **MCP server** — expose the swarm's full audit toolset to any MCP client (Cursor, Claude, IDE)
- 💸 **Payments** — bounty staking, audit fees, verifier rewards

## 2. Problem Statement

- Smart-contract audits are **slow, expensive, and centralized** — one team, one opinion.
- AI audit assistants are **single-agent** — no cross-checking, no adversarial verification, high false-positive rates.
- Findings are **hard to trust** — no reproducible proof, no on-chain record, no dispute path.
- Bug bounty payouts are opaque and slow.

**SwarmProof's answer:** a swarm that treats audits like a trial — multiple agents prepare cases, an adversarial exploiter tries to break them, verifiers reproduce with tooling, consensus adjudicates, and the whole verdict is anchored immutably on Hedera.

## 3. Workspace Layout

```
swarmproof/
├── apps/
│   ├── api/                 # Fastify/Hono backend: orchestration API, job queue
│   └── web/                 # Next.js dashboard: submit contract, watch live swarm, view reports
│
├── packages/
│   ├── agents/              # @swarmproof/agents — agent roles, prompts, LLM providers
│   ├── swarm/               # @swarmproof/swarm — orchestration, run loop, agent lifecycle
│   ├── consensus/           # @swarmproof/consensus — weighting, aggregation, disputes
│   ├── verification/        # @swarmproof/verification — Slither/Foundry/PoC runner, artifacts
│   ├── mcp/                 # @swarmproof/mcp — MCP server exposing audit tools
│   ├── payments/            # @swarmproof/payments — bounties, escrow, payouts
│   ├── hedera/              # @swarmproof/hedera — ConsensusService + HTS client
│   └── plugins/             # @swarmproof/plugins — agent plugin ecosystem (registry + executors)
│
├── contracts/
│   └── vulnerable/          # Deliberately vulnerable Solidity contracts (test corpus)
│
├── tests/                   # Integration/e2e tests orchestrating the full swarm
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md
└── plan.md                  # ← you are here
```

## 4. Tech Stack & Decisions

| Concern | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces | Fast, disk-efficient, strict deps |
| Language | TypeScript (strict) | Shared types across agents/API/verification |
| Smart contracts | Solidity (0.8.x) | Target corpus for the swarm |
| L1 anchor | Hedera | Consensus Service = audit trail, HTS = payouts |
| LLM | OpenAI + local (Ollama) fallback | Fast iteration + open-source path |
| Verification tools | Slither, solc, Foundry (`forge test`) | Real static + dynamic analysis |
| API | Hono (edge-ready) | Lightweight, works on Cloudflare/Node |
| Web | Next.js 15 | Rapid UI for the demo |
| MCP | Official `@modelcontextprotocol/sdk` | Tool exposure to any MCP client |

## 5. Architecture — How an Audit Flows

```
 User submits contract address / source
        │
        ▼
 apps/api ──► job queued (contracts/vulnerable during demo)
        │
        ▼
 packages/swarm ── orchestrates the swarm run
   ├─ Analyzer agents (2–3): static + semantic read, produce candidate findings
   ├─ Exploiter agent: adversarial — tries to PROVE findings with PoCs
   ├─ Verifier agents: run Slither / forge tests / PoCs against forked state
   ├─ Judge agent: summarizes, checks evidence quality
   ▼
 packages/consensus ── weight findings, confidence score, dispute round
   ▼
 packages/plugins ─── third-party agents (llm / http / function executors)
   │                    run in the swarm alongside built-in roles; custom
   │                    consensus weights via registry.weights()
   ▼
 packages/verification ── artifacts: proof files, tx traces, severity labels
   ▼
 packages/hedera ── report hash → Consensus Service topic; bounty status → HTS
   ▼
 packages/payments ── escrow release / bounty payout per verified severity
   ▼
 MCP server / Web dashboard ← full JSON report with evidence
```

## 6. Package-by-Package Plan

### 6.1 `packages/agents`
- Types: `AgentRole`, `AgentConfig`, `AgentMessage`, `Finding`, `Severity`.
- Factories for roles: `analyzer`, `exploiter`, `verifier`, `judge`.
- LLM provider abstraction (`OpenAIProvider`, `OllamaProvider`) with a **deterministic stub provider** for tests/demo.
- Role prompt templates (see §8).
- **Deps:** none internal (pure TS + provider SDKs).
- **Prompt:** *"Build a typescript package @swarmproof/agents that defines agent roles (analyzer, exploiter, verifier, judge), an LLM provider interface with openai + ollama + stub implementations, and zod-validated types for AgentMessage and Finding. Strict TS, ESM, no runtime deps beyond zod."*

### 6.2 `packages/swarm`
- `SwarmRunner` — orchestrates a full audit: orchestrates agent phases, message passing, retries, budget/time limits.
- `SwarmRun` state machine: `queued → analyzing → exploiting → verifying → judging → consensus → done/failed`.
- Event emitter for live streaming to API/Web (SSE/WebSocket ready).
- **Prompt:** *"Create @swarmproof/swarm: a SwarmRunner class that executes a structured multi-phase audit using agents from @swarmproof/agents. Phases: analyze → exploit → verify → judge. Emit typed events per agent message. Support injecting dependencies. Strict TS, ESM."*

### 6.3 `packages/consensus`
- `WeightedConsensus` — each finding accumulates evidence weight; threshold + quorum rules.
- Confidence scoring calibrated against the known corpus (precision/recall on `contracts/vulnerable`).
- Dispute round: if `exploiter` disagrees with `analyzer`, escalate to full swarm vote.
- Output: `ConsensusReport { findings, verdicts, confidence, disputes }`.
- **Prompt:** *"Implement @swarmproof/consensus: weighted consensus over findings from multiple agents. Rules: weight by agent role + evidence quality, min quorum to accept, confidence in [0,1], support dispute escalation. Pure functions, fully unit-testable, strict TS."*

### 6.4 `packages/verification`
- Runs external tools: `solc` compile, `slither` static analysis, `forge` PoC tests.
- Parses JSON outputs into normalized `VerificationResult` (per finding: reproduced/not, gas trace, calldata).
- Sandboxed binary runner (`child_process` with timeouts + resource limits) and an **in-process mock runner** for CI/demo.
- **Prompt:** *"Write @swarmproof/verification: runs solc/slither/forge against a contract source, normalizes outputs into typed VerificationResult per candidate finding, mock runner for CI. Strict TS."*

### 6.5 `packages/mcp`
- MCP server exposing tools: `audit_contract`, `get_report`, `list_vulnerabilities`, `verify_finding`, `check_bounty`.
- Uses `@modelcontextprotocol/sdk`; can run stdio (for local agents) or SSE (for web).
- **Prompt:** *"Build @swarmproof/mcp: an MCP server (modelcontextprotocol/sdk) exposing audit_contract, get_report, verify_finding, check_bounty tools backed by swarm/consensus/verification/hedera. stdio + SSE transports, zod schemas for all tool inputs."*

### 6.6 `packages/payments`
- Models: `Bounty`, `Escrow`, `Payout`, `Severity → reward` table.
- Hedera HTS integration (via `@swarmproof/hedera`), plus a **pure in-memory ledger** for demo.
- **Prompt:** *"Create @swarmproof/payments: bounty/escrow/payout types, severity reward table, in-memory ledger implementation with the hedera adapter interface. Strict TS."*

### 6.7 `packages/hedera`
- `ConsensusServiceClient` — submit/subscribe topic messages (report anchors).
- `TokenClient` — HTS create/transfer/freeze for bounties.
- Local/`hedera-local-node` dev mode + `MockHederaClient` for tests.
- **Prompt:** *"Implement @swarmproof/hedera: typed clients for Hedera Consensus Service (submit/subscribe reports) and HTS (bounty escrow + payouts), with a MockHederaClient for tests. Strict TS."*

### 6.8 `apps/api`
- Hono app: `POST /audits` (submit), `GET /audits/:id` (report), `GET /audits/:id/stream` (SSE events), `POST /bounties`, `GET /bounties`.
- Kicks off `SwarmRunner` jobs; persists to in-memory/sqlite store.
- **Prompt:** *"Build apps/api (Hono, TypeScript): REST + SSE endpoints to submit contract audits, stream live swarm events, fetch reports, manage bounties. Wire @swarmproof/* packages. Strict TS."*

### 6.9 `apps/web`
- Next.js dashboard: submit form, live swarm visualizer (agent nodes + messages), report view with severity badges, bounty screen.
- Talks to API via typed client; demo-friendly with tailwind.
- **Prompt:** *"Create apps/web (Next.js 15 app router, TS, tailwind): dashboard to submit a contract, live swarm activity stream, audit report view with severity badges and evidence panels, bounty UI."*

### 6.10 `contracts/vulnerable`
- Curated corpus of Solidity contracts with **known, labeled vulnerabilities** (reentrancy, overflow, access control, flash-loan, read-only reentrancy, etc.) — used as the demo corpus AND the truth set for consensus calibration.
- Each contract ships `metadata.json`: list of expected findings + severity (ground truth).
- **Prompt:** *"Write a corpus of 6–8 small deliberately vulnerable Solidity contracts, one per classic bug class (reentrancy, integer overflow, missing access control, unchecked call, price oracle manipulation, signature replay). Include metadata.json with ground-truth findings and severities for grading the swarm."*

### 6.12 `packages/plugins` — Agent Plugin Ecosystem ✅
- **Goal: anyone can plug their own agent into SwarmProof.** A plugin = manifest (id, name, role slot, optional `weight` + `systemPrompt`) + executor.
- Three executor types:
  - `llm` — wrap any `LLMProvider` (OpenAI, Ollama, custom).
  - `http` — POST contract context to any remote agent API, map response → message. *Your agent can live anywhere.*
  - `function` — in-process TS function (thin wrappers / demo agents).
- `AgentRegistry` — register / unregister / list / weights. `SwarmRunner` runs every registered plugin after the built-in phases (phase events `plugin:<id>`); `reachConsensus` accepts per-`agentId` weight overrides.
- Exposed via MCP `list_agents` tool + API `GET /agents`. Example plugins: `keyword-analyzer` (function) and HTTP variant.
- **Prompt (for building a plugin as a third party):** *"Create an AgentPlugin with manifest {id, name, version, description, role: analyzer|exploiter|verifier|judge, weight?} and an executor of type function|http|llm. Return AgentMessage(s) with content, confidence and artifactIds when you find evidence."*

### 6.13 `tests/`
- `consensus.unit.test.ts`, `swarm.e2e.test.ts` (full run against corpus), `mcp.smoke.test.ts`, `hedera.mock.test.ts`.
- Vitest; CI-friendly (all mocks, no network).
- **Prompt:** *"Write vitest suites: unit tests for consensus, e2e for a full swarm audit of contracts/vulnerable corpus using stub LLM + mock verification, and smoke tests for the MCP server."*

## 7. Milestones / Roadmap

| # | Milestone | Deliverable | Done? |
|---|---|---|---|
| M0 | Workspace scaffold | pnpm workspace, tsconfigs, empty packages build | ✅ this session |
| M1 | Corpus + consensus | vulnerable contracts + consensus unit tests green | ⬜ |
| M2 | Agents + swarm with stubs | full pipeline run on one contract, JSON report out | ⬜ |
| M3 | Verification | slither/forge integration, verified artifacts | ⬜ |
| M4 | API + Web | submit → live swarm view → report page | ⬜ |
| M5 | Hedera + payments | anchor report, bounty escrow/payout (mock + local node) | ⬜ |
| M6 | MCP server | audit tools available in any MCP client | ⬜ |
| M7 | Polish | README, demo script, video, live deploy | ⬜ |
| M8 | Agent plugin ecosystem | registry, 3 executor types, weights, MCP/API exposure, example plugins | ✅ core |

## 8. Agent Prompt Templates (the "prompts")

Each role has a system prompt + structured output schema. These are the core **prompts** of the product.

### Analyzer
```
You are a smart-contract security analyst in a swarm audit.
Contract: {source}
Known context: {compiler, framework, prior messages}
Task: List candidate vulnerabilities. For each: location (file:line/function),
category (SWC-style), severity guess (critical/high/medium/low), reasoning
steps, and what evidence would prove it.
Rules: be specific, cite code, no generic advice. Format: JSON per schema.
```

### Exploiter 🥊 (adversarial)
```
You are an adversarial security researcher. Your job is to DISPROVE or PROVE
the other agents' findings by constructing concrete attacks.
Candidate finding: {finding}
Contract: {source}
Task: If the finding is real, describe the exact attack path + a Solidity/HRE
proof-of-concept (calldata, state changes, resulting exploit). If it is NOT
exploitable, explain precisely why (mitigation, invariant, constraint).
Never hand-wave: every claim must trace to code.
```

### Verifier
```
You are an automated verification agent. Reproduce the reported vulnerability
with tooling. Run: solc compile, slither, forge test with the provided PoC,
forked-state check if applicable. Report per-finding: reproduced=true/false,
exact artifact (command, output excerpt, tx trace), adjusted severity.
Output only JSON.
```

### Judge
```
You are the lead judge of the swarm audit. You have: candidate findings,
exploiter arguments, verifier artifacts, and crowd weights.
Deliver: final finding list, per-severity verdict, confidence per finding
(0–100), open disputes, and a 3-line executive summary a founder can act on.
```

## 9. Data Flow & Types (shared surface)

```
AgentMessage { id, runId, role, phase, content, confidence?, artifactIds? }
Finding      { id, title, category, severity, location, evidence[], status }
ConsensusReport { runId, findings[], disputes[], confidenceMap, verdict }
VerificationResult { findingId, reproduced, tool, command, output, artifactUrl }
AuditReport  { runId, contract, consensusReport, verification[], anchorTx }
```

## 10. Risk Register

| Risk | Mitigation |
|---|---|
| LLM hallucination of vulnerabilities | Exploiter adversarial pass + tool verification gate only |
| False positives kill trust | Confidence calibrated vs real corpus (M1) |
| Demo needs to be offline-safe | Stub LLM + mock verifier/hedera behind interfaces |
| Runaway agent costs/time | Per-phase budget, token caps, timeout kill-switch |
| External tools not installed | `verification` degrades to mock with a clear flag |

## 12. Agent Plugin Ecosystem (how anyone plugs in)

A third party contributes an agent in 3 steps:

1. **Write a plugin** — implement `AgentPlugin` (`@swarmproof/plugins`):
   ```ts
   // my-agent.ts
   import { makePluginMessage } from "@swarmproof/plugins";
   export const myAgent = {
     manifest: {
       id: "my-company-auditor", name: "My Auditor", version: "1.0.0",
       description: "Finds X", role: "analyzer", weight: 0.4,
     },
     executor: { type: "http", url: "https://api.mycompany.dev/audit" },
   };
   ```
2. **Register it** — `registry.register(myAgent)` (API/MCP do this at startup).
3. **It runs on every audit** — SwarmRunner invokes it after the built-in phases, its messages become findings when they carry artifacts, and consensus uses its declared weight (fallback = role weight).

Remote `http` agents mean your model can be **anywhere** — your own GPU, your own API, your own fine-tune. The swarm treats all agents equally.

## 13. Demo Script (hackathon)

1. Open web app → "Audit contract" → pick `contracts/vulnerable/ReentrancyVault.sol`.
2. Live swarm panel: watch Analyzer → Exploiter → Verifier → Judge messages stream in.
3. Report page: high-confidence Reentrancy finding with PoC + Slither artifact.
4. "Anchored on Hedera" — show Consensus Service tx + bounty payout line.
5. Open MCP client → call `audit_contract` live. 🎬

---

*Keep this doc updated as plans evolve — the repo structure and prompts are the living source of truth.*