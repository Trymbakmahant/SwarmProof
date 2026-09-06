import { describe, expect, it } from "vitest";
import {
  acceptPayment,
  createFacilitator,
  fromXPaymentHeader,
  toXPaymentHeader,
  usdToTinybars,
  tinybarsToUsd,
  usdToMicros,
  covers,
  x402ChallengeHeaders,
  parseXPpaymentHeaders,
  isExpired,
  signJwt,
  verifyJwt,
  jwtClaims,
  keyPairFromMaterial,
  MOCK_FEE_PAYER,
  type X402PaymentPayload,
  type X402PaymentRequirements,
} from "@swarmproof/x402";

const QUOTE: X402PaymentRequirements = {
  scheme: "exact",
  network: "hedera:testnet",
  amount: "1000000",
  payTo: "0.0.8011510",
  maxTimeoutSeconds: 300,
  asset: "0.0.0",
  extra: { feePayer: MOCK_FEE_PAYER, service: "swarmproof-audit", auditId: "audit_1", nonce: "n-1", expiresAt: new Date(Date.now() + 60_000).toISOString() },
};

const PAYLOAD: X402PaymentPayload = {
  x402Version: 2,
  scheme: "exact",
  network: "hedera:testnet",
  accepted: QUOTE,
  payload: { transaction: "bW9ja3RyYW5zYWN0aW9u" },
};

describe("x402 money math", () => {
  it("converts USD strings to micros and back", () => {
    expect(usdToMicros("1.00")).toBe(1_000_000n);
    expect(usdToMicros("0.10")).toBe(100_000n);
    expect(usdToMicros("-0.5")).toBe(-500_000n);
    expect(tinybarsToUsd("1000000", "1000000")).toBe("1");
    expect(tinybarsToUsd("100000", "1000000")).toBe("0.1");
  });

  it("converts USD to tinybars with the rate and covers() compares", () => {
    expect(usdToTinybars("1.00", "1000000")).toBe("1000000");
    expect(usdToTinybars("2.50", "1000000")).toBe("2500000");
    expect(covers("1000000", "1000000")).toBe(true);
    expect(covers("1000001", "1000000")).toBe(false);
  });
});

describe("x402 transport helpers", () => {
  it("round-trips the X-PAYMENT header", () => {
    const header = toXPaymentHeader(PAYLOAD);
    expect(fromXPaymentHeader(header)).toEqual(PAYLOAD);
    expect(fromXPaymentHeader("garbage")).toBeNull();
    expect(fromXPaymentHeader(Buffer.from('{"x402Version":1}').toString("base64"))).toBeNull();
  });

  it("builds challenge headers and parses them back", () => {
    const headers = x402ChallengeHeaders("https://api.local/x402/audits/a1");
    expect(headers["www-authenticate"]).toBe('X402 resource="https://api.local/x402/audits/a1"');
    const parsed = parseXPpaymentHeaders({ "x-payment": toXPaymentHeader(PAYLOAD) });
    expect(parsed).toEqual(PAYLOAD);
    expect(parseXPpaymentHeaders({})).toBeNull();
  });

  it("detects expired quotes", () => {
    expect(isExpired(QUOTE)).toBe(false);
    expect(isExpired({ ...QUOTE, extra: { ...QUOTE.extra, expiresAt: new Date(Date.now() - 1000).toISOString() } })).toBe(true);
  });
});

describe("x402 facilitator client (mock)", () => {
  it("advertises hedera:testnet with a fee-payer", async () => {
    const f = createFacilitator({ forceMock: true });
    expect(f.mode).toBe("mock");
    const supported = await f.supported();
    expect(supported.kinds[0]?.network).toBe("hedera:testnet");
    expect(await f.feePayer("hedera:testnet")).toBe(MOCK_FEE_PAYER);
  });

  it("verifies and settles well-formed payloads", async () => {
    const f = createFacilitator({ forceMock: true });
    const verification = await f.verify(PAYLOAD, QUOTE);
    expect(verification.isValid).toBe(true);
    expect(verification.payer).toBeTruthy();
    const settlement = await f.settle(PAYLOAD, QUOTE);
    expect(settlement.success).toBe(true);
    expect(settlement.transaction).toMatch(/^0\.0\./);
  });

  it("rejects malformed payloads", async () => {
    const f = createFacilitator({ forceMock: true });
    const v = await f.verify({ ...PAYLOAD, accepted: { ...QUOTE, amount: "" } } as X402PaymentPayload, QUOTE);
    expect(v.isValid).toBe(false);
  });
});

describe("x402 server helpers", () => {
  it("accepts a valid payment for the exact quote", async () => {
    const f = createFacilitator({ forceMock: true });
    const result = await acceptPayment(f, PAYLOAD, {
      expectedNetwork: "hedera:testnet",
      expectedPayTo: QUOTE.payTo,
      expectedAsset: "0.0.0",
      minAmount: QUOTE.amount,
      expectedAuditId: "audit_1",
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("paid");
  });

  it("rejects mismatched recipient / amount / audit", async () => {
    const f = createFacilitator({ forceMock: true });
    const mismatchPayTo = await acceptPayment(f, PAYLOAD, { expectedPayTo: "0.0.9999999" });
    expect(mismatchPayTo.ok).toBe(false);
    expect(mismatchPayTo.status).toBe("mismatch");

    const lowAmount = await acceptPayment(f, PAYLOAD, { minAmount: "999999999999" });
    expect(lowAmount.ok).toBe(false);

    const wrongAudit = await acceptPayment(f, PAYLOAD, { expectedAuditId: "audit_2" });
    expect(wrongAudit.ok).toBe(false);
    expect(wrongAudit.reason).toMatch(/audit/);

    const expired = await acceptPayment(f, { ...PAYLOAD, accepted: { ...QUOTE, extra: { ...QUOTE.extra, expiresAt: new Date(Date.now() - 1000).toISOString() } } }, {});
    expect(expired.status).toBe("expired");
  });
});

describe("x402 signed claims (Ed25519 JWS)", () => {
  it("signs, verifies, and extracts claims", () => {
    const key = "302e020100300506032b657004220420" + "ab".repeat(32); // DER hex private key
    const token = signJwt({ sub: "0.0.7326075", aud: "swarmproof", exp: Math.floor(Date.now() / 1000) + 600 }, key);
    expect(verifyJwt(token, keyPairFromMaterial(key).publicKeyHex)).toBe(true);
    const claims = jwtClaims<{ sub: string }>(token);
    expect(claims?.sub).toBe("0.0.7326075");
  });
});