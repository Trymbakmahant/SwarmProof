import { createFacilitator, MOCK_FEE_PAYER, type X402FacilitatorClient } from "./facilitator.js";
import { toXPaymentHeader, type X402PaymentPayload, type X402PaymentRequirements, type X402SettlementResult, type X402VerifyResult } from "./types.js";

/**
 * X402Client — the consumer side of the protocol. Any agent (or the SwarmProof
 * web dashboard) can buy an audit the way it would buy any x402-gated API:
 *
 *   1. discover()  — call the gated endpoint; a 402 with
 *                    `WWW-Authenticate: X402 resource="..."` reveals the
 *                    x402 resource URL.
 *   2. getRequirements() — GET the resource with `Accept: application/x402+json`
 *                    to receive the payment quote (amount, payTo, network,
 *                    asset, fee-payer, expiry).
 *   3. signPayment() — build + partially sign the payment (real: @x402/hedera
 *                    TransferTransaction; mock: offline payload).
 *   4. verify/settle — hand the payload to the Blocky402 facilitator, which
 *                    validates the signature and co-signs + broadcasts as
 *                    fee-payer (`transaction` = Hedera tx id).
 *   5. redeem() — replay the original request with the `X-PAYMENT` header
 *                    (base64 JSON payload) to unlock the resource.
 */
export interface X402SignerMaterial {
  accountId: string;
  privateKey: string;
  /** Defaults to the requirements network. */
  network?: string;
}

export interface X402ClientConfig {
  facilitator?: X402FacilitatorClient;
  signer?: X402SignerMaterial;
  /** "auto": mock when the facilitator is mock (offline).
   *  "live": require a real signer + real facilitator. */
  mode?: "auto" | "live";
}

export interface X402HttpRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
}

export interface X402HttpResponse {
  status: number;
  ok: boolean;
  data: unknown;
  text: string;
  header(name: string): string | undefined;
}

export interface DiscoverResult {
  response: X402HttpResponse;
  /** Present when the gated endpoint returned 402 + WWW-Authenticate: X402. */
  x402Resource?: string;
}

export interface BuyResult {
  requirements: X402PaymentRequirements;
  verification: X402VerifyResult;
  settlement: X402SettlementResult;
  response: X402HttpResponse;
  paid: boolean;
}

/** Small wrapper over fetch for testability. */
export type X402Fetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<X402HttpResponse>;

export function defaultFetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<X402HttpResponse> {
  return fetch(url, init).then((res) =>
    res
      .text()
      .then(async (text) => {
        let data: unknown = text;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          /* keep raw text for non-JSON bodies */
        }
        const headers = new Map<string, string>();
        res.headers.forEach((v, k) => headers.set(k.toLowerCase(), v));
        return {
          status: res.status,
          ok: res.ok,
          data,
          text,
          header: (name: string) => headers.get(name.toLowerCase()),
        } satisfies X402HttpResponse;
      }),
  );
}

function parseHederaPrivateKey(key: string, PrivateKeyClass: { fromString(k: string): any; fromStringECDSA?(k: string): any }): any {
  const trimmed = key.trim();
  if (trimmed.startsWith("0x") || (trimmed.length === 64 && !trimmed.startsWith("30"))) {
    try {
      if (typeof PrivateKeyClass.fromStringECDSA === "function") {
        return PrivateKeyClass.fromStringECDSA(trimmed.replace(/^0x/, ""));
      }
    } catch {
      // fall through
    }
  }
  return PrivateKeyClass.fromString(trimmed);
}

export class X402Client {
  readonly facilitator: X402FacilitatorClient;
  private readonly signer?: X402SignerMaterial;
  private readonly liveMode: boolean;
  private readonly fetcher: X402Fetch;

  constructor(config: X402ClientConfig = {}, fetcher: X402Fetch = defaultFetch) {
    this.facilitator = config.facilitator ?? createFacilitator({ forceMock: true });
    this.signer = config.signer;
    // Live requires a real facilitator AND a signer; "auto" forces offline.
    const canLive = Boolean(config.signer) && this.facilitator.mode === "real";
    this.liveMode = config.mode === "auto" ? false : canLive;
    this.fetcher = fetcher;
  }

  get mode(): "live" | "mock" {
    return this.liveMode ? "live" : "mock";
  }

  /** Raw request with X-PAYMENT support; exposes parsed headers/body. */
  async request(url: string, req: X402HttpRequest = {}, extraHeaders: Record<string, string> = {}): Promise<X402HttpResponse> {
    const body = req.body === undefined ? undefined : typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const headers: Record<string, string> = { ...(req.headers ?? {}) };
    if (body !== undefined && !headers["content-type"]) headers["content-type"] = "application/json";
    Object.assign(headers, extraHeaders);
    return this.fetcher(url, { method: req.method ?? (body !== undefined ? "POST" : "GET"), headers, body });
  }

