import { EventEmitter } from "node:events";
import {
  DEFAULT_AGENT_CONFIGS,
  ROLE_PROMPTS,
  type AgentConfig,
  type AgentMessage,
  type AgentRole,
  type Finding,
  type LLMProvider,
} from "@swarmproof/agents";
import { AgentRegistry, runPlugin, type AgentPlugin } from "@swarmproof/plugins";

export interface SwarmRunInput {
  runId: string;
  contractSource: string;
  contractName: string;
  compiler?: string;
  agents: Partial<Record<AgentRole, AgentConfig>>;
  /** Third-party agents to run after the built-in phases (plugin ecosystem). */
  plugins?: AgentPlugin[];
  /** Per-run user config for plugins, keyed by plugin id. */
  pluginConfig?: Record<string, Record<string, unknown>>;
}

export type SwarmEventMap = {
  message: [AgentMessage];
  finding: [Finding];
  /** Phase events. With plugins the role is a free-form string (plugin role or custom). */
  phase: [string, "start" | "end"];
  done: [{ runId: string; findings: Finding[] }];
  failed: [{ runId: string; error: string }];
};

export interface SwarmHooks {
  runPhase(
    role: AgentRole,
    context: { input: SwarmRunInput; messages: AgentMessage[]; findings: Finding[] },
    config: AgentConfig,
  ): Promise<AgentMessage[]>;
}

/** Default phase runner: delegates each agent role to the configured LLM provider. */
export type SwarmRunnerDeps = {
  provider: LLMProvider;
  hooks?: SwarmHooks;
  /** Ecosystem registry — plugins from it run on every audit unless overridden per-run. */
  registry?: AgentRegistry;
};

const PHASE_ORDER: AgentRole[] = ["analyzer", "exploiter", "verifier", "judge"];

const ROLE_PHASE: Record<AgentRole, AgentMessage["phase"]> = {
  analyzer: "analyzing",
  exploiter: "exploiting",
  verifier: "verifying",
  judge: "judging",
};

/**
 * Orchestrates a structured multi-phase audit:
 * analyze → exploit → verify → judge.
 * Emits typed events for live streaming (API/Web SSE).
 */
export class SwarmRunner {
  private readonly events = new EventEmitter();

  constructor(private readonly deps: SwarmRunnerDeps) {}

  on<K extends keyof SwarmEventMap>(event: K, listener: (...args: SwarmEventMap[K]) => void): void {
    this.events.on(event, listener as (...args: unknown[]) => void);
  }

  /** Default phase executor: one provider call per role, guided by ROLE_PROMPTS. */
  private defaultHooks(): SwarmHooks {
    const provider = this.deps.provider;
    return {
      async runPhase(role, ctx, config) {
        const system = ROLE_PROMPTS[role];
        const user = [
          `Contract: ${ctx.input.contractName}`,
          `Source:\n${ctx.input.contractSource}`,
          `Prior context: ${ctx.messages.length} messages, ${ctx.findings.length} candidate findings.`,
          `Return structured findings for role=${role}.`,
        ].join("\n");
        const out = await provider.complete(system, [{ role: "user", content: user }], config);
        return [
          {
            id: `${ctx.input.runId}-${role}-${ctx.messages.length}`,
            runId: ctx.input.runId,
            role,
            phase: ROLE_PHASE[role],
            content: out,
            confidence: 0.5,
            artifactIds: [],
          },
        ];
      },
    };
  }

  async run(input: SwarmRunInput): Promise<{ runId: string; findings: Finding[] }> {
    const messages: AgentMessage[] = [];
    const findings: Finding[] = [];
    const hooks = this.deps.hooks ?? this.defaultHooks();
    const agents = { ...DEFAULT_AGENT_CONFIGS, ...input.agents };
    const plugins = input.plugins ?? this.deps.registry?.list() ?? [];

    // Built-in roles: the core 4-phase swarm.
    for (const role of PHASE_ORDER) {
      const config = agents[role];
      const context = { input, messages, findings };
      this.events.emit("phase", role, "start");
      const roleMessages = (await hooks.runPhase(role, context, config)) ?? [];

      for (const msg of roleMessages) {
        this.events.emit("message", msg);
        messages.push(msg);
        if (msg.artifactIds && msg.artifactIds.length > 0 && msg.confidence !== undefined) {
          const f = this.deriveFinding(input, role, msg, findings);
          findings.push(f);
          this.events.emit("finding", f);
        }
      }
      this.events.emit("phase", role, "end");
    }

    // Plugin ecosystem: every registered third-party agent contributes next.
    for (const plugin of plugins) {
      const role = plugin.manifest.role;
      this.events.emit("phase", `plugin:${plugin.manifest.id}`, "start");
      const produced = await runPlugin(
        {
          runId: input.runId,
          pluginId: plugin.manifest.id,
          contractName: input.contractName,
          contractSource: input.contractSource,
          role,
          messages,
          findings,
          config: input.pluginConfig?.[plugin.manifest.id] ?? {},
        },
        plugin,
      );
      for (const msg of produced) {
        this.events.emit("message", msg);
        messages.push(msg);
        if (msg.artifactIds && msg.artifactIds.length > 0 && msg.confidence !== undefined) {
          const f = this.deriveFinding(input, role, msg, findings);
          findings.push(f);
          this.events.emit("finding", f);
        }
      }
      this.events.emit("phase", `plugin:${plugin.manifest.id}`, "end");
    }

    const result = { runId: input.runId, findings };
    this.events.emit("done", result);
    return result;
  }

  /** Minimal finding derivation — real parsing lands with consensus package (M2). */
  private deriveFinding(
    input: SwarmRunInput,
    role: AgentRole,
    msg: AgentMessage,
    findings: Finding[],
  ): Finding {
    return {
      id: `${input.runId}-${role}-${findings.length}`,
      title: `Candidate from ${role}`,
      category: "unclassified",
      severity: "medium",
      location: msg.content.slice(0, 80),
      evidence: msg.artifactIds ?? [],
      status: "proposed",
    };
  }
}

export * from "./orchestrator.js";