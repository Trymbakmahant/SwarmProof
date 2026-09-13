/**
 * @swarmproof/hedera — HCS audit-proof anchoring, HCS payment audit trails,
 * HCS-14 agent identity, HTS helpers, and read-only mirror-node verification.
 * Money moves via x402 (packages/payments / packages/x402), NOT through here.
 */
export * from "./proof.js";
export * from "./topic.js";
export * from "./mirrornode.js";
export * from "./payment.js";
export * from "./identity.js";
export * from "./hts.js";
export { Client, PrivateKey, AccountId, TransferTransaction, Hbar } from "@hashgraph/sdk";

import type { AuditProofClient } from "./proof.js";

export type { AuditProofClient };