  /**
   * Call a gated endpoint. Two outcomes:
   *  - 2xx/other: returned as-is, `x402Resource` will be undefined.
   *  - 402 with `WWW-Authenticate: X402 resource="<url>"`: the resource URL is
   *    parsed and returned so the caller can fetch payment requirements.
   */
  async discover(gatedUrl: string, req: X402HttpRequest = {}): Promise<DiscoverResult> {
    const response = await this.request(gatedUrl, req);
    const auth = response.header("www-authenticate");
    if (response.status === 402 && auth) {
      const m = /X402\s+resource="([^"]+)"/.exec(auth);
      if (m?.[1]) return { response, x402Resource: m[1] };
    }
    return { response };
  }

  /** Fetch the payment quote served by the x402 resource endpoint. */
  async getRequirements(resourceUrl: string): Promise<X402PaymentRequirements> {
    const res = await this.request(resourceUrl, { method: "GET", headers: { accept: "application/x402+json" } });
    if (!res.ok) throw new Error(`x402 getRequirements -> ${res.status}: ${res.text.slice(0, 200)}`);
    const data = res.data as X402PaymentRequirements | { x402Version: number; accepts?: X402PaymentRequirements[]; resource?: unknown };
    // v2 envelope ({ resource, accepts[] }) or a bare requirements object.
    if (data && typeof data === "object" && "accepts" in data && Array.isArray((data as { accepts?: unknown[] }).accepts)) {
      const first = (data as { accepts: X402PaymentRequirements[] }).accepts[0];
      if (first) return first;
    }
    if (data && typeof data === "object" && "amount" in data && "payTo" in data) return data as X402PaymentRequirements;
    throw new Error("x402 getRequirements: unrecognized quote shape");
  }

  /** Build the quoted fee-payer (facilitator co-signer) into requirements. */
  async withFeePayer(requirements: X402PaymentRequirements): Promise<X402PaymentRequirements> {
    if (requirements.extra?.feePayer) return requirements;
    const feePayer = await this.facilitator.feePayer(requirements.network);
    if (!feePayer) throw new Error(`x402: facilitator has no fee-payer for ${requirements.network}`);
    return { ...requirements, extra: { ...requirements.extra, feePayer } };
  }

  /**
   * Sign a payment payload for the quote.
   *  - live: @x402/hedera`ExactHederaScheme` — partially signs a real
   *    Hedera TransferTransaction for the payer (facilitator co-signs later).
   *  - mock: a deterministic offline payload (used by tests/demo without keys).
   */
  async signPayment(requirements: X402PaymentRequirements): Promise<X402PaymentPayload> {
    const withFeePayer = await this.withFeePayer(requirements);
    if (this.liveMode && this.signer) return this.signLive(withFeePayer);
    return this.signMock(withFeePayer);
  }

  private async signLive(requirements: X402PaymentRequirements): Promise<X402PaymentPayload> {
    const hedera = await import("@x402/hedera");
    const { ExactHederaScheme } = await import("@x402/hedera/exact/client");
    const network = requirements.network.startsWith("hedera:") ? requirements.network : `hedera:${requirements.network}`;
    const signer = hedera.createClientHederaSigner(
      this.signer!.accountId,
      parseHederaPrivateKey(this.signer!.privateKey, hedera.PrivateKey),
      { network: network as "hedera:testnet" | "hedera:mainnet" },
    );
    const scheme = new ExactHederaScheme(signer);
    const signed = await scheme.createPaymentPayload(2, requirements as never);
    const payload = signed.payload as { transaction: string };
    return {
      x402Version: 2,
      scheme: "exact",
      network: requirements.network,
      accepted: requirements,
      payload,
    };
  }

  private signMock(requirements: X402PaymentRequirements): X402PaymentPayload {
    const tx = Buffer.from(
      JSON.stringify({ mock: true, network: requirements.network, amount: requirements.amount, payTo: requirements.payTo, nonce: requirements.extra?.nonce ?? "mock" }),
    ).toString("base64");
    return { x402Version: 2, scheme: "exact", network: requirements.network, accepted: requirements, payload: { transaction: tx } };
  }

  /** Validate with the facilitator. */
  verifyPayment(payload: X402PaymentPayload, requirements = payload.accepted): Promise<X402VerifyResult> {
    return this.facilitator.verify(payload, requirements);
  }

  /** Settle through the facilitator (broadcasts the transfer). */
  settlePayment(payload: X402PaymentPayload, requirements = payload.accepted): Promise<X402SettlementResult> {
    return this.facilitator.settle(payload, requirements);
  }

  /** Re-request a resource presenting the settled payment (X-PAYMENT header). */
  redeem(resourceUrl: string, payload: X402PaymentPayload, req: X402HttpRequest = {}): Promise<X402HttpResponse> {
    return this.request(resourceUrl, req, { "x-payment": toXPaymentHeader(payload) });
  }

  /**
   * One-shot buy: discover -> quote -> sign -> verify -> settle -> replay the
   * original request with X-PAYMENT. The server verifies the payload again
   * before serving (defense in depth) — see X402Server.acceptPayment.
   */
  async buy(gatedUrl: string, req: X402HttpRequest = {}): Promise<BuyResult> {
    const discovered = await this.discover(gatedUrl, req);
    if (!discovered.x402Resource) {
      throw new Error(`x402 buy: endpoint did not issue a 402 challenge (status ${discovered.response.status})`);
    }
    const requirements = await this.getRequirements(discovered.x402Resource);
    const payload = await this.signPayment(requirements);
    const verification = await this.verifyPayment(payload, requirements);
    if (!verification.isValid) {
      throw new Error(`x402 buy: facilitator rejected payment: ${verification.invalidMessage ?? verification.invalidReason}`);
    }
    const settlement = await this.settlePayment(payload, requirements);
    if (!settlement.success) {
      throw new Error(`x402 buy: settlement failed: ${settlement.errorMessage ?? settlement.errorReason}`);
    }
    const response = await this.redeem(gatedUrl, payload, req);
    return { requirements, verification, settlement, response, paid: true };
  }
}

export type { X402FacilitatorClient };
export { MOCK_FEE_PAYER } from "./facilitator.js";