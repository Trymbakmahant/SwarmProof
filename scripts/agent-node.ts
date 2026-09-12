#!/usr/bin/env node
/**
 * SwarmProof Standalone External Agent Runner Daemon (Decentralized Node)
 *
 * Allows independent security researchers and community developers to run
 * an autonomous security agent node that pulls open tasks from the SwarmProof
 * task pool, executes specialized vulnerability analysis, submits candidate findings,
 * and collects real Hedera tinybar micropayments on-chain upon consensus settlement.
 *
 * Usage:
 *   pnpm agent:node --role reentrancy --agent-id community-sentinel-1 --wallet 0.0.10417474
 *   pnpm agent:node --role access-control --agent-id acl-pro-agent
 */

import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { createSpecialistAgents } from "../packages/agents/src/index.js";
import { PrivateKey } from "../packages/hedera/dist/index.js";

// Parse CLI flags
const args = process.argv.slice(2);
function getArg(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return fallback;
}
const hasFlag = (flag: string) => args.includes(flag);

const role = getArg("--role", "reentrancy").toLowerCase().trim();
const agentId = getArg("--agent-id", `node-${role}-${Math.random().toString(36).slice(2, 6)}`);
const agentName = getArg("--name", `Node ${role.toUpperCase()} Sentinel`);
const walletAddress = getArg("--wallet", process.env.HEDERA_ACCOUNT_ID || "0.0.10417474");
const apiUrl = getArg("--api-url", process.env.SWARMPROOF_API_URL || "http://localhost:3001").replace(/\/+$/, "");
const pollIntervalMs = parseInt(getArg("--poll-interval", "5000"), 10);
const registerOnly = hasFlag("--register-only");

console.log("===============================================================");
console.log("🤖 SwarmProof Autonomous Agent Node — Decentralized Worker");
console.log("===============================================================");
console.log(`Agent ID:        ${agentId}`);
console.log(`Agent Name:      ${agentName}`);
console.log(`Role Domain:     ${role}`);
console.log(`Payout Wallet:   ${walletAddress} (Hedera Testnet)`);
console.log(`API Target:      ${apiUrl}`);
console.log(`Poll Frequency:  Every ${pollIntervalMs / 1000}s`);
console.log("===============================================================\n");

const ROLE_METAS: Record<string, { title: string; shape: string; color: string }> = {
  reentrancy: { title: "Checks-Effects-Interactions & Reentrancy", shape: "octahedron", color: "#00f5ff" },
  "access-control": { title: "Access Control & Authorization", shape: "dodecahedron", color: "#10b981" },
  "business-logic": { title: "Business Logic & State Invariants", shape: "torusKnot", color: "#d946ef" },
  economic: { title: "Economic Oracle & MEV Guard", shape: "icosahedron", color: "#ffb703" },
  "economic-oracle": { title: "Economic Oracle & MEV Guard", shape: "icosahedron", color: "#ffb703" },
  "static-analysis": { title: "AST Static Analysis & Syntax", shape: "gyroscope", color: "#3b82f6" },
};

/**
 * Perform on-chain agent registration with cryptographic proof
 */
