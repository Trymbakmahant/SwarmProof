import { makePluginMessage, type AgentPlugin, type PluginContext } from "./index.js";

/**
 * Example plugins you can register to prove the ecosystem works.
 * Each one is a valid third-party AgentPlugin — copy the pattern to ship your own.
 */

const KEYWORD_PATTERNS: Array<{ key: string; re: RegExp; severity: "critical" | "high" | "medium" | "low"; hint: string }> = [
  {
    key: "reentrancy",
    re: /\.call\{value:|\.send\(|\.transfer\(/i,
    severity: "critical",
    hint: "external value transfer — check state is updated before the call",
  },
  {
    key: "unchecked-call",
    re: /\.call\{(?!.*value)/i,
    severity: "medium",
    hint: "low-level call result not necessarily checked",
  },
  {
    key: "unchecked-arithmetic",
    re: /unchecked\s*\{/i,
    severity: "medium",
    hint: "arithmetic inside unchecked block can overflow/underflow",
  },
];

/**
 * A zero-cost in-process example: greps the source for classic bug
 * keywords and emits a finding when it hits. Proves the function-executor
 * path and gives the API demo real findings out of the box.
 */
export function createKeywordAnalyzerPlugin(): AgentPlugin {
  return {
    manifest: {
      id: "keyword-analyzer",
      name: "Keyword Analyzer",
      version: "1.0.0",
      description: "Flags classic vulnerability keywords (external value calls, unchecked arithmetic) in source.",
      role: "analyzer",
      author: "SwarmProof",
      license: "MIT",
      weight: 0.25,
    },
    executor: {
      type: "function",
      async invoke(ctx: PluginContext) {
        const hits = KEYWORD_PATTERNS.filter((p) => p.re.test(ctx.contractSource));
        if (hits.length === 0) return [];
        return [makePluginMessage(ctx, {
          content: `Keyword scan found ${hits.length} pattern(s): ${hits.map((h) => h.key).join(", ")}. ${hits[0]?.hint ?? ""}`,
          confidence: 0.6,
          artifactIds: hits.map((h) => `kw:${h.key}`),
        })];
      },
    },
  };
}

/** Same plugin, but exposed as a remote HTTP agent (self-hosting demo target). */
export function createKeywordAnalyzerHttpPlugin(url: string): AgentPlugin {
  return {
    manifest: {
      id: "keyword-analyzer-http",
      name: "Keyword Analyzer (HTTP)",
      version: "1.0.0",
      description: "Keyword analyzer running as a remote HTTP service.",
      role: "analyzer",
      author: "SwarmProof",
      license: "MIT",
      weight: 0.25,
    },
    executor: { type: "http", url, timeoutMs: 5_000 },
  };
}