import { Client, PrivateKey, AccountId, AccountCreateTransaction, Hbar } from "@hashgraph/sdk";
import { SPECIALIST_KEYPAIRS } from "../packages/agents/src/agentKeypairs.js";

async function main() {
  console.log("================================================================================");
  console.log("🏦 SwarmProof Specialist Hedera Testnet Account Generation & Funding");
  console.log("================================================================================\n");

  const operatorId = process.env.HEDERA_ACCOUNT_ID || "0.0.10119346";
  const derKey = process.env.HEDERA_PRIVATE_KEY || "3030020100300706052b8104000a042204202960059c00f2267248928cde03878b1438508f0646c2d282a2e1c89a3af8d407";
  const operatorKey = derKey.startsWith("3030")
    ? PrivateKey.fromStringDer(derKey)
    : PrivateKey.fromStringECDSA(derKey.replace(/^0x/, ""));

  const hederaClient = Client.forTestnet();
  hederaClient.setOperator(AccountId.fromString(operatorId), operatorKey);

  const results: Record<string, string> = {};

  for (const [id, agent] of Object.entries(SPECIALIST_KEYPAIRS)) {
    if (id === "static-agent") {
      console.log(`✅ [${id}] Already has verified active account: 0.0.10417474`);
      results[id] = "0.0.10417474";
      continue;
    }

    console.log(`⚙️  Creating authentic on-chain account for "${id}"...`);
    try {
      const cleanKey = agent.privateKey.replace(/^0x/, "");
      const agentKey = PrivateKey.fromStringECDSA(cleanKey);
      const agentPubKey = agentKey.publicKey;

      const tx = await new AccountCreateTransaction()
        .setKey(agentPubKey)
        .setInitialBalance(new Hbar(2))
        .setAccountMemo(`SwarmProof Specialist: ${id}`)
        .execute(hederaClient);

      const receipt = await tx.getReceipt(hederaClient);
      const newAccountId = receipt.accountId!.toString();
      results[id] = newAccountId;
      console.log(`   ✅ [${id}] Account created: ${newAccountId} (https://hashscan.io/testnet/account/${newAccountId})`);
    } catch (err) {
      console.error(`   ❌ Failed to create account for ${id}:`, (err as Error).message);
    }
  }

  console.log("\n================================================================================");
  console.log("📋 Summary of All Active Specialist Hedera Accounts:");
  console.log("================================================================================");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
