# 🐝 SwarmProof — understandV1

A plain-English walkthrough of what this codebase actually does, how it's wired together, and where the real logic lives vs. where things are stubbed for the demo.

> Companion to [plan.md](./plan.md) (the *what we want to build*) — this doc is the *what's actually in the code today*.

---

## 1. TL;DR

- **SwarmProof** = a smart-contract auditing platform where a **swarm of 4 AI agent roles** (Analyzer → Exploiter → Verifier → Judge) examine a Solidity contract, produce candidate findings, and **vote/consensus** decides which findings are real.
- Today the repo is a **working skeleton (M0 done)** : every package exists, every interface is defined, all tests pass — **but every heavyweight dependency is a mock**:
  - the LLM is a `StubProvider` (returns deterministic text, no real AI),
  - verification is a `MockVerifier` (regex on file names),
  - Hedera is in-memory, payments are in-memory,
  - MCP is a tool registry without a real transport.
- The important thing: **the architecture and data contracts are real and enforced by TypeScript** — swap the mocks for real implementations and the rest of the system should keep working.

---

## 2. Big Picture

```
 web dashboard (Next.js)  ──POST /audits──▶  api (Hono)  ──stores──▶ audits Map
                                               │
                                               ▼
                                        SwarmRunner
        ┌──────────────┬───────────────┬───────────────┬──────────────┐
        ▼              ▼               ▼               ▼
     analyzer        exploiter       verifier        judge
     (LLM call)      (LLM call)      (LLM call)      (LLM call)     ◀─ StubProvider today
        │              │               │               │
        └──────────────┴───────┬───────┴───────────────┘
                               ▼
                        reachConsensus()          ◀─ weighted voting
                               ▼
                      ConsensusReport            ◀─ stored, returned to web
                               ▼
             (future M5) hedera anchor + bounty payout
```

The 4 "agents" are currently **the same stub provider called 4 times with different role prompts** — they don't yet talk to each other. The message-passing plumbing (events, context passing) is built; the multi-agent conversation is M2 work.

---

## 3. Repo Map

| Path | Package | What it really does today |
|---|---|---|
| `apps/api/src/index.ts` | `@swarmproof/api` | Hono REST server on :3001 — the only running process |
| `apps/web/` | `@swarmproof/web` | Next.js 15 dashboard — form → submit → poll → show JSON report |
| `packages/agents/src/index.ts` | `@swarmproof/agents` | **Shared types** (every package depends on this) + LLM provider interface + role prompts + stub provider |
| `packages/swarm/src/index.ts` | `@swarmproof/swarm` | `SwarmRunner` — the orchestration loop |
| `packages/consensus/src/index.ts` | `@swarmproof/consensus` | `reachConsensus()` — the voting math (pure functions) |
| `packages/verification/src/index.ts` | `@swarmproof/verification` | Verifier interface + mock (real solc/slither/forge = M3 TODO) |
| `packages/hedera/src/index.ts` | `@swarmproof/hedera` | Hedera interface + mock (real SDK = M5 TODO) |
| `packages/payments/src/index.ts` | `@swarmproof/payments` | Bounty ledger (in-memory) + severity payout table |
| `packages/mcp/src/index.ts` | `@swarmproof/mcp` | MCP tool registry (no SDK transport yet = M6 TODO) |
| `contracts/vulnerable/*.sol` | — | 3 deliberately vulnerable contracts + `metadata.json` ground truth |
| `tests/*.test.ts` | `@swarmproof/tests` | 9 vitest tests, all green, no network needed |
| `plan.md` / `README.md` / `tsconfig.base.json` / `vitest.config.ts` | — | docs + tooling |

---

## 4. The Shared Type Surface (the language of the system)

Defined in `packages/agents/src/index.ts` via zod — every other package imports these:

| Type | Meaning |
|---|---|
| `AgentRole` | `"analyzer" \| "exploiter" \| "verifier" \| "judge"` |
| `Severity` | `"critical" \| "high" \| "medium" \| "low" \| "info"` |
| `AgentPhase` | `"queued" \| "analyzing" \| "exploiting" \| "verifying" \| "judging" \| "done" \| "failed"` |
| `Finding` | one suspected vulnerability `{ id, title, category, severity, location, evidence[], status }` — `status` ∈ proposed/contested/verified/rejected |
| `AgentMessage` | one agent's output `{ id, runId, role, phase, content, confidence?, artifactIds? }` |
| `AgentConfig` | per-role LLM settings `{ model, temperature, maxTokens, budget }` — **`budget` is declared but never enforced** (cost control is planned) |
| `LLMProvider` | `complete(system, messages, config) → Promise<string>` — the single seam where real AI plugs in |

