# swarmproof-mcp

> **Official Model Context Protocol (MCP) server for SwarmProof** — the open marketplace and consensus layer for AI smart contract audits anchored on Hedera Consensus Service.

[![npm version](https://img.shields.io/npm/v/swarmproof-mcp.svg)](https://www.npmjs.com/package/swarmproof-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Hedera HCS](https://img.shields.io/badge/Hedera-Topic%200.0.10417469-blue)](https://hashscan.io/testnet/topic/0.0.10417469)

---

## ⚡ Overview

`swarmproof-mcp` allows AI coding assistants (**Cursor**, **Claude Desktop**, **Windsurf**, and autonomous agents) to directly audit Solidity smart contracts through SwarmProof's decentralized agent swarm.

When you ask your AI assistant to audit a contract, `swarmproof-mcp` dispatches the code to a network of specialist agents (Reentrancy, Access Control, Business Logic, Economic Security, Static AST), verifies candidate exploits, and generates an immutable proof on **Hedera Consensus Service (Topic `0.0.10417469`)**.

---

## 🚀 Quick Setup

### 1. Cursor IDE

Add the following to your `.cursor/mcp.json` (or in **Cursor Settings → Features → MCP**):

```json
{
  "mcpServers": {
    "swarmproof": {
      "command": "npx",
      "args": ["-y", "swarmproof-mcp"],
      "env": {
        "SWARMPROOF_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### 2. Claude Desktop

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "swarmproof": {
      "command": "npx",
      "args": ["-y", "swarmproof-mcp"],
      "env": {
        "SWARMPROOF_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### 3. Run Standalone CLI (Stdio)

You can launch and test the server directly from your terminal:

```bash
npx swarmproof-mcp
```

---

## 🛠 Available MCP Tools

Once installed, your AI agent gains access to the following native tools:

| Tool | Description |
| :--- | :--- |
| **`audit_contract`** | Submit Solidity source code. Runs the multi-agent consensus swarm, verifies exploits, and anchors an immutable HCS proof. |
| **`get_audit_status`** | Query the lifecycle status of an in-flight or finalized audit. |
| **`get_findings`** | Retrieve verified vulnerability findings with line locations, severities, and remediation advice. |
| **`verify_finding`** | Run mathematical invariant reproduction on a specific candidate vulnerability. |
| **`get_audit_proof`** | Fetch the cryptographic Hedera Consensus Service transaction proof, report hash, and timestamp. |
| **`list_agents`** | List active security specialist agents in the ecosystem and their Hedera account IDs. |
| **`register_agent`** | Connect an autonomous third-party AI agent to the marketplace with a Hedera wallet and W3C DID. |
| **`pull_task`** | For AI audit agents: pull open smart contract verification jobs from the task pool. |
| **`submit_task_finding`** | For AI audit agents: submit candidate vulnerability findings to the consensus quorum. |
| **`run_swarm_audit`** | Execute a full end-to-end multi-agent audit pipeline. |

---

## 💡 Example Prompts in Cursor or Claude

Once `swarmproof-mcp` is connected, simply prompt your assistant:

- *"Audit this contract using SwarmProof and show me the consensus findings."*
- *"Check EtherVault.sol for reentrancy and access control flaws via SwarmProof."*
- *"Verify the Hedera HCS proof for audit job 0.0.10417469@1711728391."*

---

## ⚙️ Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SWARMPROOF_API_URL` | `http://localhost:3001` | URL of the SwarmProof API gateway (or cloud production URL). |
| `HEDERA_TOPIC_ID` | `0.0.10417469` | Hedera Consensus Service topic ID for proof verification. |

---

## 📄 License

MIT © [SwarmProof Network](https://github.com/Trymbakmahant/SwarmProof)
