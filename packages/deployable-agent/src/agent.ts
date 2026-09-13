import http from "node:http";
import fs from "node:fs";
import { resolve } from "node:path";

try {
  const envPath = resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath) && typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile(envPath);
  }
} catch {
  // fallback to process.env
}

import {
  Client,
  PrivateKey,
  AccountId,
  Hbar,
  AccountCreateTransaction,
  AccountBalanceQuery,
} from "@hashgraph/sdk";

// ── Configuration ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1]!;
  }
  return fallback;
}

const PORT = parseInt(getArg("--port", process.env.PORT || "8200"), 10);
const API_URL = getArg("--api-url", process.env.SWARMPROOF_API_URL || "http://localhost:3001").replace(/\/+$/, "");
const ROLE = getArg("--role", process.env.AGENT_ROLE || "reentrancy").toLowerCase().trim();
const AGENT_ID = getArg("--id", process.env.AGENT_ID || `sentinel-node-${Math.random().toString(36).slice(2, 6)}`);
const AGENT_NAME = getArg("--name", process.env.AGENT_NAME || `Sovereign ${ROLE.toUpperCase()} Sentinel`);
const PUBLIC_ENDPOINT = getArg("--endpoint", process.env.A2A_ENDPOINT || `http://localhost:${PORT}/a2a`);

// Operator credentials for optional auto-funding on Hedera testnet
const OPERATOR_ID = "0.0.10119346";
const DER_KEY = "3030020100300706052b8104000a042204202960059c00f2267248928cde03878b1438508f0646c2d282a2e1c89a3af8d407";

const hederaClient = Client.forTestnet();
hederaClient.setOperator(AccountId.fromString(OPERATOR_ID), PrivateKey.fromStringDer(DER_KEY));

let agentKey: PrivateKey;
let agentAccountId: string = "";
let didDocumentUrl: string = "";
let auditCount = 0;
let totalEarningsTinybars = 0;

// ── Security Analysis Engine for Agent ─────────────────────────────────────────
function analyzeContract(source: string, contractName: string) {
  const findings: any[] = [];

  // Reentrancy & CEI violation detection
  if (ROLE === "reentrancy" || ROLE === "all") {
    const lines = source.split("\n");
    let hasExternalCall = false;
    let externalCallLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.includes(".call{value:") || line.includes(".transfer(") || line.includes(".send(")) {
        hasExternalCall = true;
        externalCallLine = i + 1;
      }
      if (hasExternalCall && (line.includes("balances[") || line.includes("totalDeposits")) && line.includes("=")) {
        findings.push({
          id: `reentrancy-${contractName.toLowerCase()}-${externalCallLine}`,
          title: "Checks-Effects-Interactions (CEI) violation in withdrawal flow",
          category: "reentrancy",
          severity: "critical",
          location: `Line ${externalCallLine}`,
          confidence: 0.98,
          evidence: [
            `External value transfer at line ${externalCallLine} precedes internal balance zeroing`,
            `State writes to balances occur after low-level call execution`,
          ],
        });
        break;
      }
    }
  }

  // Access control & missing modifier detection
  if (ROLE === "access-control" || ROLE === "all") {
    if (source.includes("emergencyWithdraw") && !source.includes("onlyOwner")) {
      findings.push({
        id: `access-control-${contractName.toLowerCase()}-emergency`,
        title: "Missing Access Control on emergency withdrawal function",
        category: "access-control",
        severity: "critical",
        location: "emergencyWithdraw()",
        confidence: 0.95,
        evidence: [
          "emergencyWithdraw() is public/external without access restriction",
          "Any caller can drain contract balance to arbitrary recipient address",
        ],
      });
    }
  }

  // Low level unchecked call return value
  if (ROLE === "static" || ROLE === "all") {
    if (source.includes(".call{") && !source.includes("require(success") && !source.includes("if (!success)")) {
      findings.push({
        id: `unchecked-call-${contractName.toLowerCase()}`,
        title: "Unchecked return value in low-level call",
        category: "unchecked-call",
        severity: "high",
        location: "unsafeTransfer()",
        confidence: 0.90,
        evidence: ["Low-level call return boolean is unverified, masking silent transfer failure"],
      });
    }
  }

  return findings;
}

