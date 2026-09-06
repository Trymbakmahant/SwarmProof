/**
 * @swarmproof/hedera — HCS audit-proof anchoring + future agent identity (HCS-14).
 * Money moves via x402 (packages/payments), NOT through here.
 */
export * from "./proof.js";

import type { AuditProofClient } from "./proof.js";

export type { AuditProofClient };