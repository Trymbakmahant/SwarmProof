# 🐝 SwarmProof

Decentralized smart-contract auditing powered by a **swarm of AI agents** that collaborate, argue, and reach **consensus** — anchored on **Hedera**.

> 🎯 ETHGlobal Online 2026 · full plans & prompts in **[plan.md](./plan.md)** · corpus: `contracts/vulnerable`

## What it does

1. You submit a contract (source or address).
2. A swarm runs: **Analyzer → Exploiter (adversarial) → Verifier (solc/slither/forge) → Judge**.
3. **Consensus** weights findings by evidence; disputes escalate to a full vote.
4. A JSON report with **reproducible proof** is anchored on Hedera Consensus Service.
5. Bounties are escrowed and paid out by severity (HTS tokens).

## Payments: x402 + Blocky402 (no API keys, no subscriptions)

Every audit is an **x402-gated resource** settled through the **Blocky402 facilitator** on
`hedera:testnet` — an agent pays one exact HBAR (or HTS token) payment, and the swarm runs:

```
POST /audit                          → HTTP 402 + WWW-Authenticate: X402 resource="…"
GET  /x402/audits/:id (Accept: x402+json) → payment quote (exact, tinybars, fee-payer)
sign TransferTransaction (ExactHederaScheme) → Blocky402 /verify + /settle
then replay POST /audit with X-PAYMENT      → 201 auditId — swarm runs → HCS proof
```

- `GET /supported` — service + agent **discovery directory** (x402 capabilities, pricing, agents)
- HCS **payment audit trails** anchored for every settled audit
- **W3C Decentralized Identifiers (`did:hedera`) & Verifiable Credentials** anchored to Hedera HCS Topic
- **HCS-14 agent identity** published per specialist (visible via `GET /agents`, `GET /dids`)
- Settled asset configurable: HBAR (`0.0.0`) or any **HTS token** (`X402_ASSET`)
- Mirror-node verification for direct-transfer payments (no facilitator needed)

## 🆔 W3C Decentralized Identity & Verifiable Credentials (did:hedera)

SwarmProof treats AI auditing agents not as ephemeral database rows, but as **sovereign, cryptographically verifiable autonomous actors**:

1. **W3C `did:hedera` Conformance:**
   Every specialist agent is assigned a W3C-compliant decentralized identifier:
   `did:hedera:testnet:0.0.10417469_<agentId>`
   anchored to the Hedera Consensus Service topic `0.0.10417469`.
2. **W3C DID Core 1.0 Documents (`GET /agents/:id/did`):**
   Exposes canonical JSON-LD DID Documents containing Ed25519 verification methods, `blockchainAccountId` links (`hedera:testnet:<accountId>`), authentication keys, and service endpoints.
3. **W3C Verifiable Credentials (`GET /agents/:id/credential`):**
   Issues cryptographic `SwarmSecurityAuditorCredential` verifiable credentials asserting the agent's audit role, capabilities, and consensus authority, backed by an immutable Hedera consensus timestamp and transaction ID proof.
4. **Interactive W3C DID Explorer & Registration:**
   The Web Dashboard (`apps/web`) features live 3D Orbit agent inspection, instant one-click DID copy, and interactive JSON-LD viewers for both DID Documents and Verifiable Credentials. Anyone can register new specialists dynamically via the UI or `POST /agents/register`.

Offline by default: with no `X402_FACILITATOR_URL` a mock facilitator runs the exact same wire
flow (CI-safe). Go live by adding the env vars — see `.env.example`.

Live demo (needs a funded testnet account):

```bash
pnpm --filter @swarmproof/api x402:live
```

### 🎬 Live Testnet Run (Terminal Output & On-Chain Verification)

Running `pnpm --filter @swarmproof/api x402:live` executes the full autonomous machine-to-machine payment and audit settlement on Hedera Testnet:

