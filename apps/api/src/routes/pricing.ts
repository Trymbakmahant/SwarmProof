import { Hono } from "hono";
import { calculateAuditQuote, DEFAULT_TINYBARS_PER_USD, HEDERA_FAUCET_URL, type AuditTier } from "@swarmproof/payments";

export function createPricingRoutes(opts: {
  env?: NodeJS.ProcessEnv;
  network?: string;
  gatewayAddress?: string;
  agentDirectory?: () => any[];
}): Hono {
  const router = new Hono();
  const env = opts.env ?? process.env;
  const rate = Number(env.X402_TINYBARS_PER_USD) || Number(DEFAULT_TINYBARS_PER_USD);

  // POST /pricing/quote — calculate dynamic audit quote from Solidity source or parameters
  router.post("/pricing/quote", async (c) => {
    try {
      const body = await c.req
        .json<{
          source?: string;
          tier?: AuditTier;
          totalUSD?: string | number;
        }>()
        .catch((): { source?: string; tier?: AuditTier; totalUSD?: string | number } => ({}));

      const quote = calculateAuditQuote({
        source: body.source,
        tier: body.tier,
        totalUSD: body.totalUSD,
        tinybarsPerUSD: rate,
      });

      return c.json({
        ok: true,
        quote,
        pricingEngine: "SwarmProof Dynamic Complexity Sizing v2.0",
        currency: "USD",
        settlementAsset: env.X402_ASSET ?? "0.0.0 (HBAR)",
        network: opts.network ?? env.PAYMENT_NETWORK ?? "hedera:testnet",
        faucetUrl: HEDERA_FAUCET_URL,
      });
    } catch (err) {
      return c.json({ ok: false, error: (err as Error).message }, 400);
    }
  });

  // GET /pricing/quote — query pricing tiers and preview sizing
  router.get("/pricing/quote", (c) => {
    const tier = (c.req.query("tier") as AuditTier) || "standard";
    const totalUSD = c.req.query("totalUSD");
    const quote = calculateAuditQuote({
      tier,
      totalUSD,
      tinybarsPerUSD: rate,
    });

    return c.json({
      ok: true,
      quote,
      tiers: {
        quick: { bountyUSD: "$1.00", hbar: "1.00 ℏ", description: "5-domain heuristic scan + dual-agent consensus" },
        standard: { bountyUSD: "$1.00", hbar: "1.00 ℏ", description: "Standard 5-domain specialist swarm with AST validation" },
        deep: { bountyUSD: "$2.00", hbar: "2.00 ℏ", description: "10-agent DeepSeek reasoning + Foundry PoC verification + HCS proof" },
        "high-assurance": { bountyUSD: "$5.00", hbar: "5.00 ℏ", description: "Comprehensive formal invariants + economic MEV modeling + priority HCS proof" },
      },
      faucetUrl: HEDERA_FAUCET_URL,
    });
  });

  return router;
}