**`ROLE_PROMPTS`** — the system prompts (analyzer/exploiter/verifier/judge) are already written here and used by `SwarmRunner`'s default phase executor. These are the *prompts* the product ships with.

---

## 5. Package by Package — what the code actually does

### 5.1 `@swarmproof/agents` — types + the LLM seam
- **`LLMProvider` interface** — the whole system is driven through this one method. Three implementations are planned (OpenAI, Ollama, stub); **only the stub exists**.
- **`StubProvider`** — deterministic. It echoes back a string like `[stub:stub] system=189 chars; last=Contract: ReentrancyVault...`. It never looks at the contract. This is what makes tests and the demo offline-safe — but **no real analysis happens yet**.
- **`DEFAULT_AGENT_CONFIGS`** — all 4 roles default to the stub model with `temperature: 0`.

### 5.2 `@swarmproof/swarm` — the conductor
- **`SwarmRunner`** holds [`EventEmitter`]((node:events)) and a `run(input)` method.
- `run()` iterates `PHASE_ORDER = [analyzer, exploiter, verifier, judge]`. For each role:
  1. emits `phase(role, "start")`,
  2. calls the **phase hook** (default: one `provider.complete()` call with `ROLE_PROMPTS[role]` as system + contract source as user message),
  3. emits a `message` event for each returned `AgentMessage`,
  4. **derives a `Finding`** from any message that has `artifactIds` set + a confidence — ⚠️ *see gotcha #1*,
  5. emits `phase(role, "end")`.
- Builds a `{ runId, findings }` result, emits `done`.
- **Hooks injection** — you can pass a custom `SwarmHooks.runPhase` to replace how a phase executes (this is how the real multi-agent conversation / tool-use will slot in during M2).
- No retries, no budgets, no parallel agents — all planned, none implemented.

### 5.3 `@swarmproof/consensus` — the voting math ✅ (most "real" package)
Pure, unit-tested functions. `reachConsensus(runId, candidates, config?)`:

```
score(finding) = Σ over evidence items: roleWeight × confidence × artifactWeight

roleWeight:  analyzer 0.30 | exploiter 0.35 | verifier 1.00 | judge 0.40
(verifier dominates because a tool-reproduced finding is the strongest proof)

verdict:
  - rejected        if the exploitER said artifactWeight=0 (disproved)
  - rejected        if score < minScore (0.6) OR quorum (<2 distinct roles) not met
  - disputed        if high/critical AND quorum not met  (needs a full swarm vote, M2)
  - accepted        otherwise

confidence = min(1, score / minScore)
```

- `ConsensusReport` = accepted findings + disputes + a `confidenceMap` + a one-line `summary`.
- 4 unit tests cover: accept-verified, exploit-rejected, dispute-on-low-quorum, sanity of weights.

### 5.4 `@swarmproof/verification` — tool runner seam
- `VerificationEngine.verify(req) → VerificationResult { reproduced, command, outputExcerpt, ... }`.
- **`MockVerifier`** — "reproduces" a finding if `tool === "mock"` or the contract path matches `/reentrancy|overflow|access/i`. Demo-only.
- **`ToolVerifier`** — exists but **throws** ("M3 not wired"); the real slither/solc/forge executors replace this later.
- `createVerifier("mock" | "tool")` factory.

