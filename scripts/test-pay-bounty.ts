import { createToolRegistry, SwarmProofApiClient } from "../packages/mcp/src/index.js";

async function testPayBounty() {
  const client = new SwarmProofApiClient({ apiBaseUrl: "http://localhost:3001" });
  const tools = createToolRegistry(client);

  const createPoolTool = tools.find((t) => t.name === "create_pool_task")!;
  const payBountyTool = tools.find((t) => t.name === "pay_bounty")!;

  console.log("1. Creating unpaid pool task...");
  const unpaidTask: any = await createPoolTool.run({
    contractName: "TestBountyVault",
    source: "contract TestBountyVault { function test() public {} }",
    bountyTotal: "1.00",
  });

  const taskId = unpaidTask.taskId;
  console.log(`Created Task ID: ${taskId}, Status: ${unpaidTask.status}`);

  console.log("2. Paying bounty using pay_bounty tool with Hedera keys...");
  const payRes: any = await payBountyTool.run({
    id: taskId,
    payerAccountId: "0.0.10119346",
    payerPrivateKey: "3030020100300706052b8104000a042204202960059c00f2267248928cde03878b1438508f0646c2d282a2e1c89a3af8d407",
  });

  console.log("pay_bounty result:", JSON.stringify(payRes, null, 2));

  if (!payRes.ok || payRes.status !== "ESCROWED") {
    throw new Error(`Expected ESCROWED, got ${JSON.stringify(payRes)}`);
  }

  console.log("✅ pay_bounty successfully funded and escrowed on-chain!");
}

testPayBounty().catch((e) => {
  console.error(e);
  process.exit(1);
});
