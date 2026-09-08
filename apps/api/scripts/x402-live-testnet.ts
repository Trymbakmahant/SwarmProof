/**
 * Live x402 + Blocky402 demo against testnet.
 *
 * Runs the FULL consumer flow against a running SwarmProof API:
 *   POST /audit (402) → GET /x402/audits/:id (quote) → sign (threshold: none —
 *   payer testnet key) → facilitator /verify + /settle → replay POST /audit
 *   with X-PAYMENT → swarm runs → HCS proof.
 *
 * Requirements (env):
 *   SWARMPROOF_API_URL       http://localhost:3001 (running `pnpm dev:api`)
 *   X402_FACILITATOR_URL     https://api.testnet.blocky402.com (default)
 *   HEDERA_ACCOUNT_ID        0.0.<testnet payer>  (fund via hedera portal faucet)
 *   HEDERA_PRIVATE_KEY       the payer's private key
 *
 * Run:  pnpm --filter @swarmproof/api x402:live
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { X402Client, createFacilitator, type X402HttpRequest } from "@swarmproof/x402";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const env = process.env;
const apiUrl = (env.SWARMPROOF_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const contractExamplePath = env.SWARMPROOF_CONTRACT_PATH ?? "../../../contracts/vulnerable/ReentrancyVault.sol";

function hb(table: string, rows: Array<Array<string>>): string {
  const widths = table.split("|").map((h, i) => Math.max(h.trim().length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = (cells: string[]) => "| " + cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join(" | ") + " |";
  return [line(table.split("|").map((h) => h.trim())), line(widths.map((w) => "-".repeat(w))), ...rows.map((r) => line(r))].join("\n");
}

async function main(): Promise<void> {
  const live = Boolean(env.HEDERA_ACCOUNT_ID && env.HEDERA_PRIVATE_KEY);
  console.log("\n🐝 SwarmProof — x402 + Blocky402 live audit demo");
  console.log("────────────────────────────────────────────────\n");

  const client = new X402Client({
    mode: live ? "live" : "mock",
    signer: live
      ? { accountId: env.HEDERA_ACCOUNT_ID!, privateKey: env.HEDERA_PRIVATE_KEY!, network: env.X402_NETWORK ?? "hedera:testnet" }
      : undefined,
    facilitator: env.X402_FACILITATOR_URL
      ? createFacilitator({ baseUrl: env.X402_FACILITATOR_URL, apiKey: env.X402_API_TOKEN })
      : undefined,
  });

  if (!live) {
    console.warn("⚠ no signer (HEDERA_ACCOUNT_ID/HEDERA_PRIVATE_KEY) — running offline mock flow.\n");
  } else {
    console.log(`payer: ${env.HEDERA_ACCOUNT_ID} on ${env.X402_NETWORK ?? "hedera:testnet"}`);
  }

  // Contract to audit (ground-truth vulnerable corpus).
  let source: string;
  try {
    source = fs.readFileSync(new URL(contractExamplePath, import.meta.url), "utf8");
  } catch {
    source = "contract V { function withdraw(uint x) public {} }";
  }
  const contractName = "ReentrancyVault";
  const request: X402HttpRequest = {
    method: "POST",
    body: { contractName, source },
  };

  console.log("1) POST /audit — expecting HTTP 402 challenge…");
  const discovered = await client.discover(`${apiUrl}/audit`, request);
  console.log(`   status=${discovered.response.status}`);
  if (!discovered.x402Resource) {
    console.error("   ✗ no X402 resource in WWW-Authenticate — is the API up?");
    process.exit(1);
  }
  console.log(`   WWW-Authenticate: X402 resource="${discovered.x402Resource}"`);

  console.log("\n2) GET resource with Accept: application/x402+json — the quote…");
  const requirements = await client.getRequirements(discovered.x402Resource);
  console.log(
    hb("field|value", [
      ["scheme", requirements.scheme],
      ["network", requirements.network],
      ["amount (tinybars)", requirements.amount],
      ["payTo", requirements.payTo],
      ["asset", requirements.asset],
      ["maxTimeoutSeconds", String(requirements.maxTimeoutSeconds)],
      ["feePayer (facilitator)", requirements.extra?.feePayer ?? "—"],
      ["auditId", String(requirements.extra?.auditId ?? "—")],
      ["expiresAt", String(requirements.extra?.expiresAt ?? "—")],
    ]),
  );
  console.log("\n   This quote is served by SwarmProof; the amount is the price of ONE audit.");

  console.log("\n3) Signing payment payload (payer signs a TransferTransaction)…");
  const payload = await client.signPayment(requirements);
  console.log(`   payload x402Version=${payload.x402Version} scheme=${payload.scheme} accepted.amount=${payload.accepted.amount}`);

  console.log("\n4) Submitting to Blocky402 facilitator: /verify then /settle…");
  const verification = await client.verifyPayment(payload);
  if (!verification.isValid) throw new Error(`facilitator rejected: ${verification.invalidMessage ?? verification.invalidReason}`);
  console.log(`   verify  → isValid=${verification.isValid} payer=${verification.payer ?? "?"}`);
  const settlement = await client.settlePayment(payload);
  if (!settlement.success) throw new Error(`settlement failed: ${settlement.errorMessage ?? settlement.errorReason}`);
  console.log(`   settle  → success=${settlement.success} transaction=${settlement.transaction}`);

  console.log("\n5) Replaying POST /audit with X-PAYMENT header…");
  const redemption = await client.redeem(`${apiUrl}/audit`, payload, { method: "POST", body: request.body });
  console.log(`   status=${redemption.status} body=${JSON.stringify(redemption.data).slice(0, 400)}`);
  if (redemption.status >= 400) {
    console.error("   ✗ redemption failed — expected 201/202.");
    process.exit(1);
  }
  const auditId = (redemption.data as { auditId?: string }).auditId;
  console.log(`   audit ${auditId ?? "?"} accepted — swarm running…`);

  if (auditId) {
    console.log("\n6) Polling audit status…");
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const status = (await client.request(`${apiUrl}/audits/${auditId}/status`, { method: "GET" })).data as {
        status?: string;
        paymentStatus?: string;
        findingCount?: number;
      };
      process.stdout.write(`   [${status.status}] findings=${status.findingCount ?? 0} payment=${status.paymentStatus}\r`);
      if (status.status === "done" || status.status === "failed") break;
    }
    console.log("\n\n7) HCS proof:");
    const proofResponse = await client.request(`${apiUrl}/audits/${auditId}/proof`, { method: "GET" });
    console.log(JSON.stringify(proofResponse.data, null, 2));
  }

  console.log("\n✅ End-to-end paid audit complete — no API key, no subscription.");
  console.log("   Hedera transaction: " + (settlement.transaction ?? "see facilitator settle response"));
}

main().catch((err) => {
  console.error("\n✗ demo failed:", (err as Error).message);
  process.exit(1);
});