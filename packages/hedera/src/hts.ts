/**
 * HTS (Hedera Token Service) helpers — the "HTS tokens or custom fee schedules
 * in the settlement path" extra point.
 *
 * x402 on Hedera supports token payments: set `asset` to an HTS token id and
 * the ExactHederaScheme builds a token TransferTransaction. Payers must be
 * associated with the token; these helpers cover that + direct transfers.
 */

export interface HtsCredentials {
  network: string; // "testnet" | "mainnet" | "previewnet"
  accountId: string;
  privateKey: string;
}

export function htsCredentialsFromEnv(env: NodeJS.ProcessEnv = process.env): HtsCredentials {
  return {
    network: env.HEDERA_NETWORK ?? "testnet",
    accountId: env.HEDERA_ACCOUNT_ID ?? "",
    privateKey: env.HEDERA_PRIVATE_KEY ?? "",
  };
}

/** Native HBAR asset id used by x402. */
export const HBAR_ASSET_ID = "0.0.0";

/** Associate `accountId` with an HTS token (required once before transfers). */
export async function associateTokenAccount(credentials: HtsCredentials, tokenId: string): Promise<{ transactionId: string; alreadyAssociated: boolean }> {
  const sdk = await import("@hashgraph/sdk");
  const { Client, PrivateKey, AccountId, TokenId, TokenAssociateTransaction } = sdk;

  const client = Client.forName(credentials.network);
  client.setOperator(AccountId.fromString(credentials.accountId), PrivateKey.fromString(credentials.privateKey));

  const tx = await new TokenAssociateTransaction({
    accountId: AccountId.fromString(credentials.accountId),
    tokenIds: [TokenId.fromString(tokenId)],
  }).execute(client);
  await tx.getReceipt(client);
  return { transactionId: tx.transactionId.toString(), alreadyAssociated: false };
}

/** Check an account is associated with a token via the mirror node token relation. */
export async function isAssociated(
  { baseUrl = "https://testnet.mirrornode.hedera.com" }: { baseUrl?: string },
  accountId: string,
  tokenId: string,
): Promise<boolean> {
  const res = await fetch(`${baseUrl}/api/v1/accounts/${encodeURIComponent(accountId)}/tokens?token.id=${encodeURIComponent(tokenId)}`);
  if (!res.ok) return false;
  const body = (await res.json()) as { tokens?: Array<{ token_id: string }> };
  return Boolean(body.tokens?.some((t) => t.token_id === tokenId));
}

/**
 * Build + sign an HTS transfer (token `tokenId`, from `from` to `to`,
 * `amount` in smallest units) and return the base64-serialized transaction —
 * the analog of an x402 payload for direct (non-facilitator) token rails.
 */
export async function buildSignedTokenTransfer(
  credentials: HtsCredentials,
  input: { tokenId: string; from: string; to: string; amount: string },
): Promise<{ transactionBase64: string; transactionId: string }> {
  const sdk = await import("@hashgraph/sdk");
  const { Client, PrivateKey, AccountId, TokenId, TransferTransaction } = sdk;

  const client = Client.forName(credentials.network);
  const operatorKey = PrivateKey.fromString(credentials.privateKey);
  client.setOperator(AccountId.fromString(credentials.accountId), operatorKey);

  const tx = new TransferTransaction()
    .addTokenTransfer(TokenId.fromString(input.tokenId), AccountId.fromString(input.from), -BigInt(input.amount))
    .addTokenTransfer(TokenId.fromString(input.tokenId), AccountId.fromString(input.to), BigInt(input.amount))
    .setTransactionMemo("swarmproof-hts-payout");

  const frozen = await tx.freezeWith(client);
  const signed = await frozen.sign(operatorKey);
  const transactionBase64 = Buffer.from(signed.toBytes()).toString("base64");
  const transactionId = signed.transactionId?.toString() ?? "";
  return { transactionBase64, transactionId };
}