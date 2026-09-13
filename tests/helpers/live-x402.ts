/**
 * Live x402 helper for the pool/reputation E2E suites.
 *
 * These tests must NOT bypass the HTTP 402 x402 gate. When a funded Hedera
 * testnet payer is available (from the gitignored root `.env` or the process
 * environment), they perform a REAL on-chain escrow transfer to the SwarmProof
 * gateway and assert the resulting on-chain transaction.
 *
 * The private key is consumed from the local environment ONLY — it is never
 * hardcoded in source and never committed (`.env` is gitignored). Without a
 * funded payer the gated tests simply skip, keeping `pnpm test` offline-safe
 * and green in CI.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Minimal zero-dependency .env parser (reads without mutating process.env). */
function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadPayer(): { accountId: string; privateKey: string } {
  let file: Record<string, string> = {};
  try {
    const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
    file = parseDotEnv(readFileSync(resolve(rootDir, ".env"), "utf8"));
  } catch {
    /* no .env — fall back to process env only */
  }
  const accountId =
    process.env.X402_PAYER_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID || file.X402_PAYER_ACCOUNT_ID || file.HEDERA_ACCOUNT_ID || "";
  const privateKey =
    process.env.X402_PAYER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY || file.X402_PAYER_PRIVATE_KEY || file.HEDERA_PRIVATE_KEY || "";
  return { accountId, privateKey };
}

export const payer = loadPayer();
export const payerAccountId = payer.accountId;
export const payerPrivateKey = payer.privateKey;
/** True when a funded Hedera testnet payer is configured → gated tests run live. */
export const hasFundedPayer = Boolean(payerAccountId && payerPrivateKey);

/**
 * Create a pool task WITHOUT bypassing the 402 gate:
 *  1. POST without keys → assert the x402 gate fires (402, no bypass).
 *  2. Replay with the funded payer keys → app signs & broadcasts a real
 *     on-chain TransferTransaction (payer → gateway) and escrows the task.
 *  3. Assert a real escrow transaction id / HashScan receipt was recorded, and
 *     return the escrowed task.
 *
 * Throws with an actionable error (including the testnet faucet) if the payer
 * is unfunded or the on-chain transfer fails.
 */
export async function createTaskWithRealX402Escrow(
  app: { request: (path: string, init?: RequestInit | any) => Promise<any> },
  body: Record<string, unknown>,
): Promise<any> {
  const start = Date.now();

  // 1) The gate must fire first — prove we are not bypassing the 402.
  const challenge = await app.request("/pool/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (challenge.status !== 402) {
    throw new Error(`x402 gate did not fire: expected 402, got ${challenge.status}`);
  }

  // 2) Pay the real x402 escrow on Hedera testnet with the funded test pk.
  const paid = await app.request("/pool/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, payerAccountId, payerPrivateKey }),
  });
  const data = await paid.json().catch(() => ({}));
  if (paid.status !== 201) {
    throw new Error(`real x402 escrow rejected (HTTP ${paid.status}): ${JSON.stringify(data)}`);
  }

  const txId = data?.task?.escrowReceipt?.transactionId as string | undefined;
  if (!txId) {
    throw new Error(
      `No on-chain escrow transaction recorded — is the payer funded?\n` +
        `  payer: ${payerAccountId}\n` +
        `  elapsedMs: ${Date.now() - start}\n` +
        `  task: ${JSON.stringify(data?.task ?? data).slice(0, 800)}\n` +
        `  Fund testnet HBAR via the Hedera portal faucet: https://portal.hedera.com/dashboard`,
    );
  }
  return data.task;
}