/**
 * @swarmproof/x402 — x402 payment protocol SDK for SwarmProof.
 *
 * - client:  consumer-agent side (discover / quote / sign / settle / redeem)
 * - server:  service side (402 challenge / X-PAYMENT parsing / verification)
 * - facilitator: Blocky402 wire client (GET /supported, POST /verify, POST /settle)
 *                with an offline mock for tests and local demos
 * - jwt/keys: Ed25519 JWS helpers used for app-level signed claims
 */
export * from "./types.js";
export * from "./money.js";
export * from "./facilitator.js";
export * from "./client.js";
export * from "./server.js";
export * from "./jwt.js";
export * from "./keys.js";