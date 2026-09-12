import { describe, expect, it, vi } from "vitest";
import {
  createLLMProviderFromEnv,
  FireworksProvider,
  createSpecialistAgents,
  type SecurityTask,
} from "@swarmproof/agents";

describe("Fireworks AI LLM Provider", () => {
  it("initializes with default model and endpoint", () => {
    const provider = new FireworksProvider({ apiKey: "fw-test-key" });
    expect(provider.name).toContain("fireworks:accounts/fireworks/models/deepseek-v4p1-flash");
  });

  it("accepts a custom model and temperature", () => {
    const provider = new FireworksProvider({
      apiKey: "fw-test-key",
      model: "accounts/fireworks/models/qwen2p5-coder-32b-instruct",
      temperature: 0.1,
    });
    expect(provider.name).toBe("fireworks:accounts/fireworks/models/qwen2p5-coder-32b-instruct");
  });

  it("sends OpenAI-compatible chat completion payload with Bearer auth", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = JSON.parse((init?.body as string) || "{}");
      const payload = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                findings: [
                  {
                    title: "Fireworks Reentrancy Vector",
                    category: "reentrancy",
                    severity: "critical",
                    location: "withdraw()",
                    evidence: ["external call before zeroing balance"],
                  },
                ],
              }),
            },
          },
        ],
      };
      return {
        ok: true,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      } as Response;
    });

    const provider = new FireworksProvider(
      {
        apiKey: "fw-test-token-xyz",
        model: "accounts/fireworks/models/deepseek-v3",
      },
      mockFetch as unknown as typeof fetch,
    );

    const result = await provider.complete("You are an expert security auditor.", [
      { role: "user", content: "Audit this contract: contract Test {}" },
    ]);

    expect(capturedUrl).toBe("https://api.fireworks.ai/inference/v1/chat/completions");
    expect(capturedHeaders["authorization"] || capturedHeaders["Authorization"]).toBe("Bearer fw-test-token-xyz");
    expect(capturedHeaders["content-type"] || capturedHeaders["Content-Type"]).toBe("application/json");
    expect(capturedBody.model).toBe("accounts/fireworks/models/deepseek-v3");
    expect(capturedBody.messages).toHaveLength(2);
    expect(capturedBody.messages[0]).toEqual({
      role: "system",
      content: "You are an expert security auditor.",
    });
    expect(capturedBody.messages[1]).toEqual({
      role: "user",
      content: "Audit this contract: contract Test {}",
    });
    expect(result).toContain("Fireworks Reentrancy Vector");
  });

  it("throws descriptive error on API failure", async () => {
    const mockFetch = vi.fn(async () => {
      return {
        ok: false,
        status: 401,
        text: async () => "Unauthorized: Invalid Fireworks API Key",
      } as Response;
    });

    const provider = new FireworksProvider(
      { apiKey: "bad-key" },
      mockFetch as unknown as typeof fetch,
    );

    await expect(
      provider.complete("system", [{ role: "user", content: "test" }]),
    ).rejects.toThrow("Fireworks API error [401]: Unauthorized: Invalid Fireworks API Key");
  });

  it("auto-detects FIREWORKS_API_KEY in createLLMProviderFromEnv", () => {
    const provider = createLLMProviderFromEnv({
      FIREWORKS_API_KEY: "fw-live-12345",
    });
    expect(provider).toBeDefined();
    expect(provider?.name).toContain("fireworks:accounts/fireworks/models/deepseek-v4p1-flash");
  });

  it("respects FIREWORKS_MODEL and custom temperature from env", () => {
    const provider = createLLMProviderFromEnv({
      FIREWORKS_API_KEY: "fw-live-12345",
      FIREWORKS_MODEL: "accounts/fireworks/models/qwen2p5-coder-32b-instruct",
      SWARMPROOF_LLM_TEMPERATURE: "0.05",
    });
    expect(provider).toBeDefined();
    expect(provider?.name).toBe("fireworks:accounts/fireworks/models/qwen2p5-coder-32b-instruct");
  });

  it("runs specialist analysis using FireworksProvider and parses findings", async () => {
    const payload = {
      choices: [
        {
          message: {
            content: `\`\`\`json
{
  "findings": [
    {
      "title": "Cross-Function Reentrancy Detected by DeepSeek",
      "category": "reentrancy",
      "severity": "critical",
      "location": "LendingPool.sol#withdraw",
      "evidence": ["Unprotected external call executes before storage write"]
    }
  ]
}
\`\`\``,
          },
        },
      ],
    };
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    }));

    const fireworks = new FireworksProvider(
      { apiKey: "fw-key-specialist" },
      mockFetch as unknown as typeof fetch,
    );

    const agents = createSpecialistAgents({ llmProvider: fireworks });
    const task: SecurityTask = {
      contractName: "LendingPool",
      source: "contract LendingPool { function withdraw() external {} }",
    };

    const findings = await agents["reentrancy-agent"].analyze(task);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe("Cross-Function Reentrancy Detected by DeepSeek");
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].category).toBe("reentrancy");
  });
});
