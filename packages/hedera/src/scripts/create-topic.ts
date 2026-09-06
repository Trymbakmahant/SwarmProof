/**
 * Create an HCS topic on Hedera, print its ID, and update .env.
 *
 * Usage (needs valid testnet credentials in env):
 *   HEDERA_NETWORK=testnet HEDERA_ACCOUNT_ID=0.0.xxx HEDERA_PRIVATE_KEY=302e... \
 *   pnpm --filter @swarmproof/hedera create-topic
 *
 * The printed topic ID (e.g. 0.0.12345) is your HEDERA_TOPIC_ID.
 */
import { Client, AccountId, PrivateKey, TopicCreateTransaction } from "@hashgraph/sdk";

async function main(): Promise<void> {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const network = process.env.HEDERA_NETWORK ?? "testnet";
  if (!accountId || !privateKey) {
    console.error("HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY are required (see docs below).");
    process.exit(1);
  }

  const client = Client.forName(network).setOperator(
    AccountId.fromString(accountId),
    PrivateKey.fromString(privateKey),
  );

  console.log(`creating HCS topic on ${network} as ${accountId} …`);
  const tx = await new TopicCreateTransaction({
    topicMemo: "SwarmProof audit proofs",
  }).execute(client);
  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId?.toString();
  client.close();

  if (!topicId) {
    console.error("no topic id returned");
    process.exit(1);
  }
  console.log(`\n✅ HCS topic created: ${topicId}`);
  console.log(`Add to .env:\n  HEDERA_TOPIC_ID=${topicId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});