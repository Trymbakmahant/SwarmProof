import type { AgentConfig, Finding, LLMProvider, ProviderMessage, Severity } from "./index.js";
import type { SpecialistId } from "./specialists.js";

export type { LLMProvider };
export type EnvMap = Record<string, string | undefined>;
declare const process: { env: Record<string, string | undefined> } | undefined;

/**
 * Universal LLM provider client supporting:
 *  - OpenAI (and any OpenAI-compatible API: OpenRouter, DeepSeek, Groq, Together)
 *  - Anthropic (Claude 3.5 Sonnet / Claude 3 Haiku)
 *  - Ollama (local private models: DeepSeek-Coder, CodeLlama)
 *  - StubProvider (deterministic offline fallback)
 */

export interface LLMClientConfig {
  provider: "openai" | "fireworks" | "anthropic" | "ollama" | "stub";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

/* ------------------------------------------------------------------ */
/* 1. OpenAI Provider (works with OpenAI, OpenRouter, Groq, DeepSeek)  */
/* ------------------------------------------------------------------ */

export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: { apiKey: string; baseUrl?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.model = config.model ?? "gpt-4o-mini";
    this.name = `openai:${this.model}`;
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  async complete(system: string, messages: ProviderMessage[], config?: AgentConfig): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const formattedMessages = [
      { role: "system", content: system },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: config?.model && config.model !== "default" && config.model !== "stub" ? config.model : this.model,
          messages: formattedMessages,
          temperature: config?.temperature ?? 0.1,
          max_tokens: config?.maxTokens ?? 3000,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`OpenAI API error [${res.status}]: ${errText.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenAI API returned empty response content");
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 2. Fireworks AI Provider (DeepSeek-V3, Qwen 2.5 Coder, Llama 3.3)   */
/* ------------------------------------------------------------------ */

export class FireworksProvider implements LLMProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(
    config: { apiKey: string; baseUrl?: string; model?: string; timeoutMs?: number },
    fetchFn?: typeof fetch,
  ) {
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl ?? "https://api.fireworks.ai/inference/v1").replace(/\/$/, "");
    this.model = config.model ?? "accounts/fireworks/models/deepseek-v4p1-flash";
    this.name = `fireworks:${this.model}`;
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.fetchFn = fetchFn ?? fetch;
  }

  async complete(system: string, messages: ProviderMessage[], config?: AgentConfig): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const formattedMessages = [
      { role: "system", content: system },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      const res = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: config?.model && config.model !== "default" && config.model !== "stub" ? config.model : this.model,
          messages: formattedMessages,
          temperature: config?.temperature ?? 0.1,
          max_tokens: config?.maxTokens ?? 3000,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Fireworks API error [${res.status}]: ${errText.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
      };

      const msg = data.choices?.[0]?.message;
      let content = msg?.content?.trim();
      if (!content && msg?.reasoning_content) {
        content = msg.reasoning_content.trim();
      }
      if (!content) throw new Error("Fireworks API returned empty response content");
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 2. Anthropic Provider (Claude 3.5 Sonnet / Haiku)                   */
/* ------------------------------------------------------------------ */

export class AnthropicProvider implements LLMProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: { apiKey: string; baseUrl?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.anthropic.com/v1").replace(/\/$/, "");
    this.model = config.model ?? "claude-3-5-sonnet-20241022";
    this.name = `anthropic:${this.model}`;
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  async complete(system: string, messages: ProviderMessage[], config?: AgentConfig): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const userAndAssistant = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Anthropic requires at least one message
    if (userAndAssistant.length === 0) {
      userAndAssistant.push({ role: "user", content: "Analyze the smart contract." });
    }

    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config?.model && config.model !== "default" && config.model !== "stub" ? config.model : this.model,
          system,
          messages: userAndAssistant,
          temperature: config?.temperature ?? 0.1,
          max_tokens: config?.maxTokens ?? 3000,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Anthropic API error [${res.status}]: ${errText.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };

      const text = data.content?.find((c) => c.type === "text")?.text;
      if (!text) throw new Error("Anthropic API returned empty message content");
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 3. Ollama Provider (Local self-hosted models)                       */
/* ------------------------------------------------------------------ */

export class OllamaProvider implements LLMProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: { baseUrl?: string; model?: string; timeoutMs?: number }) {
    this.baseUrl = (config.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
    this.model = config.model ?? "deepseek-coder-v2";
    this.name = `ollama:${this.model}`;
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async complete(system: string, messages: ProviderMessage[], config?: AgentConfig): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const formattedMessages = [
      { role: "system", content: system },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: config?.model && config.model !== "default" && config.model !== "stub" ? config.model : this.model,
          messages: formattedMessages,
          temperature: config?.temperature ?? 0.1,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Ollama API error [${res.status}]: ${errText.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Ollama returned empty response content");
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 4. JSON Response Parser & Helpers                                   */
/* ------------------------------------------------------------------ */

/**
 * Robustly extract a JSON object or array from raw LLM text that may contain
 * markdown code blocks (```json ... ```) or conversational commentary.
 */
export function extractJsonFromLlmResponse(text: string): unknown {
  const trimmed = text.trim();

  // 1. Direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue to regex extraction */
  }

  // 2. Markdown ```json ... ``` block
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      /* continue */
    }
  }

  // 3. Balanced brace match for outermost { ... }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      /* continue */
    }
  }

  // 4. Balanced bracket match for outermost [ ... ]
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
    } catch {
      /* continue */
    }
  }

  throw new Error("Could not extract valid JSON from LLM response");
}

const VALID_SEVERITIES: Set<Severity> = new Set(["critical", "high", "medium", "low", "info"]);

function sanitizeSeverity(sev: unknown): Severity {
  if (typeof sev === "string") {
    const s = sev.toLowerCase().trim() as Severity;
    if (VALID_SEVERITIES.has(s)) return s;
  }
  return "medium";
}

export interface RawLlmFindingItem {
  category?: string;
  severity?: string;
  title?: string;
  location?: string;
  evidence?: string | string[];
  reasoning?: string;
  detail?: string;
}

/**
 * Parse and normalize findings from LLM output into typed Finding objects.
 */
export function parseLLMFindings(rawResponse: string, agentId: SpecialistId): Finding[] {
  let parsed: unknown;
  try {
    parsed = extractJsonFromLlmResponse(rawResponse);
  } catch {
    return [];
  }

  let items: RawLlmFindingItem[] = [];
  if (Array.isArray(parsed)) {
    items = parsed as RawLlmFindingItem[];
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.findings)) {
      items = obj.findings as RawLlmFindingItem[];
    } else if (Array.isArray(obj.vulnerabilities)) {
      items = obj.vulnerabilities as RawLlmFindingItem[];
    }
  }

  const findings: Finding[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") continue;

    const category = (item.category ?? agentId.replace("-agent", "")).toLowerCase().replace(/\s+/g, "-");
    const severity = sanitizeSeverity(item.severity);
    const location = String(item.location ?? "contract");
    const title = String(item.title ?? `${category.replace(/-/g, " ")} (${agentId})`);

    const evidenceList: string[] = [];
    if (Array.isArray(item.evidence)) {
      evidenceList.push(...item.evidence.map(String));
    } else if (typeof item.evidence === "string" && item.evidence) {
      evidenceList.push(item.evidence);
    }
    if (item.reasoning && typeof item.reasoning === "string") {
      evidenceList.push(item.reasoning);
    }
    if (item.detail && typeof item.detail === "string") {
      evidenceList.push(item.detail);
    }
    if (evidenceList.length === 0) {
      evidenceList.push(`${agentId} identified candidate vulnerability in ${location}`);
    }

    findings.push({
      id: `${agentId}-${category}-${findings.length}`,
      title,
      category,
      severity,
      location,
      evidence: evidenceList,
      status: "proposed",
    });
  }

  return findings;
}

/* ------------------------------------------------------------------ */
/* 5. Environment Auto-Detection Factory                               */
/* ------------------------------------------------------------------ */

/**
 * Create an LLM provider based on available environment variables:
 *  1. FIREWORKS_API_KEY -> FireworksProvider (DeepSeek-V3 / Qwen 2.5 Coder)
 *  2. ANTHROPIC_API_KEY -> AnthropicProvider (Claude 3.5 Sonnet)
 *  3. OPENAI_API_KEY -> OpenAIProvider (GPT-4o / GPT-4o-mini)
 *  4. OLLAMA_BASE_URL -> OllamaProvider (Local models)
 *  5. None -> returns undefined (signals heuristic fallback mode)
 */
export function createLLMProviderFromEnv(
  env: EnvMap = typeof process !== "undefined" && process?.env ? process.env : {},
): LLMProvider | undefined {
  if (env.SWARMPROOF_USE_MOCK_AGENTS === "true") {
    return undefined;
  }

  const fireworksKey = env.FIREWORKS_API_KEY ?? env.SWARMPROOF_FIREWORKS_API_KEY;
  if (fireworksKey) {
    return new FireworksProvider({
      apiKey: fireworksKey.trim(),
      baseUrl: env.FIREWORKS_BASE_URL ?? env.SWARMPROOF_FIREWORKS_BASE_URL,
      model: env.FIREWORKS_MODEL ?? env.SWARMPROOF_LLM_MODEL ?? "accounts/fireworks/models/deepseek-v4p1-flash",
    });
  }

  const anthropicKey = env.ANTHROPIC_API_KEY ?? env.SWARMPROOF_ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return new AnthropicProvider({
      apiKey: anthropicKey,
      baseUrl: env.ANTHROPIC_BASE_URL,
      model: env.ANTHROPIC_MODEL ?? env.SWARMPROOF_LLM_MODEL ?? "claude-3-5-sonnet-20241022",
    });
  }

  const openAiKey = env.OPENAI_API_KEY ?? env.SWARMPROOF_OPENAI_API_KEY;
  if (openAiKey) {
    return new OpenAIProvider({
      apiKey: openAiKey,
      baseUrl: env.OPENAI_BASE_URL ?? env.SWARMPROOF_OPENAI_BASE_URL,
      model: env.OPENAI_MODEL ?? env.SWARMPROOF_LLM_MODEL ?? "gpt-4o-mini",
    });
  }

  const ollamaUrl = env.OLLAMA_BASE_URL ?? env.SWARMPROOF_OLLAMA_BASE_URL;
  if (ollamaUrl) {
    return new OllamaProvider({
      baseUrl: ollamaUrl,
      model: env.OLLAMA_MODEL ?? env.SWARMPROOF_LLM_MODEL ?? "deepseek-coder-v2",
    });
  }

  return undefined;
}
