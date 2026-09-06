import { bytesToBase64url, base64urlToBytes, keyPairFromMaterial, verifyEd25519 } from "./keys.js";
import nacl from "tweetnacl";

/**
 * Minimal JWS (RFC 7515) with EdDSA/Ed25519 — the x402 token format.
 * Tokens are `header.payload.signature`, each part base64url-encoded.
 */

const HEADER = { alg: "EdDSA", typ: "JWT" };

export function signJwt(payload: Record<string, unknown>, privateKeyMaterial: string): string {
  const keys = keyPairFromMaterial(privateKeyMaterial);
  const headerPart = bytesToBase64url(new TextEncoder().encode(JSON.stringify(HEADER)));
  const payloadPart = bytesToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerPart}.${payloadPart}`;
  const sig = keys.secretKey; // nacl secretKey is 64 bytes (seed || public)
  // nacl.sign.detached requires secretKey as bytes[64]
  const signature = signDetached(new TextEncoder().encode(signingInput), sig);
  return `${signingInput}.${bytesToBase64url(signature)}`;
}

function signDetached(data: Uint8Array, secretKey: Uint8Array): Uint8Array {
  // tweetnacl's sign.detached needs the 64-byte secret key.
  return nacl.sign.detached(data, secretKey);
}

export function parseJwt<T extends Record<string, unknown>>(token: string): {
  header: Record<string, unknown>;
  payload: T;
} | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[0] ?? ""))) as Record<string, unknown>;
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[1] ?? ""))) as T;
    return { header, payload };
  } catch {
    return null;
  }
}

/** Verify the signature of a JWS against an Ed25519 public key (hex). */
export function verifyJwt(token: string, publicKeyHex: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const signingInput = `${parts[0]}.${parts[1]}`;
  try {
    const signature = base64urlToBytes(parts[2] ?? "");
    return verifyEd25519(new TextEncoder().encode(signingInput), signature, publicKeyHex);
  } catch {
    return false;
  }
}

export function jwtClaims<T extends Record<string, unknown>>(token: string): T | null {
  return parseJwt<T>(token)?.payload ?? null;
}