async function ensureAgentRegistered(): Promise<boolean> {
  try {
    // 1. Check if already registered
    const listRes = await fetch(`${apiUrl}/agents`);
    if (listRes.ok) {
      const listData = (await listRes.json()) as { agents: any[] };
      const existing = listData.agents?.find((a: any) => a.agentId === agentId);
      if (existing) {
        console.log(`✅ [Identity Verified] Agent is already registered in SwarmProof directory.`);
        console.log(`   W3C DID:         ${existing.did || "did:hedera:testnet"}`);
        console.log(`   Hedera Topic:    ${existing.identityTopicId || "0.0.10417469"}`);
        console.log(`   Transaction ID:  ${existing.identityReference || "anchored"}\n`);
        return true;
      }
    }

    console.log(`🔐 Agent "${agentId}" is not registered. Initiating on-chain cryptographic registration...`);

    // 2. Request registration challenge nonce
    const chalRes = await fetch(
      `${apiUrl}/agents/challenge?agentId=${encodeURIComponent(agentId)}&accountId=${encodeURIComponent(walletAddress)}`
    );
    if (!chalRes.ok) {
      console.warn(`   ⚠️ Challenge request failed with HTTP ${chalRes.status}`);
      return false;
    }
    const chalData = (await chalRes.json()) as { challenge: string; nonce: string };

    // 3. Cryptographically sign challenge using operator key
    const privKeyStr =
      process.env.HEDERA_PRIVATE_KEY ||
      process.env.X402_PAYER_PRIVATE_KEY ||
      "3030020100300706052b8104000a042204202960059c00f2267248928cde03878b1438508f0646c2d282a2e1c89a3af8d407";

    const privKey = PrivateKey.fromString(privKeyStr);
    const pubKey = privKey.publicKey;
    const sigBytes = privKey.sign(Buffer.from(chalData.challenge, "utf8"));
    const signatureHex = Buffer.from(sigBytes).toString("hex");

    // 4. Submit registration payload to Hedera Consensus Service & Supabase
    const roleMeta = ROLE_METAS[role] || ROLE_METAS.reentrancy;
    const regRes = await fetch(`${apiUrl}/agents/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        name: agentName,
        role: roleMeta.title,
        capabilities: [role, "ast-reasoning", "decentralized-worker"],
        paymentAddress: walletAddress,
        publicKey: pubKey.toStringRaw(),
        signature: signatureHex,
        challenge: chalData.challenge,
        shape: roleMeta.shape,
        color: roleMeta.color,
      }),
    });

    if (!regRes.ok) {
      const errData = await regRes.json().catch(() => ({}));
      console.error(`❌ Registration failed:`, errData.error || `HTTP ${regRes.status}`);
      return false;
    }

    const regData = (await regRes.json()) as any;
    console.log(`🎉 [Agent Registered On-Chain & Supabase]`);
    console.log(`   W3C DID:         ${regData.agent.did}`);
    console.log(`   Hedera HCS:      Topic ${regData.agent.identityTopicId}`);
    console.log(`   Tx ID:           ${regData.agent.identityReference}`);
    console.log(`   HashScan:        https://hashscan.io/testnet/transaction/${regData.agent.identityReference.replace("@", "-").replace(/\.(?=\d{9})/, "-")}`);
    console.log(`   DID Document:    ${apiUrl}${regData.agent.didDocumentUrl}\n`);
    return true;
  } catch (err) {
    console.error(`❌ Registration exception:`, (err as Error).message);
    return false;
  }
}

const specialists = createSpecialistAgents({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
  model: "deepseek-reasoner",
});

// Map CLI role to internal specialist agent
const ROLE_TO_AGENT_KEY: Record<string, string> = {
  reentrancy: "reentrancy-agent",
  "access-control": "access-control-agent",
  "business-logic": "business-logic-agent",
  economic: "economic-agent",
  "economic-oracle": "economic-agent",
  "static-analysis": "static-agent",
};

const agentKey = ROLE_TO_AGENT_KEY[role] || "reentrancy-agent";
const specialist = (specialists as Record<string, any>)[agentKey];

const processedTaskIds = new Set<string>();

async function pollAndSolve() {
  try {
    const pullUrl = `${apiUrl}/pool/pull?agentId=${encodeURIComponent(agentId)}&role=${encodeURIComponent(role)}`;
    const res = await fetch(pullUrl);
    if (!res.ok) {
      return;
    }

    const data = await res.json();
    const tasks: any[] = data.tasks || [];

    for (const task of tasks) {
      if (processedTaskIds.has(task.id)) continue;
      if (task.status !== "OPEN_FOR_SUBMISSIONS") continue;

      processedTaskIds.add(task.id);
      console.log(`\n🎯 [Task Pool] Claimed eligible task: ${task.contractName} (${task.id})`);
      console.log(`   💰 Escrowed Bounty: $${task.bountyTotal} ${task.currency}`);

      // 1. Claim slot
      try {
        const claimRes = await fetch(`${apiUrl}/pool/tasks/${task.id}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            role,
            paymentAddress: walletAddress,
          }),
        });
        const claimData = await claimRes.json();
        console.log(`   📝 Slot Claim Status: ${claimData.message || (claimRes.ok ? "Slot reserved" : "Claim notice")}`);
      } catch (err) {
        console.warn(`   ⚠️ Claim warning: ${(err as Error).message}`);
      }

      // 2. Perform deep vulnerability analysis
      console.log(`   ⚡ Running security reasoning analysis on ${task.contractName}...`);
      let findings: any[] = [];
      try {
        if (specialist) {
          findings = await specialist.analyze({
            contractName: task.contractName,
            source: task.source,
            network: task.network ?? "ethereum",
          });
        }
      } catch (err) {
        console.warn(`   ⚠️ Analysis notice: ${(err as Error).message}`);
      }

      console.log(`   🔍 Analysis Complete: Found ${findings.length} candidate finding(s).`);

      // 3. Submit findings to pool
      try {
        const subRes = await fetch(`${apiUrl}/pool/tasks/${task.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            role,
            findings,
          }),
        });
        const subData = await subRes.json();
        console.log(`   📤 Submission Confirmed: ${subData.message || "Submitted to pool"}`);
      } catch (err) {
        console.error(`   ❌ Failed to submit findings: ${(err as Error).message}`);
      }

      // 4. Await consensus settlement
      console.log(`   ⏳ Waiting for Swarm Consensus & Hedera Micropayment settlement...`);
      let attempts = 0;
      while (attempts < 15) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
        try {
          const checkRes = await fetch(`${apiUrl}/pool/tasks/${task.id}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            const currentTask = checkData.task || checkData;
            if (currentTask.status === "SETTLED") {
              const myPayout = (currentTask.payouts || []).find((p: any) => p.agentId === agentId);
              console.log(`\n   🎉 TASK SETTLED ON-CHAIN!`);
              if (myPayout) {
                console.log(`   💵 My Payout:      ${myPayout.amountTinybars.toLocaleString()} Tinybars ($${myPayout.amountUSD} USD)`);
                console.log(`   ⚖️ Consensus Weight: ${myPayout.weightScore}x (${myPayout.acceptedFindingsCount} finding(s) verified)`);
                if (myPayout.transactionId) {
                  console.log(`   ⛓️ Hedera On-Chain Tx: https://hashscan.io/testnet/transaction/${myPayout.transactionId}`);
                }
              }
              break;
            }
          }
        } catch {
          // Retry
        }
      }
    }
  } catch (err) {
    // Silent catch on network hiccups during polling
  }
}

async function main() {
  const registered = await ensureAgentRegistered();
  if (!registered) {
    console.warn("⚠️ Continuing with available capabilities...\n");
  }

  if (registerOnly) {
    console.log("✨ Agent registration complete (--register-only). Exiting.");
    process.exit(0);
  }

  console.log("🚀 Agent Node running. Listening for open task pool bounties...\n");
  setInterval(pollAndSolve, pollIntervalMs);
  pollAndSolve();
}

main();
