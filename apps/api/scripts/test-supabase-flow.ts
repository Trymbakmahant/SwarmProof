import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), "../../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { getSupabaseClient, dbSaveTask, dbLoadAllTasks } from "../src/supabase.js";
import type { PoolTask } from "../src/pool.js";

async function runTest() {
  console.log("=== SwarmProof Supabase End-to-End Persistence Test ===");
  const sb = getSupabaseClient();
  if (!sb) {
    console.error("❌ Supabase client failed to initialize. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  console.log("✅ Supabase client initialized.");

  const testTaskId = `test_task_${Date.now()}`;
  const testTask: PoolTask = {
    id: testTaskId,
    contractName: "TestVault",
    source: "contract TestVault { function withdraw() external {} }",
    network: "ethereum",
    status: "SETTLED",
    submissionWindowSeconds: 60,
    requiredRoles: ["reentrancy", "access-control"],
    claims: [
      {
        agentId: "reentrancy-agent",
        role: "reentrancy",
        claimedAt: new Date().toISOString(),
        paymentAddress: "0.0.10417474",
      },
    ],
    submissions: [
      {
        agentId: "reentrancy-agent",
        role: "reentrancy",
        findings: [
          {
            id: "SWC-107",
            title: "Reentrancy in withdraw",
            severity: "critical",
            confidence: 0.95,
            category: "reentrancy",
            description: "CEI violation in withdraw function",
            location: { file: "TestVault.sol", line: 1 },
          },
        ],
        submittedAt: new Date().toISOString(),
        status: "accepted",
      },
    ],
    bountyTotal: "1.00",
    currency: "USD",
    escrowStatus: "distributed",
    payouts: [
      {
        agentId: "reentrancy-agent",
        role: "reentrancy",
        address: "0.0.10417474",
        sharePercent: 100,
        amountUSD: "1.00",
        amountTinybars: 7500000,
        acceptedFindingsCount: 1,
        weightScore: 4.0,
        weightBonusReason: "Critical Reentrancy Finding",
        transactionId: "0.0.10119346@1789226901.100057140",
        status: "settled",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log(`\n1. Saving test task ${testTaskId} to Supabase...`);
  const saved = await dbSaveTask(testTask);
  if (!saved) {
    console.error("❌ Failed to save task to Supabase. (Have you run supabase/schema.sql in the Supabase SQL Editor?)");
    process.exit(1);
  }
  console.log("✅ Task saved successfully to pool_tasks & agent_payouts tables!");

  console.log("\n2. Loading all tasks from Supabase...");
  const tasks = await dbLoadAllTasks();
  console.log(`✅ Loaded ${tasks.length} task(s) from Supabase.`);

  const found = tasks.find((t) => t.id === testTaskId);
  if (!found) {
    console.error(`❌ Newly created task ${testTaskId} not found in loaded tasks.`);
    process.exit(1);
  }

  console.log(`✅ Found task ${found.id} with ${found.submissions.length} submission(s) and ${found.payouts?.length || 0} payout(s)!`);
  console.log("\n🎉 Supabase integration verification PASSED!");
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