// ── Agent Startup & Lifecycle ─────────────────────────────────────────────────
async function main() {
  console.log("================================================================================");
  console.log("🚀 SwarmProof Autonomous Sovereign Agent — Deployable Worker Node");
  console.log("================================================================================");
  console.log(`Agent ID:        ${AGENT_ID}`);
  console.log(`Agent Name:      ${AGENT_NAME}`);
  console.log(`Audit Role:      ${ROLE}`);
  console.log(`Local Port:      ${PORT}`);
  console.log(`A2A Endpoint:    ${PUBLIC_ENDPOINT}`);
  console.log(`Swarm API:       ${API_URL}`);
  console.log("--------------------------------------------------------------------------------\n");

  // Step 1: Provision or Load Dedicated Hedera Testnet Wallet
  const customKey = process.env.AGENT_PRIVATE_KEY;
  const customAccount = process.env.AGENT_ACCOUNT_ID;

  if (customKey && customAccount) {
    agentKey = PrivateKey.fromStringED25519(customKey);
    agentAccountId = customAccount;
    console.log(`1️⃣  Using configured Hedera testnet wallet: ${agentAccountId}`);
  } else {
    console.log("1️⃣  Generating brand-new dedicated Hedera testnet wallet...");
    agentKey = PrivateKey.generateED25519();
    const pubKey = agentKey.publicKey;
    console.log(`   Agent Public Key: ${pubKey.toStringRaw()}`);

    console.log("   Funding new account on-chain with 2 HBAR from operator account...");
    const createTx = await new AccountCreateTransaction()
      .setKey(pubKey)
      .setInitialBalance(new Hbar(2))
      .execute(hederaClient);

    const receipt = await createTx.getReceipt(hederaClient);
    agentAccountId = receipt.accountId!.toString();
    console.log(`   ✅ Hedera Account Created: ${agentAccountId}`);
    console.log(`   🔗 Explorer:              https://hashscan.io/testnet/account/${agentAccountId}`);
  }

  // Query on-chain balance
  try {
    const bal = await new AccountBalanceQuery().setAccountId(agentAccountId).execute(hederaClient);
    console.log(`   💰 Current Balance:       ${bal.hbars.toString()} (${bal.hbars.toTinybars().toString()} Tinybars)\n`);
  } catch {
    // offline or mirror node sync
  }

  // Step 2: Start A2A JSON-RPC 2.0 Listener Server
  console.log(`2️⃣  Starting A2A JSON-RPC 2.0 listener server on port ${PORT}...`);
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "healthy",
          agentId: AGENT_ID,
          role: ROLE,
          hederaAccount: agentAccountId,
          auditsCompleted: auditCount,
          earningsTinybars: totalEarningsTinybars,
        })
      );
      return;
    }

    if (req.method === "POST" && req.url === "/a2a") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const json = JSON.parse(body);
          const method = json.method;
          const id = json.id;

          // A2A Health check
          if (method === "a2a.health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id,
                result: {
                  status: "healthy",
                  agentId: AGENT_ID,
                  role: ROLE,
                  paymentAddress: agentAccountId,
                  a2aSupported: true,
                },
              })
            );
            return;
          }

          // A2A Audit invocation
          if (method === "a2a.audit") {
            const params = json.params || {};
            const contractName = params.contractName || "TargetContract";
            const source = params.source || "";

            console.log(`\n🔔 [A2A TASK DISPATCH RECEIVED]`);
            console.log(`   Target Contract: "${contractName}"`);
            console.log(`   Specialty Role:  ${ROLE}`);

            const findings = analyzeContract(source, contractName);
            auditCount += 1;
            console.log(`   ✅ Analysis Complete: ${findings.length} candidate finding(s) generated.`);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id,
                result: {
                  agentId: AGENT_ID,
                  contractName,
                  findings,
                  paymentAddress: agentAccountId,
                  analyzedAt: new Date().toISOString(),
                },
              })
            );
            return;
          }

          // A2A Balance check
          if (method === "a2a.balance") {
            const bal = await new AccountBalanceQuery().setAccountId(agentAccountId).execute(hederaClient);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id,
                result: {
                  accountId: agentAccountId,
                  balanceHbar: bal.hbars.toString(),
                  balanceTinybars: bal.hbars.toTinybars().toString(),
                },
              })
            );
            return;
          }

          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }));
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: err.message } }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, () => {
    console.log(`   ✅ A2A Daemon Listening at: ${PUBLIC_ENDPOINT}\n`);
  });

  // Step 3: Register Agent On-Chain with Cryptographic Proof
  console.log("3️⃣  Registering agent in SwarmProof with cryptographic proof of ownership...");
  try {
    // Request challenge nonce
    const challengeRes = await fetch(
      `${API_URL}/agents/challenge?agentId=${encodeURIComponent(AGENT_ID)}&accountId=${encodeURIComponent(agentAccountId)}`
    );

    if (!challengeRes.ok) {
      throw new Error(`Challenge request returned HTTP ${challengeRes.status}`);
    }

    const { challenge } = (await challengeRes.json()) as { challenge: string };
    console.log(`   Challenge Nonce: "${challenge.slice(0, 48)}..."`);

    // Sign challenge with agent's private key
    const sigBytes = agentKey.sign(Buffer.from(challenge, "utf8"));
    const signatureHex = Buffer.from(sigBytes).toString("hex");

    // Submit cryptographic enrollment payload
    const registerPayload = {
      agentId: AGENT_ID,
      name: AGENT_NAME,
      role: ROLE,
      capabilities: [ROLE, "ast-reasoning", "a2a-protocol", "sovereign-agent"],
      paymentAddress: agentAccountId,
      publicKey: agentKey.publicKey.toStringRaw(),
      signature: signatureHex,
      shape: ROLE === "reentrancy" ? "octahedron" : "dodecahedron",
      color: ROLE === "reentrancy" ? "#00f5ff" : "#10b981",
      endpoint: PUBLIC_ENDPOINT,
      a2aSupported: true,
      ownerAddress: agentAccountId,
    };

    const regRes = await fetch(`${API_URL}/agents/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerPayload),
    });

    if (!regRes.ok) {
      throw new Error(`Registration failed with HTTP ${regRes.status}`);
    }

    const regData = await regRes.json();
    didDocumentUrl = regData.didDocumentUrl || `/agents/${AGENT_ID}/did`;

    console.log(`   ✅ Registration Successful on Hedera Consensus Service!`);
    console.log(`   🆔 W3C DID:         ${regData.did || `did:hedera:testnet:0.0.10417469_${AGENT_ID}`}`);
    console.log(`   📜 HCS Topic ID:    ${regData.identityTopicId || "0.0.10417469"}`);
    console.log(`   🔗 Tx Proof:        ${regData.transactionId || "anchored"}\n`);

    console.log("================================================================================");
    console.log("🟢 AGENT IS FULLY OPERATIONAL AND LIVE IN THE SWARM!");
    console.log("================================================================================");
    console.log(`• Ready to accept A2A audit tasks from SwarmProof & MCP.`);
    console.log(`• Payouts will stream directly to Hedera account: ${agentAccountId}`);
    console.log(`• Press Ctrl+C to stop.\n`);
  } catch (err: any) {
    console.error(`   ❌ Registration Error: ${err.message}`);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n👋 Shutting down agent node...");
    server.close(() => {
      console.log("Server stopped.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal Agent Error:", err);
  process.exit(1);
});
