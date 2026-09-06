import nacl from "tweetnacl";

/**
 * Minimal Ed25519 helpers for x402 JWTs.
 *
 * x402 on Hedera uses JWS (RFC 7515) with EdDSA over Ed25519 — the same curve
 * as Hedera accounts. Keys may be given as raw 32-byte hex (64 chars), the
 * standard DER hex used by Hedera (302e020100300506032b657004220420 + 32B),
 * or base64 of either.
 */

export function isRawSeed(s: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(s);
}

export function isDerHex(s: string): boolean {
  return (
    s.length > 64 &&
    /^[0-9a-fA-F]+$/.test(s) &&
    s.toLowerCase().endsWith("0420")
  );
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("odd-length hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function bytesToBase64url(b: Uint8Array): string {
  return Buffer.from(b).toString("base64url");
}

export function base64urlToBytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

/** Parse a private key string into the 32-byte Ed25519 seed. */
export function parseEd25519Seed(material: string): Uint8Array {
  let hex = material.trim();
  if (hex.startsWith("0x")) hex = hex.slice(2);
  if (hex.length === 0) throw new Error("empty private key material");
  if (isRawSeed(hex)) return hexToBytes(hex);
  if (isDerHex(hex)) return hexToBytes(hex).slice(-32);
  // base64 (raw 32 bytes or DER asn1)
  const asBuf = Buffer.from(material, "base64");
  if (asBuf.length === 32) return new Uint8Array(asBuf);
  if (asBuf.length > 32) return new Uint8Array(asBuf.slice(-32));
  throw new Error("unrecognized Ed25519 private key format (raw hex, DER hex, or base64)");
}

export interface KeyPair {
  secretKey: Uint8Array; // 64 bytes (seed || public)
  publicKey: Uint8Array; // 32 bytes
  publicKeyHex: string;
}

/** Derive an Ed25519 keypair from a seed (any accepted key format). */
export function keyPairFromMaterial(material: string): KeyPair {
  const seed = parseEd25519Seed(material);
  const kp = nacl.sign.keyPair.fromSeed(seed);
  return {
    secretKey: kp.secretKey,
    publicKey: kp.publicKey,
    publicKeyHex: bytesToHex(kp.publicKey),
  };
}

export function verifyEd25519(data: Uint8Array, signature: Uint8Array, publicKeyHex: string): boolean {
  try {
    return nacl.sign.detached.verify(data, signature, hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}