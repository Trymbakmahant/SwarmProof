import { describe, expect, it, vi } from "vitest";
import {
  createLLMProviderFromEnv,
  createSpecialistAgents,
  extractJsonFromLlmResponse,
  parseLLMFindings,
  type LLMProvider,
  type ProviderMessage,
  type SecurityTask,
} from "@swarmproof/agents";

describe("LLM parser & JSON extraction", () => {
  it("extracts plain JSON directly", () => {
    const json = '{"findings": [{"title": "Reentrancy detected", "category": "reentrancy", "severity": "critical"}]}';
    const parsed = extractJsonFromLlmResponse(json) as { findings: Array<{ title: string }> };
    expect(parsed.findings[0]?.title).toBe("Reentrancy detected");
  });

  it("extracts JSON wrapped in markdown code fence", () => {
    const raw = `Here is my analysis:
\`\`\`json
{
  "findings": [
    {
      "title": "Missing onlyOwner modifier",
      "category": "access-control",
      "severity": "high",
      "location": "line 24",
      "evidence": ["function withdraw() has no access restriction"],
      "reasoning": "Anyone can call withdraw and drain funds"
    }
  ]
}
\`\`\`
Hope this helps!`;
    const parsed = extractJsonFromLlmResponse(raw) as { findings: Array<{ title: string; severity: string }> };
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0]?.severity).toBe("high");
  });

  it("parses and normalizes LLM findings into typed Finding objects", () => {
    const raw = `\`\`\`json
{
  "findings": [
    {
      "title": "Cross-function reentrancy",
      "category": "reentrancy",
      "severity": "CRITICAL",
      "location": "Vault.sol#withdraw",
      "evidence": ["call before state write"],
      "reasoning": "Re-enters transfer before balance is zeroed"
    }
  ]
}
\`\`\``;
    const findings = parseLLMFindings(raw, "reentrancy-agent");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.id).toBe("reentrancy-agent-reentrancy-0");
    expect(findings[0]?.severity).toBe("critical");
    expect(findings[0]?.category).toBe("reentrancy");
    expect(findings[0]?.location).toBe("Vault.sol#withdraw");
  });

  it("handles malformed or empty LLM output gracefully", () => {
    const findings = parseLLMFindings("I could not find any valid vulnerabilities.", "reentrancy-agent");
    expect(findings).toEqual([]);
  });
});

describe("LLM-powered specialist agents", () => {
  const task: SecurityTask = {
    contractName: "TestVault",
    source: `contract TestVault {
      mapping(address => uint) balances;
      function withdraw() external {
        (bool ok,) = msg.sender.call{value: balances[msg.sender]}("");
        balances[msg.sender] = 0;
      }
    }`,
    network: "ethereum",
  };

  it("calls the LLM provider when configured", async () => {
    let calledSystem = "";
    let calledUser = "";

    const mockProvider: LLMProvider = {
      name: "mock-llm:test",
      complete: vi.fn(async (system: string, messages: ProviderMessage[]) => {
        calledSystem = system;
        calledUser = messages[0]?.content ?? "";
        return JSON.stringify({
          findings: [
            {
              title: "Critical CEI Violation",
              category: "reentrancy",
              severity: "critical",
              location: "withdraw()",
              evidence: ["state update after call"],
            },
          ],
        });
      }),
    };

    const agents = createSpecialistAgents({
      llmProvider: mockProvider,
    });

    expect(agents["reentrancy-agent"].identity.name).toContain("[mock-llm:test]");

    const findings = await agents["reentrancy-agent"].analyze(task);
    expect(mockProvider.complete).toHaveBeenCalled();
    expect(calledSystem).toContain("Reentrancy Specialist Agent");
    expect(calledUser).toContain("contract TestVault");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Critical CEI Violation");
  });

  it("falls back to heuristic detector if LLM throws an error", async () => {
    const failingProvider: LLMProvider = {
      name: "mock-failing",
      complete: vi.fn(async () => {
        throw new Error("Network timeout: rate limited");
      }),
    };

    const agents = createSpecialistAgents({
      llmProvider: failingProvider,
    });

    // TestVault has reentrancy that our heuristic detector finds
    const findings = await agents["reentrancy-agent"].analyze(task);
    expect(failingProvider.complete).toHaveBeenCalled();
    // Successfully fell back to deterministic heuristic without throwing!
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.category).toBe("reentrancy");
  });
});

describe("createLLMProviderFromEnv", () => {
  it("returns undefined when SWARMPROOF_USE_MOCK_AGENTS is true", () => {
    const provider = createLLMProviderFromEnv({
      SWARMPROOF_USE_MOCK_AGENTS: "true",
      OPENAI_API_KEY: "sk-test",
    });
    expect(provider).toBeUndefined();
  });

  it("creates AnthropicProvider when ANTHROPIC_API_KEY is present", () => {
    const provider = createLLMProviderFromEnv({
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    expect(provider).toBeDefined();
    expect(provider?.name).toContain("anthropic:");
  });

  it("creates OpenAIProvider when OPENAI_API_KEY is present", () => {
    const provider = createLLMProviderFromEnv({
      OPENAI_API_KEY: "sk-proj-test",
    });
    expect(provider).toBeDefined();
    expect(provider?.name).toContain("openai:");
  });

  it("creates OllamaProvider when OLLAMA_BASE_URL is present", () => {
    const provider = createLLMProviderFromEnv({
      OLLAMA_BASE_URL: "http://127.0.0.1:11434",
    });
    expect(provider).toBeDefined();
    expect(provider?.name).toContain("ollama:");
  });
});
