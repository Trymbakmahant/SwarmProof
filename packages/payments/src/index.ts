export * from "./types.js";
export * from "./allocator.js";
export * from "./gateway.js";
export * from "./providers/mock.js";
export * from "./providers/x402.js";
export * from "./pricing.js";

import type { PaymentProvider } from "./types.js";
import { MockPaymentProvider } from "./providers/mock.js";
import { X402PaymentProvider, type X402Config } from "./providers/x402.js";

export interface PaymentEnvConfig {
  x402FacilitatorUrl?: string;
  x402Network?: string;
  apiToken?: string;
  /** tinybars per 1 USD used to build the x402 quote (default 100_000_000). */
  tinybarsPerUSD?: string;
  /** Settled asset: "0.0.0" = HBAR, or an HTS token id. */
  asset?: string;
  /** Optional on-chain (mirror node) verifier for direct transfer tx ids. */
  verifyOnChain?: X402Config["verifyOnChain"];
}

/** Pick mock or real x402 provider from env — zero-config local runs use mock. */
export function createPaymentProvider(env: PaymentEnvConfig = {}): PaymentProvider {
  if (env.x402FacilitatorUrl) {
    return new X402PaymentProvider({
      hint: env.x402Network ?? "hedera:testnet",
      facilitatorUrl: env.x402FacilitatorUrl,
      apiToken: env.apiToken,
      tinybarsPerUSD: env.tinybarsPerUSD,
      asset: env.asset,
      verifyOnChain: env.verifyOnChain,
    });
  }
  return new MockPaymentProvider();
}