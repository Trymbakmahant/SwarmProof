export * from "./types.js";
export * from "./allocator.js";
export * from "./gateway.js";
export * from "./providers/mock.js";
export * from "./providers/x402.js";

import type { PaymentProvider } from "./types.js";
import { MockPaymentProvider } from "./providers/mock.js";
import { X402PaymentProvider } from "./providers/x402.js";

export interface PaymentEnvConfig {
  x402FacilitatorUrl?: string;
  x402Network?: string;
  apiToken?: string;
}

/** Pick mock or real x402 provider from env — zero-config local runs use mock. */
export function createPaymentProvider(env: PaymentEnvConfig = {}): PaymentProvider {
  if (env.x402FacilitatorUrl) {
    return new X402PaymentProvider({
      hint: env.x402Network ?? "hedera:testnet",
      facilitatorUrl: env.x402FacilitatorUrl,
      apiToken: env.apiToken,
    });
  }
  return new MockPaymentProvider();
}