### 5.5 `@swarmproof/hedera` — L1 anchor seam
- `HederaClient` interface: **Consensus Service** (`submitReport`, `subscribeTopic`) + **HTS tokens** (`escrow`, `payout`).
- **`MockHederaClient`** — stores nothing, fabricates a `contentHash` as `sha256:<b64-ish>` (⚠️ it's a truncated base64, not a real hash — cosmetic only) and returns a timestamp. `network: "mock"`.
- Real `@hashgraph/sdk` wiring = M5.

### 5.6 `@swarmproof/payments` — bounty ledger
- `Bounty { id, contractName, tokenId, payer, createdAt, status }`, status ∈ escrowed/paid/refunded.
- **`DEFAULT_SCHEDULE`** — severity → reward: critical 5000, high 2000, medium 500, low 100, info 0.
- **`MemoryLedger`** — `Map<string, Bounty>`, delegates token moves to the injected `HederaClient`. `payout()` marks the bounty `paid`.

### 5.7 `@swarmproof/mcp` — MCP tool registry
- `MCPTool` interface `{ name, description, inputSchema, run }` — **JSON-Schema-shaped, but not a real MCP server yet** (no `@modelcontextprotocol/sdk`, no transports).
- 4 tools: `audit_contract`, `get_report`, `verify_finding`, `check_bounty` — each just calls into swarm/verification/payments.
- Note: `audit_contract` runs a swarm with `agents: {}` (defaults) and stores **nothing** — `get_report` only finds reports that someone manually put in the `reports` map.

### 5.8 `apps/api` — the one thing you can actually run
- In-memory `audits` + `reports` maps (no persistence).
- On `POST /audits`: creates `audit-<timestamp>`, builds a fresh `SwarmRunner`, runs it **in the background** (fire-and-forget `.then()` — get a `202 queued` immediately). On `done`, it calls `reachConsensus` with **hardcoded evidence** for every finding (verifier@0.9 + analyzer@0.7, both `artifactWeight: 1`) — so **every finding gets accepted** in the live demo (see gotcha #2).
- `GET /audits/:id` — returns the record; web app polls this until `status === "done"`.
- `GET /audits/:id/stream` — SSE, but **creates a brand-new runner** and runs a mini-audit with placeholder source; it does not stream the in-flight audit. Real streaming store = M4.
- `POST/GET /bounties` — wraps `MemoryLedger`.

### 5.9 `apps/web` — the dashboard
- One page: textarea pre-filled with a **reentrancy demo contract**, "Run swarm audit" button.
- Polls the API every second (max 60s) → renders the raw `report` JSON in a dark `<pre>`.
- No severity badges, no live swarm visualizer yet (M4).

### 5.10 `contracts/vulnerable` — the demo corpus
- `ReentrancyVault.sol` — genuine classic reentrancy (external call before state update). Ground truth: critical. ✅
- `AccessControlAdmin.sol` — missing access control on `setAdmin`/`withdrawAll`. Ground truth: high. ✅
- `OverflowAuction.sol` — **fact-check needed**: header claims "integer underflow in 0.8 requires `unchecked`" but the code has no `unchecked` block — under `^0.8.20` arithmetic reverts by default, so the described bug class wouldn't fire as-written. Fine as demo material, but the ground-truth comments may mislead the consensus calibration in M1.
- `metadata.json` — ground truth `{ category, severity, location }` per contract; used to grade the swarm (M1).

### 5.11 `tests/` — 9 tests, all green, all offline
- `consensus.unit.test.ts` (4) — pure consensus logic.
- `swarm.e2e.test.ts` (5) — full swarm run with stub, mock verifier reproduce, mock hedera anchor, payment schedule, MCP registry shape.

---

## 6. Walking one request end-to-end (what actually happens)

1. Web form POSTs `{ contractName: "Vault", source: "<solidity>" }` → `apps/api POST /audits`.
2. API creates record `status: "queued"`, spawns `SwarmRunner` async.
3. `SwarmRunner.run()` loops 4 roles; each calls `StubProvider.complete(...)` with the role's system prompt + the source text; stub returns a metadata string (analysis is fake).
4. Each stub message has `artifactIds: []` (truthy!) + `confidence: 0.5` → **each creates a `Finding`** titled "Candidate from X" with `severity: "medium"` (the severity is never reasoned — it's hardcoded).
5. On `done`, API builds evidence `[verfier 0.9×1.0, analyzer 0.7×1.0]` for **every** finding → `reachConsensus` score = 0.9×1.0×1 + 0.7×0.3×1 = 1.11 ≥ 0.6, quorum 2/2 → **accepted** (always).
6. `reports` map updated; audit record flips `status: "done"` with the report.
7. Web poll sees `done`, renders the report — which will contain one accepted finding per role (analyzer/exploiter/verifier/judge), all severity "medium", none of it grounded in the actual contract.

So the live demo **exercises the full pipeline shape but produces semantically empty results** — the swarm "works" mechanically. That's exactly what M2 (red agents + real conversation + real finding parsing) fixes.

---

## 7. What's Real vs Placeholder (honest status)

| Area | Status |
|---|---|
| Types & zod schemas | ✅ real |
| Consensus math | ✅ real & tested |
| Swarm orchestration loop (sequential phases, events) | ✅ real shape, 🕐 no parallel/retry/budget |
| LLM | 🕐 `StubProvider` only (OpenAI/Ollama = M2) |
| Finding extraction from LLM output | ❌ none — stub derives mechanical "Candidate from X" |
| Verification | ❌ mock only (solc/slither/forge = M3) |
| Hedera anchor + tokens | ❌ mock only (SDK = M5) |
| Payments ledger | 🕐 real in-memory, hedera adapter mocked |
| MCP server | ❌ registry only, no SDK transport (M6) |
| API persistence | ❌ in-memory Maps, restarts lose everything |
| SSE live stream | ❌ runs a fresh mini-audit, doesn't stream the real one (M4) |
| Web UI | ⚫ basic form + JSON viewer (M4) |
| Corpus | ⚫ 3 contracts, 1 has misleading ground truth |

---

## 8. Gotchas & TODO notes baked into the code

1. **Empty array is truthy**: `if (msg.artifactIds && ...)` in `SwarmRunner` treats `[]` as present → every phase produces a fake finding. The check should probably be `msg.artifactIds.length > 0`.
2. **API fabricates evidence**: consensus is run against hardcoded evidence arrays, so the live API always "accepts" everything. Once real findings/evidence exist, this block goes away.
3. **`budget` / tokens / retries are declarative only** — `AgentConfig.budget`, `maxTokens`, `temperature` are never enforced anywhere today.
4. **Two "todo" seams are marked in code**: `apps/api` SSE `NOTE: M4 wires a real in-flight runner store`; `verification` `ToolVerifier ... M3`.
5. **`hedera` mock hash is fake**: `sha256:<base64 slice>` is cosmetic; fine for sequence tests, must be a real hash before anchoring real reports.
6. **MCP `audit_contract` doesn't persist** — `get_report` will return `undefined` for anything audited via the tool unless manually stored.
7. **`tsconfig.paths` were removed** — packages resolve each other through built `dist/` artifacts (via `exports` in each package.json). So **package A changes require rebuilding A before B sees them**; `pnpm -r build` respects topo-logical order.
8. **Web polls, doesn't SSE** — 60×1s loop; long audits timeout the UI poll loop (the API run on in background continues, but UI gives up).

---

## 9. How to run

```bash
pnpm install
pnpm build          # topological: agents → swarm… → api/web
pnpm test           # all mocks, offline
pnpm dev:api       # Hono on http://localhost:3001
pnpm dev:web       # dashboard on http://localhost:3000  (set NEXT_PUBLIC_API_BASE if needed)
```

Smoke test the API alone:
```bash
curl -s -X POST localhost:3001/audits -H 'content-type: application/json' \
  -d '{"contractName":"Vault","source":"contract Vault {}"}'
# → {"id":"audit-...","status":"queued"}  wait ~1s, then:
curl -s localhost:3001/audits/<id>   # → status "done" + report
```

---

## 10. Alignment with plan.md roadmap

| Milestone | plan.md status | code reality |
|---|---|---|
| M0 Workspace scaffold | ✅ | ✅ done — everything builds & tests green |
| M1 Corpus + consensus | 🕐 | consensus math + tests done; corpus needs fact-check (`OverflowAuction`) |
| M2 Agents + swarm with stubs | 🕐 | runner + prompts exist; real LLM providers & finding parsing missing |
| M3 Verification | 🕐 | interface + mock; tools throw |
| M4 API + Web | 🕐 | REST + polling page work; SSE store & live viz missing |
| M5 Hedera + payments | 🕐 | interfaces + in-memory impls; SDK missing |
| M6 MCP | 🕐 | tool registry; SDK transport missing |
| M7 Polish | ⬜ | — |

---

## 11. In one paragraph

This is a **well-factored, fully-typed, mock-baked skeleton** of a multi-agent audit platform: the hard architectural decisions (shared zod types, an LLM-provider seam, a strict role/phase orchestration loop, weighted-consensus math, verifier/Hedera/payment adapter interfaces) are made and enforced by the compiler, and the whole thing runs end-to-end offline. What's missing is *the intelligence*: real model calls (M2), real slither/forge verification (M3), a real Hedera anchor (M5), and a real MCP transport (M6) — each slots behind an existing interface without rewiring the rest.

*If you're onboarding: start with `packages/agents/src/index.ts` (types + seam), then `packages/swarm/src/index.ts` (orchestration), then `packages/consensus/src/index.ts` (the only real algorithm), then `apps/api/src/index.ts` (how it all gets exposed).*