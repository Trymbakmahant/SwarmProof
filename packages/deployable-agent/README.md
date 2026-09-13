# @swarmproof/deployable-agent

> **Deployable Autonomous Sovereign Security Agent** for the SwarmProof decentralized smart contract audit network.

This package is a **100% individual, standalone autonomous agent node** with **zero internal workspace dependencies**. It can be deployed directly from this monorepo or exported into its own independent GitHub repository.

---

## 🌟 What This Agent Does
1. **Generates or Connects a Hedera Testnet Wallet** with dedicated private key and account ID.
2. **Performs Cryptographic Registration** against Hedera Consensus Service Topic `0.0.10417469` using ED25519 signature proof.
3. **Receives an Official W3C Decentralized Identifier (DID)** (`did:hedera:testnet:0.0.10417469_<agentId>`).
4. **Hosts an Agent-to-Agent (A2A) JSON-RPC 2.0 API** to receive contracts, perform static AST analysis, and return vulnerability findings with cryptographic signatures.
5. **Collects Direct On-Chain HBAR Micropayments** streamed into its Hedera account upon task consensus settlement.

---

## ⚡ Deployment Options

### Option 1: Deploy to Vercel (Individual Serverless Node)
This package includes a preconfigured [vercel.json](file:///packages/deployable-agent/vercel.json), static dashboard in [public/index.html](file:///packages/deployable-agent/public/index.html), and serverless handler in [api/index.js](file:///packages/deployable-agent/api/index.js).

1. In Vercel Project Settings:
   - **Framework Preset**: Other
   - **Root Directory**: `packages/deployable-agent`
   - **Output Directory**: `public` (handled automatically by `vercel.json`)
   - **Build Command**: `pnpm run build` or `npm run build`
2. Configure Environment Variables (optional, auto-generates if omitted):
   - `SWARMPROOF_API_URL`: Your SwarmProof web/api deployment (e.g. `https://swarm-proof-api.vercel.app`)
   - `AGENT_ID`: Unique ID for your sentinel node (e.g. `my-sentinel-01`)
   - `AGENT_NAME`: Display name (e.g. `Sovereign Reentrancy Sentinel`)
   - `AGENT_ROLE`: Vulnerability specialty (`reentrancy`, `access-control`, `oracle`, `logic`)
   - `HEDERA_ACCOUNT_ID`: (Optional) Existing Hedera account ID.
   - `HEDERA_PRIVATE_KEY`: (Optional) DER private key.

### Option 2: Deploy as a Standalone GitHub Repository
Because this package has zero monorepo couplings, you can push it as its own independent git repository:

```bash
cd packages/deployable-agent
git init
git add .
git commit -m "Initial commit: SwarmProof Autonomous Sentinel"
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git branch -M main
git push -u origin main
```

Then import that standalone repo into Vercel, Railway, Render, or Fly.io!

### Option 3: Run Locally as a CLI Daemon
```bash
# From workspace root
pnpm --filter @swarmproof/deployable-agent start

# Or with custom flags:
pnpm --filter @swarmproof/deployable-agent start -- \
  --id my-sentinel-01 \
  --name "My Sovereign Sentinel" \
  --role reentrancy \
  --port 8200 \
  --api-url https://swarm-proof-api.vercel.app
```

### Option 4: Deploy with Docker
```bash
docker build -t swarmproof-agent .
docker run -p 8200:8200 \
  -e SWARMPROOF_API_URL=https://swarm-proof-api.vercel.app \
  swarmproof-agent
```

---

## 📡 Supported A2A JSON-RPC 2.0 Methods

- **`a2a.health`**: Returns agent operational status, identity, role, and payment address.
- **`a2a.audit`**: Receives Solidity contract source code and parameters, executes domain AST reasoning, and returns candidate vulnerability findings with evidence.
- **`a2a.balance`**: Queries the agent's live on-chain HBAR balance on Hedera testnet.

