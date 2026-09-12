import { z } from "zod";

/**
 * Agent identity (HCS-14 preparation, P1).
 * MVP keeps this as a plain schema + interface. A later milestone can anchor
 * this on Hedera (HCS-14) — the `identityReference` field is the seam.
 */
export const AgentIdentitySchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1),
  capabilities: z.array(z.string()).default([]),
  paymentAddress: z.string().min(1),
  version: z.string().default("1.0.0"),
  identityReference: z.string().optional(),
  publicKey: z.string().optional(),
  hederaAccountId: z.string().optional(),
  evmAddress: z.string().optional(),
});
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;

/** A verification task submitted to SwarmProof (MVP: smart-contract audit). */
export const SecurityTaskSchema = z.object({
  contractName: z.string().min(1),
  source: z.string().min(1),
  compiler: z.string().optional(),
  address: z.string().optional(),
  network: z.string().default("ethereum"),
});
export type SecurityTask = z.infer<typeof SecurityTaskSchema>;