```text
🐝 SwarmProof — x402 + Blocky402 live audit demo
────────────────────────────────────────────────

payer: 0.0.10119346 on hedera:testnet
1) POST /audit — expecting HTTP 402 challenge…
   status=402
   WWW-Authenticate: X402 resource="http://localhost:3001/x402/audits/audit_1788849231642_g576ds"

2) GET resource with Accept: application/x402+json — the quote…
| field                  | value                      |
| ---------------------- | -------------------------- |
| scheme                 | exact                      |
| network                | hedera:testnet             |
| amount (tinybars)      | 1000000                    |
| payTo                  | 0.0.10417474               |
| asset                  | 0.0.0                      |
| maxTimeoutSeconds      | 300                        |
| feePayer (facilitator) | 0.0.7162784                |
| auditId                | audit_1788849231642_g576ds |
| expiresAt              | 2026-09-08T06:38:51.643Z   |

   This quote is served by SwarmProof; the amount is the price of ONE audit.

3) Signing payment payload (payer signs a TransferTransaction)…
   payload x402Version=2 scheme=exact accepted.amount=1000000

4) Submitting to Blocky402 facilitator: /verify then /settle…
   verify  → isValid=true payer=0.0.10119346
   settle  → success=true transaction=0.0.7162784@1788849225.803231622

5) Replaying POST /audit with X-PAYMENT header…
   status=201 body={"auditId":"audit_1788849231642_g576ds","status":"running","payment":{"paymentId":"x402-d63c80aa-82e4-48ef-aa1c-f3d6a1330e0f","auditId":"audit_1788849231642_g576ds","status":"paid","paidAmount":"1","paidAt":"2026-09-08T06:33:57.838Z","transactionReference":"0.0.10119346","message":"x402 paid by 0.0.10119346 (1000000 tinybars)"}}
   audit audit_1788849231642_g576ds accepted — swarm running…

6) Polling audit status…
   [done] findings=1 payment=paid

7) HCS proof:
{
  "auditId": "audit_1788849231642_g576ds",
  "reportHash": "1472c9cc972ccbde5e1ea70126595b8d9b6e2972d05d79d5d319e0ad6de2667f",
  "hcsTopicId": "0.0.10417469",
  "transactionId": "0.0.10119346@1788849233.623260124",
  "consensusTimestamp": "2026-09-08T06:34:01.762Z",
  "verified": true
}

✅ End-to-end paid audit complete — no API key, no subscription.
   Hedera transaction: 0.0.7162784@1788849225.803231622
```

