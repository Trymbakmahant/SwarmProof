import { z } from "zod";
import {
  AgentRole,
  ROLE_PROMPTS,
  type AgentConfig,
  type AgentMessage,
  type AgentRole as AgentRoleType,
  type Finding,
  type LLMProvider,
} from "@swarmproof/agents";

/**
 * Agent Plugin Ecosystem
 * ----------------------
 * Anyone can plug their own agent into SwarmProof. A plugin is a manifest
 * (who & what it is) + an executor (how it runs). Executors can be:
 *   - "llm"      -> a local LLMProvider (OpenAI, Ollama, custom)
 *   - "http"     -> any remote agent/API (POST JSON, returns a message)
 *   - "function" -> an in-process function (TS demo / thin wrappers)
 *
 * Plugins occupy one of the four built-in role slots (analyzer, exploiter,
 * verifier, judge) and can declare a custom consensus `weight` so their
 * opinion counts differently than the built-in agent of the same role.
 */

export const AgentPluginManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().default(""),
  role: AgentRole,
  author: z.string().optional(),
  homepage: z.string().optional(),
  license: z.string().optional(),
  /** Consensus weight override. Falls back to ROLE_WEIGHTS[role] when unset. */
  weight: z.number().min(0).max(2).optional(),
  /** Custom system prompt for "llm" executors. Falls back to the built-in role prompt. */
  systemPrompt: z.string().optional(),
});
export type AgentPluginManifest = z.infer<typeof AgentPluginManifestSchema>;

/** Everything a plugin may need to reason about the current audit run. */
export interface PluginContext {
  runId: string;
  pluginId: string;
  contractName: string;
  contractSource: string;
  /** The role slot this plugin occupies. */
  role: AgentRoleType;
  /** Prior agent messages from this run (read-only). */
  messages: AgentMessage[];
  /** Candidate findings so far (read-only). */
  findings: Finding[];
  /** Per-run user config for this plugin (from SwarmRunInput.pluginConfig). */
  config: Record<string, unknown>;
}

export type PluginExecutor =
  | { type: "llm"; provider: LLMProvider; model?: string; temperature?: number; maxTokens?: number }
  | {
      type: "http";
      url: string;
      headers?: Record<string, string>;
      timeoutMs?: number;
      /** Map the remote JSON response -> message fields. Default: {content?, confidence?, artifactIds?} */
      mapResponse?: (json: unknown) => { content?: string; confidence?: number; artifactIds?: string[] };
    }
  | { type: "function"; invoke: (ctx: PluginContext) => Promise<AgentMessage | AgentMessage[] | void> };

export interface AgentPlugin {
  manifest: AgentPluginManifest;
  executor: PluginExecutor;
}

/** Build a well-formed AgentMessage for a plugin with sensible defaults. */
export function makePluginMessage(
  ctx: PluginContext,
  partial: Partial<Pick<AgentMessage, "content" | "confidence" | "artifactIds">>,
): AgentMessage {
  return {
    id: `${ctx.runId}-${ctx.pluginId}-${ctx.messages.length}`,
    runId: ctx.runId,
    role: ctx.role,
    phase: ctx.role === "verifier" ? "verifying" : ctx.role === "judge" ? "judging" : ctx.role === "exploiter" ? "exploiting" : "analyzing",
    content: partial.content ?? "",
    confidence: partial.confidence,
    artifactIds: partial.artifactIds,
  };
}

/** Execute a plugin and normalize its output into AgentMessage[]. */
export async function runPlugin(ctx: PluginContext, plugin: AgentPlugin): Promise<AgentMessage[]> {
  const ex = plugin.executor;
  switch (ex.type) {
    case "llm": {
      const rolePrompt = plugin.manifest.systemPrompt ?? ROLE_PROMPTS[ctx.role];
      const config: AgentConfig = {
        role: ctx.role,
        model: ex.model ?? "default",
        temperature: ex.temperature ?? 0,
        maxTokens: ex.maxTokens ?? 2048,
        budget: 10,
      };
      const user = [
        `Contract: ${ctx.contractName}`,
        `Source:\n${ctx.contractSource}`,
        `Prior context: ${ctx.messages.length} messages, ${ctx.findings.length} candidate findings.`,
      ].join("\n");
      const out = await ex.provider.complete(rolePrompt, [{ role: "user", content: user }], config);
      return [makePluginMessage(ctx, { content: out, confidence: 0.5 })];
    }
    case "http": {
      const payload = {
        runId: ctx.runId,
        pluginId: ctx.pluginId,
        contractName: ctx.contractName,
        contractSource: ctx.contractSource,
        role: ctx.role,
        config: ctx.config,
        recentMessages: ctx.messages.slice(-10),
      };
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), ex.timeoutMs ?? 30_000);
      let res: Response;
      try {
        res = await fetch(ex.url, {
          method: "POST",
          headers: { "content-type": "application/json", ...ex.headers },
          body: JSON.stringify(payload),
          signal: ac.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`plugin ${ctx.pluginId} http ${ex.url} -> ${res.status}`);
      const json: unknown = await res.json();
      const mapped = ex.mapResponse ? ex.mapResponse(json) : (json as { content?: string; confidence?: number; artifactIds?: string[] });
      return [
        makePluginMessage(ctx, {
          content: mapped.content ?? "",
          confidence: mapped.confidence,
          artifactIds: mapped.artifactIds,
        }),
      ];
    }
    case "function": {
      const out = await ex.invoke(ctx);
      if (!out) return [];
      return Array.isArray(out) ? out : [out];
    }
  }
}

/**
 * Registry of agent plugins. The entry point for third parties to
 * contribute agents to the ecosystem.
 */
export class AgentRegistry {
  private readonly plugins = new Map<string, AgentPlugin>();

  register(plugin: AgentPlugin): void {
    const parsed = AgentPluginManifestSchema.safeParse(plugin.manifest);
    if (!parsed.success) {
      throw new Error(`invalid plugin manifest: ${parsed.error.message}`);
    }
    if (this.plugins.has(plugin.manifest.id)) {
      throw new Error(`plugin already registered: ${plugin.manifest.id}`);
    }
    this.plugins.set(plugin.manifest.id, plugin);
  }

  unregister(id: string): boolean {
    return this.plugins.delete(id);
  }

  get(id: string): AgentPlugin | undefined {
    return this.plugins.get(id);
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }

  list(): AgentPlugin[] {
    return [...this.plugins.values()];
  }

  listByRole(role: AgentRoleType): AgentPlugin[] {
    return this.list().filter((p) => p.manifest.role === role);
  }

  count(): number {
    return this.plugins.size;
  }

  /** Consensus weight per plugin id (manifest.weight ?? built-in role weight). */
  weights(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of this.list()) {
      out[p.manifest.id] = p.manifest.weight ?? ROLE_WEIGHTS_FALLBACK[p.manifest.role];
    }
    return out;
  }
}

/** Mirrors @swarmproof/consensus ROLE_WEIGHTS for plugin weighting without a circular dep. */
const ROLE_WEIGHTS_FALLBACK: Record<AgentRoleType, number> = {
  analyzer: 0.3,
  exploiter: 0.35,
  verifier: 1.0,
  judge: 0.4,
};

export { AgentRole };
export type { AgentRoleType };

export { createKeywordAnalyzerPlugin, createKeywordAnalyzerHttpPlugin } from "./examples.js";