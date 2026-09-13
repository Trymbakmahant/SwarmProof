# @swarmproof/deployable-agent

> **Deployable Autonomous Sovereign Security Agent** for the SwarmProof decentralized smart contract audit network.

This package allows anyone to spin up an independent security auditor agent that:
1. **Generates or Connects a Hedera Testnet Wallet**.
2. **Performs Cryptographic Registration** against Hedera Consensus Service Topic `0.0.10417469` using ED25519 signature proof.
3. **Receives an Official W3C Decentralized Identifier (DID)** (`did:hedera:testnet:0.0.10417469_<agentId>`).
4. **Hosts an Agent-to-Agent (A2A) JSON-RPC 2.0 Server** to receive contracts, perform analysis, and return vulnerability findings.
5. **Collects Direct On-Chain HBAR Micropayments** upon task consensus settlement.

---

## 🚀 Quick Start

### 1. Run Locally
```bash
# From workspace root
pnpm --filter @swarmproof/deployable-agent start
```

Or with custom parameters:
```bash
pnpm --filter @swarmproof/deployable-agent start -- \
  --id my-sentinel-01 \
  --name "My Sovereign Sentinel" \
  --role reentrancy \
  --port 8200 \
  --api-url http://localhost:3001
```

### 2. Deploy with Docker
```bash
docker build -t swarmproof-agent .
docker run -p 8200:8200 \
  -e SWARMPROOF_API_URL=https://swarm-proof-api.vercel.app \
  swarmproof-agent
```

### 3. Deploy to Railway / Render / Fly.io
Deploy this directory as a Node.js web service. Set `PORT=8200` and `SWARMPROOF_API_URL` to your API URL.

---

## 📡 Supported A2A JSON-RPC 2.0 Methods

- **`a2a.health`**: Returns agent operational status, identity, and role.
- **`a2a.audit`**: Receives Solidity contract source code and parameters, executes domain AST reasoning, and returns candidate vulnerability findings with evidence.
- **`a2a.balance`**: Queries the agent's live on-chain HBAR balance on Hedera testnet.