#### 🔗 Verified Testnet Explorer Links
- **x402 Settlement Transaction:** [HashScan Transaction 0.0.7162784@1788849225.803231622](https://hashscan.io/testnet/transaction/0.0.7162784@1788849225.803231622) (Settled 0.01 ℏ payment via Blocky402 facilitator)
- **HCS Audit Proof Anchor:** [HashScan Transaction 0.0.10119346@1788849233.623260124](https://hashscan.io/testnet/transaction/0.0.10119346@1788849233.623260124) (Deterministic report hash submitted to topic)
- **HCS Audit Topic:** [HashScan Topic 0.0.10417469](https://hashscan.io/testnet/topic/0.0.10417469)
- **Gateway Payee Account:** [HashScan Account 0.0.10417474](https://hashscan.io/testnet/account/0.0.10417474)

You can also run this interactively in your browser at `http://localhost:3000/x402` (**Payment Lab**).

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
| `packages/plugins` | `@swarmproof/plugins` | **Agent plugin ecosystem** — registry + llm/http/function executors |
| `contracts/vulnerable` | `@swarmproof/vulnerable-contracts` | Ground-truth vulnerable corpus |
| `tests` | `@swarmproof/tests` | Unit + e2e suites |

## Roadmap

- [x] **M0** Workspace scaffold
- [x] **M8** Agent plugin ecosystem — anyone can plug their agent in
- [x] **M9** P0 gateway flow — x402 single payment, 5 parallel specialists, cluster/consensus, verification, HCS proof, MCP thin client
- [x] **P0-A** x402 facilitator wiring — real Blocky402 flow (402 gate, quote, `@x402/hedera` signing, verify/settle, X-PAYMENT), `/supported` discovery, HCS payment trails + HCS-14 identity, mirror-node verification
- [x] **M10** W3C Decentralized Identity (`did:hedera`) & Verifiable Credentials (`SwarmSecurityAuditorCredential`)
- [x] **M4** Live 3D swarm visualizer in web (`Three.js`) with Fullscreen Theater Mode (`F`/`Esc`)
- [ ] **M3** Tool verification (slither/forge)
- [ ] **M6** MCP SDK transport (stdio/SSE)
- [ ] **P1** Scheduled-transaction payouts · payment viz · proof UI
- [ ] **P2** Reputation-weighted voting · marketplace · A2A negotiation · UCP discovery

## 🌌 3D Interactive Swarm Visualizer & Fullscreen Theater

SwarmProof features an interactive **Three.js 3D orbital deck**:
* **Specialist Agent Geometries:** Each specialist agent orbits the consensus core rendered as a distinct 3D mathematical primitive (💎 Octahedron, 🛡️ Dodecahedron, ♾️ Torus Knot, 💠 Icosahedron, ⚙️ Gyroscopic Prism).
* **Real-time Consensus Particle Beams:** Visualizes data packets flowing between agents and the Hedera consensus core during audit phases.
* **Agent Inspector & Live W3C JSON-LD Viewer:** Click any agent in 3D to view its credentials, capabilities, and inspect its live W3C DID Core 1.0 Document & Verifiable Credential directly in the browser.
* **Immersive Fullscreen Mode:** Toggle with one click or press **`F`** / **`Esc`** for a full-screen theater view with adaptive `ResizeObserver` viewport rendering.

## API (P0 flow & W3C DID Services)

```
POST /audit                      → x402 gate (402 + WWW-Authenticate) or run with X-PAYMENT
GET  /x402/audits/:id            → payment quote (application/x402+json) / payment accept
POST /audits/:id/pay {reference} → confirm the ONE job payment → swarm runs
GET  /audits/:id/status          → lifecycle + payment status + HCS payment trail
GET  /audits/:id/findings        → accepted findings + verification
GET  /audits/:id/proof           → HCS anchor {reportHash, hcsTopicId, transactionId, consensusTimestamp, verified}
POST /audits/:id/verify          → reproduce one finding
GET  /agents                     → specialist directory (identities + W3C DIDs + payment addresses)
GET  /agents/:id/did             → W3C DID Core 1.0 Document (application/did+ld+json)
GET  /agents/:id/credential      → W3C Verifiable Credential (application/vc+ld+json)
GET  /dids                      → W3C DID registry index of all active specialists
POST /agents/register            → dynamically register agent + anchor W3C DID & VC on Hedera HCS
GET  /supported                  → x402 discovery: capabilities, services, pricing, agents
```

Env: copy `.env.example` → `.env`. No credentials required locally — mock payment + mock HCS kick in automatically. Set `HEDERA_*` + `X402_*` to go live.

## Bring your own agent (plugin ecosystem)

Anyone can plug their agent into SwarmProof — in-process function, your own LLM, or a **remote HTTP agent** living anywhere:

```ts
import { AgentRegistry, makePluginMessage } from "@swarmproof/plugins";

const myAgent = {
  manifest: {
    id: "my-auditor", name: "My Auditor", version: "1.0.0",
    description: "Finds X", role: "analyzer", weight: 0.4,
  },
  executor: { type: "http", url: "https://api.mycompany.dev/audit" },
};

const registry = new AgentRegistry();
registry.register(myAgent); // now it audits every contract
```

- Executor types: `function` · `http` · `llm`
- Consensus weight per plugin via `manifest.weight` (falls back to role weight)
- Discoverable via API `GET /agents` and MCP `list_agents`
- Built-in demo plugin: `keyword-analyzer` (live in the API)

See [plan.md §12](./plan.md) for the full guide.

See [plan.md](./plan.md) for architecture, prompts, and the demo script.