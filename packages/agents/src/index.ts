import { z } from "zod";

/** Phases of a swarm audit run. */
export const AgentRole = z.enum(["analyzer", "exploiter", "verifier", "judge"]);
export type AgentRole = z.infer<typeof AgentRole>;

export const Severity = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof Severity>;

export const AgentPhase = z.enum([
  "queued",
  "analyzing",
  "exploiting",
  "verifying",
  "judging",
  "done",
  "failed",
]);
export type AgentPhase = z.infer<typeof AgentPhase>;

export const FindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  severity: Severity,
  location: z.string(),
  evidence: z.array(z.string()),
  status: z.enum(["proposed", "contested", "verified", "rejected"]),
});
export type Finding = z.infer<typeof FindingSchema>;

export const AgentMessageSchema = z.object({
  id: z.string(),
  runId: z.string(),
  role: AgentRole,
  phase: AgentPhase,
  content: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  artifactIds: z.array(z.string()).optional(),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export interface AgentConfig {
  role: AgentRole;
  model: string;
  temperature: number;
  maxTokens: number;
  budget: number; // max cost units for this agent
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** LLM provider abstraction — OpenAI, Ollama, or a deterministic stub. */
export interface LLMProvider {
  complete(system: string, messages: ProviderMessage[], config: AgentConfig): Promise<string>;
  readonly name: string;
}

/** Deterministic stub provider for tests & offline demo. Mirrors prompt text back. */
export class StubProvider implements LLMProvider {
  readonly name = "stub";

  async complete(system: string, messages: ProviderMessage[]): Promise<string> {
    const last = messages.at(-1);
    return `[stub:${this.name}] system=${system.length} chars; last=${last?.content.slice(0, 80) ?? ""}...`;
  }
}

export const ROLE_PROMPTS: Record<AgentRole, string> = {
  analyzer:
    "You are a smart-contract security analyst in a swarm audit. List candidate vulnerabilities with location, category, severity guess, reasoning, and required evidence. Be specific; cite code.",
  exploiter:
    "You are an adversarial security researcher. Disprove or prove other agents' findings by constructing concrete attacks with exact call paths and PoC. Never hand-wave.",
  verifier:
    "You are an automated verification agent. Reproduce vulnerabilities with tooling (solc, slither, forge). Report per-finding: reproduced, artifact, adjusted severity. JSON only.",
  judge:
    "You are the lead judge. Given findings, exploiter arguments, verifier artifacts: deliver final verdicts, per-finding confidence, disputes, and a 3-line executive summary.",
};

export const DEFAULT_AGENT_CONFIGS: Record<AgentRole, AgentConfig> = {
  analyzer: { role: "analyzer", model: "stub", temperature: 0, maxTokens: 2048, budget: 10 },
  exploiter: { role: "exploiter", model: "stub", temperature: 0, maxTokens: 2048, budget: 10 },
  verifier: { role: "verifier", model: "stub", temperature: 0, maxTokens: 2048, budget: 10 },
  judge: { role: "judge", model: "stub", temperature: 0, maxTokens: 2048, budget: 10 },
};