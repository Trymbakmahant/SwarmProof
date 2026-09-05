# 🐝 SwarmProof

Decentralized smart-contract auditing powered by a **swarm of AI agents** that collaborate, argue, and reach **consensus** — anchored on **Hedera**.

> 🎯 ETHGlobal Online 2026 · full plans & prompts in **[plan.md](./plan.md)** · corpus: `contracts/vulnerable`

## What it does

1. You submit a contract (source or address).
2. A swarm runs: **Analyzer → Exploiter (adversarial) → Verifier (solc/slither/forge) → Judge**.
3. **Consensus** weights findings by evidence; disputes escalate to a full vote.
4. A JSON report with **reproducible proof** is anchored on Hedera Consensus Service.
5. Bounties are escrowed and paid out by severity (HTS tokens).

## Quickstart

```bash
pnpm install
pnpm build        # compile all packages
pnpm test         # consensus unit + swarm e2e (all mocks, offline-safe)
pnpm dev:api      # API on :3001
pnpm dev:web      # dashboard on :3000
```

## Workspace

| Path | Package | Role |
|---|---|---|
| `apps/api` | `@swarmproof/api` | Hono REST + SSE API |
| `apps/web` | `@swarmproof/web` | Next.js dashboard |
| `packages/agents` | `@swarmproof/agents` | Agent roles, prompts, LLM providers |
| `packages/swarm` | `@swarmproof/swarm` | Swarm orchestration / run loop |
| `packages/consensus` | `@swarmproof/consensus` | Weighted consensus over findings |
| `packages/verification` | `@swarmproof/verification` | solc / slither / forge runner |
| `packages/mcp` | `@swarmproof/mcp` | MCP server exposing audit tools |
| `packages/payments` | `@swarmproof/payments` | Bounties, escrow, payouts |
| `packages/hedera` | `@swarmproof/hedera` | Hedera Consensus Service + HTS |
| `contracts/vulnerable` | `@swarmproof/vulnerable-contracts` | Ground-truth vulnerable corpus |
| `tests` | `@swarmproof/tests` | Unit + e2e suites |

## Roadmap

- [x] **M0** Workspace scaffold
- [ ] **M1** Corpus + consensus calibration
- [ ] **M2** Agents + swarm pipeline with stubs
- [ ] **M3** Tool verification (slither/forge)
- [ ] **M4** API + Web live swarm view
- [ ] **M5** Hedera + payments (local node)
- [ ] **M6** MCP server
- [ ] **M7** Demo polish & deploy

See [plan.md](./plan.md) for architecture, prompts, and the demo script.