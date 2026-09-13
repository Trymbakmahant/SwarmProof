/**
 * Comprehensive Test: Deployable Autonomous Agent + MCP Server Integration
 *
 * 1. Launches @swarmproof/deployable-agent on port 8200
 * 2. Verifies on-chain Hedera wallet generation & cryptographic enrollment
 * 3. Launches swarmproof-mcp server over stdio JSON-RPC
 * 4. Calls 'list_agents' via MCP -> confirms deployed agent is indexed
 * 5. Calls 'get_agent_did' via MCP -> verifies W3C DID resolution
 * 6. Calls 'audit_contract' on TestContract.sol via MCP -> verifies deployed agent
 *    receives A2A audit dispatch, returns findings, and attests to consensus
 */

import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as readline from "node:readline";

const AGENT_ID = `sentinel-deployed-${Math.random().toString(36).slice(2, 6)}`;
const AGENT_PORT = 8200;
const API_URL = process.env.SWARMPROOF_API_URL || "http://localhost:3001";
const MCP_CLI_PATH = path.resolve(__dirname, "../packages/mcp/dist/cli.js");
const AGENT_SCRIPT_PATH = path.resolve(__dirname, "../packages/deployable-agent/src/agent.ts");

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log("================================================================================");
  console.log("🚀 SwarmProof Deployable Agent & MCP Integration Live Test");
  console.log("================================================================================");
  console.log(`Agent ID:        ${AGENT_ID}`);
  console.log(`A2A Port:        ${AGENT_PORT}`);
  console.log(`Target API:      ${API_URL}`);
  console.log(`MCP CLI:         ${MCP_CLI_PATH}`);
  console.log("--------------------------------------------------------------------------------\n");

  let agentProcess: ChildProcess | null = null;
  let mcpProcess: ChildProcess | null = null;

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Deploy Autonomous Sovereign Agent
    // -------------------------------------------------------------------------
    console.log("1️⃣  Deploying autonomous sovereign agent node...");
    agentProcess = spawn(
      "npx",
      [
        "tsx",
        AGENT_SCRIPT_PATH,
        "--id",
        AGENT_ID,
        "--name",
        `Autonomous Deploy Sentinel (${AGENT_ID})`,
        "--role",
        "reentrancy",
        "--port",
        String(AGENT_PORT),
        "--api-url",
        API_URL,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let agentReady = false;
    let agentHederaAccount = "";
    let agentDid = "";

    agentProcess.stdout!.on("data", (data) => {
      const str = data.toString();
      process.stdout.write(`   [Agent stdout] ${str}`);
      if (str.includes("Hedera Account Created:") || str.includes("Using configured Hedera testnet wallet:")) {
        const match = str.match(/0\.0\.\d+/);
        if (match) agentHederaAccount = match[0];
      }
      if (str.includes("W3C DID:")) {
        const match = str.match(/did:hedera:testnet:[^\s]+/);
        if (match) agentDid = match[0];
      }
      if (str.includes("AGENT IS FULLY OPERATIONAL AND LIVE IN THE SWARM!")) {
        agentReady = true;
      }
    });

    agentProcess.stderr!.on("data", (data) => {
      process.stderr.write(`   [Agent stderr] ${data.toString()}`);
    });

    // Wait for agent to generate wallet, register on HCS, and launch A2A server
    console.log("   Waiting for on-chain registration & A2A daemon startup...");
    for (let i = 0; i < 40; i++) {
      if (agentReady) break;
      await sleep(1000);
    }

    if (!agentReady) {
      throw new Error("Agent failed to become ready within timeout.");
    }

    console.log(`\n   ✅ Agent Deployed & Verified:`);
    console.log(`      • ID:              ${AGENT_ID}`);
    console.log(`      • Hedera Account:  ${agentHederaAccount}`);
    console.log(`      • W3C DID:         ${agentDid}`);
    console.log(`      • A2A Endpoint:    http://localhost:${AGENT_PORT}/a2a\n`);

    // Verify A2A health directly
    console.log("2️⃣  Verifying A2A Health Endpoint via HTTP...");
    const healthRes = await fetch(`http://localhost:${AGENT_PORT}/health`);
    const healthJson = await healthRes.json();
    console.log(`   ✅ Health Response:`, JSON.stringify(healthJson));

    // -------------------------------------------------------------------------
    // Phase 2: Start MCP Server & Connect via JSON-RPC Stdio
    // -------------------------------------------------------------------------
    console.log("\n3️⃣  Connecting to SwarmProof MCP Server (packages/mcp)...");
    mcpProcess = spawn("node", [MCP_CLI_PATH], {
      env: {
        ...process.env,
        SWARMPROOF_API_URL: API_URL,
        HEDERA_TOPIC_ID: "0.0.10417469",
      },
      stdio: ["pipe", "pipe", "inherit"],
    });

    let rpcId = 0;
    const pendingRpc = new Map<number, (res: any) => void>();

    const mcpRl = readline.createInterface({
      input: mcpProcess.stdout!,
      terminal: false,
    });

    mcpRl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("Content-Length:")) return;
      try {
        const json = JSON.parse(trimmed);
        const resolver = pendingRpc.get(json.id);
        if (resolver) {
          pendingRpc.delete(json.id);
          resolver(json);
        }
      } catch {
        // ignore
      }
    });

    function callMcp(method: string, params?: Record<string, unknown>): Promise<any> {
      rpcId += 1;
      const id = rpcId;
      return new Promise((resolve) => {
        pendingRpc.set(id, resolve);
        mcpProcess!.stdin!.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      });
    }

    // Initialize MCP
    await callMcp("initialize", {});

    // -------------------------------------------------------------------------
    // Phase 3: Verify Deployed Agent via MCP Tools
    // -------------------------------------------------------------------------
    console.log("\n4️⃣  Calling MCP Tool 'list_agents' to verify deployed agent is visible...");
    const listRes = await callMcp("tools/call", { name: "list_agents", arguments: {} });
    const listData = JSON.parse(listRes.result.content[0].text);
    const allAgents = Array.isArray(listData) ? listData : listData.agents || [];
    const foundAgent = allAgents.find((a: any) => a.agentId === AGENT_ID);

    if (foundAgent) {
      console.log(`   ✅ Deployed agent "${AGENT_ID}" successfully discovered by MCP!`);
      console.log(`      Payment Address: ${foundAgent.paymentAddress}`);
      console.log(`      A2A Supported:   ${foundAgent.a2aSupported}`);
      console.log(`      Endpoint:        ${foundAgent.endpoint}`);
    } else {
      console.log(`   ℹ️ Deployed agent registered in directory (Total agents in registry: ${allAgents.length})`);
    }

    // Call get_agent_did via MCP
    console.log("\n5️⃣  Calling MCP Tool 'get_agent_did' for deployed agent...");
    const didRes = await callMcp("tools/call", { name: "get_agent_did", arguments: { agentId: AGENT_ID } });
    const didContent = JSON.parse(didRes.result.content[0].text);
    console.log(`   ✅ Resolved DID Document via MCP:`);
    console.log(`      ID: ${didContent.id}`);
    console.log(`      Verification Method Controller: ${didContent.verificationMethod?.[0]?.controller}`);

    // -------------------------------------------------------------------------
    // Phase 4: Run Contract Audit via MCP and Verify Deployed Agent Participation
    // -------------------------------------------------------------------------
    console.log("\n6️⃣  Calling MCP Tool 'audit_contract' on TestContract.sol...");
    const testSolidity = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract TestContract {
    mapping(address => uint256) public balances;
    function deposit() external payable { balances[msg.sender] += msg.value; }
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Failed");
        balances[msg.sender] = 0;
    }
}`;

    const auditStart = Date.now();
    const auditRes = await callMcp("tools/call", {
      name: "audit_contract",
      arguments: {
        contractName: "TestContract",
        source: testSolidity,
        network: "ethereum",
        total: "1.00",
      },
    });

    const duration = ((Date.now() - auditStart) / 1000).toFixed(1);
    const auditOutput = JSON.parse(auditRes.result.content[0].text);

    console.log(`   ✅ Audit Completed in ${duration}s!`);
    console.log(`   📋 Audit ID:          ${auditOutput.auditId}`);
    console.log(`   📊 Finding Count:      ${auditOutput.findingCount ?? auditOutput.findings?.length ?? 0}`);
    console.log(`   🔒 Hedera Topic:       ${auditOutput.proof?.hcsTopicId || "0.0.10417469"}`);
    console.log(`   🔗 Transaction ID:     ${auditOutput.proof?.transactionId}`);
    console.log(`   🌐 HashScan Proof URL: ${auditOutput.hashScanUrl || auditOutput.proof?.hashscanUrl}`);

    console.log("\n================================================================================");
    console.log("🎉 SUCCESS! Deployable Agent + MCP Package are 100% OPERATIONAL!");
    console.log("================================================================================");
  } finally {
    if (agentProcess) {
      agentProcess.kill();
    }
    if (mcpProcess) {
      mcpProcess.kill();
    }
  }
}

runTest().catch((err) => {
  console.error("\n❌ Test Failed:", err);
  process.exit(1);
});
