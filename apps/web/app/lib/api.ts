/**
 * Dynamically resolves the active SwarmProof API URL:
 * 1. Respects NEXT_PUBLIC_API_BASE if explicitly set in environment
 * 2. In browser production (non-localhost), routes to the live deployed Vercel API
 * 3. In local development, falls back to http://localhost:3001
 */
export function getApiBase(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return "https://swarm-proof-api.vercel.app";
    }
  }
  if (typeof process !== "undefined" && (process.env?.VERCEL || process.env?.NODE_ENV === "production")) {
    return "https://swarm-proof-api.vercel.app";
  }
  return "http://localhost:3001";
}
