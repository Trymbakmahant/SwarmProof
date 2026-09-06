import type {
  X402FacilitatorHealth,
  X402FacilitatorMode,
  X402PaymentPayload,
  X402PaymentRequirements,
  X402SettlementResult,
  X402SupportedResponse,
  X402VerifyResult,
} from "./types.js";

/**
 * Blocky402 facilitator client (x402 v2).
 *
 * Reference: https://blocky402.com/docs/api-reference/
 *   GET  /supported  -> supported networks + the Hedera fee-payer account
 *   POST /verify     -> validate a signed payment payload
 *   POST /settle     -> co-sign + broadcast the transfer (fee payer = facilitator)
 *   GET  /health
 *
 * Defaults to the hosted testnet (open access, no API key). Mainnet uses
 * `X-Api-Key` when `apiKey` is set.
 */
export interface X402FacilitatorConfig {
  baseUrl?: string;
  apiKey?: string;
}

export interface X402FacilitatorClient {
  readonly mode: X402FacilitatorMode;
  readonly baseUrl: string;
  supported(): Promise<X402SupportedResponse>;
  /** Fee-payer account the facilitator co-signs as, for `network`. */
  feePayer(network?: string): Promise<string | undefined>;
  verify(payload: X402PaymentPayload, requirements: X402PaymentRequirements): Promise<X402VerifyResult>;
  settle(payload: X402PaymentPayload, requirements: X402PaymentRequirements): Promise<X402SettlementResult>;
  health(): Promise<X402FacilitatorHealth>;
}

export const DEFAULT_FACILITATOR_URL = "https://api.testnet.blocky402.com";
export const DEFAULT_X402_NETWORK = "hedera:testnet";

/* ------------------------------------------------------------------ */

class Blocky402FacilitatorClient implements X402FacilitatorClient {
  readonly mode = "real" as const;
  readonly baseUrl: string;
  private readonly apiKey?: string;
  private supportedCache: X402SupportedResponse | null = null;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (this.apiKey) h["x-api-key"] = this.apiKey;
    return h;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Blocky402 ${path} -> ${res.status} ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async supported(): Promise<X402SupportedResponse> {
    if (!this.supportedCache) this.supportedCache = await this.request<X402SupportedResponse>("/supported");
    return this.supportedCache;
  }

  async feePayer(network = DEFAULT_X402_NETWORK): Promise<string | undefined> {
    const sup = await this.supported();
    const kind = sup.kinds.find((k) => k.network === network);
    const fromKind = kind?.extra?.feePayer;
    if (fromKind) return fromKind;
    const signer = sup.signers[network.startsWith("hedera") ? "hedera:*" : `${network.split(":")[0]}:*`];
    void signer;
    // Fall back to scanning signers for any key whose prefix could match.
    for (const [k, addrs] of Object.entries(sup.signers)) {
      if (network.startsWith(k.split(":")[0] ?? "hedera")) return addrs[0];
    }
    return undefined;
  }

  async verify(payload: X402PaymentPayload, requirements: X402PaymentRequirements): Promise<X402VerifyResult> {
    return this.request<X402VerifyResult>("/verify", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ x402Version: 2, paymentPayload: payload, paymentRequirements: requirements }),
    });
  }

  async settle(payload: X402PaymentPayload, requirements: X402PaymentRequirements): Promise<X402SettlementResult> {
    return this.request<X402SettlementResult>("/settle", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ x402Version: 2, paymentPayload: payload, paymentRequirements: requirements }),
    });
  }

  async health(): Promise<X402FacilitatorHealth> {
    return this.request<X402FacilitatorHealth>("/health");
  }
}

/* ------------------------------------------------------------------ */

/** Default network + fee-payer used by the offline mock. */
export const MOCK_FEE_PAYER = "0.0.1002001";
export const MOCK_NETWORK = DEFAULT_X402_NETWORK;

/**
 * Fully offline facilitator: accepts any well-formed payload and settles
 * with a fake transaction id. Powering the demo and the CI e2e suite —
 * everything before the live-signing step behaves identically to Blocky402.
 */
class MockFacilitatorClient implements X402FacilitatorClient {
  readonly mode = "mock" as const;
  readonly baseUrl = "mock://blocky402";

  async supported(): Promise<X402SupportedResponse> {
    return {
      kinds: [
        { scheme: "exact", network: MOCK_NETWORK, x402Version: 2, extra: { feePayer: MOCK_FEE_PAYER } },
      ],
      extensions: [],
      signers: { "hedera:*": [MOCK_FEE_PAYER] },
    };
  }

  async feePayer(_network = DEFAULT_X402_NETWORK): Promise<string | undefined> {
    return MOCK_FEE_PAYER;
  }

  async verify(payload: X402PaymentPayload): Promise<X402VerifyResult> {
    if (!payload?.accepted?.amount || !payload?.accepted?.payTo) {
      return { isValid: false, invalidReason: "MalformedPayload", invalidMessage: "mock: missing accepted.amount/payTo" };
    }
    return { isValid: true, payer: "0.0.1002002" };
  }

  async settle(payload: X402PaymentPayload): Promise<X402SettlementResult> {
    if (!payload?.accepted?.amount) return { success: false, transaction: "", network: MOCK_NETWORK, errorReason: "malformed", errorMessage: "mock: missing amount" };
    return { success: true, transaction: `0.0.1002001@${Math.floor(Date.now() / 1000)}.123456789`, network: MOCK_NETWORK, payer: "0.0.1002002" };
  }

  async health(): Promise<X402FacilitatorHealth> {
    return { status: "ok", timestamp: new Date().toISOString(), version: "mock" };
  }
}

/* ------------------------------------------------------------------ */

/**
 * Create a facilitator client. Pass `baseUrl: "mock://"` (or omit and set
 * `forceMock`) for offline mode — used when no X402_FACILITATOR_URL is set.
 */
export function createFacilitator(config: X402FacilitatorConfig & { forceMock?: boolean } = {}): X402FacilitatorClient {
  const baseUrl = config.baseUrl?.trim() || DEFAULT_FACILITATOR_URL;
  if (config.forceMock || baseUrl.startsWith("mock")) return new MockFacilitatorClient();
  return new Blocky402FacilitatorClient(baseUrl, config.apiKey);
}