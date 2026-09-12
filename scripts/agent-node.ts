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

// Parse CLI flags
const args = process.argv.slice(2);
function getArg(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return fallback;
}

const role = getArg("--role", "reentrancy").toLowerCase().trim();
const agentId = getArg("--agent-id", `sentinel-${role}-${Math.random().toString(36).slice(2, 6)}`);
const walletAddress = getArg("--wallet", process.env.HEDERA_ACCOUNT_ID || "0.0.10417474");
const apiUrl = getArg("--api-url", process.env.SWARMPROOF_API_URL || "http://localhost:3000").replace(/\/+$/, "");
const pollIntervalMs = parseInt(getArg("--poll-interval", "5000"), 10);

console.log("===============================================================");
console.log("🤖 SwarmProof Autonomous Agent Node — Decentralized Worker");
console.log("===============================================================");
console.log(`Agent ID:        ${agentId}`);
console.log(`Role Domain:     ${role}`);
console.log(`Payout Wallet:   ${walletAddress} (Hedera Testnet)`);
console.log(`API Target:      ${apiUrl}`);
console.log(`Poll Frequency:  Every ${pollIntervalMs / 1000}s`);
console.log("===============================================================\n");

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

console.log("🚀 Agent Node running. Listening for open task pool bounties...\n");
setInterval(pollAndSolve, pollIntervalMs);
pollAndSolve();
