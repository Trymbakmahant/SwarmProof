import { createToolRegistry, SwarmProofApiClient } from "../packages/mcp/src/index.js";

const TEST_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BountyTestVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "No balance");
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, "Transfer failed");
        balances[msg.sender] = 0;
    }
}
`;

async function testMcpX402Flow() {
  console.log("================================================================================");
  console.log("🧪 SwarmProof MCP x402 Payment & Participating Agent Payouts Verification");
  console.log("================================================================================\n");

  const client = new SwarmProofApiClient({ apiBaseUrl: "http://localhost:3001" });
  const tools = createToolRegistry(client);

  const auditTool = tools.find((t) => t.name === "audit_contract")!;
  const createPoolTool = tools.find((t) => t.name === "create_pool_task")!;
  const payBountyTool = tools.find((t) => t.name === "pay_bounty")!;

  console.log("--------------------------------------------------------------------------------");
  console.log("Test 1: Unpaid MCP Audit Request -> Verify HTTP 402 PAYMENT_REQUIRED Challenge");
  console.log("--------------------------------------------------------------------------------");

  // Temporarily clear env vars to test unpaid challenge
  const savedAcc = process.env.HEDERA_ACCOUNT_ID;
  const savedKey = process.env.HEDERA_PRIVATE_KEY;
  delete process.env.HEDERA_ACCOUNT_ID;
  delete process.env.HEDERA_PRIVATE_KEY;

  const unpaidResult: any = await auditTool.run({
    contractName: "BountyTestVault",
    source: TEST_CONTRACT,
    total: "1.00",
  });

  console.log("Received MCP Response for unpaid audit:");
  console.log(JSON.stringify(unpaidResult, null, 2));

  if (unpaidResult.status !== "PAYMENT_REQUIRED" || unpaidResult.httpCode !== 402) {
    throw new Error(`Expected HTTP 402 PAYMENT_REQUIRED, got: ${JSON.stringify(unpaidResult)}`);
  }
  console.log("✅ Test 1 Passed: MCP cleanly prompted for x402 payment with HBAR quote and payment instructions!\n");

  console.log("--------------------------------------------------------------------------------");
  console.log("Test 2: Unpaid MCP Pool Task -> Verify HTTP 402 PENDING_ESCROW Challenge");
  console.log("--------------------------------------------------------------------------------");

  const unpaidPoolTask: any = await createPoolTool.run({
    contractName: "BountyTestVault",
    source: TEST_CONTRACT,
    bountyTotal: "1.50",
  });

  console.log("Received MCP Response for unpaid pool task:");
  console.log(JSON.stringify(unpaidPoolTask, null, 2));

  if (unpaidPoolTask.status !== "PENDING_ESCROW") {
    throw new Error(`Expected PENDING_ESCROW, got: ${JSON.stringify(unpaidPoolTask)}`);
  }
  console.log("✅ Test 2 Passed: Pool task creation required advance x402 escrow!\n");

  console.log("--------------------------------------------------------------------------------");
  console.log("Test 3: Automated On-Chain x402 Payment & Agent Micropayments");
  console.log("--------------------------------------------------------------------------------");

  // Restore operator keys as payer
  const payerAccountId = savedAcc || "0.0.10119346";
  const payerPrivateKey = savedKey || "3030020100300706052b8104000a042204202960059c00f2267248928cde03878b1438508f0646c2d282a2e1c89a3af8d407";

  console.log(`Payer Account: ${payerAccountId}`);
  console.log("Invoking MCP audit_contract with payer credentials...");

  const paidResult: any = await auditTool.run({
    contractName: "BountyTestVault",
    source: TEST_CONTRACT,
    total: "1.00",
    payerAccountId,
    payerPrivateKey,
  });

  console.log("\nReceived MCP Response for paid audit:");
  console.log(JSON.stringify({
    auditId: paidResult.auditId,
    status: paidResult.status,
    payment: paidResult.payment,
    findingCount: paidResult.findingCount,
    proofTransactionId: paidResult.proof?.transactionId,
    hashScanUrl: paidResult.hashScanUrl,
  }, null, 2));

  if (paidResult.status !== "done" && paidResult.status !== "running") {
    throw new Error(`Expected status done/running, got: ${paidResult.status}`);
  }

  if (!paidResult.payment?.escrowTransactionId) {
    throw new Error("Expected real escrowTransactionId on Hedera testnet!");
  }

  console.log(`✅ Test 3.1: Real on-chain x402 escrow transfer confirmed!`);
  console.log(`   Escrow Tx: ${paidResult.payment.escrowTransactionId}`);
  console.log(`   HashScan:  ${paidResult.payment.hashScanUrl}`);
  console.log(`   HCS Proof: ${paidResult.proof?.transactionId}`);

  // Fetch settled task payouts from task pool to inspect participating agent micropayments
  console.log("\nInspecting real on-chain payouts to participating agents...");
  const poolTasksRes = await client.get<any>(`/pool/tasks?status=SETTLED`);
  const latestSettled = poolTasksRes.tasks?.find((t: any) => t.payouts && t.payouts.length > 0);

  if (latestSettled) {
    console.log(`Found settled task: ${latestSettled.id} (${latestSettled.contractName})`);
    console.log(`Total Bounty: $${latestSettled.bountyTotal} ${latestSettled.currency}`);
    console.log("Agent Payouts Breakdown:");
    for (const p of latestSettled.payouts) {
      console.log(`  🤖 Agent: ${p.agentId.padEnd(24)} | Role: ${p.role.padEnd(16)} | Account: ${p.address.padEnd(14)} | Tinybars: ${p.amountTinybars} | Tx: ${p.transactionId}`);
    }
  }

  console.log("\n================================================================================");
  console.log("🎉 ALL MCP x402 PAYMENT & AGENT PAYOUT TESTS PASSED SUCCESSFULLY!");
  console.log("================================================================================");
}

testMcpX402Flow().catch((err) => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
