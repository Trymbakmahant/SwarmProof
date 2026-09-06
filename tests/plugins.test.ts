import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { StubProvider } from "@swarmproof/agents";
import { SwarmRunner } from "@swarmproof/swarm";
import {
  AgentRegistry,
  createKeywordAnalyzerPlugin,
  createKeywordAnalyzerHttpPlugin,
  makePluginMessage,
  runPlugin,
} from "@swarmproof/plugins";
import type { PluginContext } from "@swarmproof/plugins";

const REENTRANCY_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Vault {
  mapping(address => uint256) public balances;
  function withdraw() external {
    uint256 amt = balances[msg.sender];
    (bool ok, ) = msg.sender.call{value: amt}("");
    require(ok);
    balances[msg.sender] = 0;
  }
}`;

function ctx(overrides: Partial<PluginContext> = {}): PluginContext {
  return {
    runId: "run-plugin",
    pluginId: "test-plugin",
    contractName: "Vault",
    contractSource: REENTRANCY_SOURCE,
    role: "analyzer",
    messages: [],
    findings: [],
    config: {},
    ...overrides,
  };
}

describe("agent plugin ecosystem", () => {
  it("registry: register, list, lookup, unregister, duplicate-guard", () => {
    const reg = new AgentRegistry();
    const p = createKeywordAnalyzerPlugin();
    reg.register(p);
    expect(reg.count()).toBe(1);
    expect(reg.has(p.manifest.id)).toBe(true);
    expect(reg.get(p.manifest.id)).toBe(p);
    expect(reg.listByRole("analyzer")).toHaveLength(1);
    expect(reg.weights()).toEqual({ "keyword-analyzer": 0.25 });
    expect(() => reg.register(p)).toThrow(/already registered/);
    expect(reg.unregister(p.manifest.id)).toBe(true);
    expect(reg.count()).toBe(0);
  });

  it("registry: rejects an invalid manifest", () => {
    const reg = new AgentRegistry();
    expect(() =>
      reg.register({ manifest: { id: "", name: "", version: "" }, executor: { type: "function", invoke: async () => [] } } as never),
    ).toThrow(/invalid plugin manifest/);
  });

  it("keyword plugin flags reentrancy in source and returns a message with artifacts", async () => {
    const p = createKeywordAnalyzerPlugin();
    const messages = await runPlugin(ctx(), p);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.artifactIds).toContain("kw:reentrancy");
    expect(messages[0]?.confidence).toBeGreaterThan(0);
  });

  it("keyword plugin stays quiet on clean source", async () => {
    const p = createKeywordAnalyzerPlugin();
    const messages = await runPlugin(ctx({ contractSource: "contract Clean { uint256 x; }" }), p);
    expect(messages).toHaveLength(0);
  });

  it("http executor posts the context and maps the remote response", async () => {
    let received: unknown;
    const server: Server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received = JSON.parse(body);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ content: "remote verdict: reentrancy confirmed", confidence: 0.8, artifactIds: ["remote:reentrancy"] }));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;

    try {
      const p = createKeywordAnalyzerHttpPlugin(`http://127.0.0.1:${port}/audit`);
      const messages = await runPlugin(ctx({ pluginId: "keyword-analyzer-http" }), p);
      expect(messages[0]?.content).toContain("remote verdict");
      expect(messages[0]?.artifactIds).toEqual(["remote:reentrancy"]);
      expect((received as { contractSource: string }).contractSource).toContain("contract Vault");
    } finally {
      server.close();
    }
  });

  it("makePluginMessage fills stable ids and correct phase per role", () => {
    const m = makePluginMessage(ctx({ role: "verifier" }), { content: "ok", confidence: 0.9, artifactIds: ["a"] });
    expect(m.id).toBe("run-plugin-test-plugin-0");
    expect(m.phase).toBe("verifying");
    expect(m.role).toBe("verifier");
  });

  it("swarm runs registered plugins and derives their findings", async () => {
    const reg = new AgentRegistry();
    reg.register(createKeywordAnalyzerPlugin());
    const runner = new SwarmRunner({ provider: new StubProvider(), registry: reg });
    const phases: string[] = [];
    runner.on("phase", (p) => phases.push(p));

    const result = await runner.run({
      runId: "run-with-plugin",
      contractName: "Vault",
      contractSource: REENTRANCY_SOURCE,
      agents: {},
    });

    expect(phases).toContain("plugin:keyword-analyzer");
    expect(result.findings.some((f) => f.evidence.includes("kw:reentrancy"))).toBe(true);
  });

  it("llm executor uses custom system prompt when provided", async () => {
    const calls: string[] = [];
    const provider = new StubProvider();
    const original = provider.complete.bind(provider);
    provider.complete = async (system, m, cfg) => {
      calls.push(system);
      return original(system, m, cfg);
    };
    const plugin = {
      manifest: {
        id: "llm-analyzer",
        name: "LLM Analyzer",
        version: "1.0.0",
        description: "llm",
        role: "analyzer" as const,
        systemPrompt: "CUSTOM PROMPT",
      },
      executor: { type: "llm" as const, provider },
    };
    const out = await runPlugin(ctx({ pluginId: "llm-analyzer" }), plugin);
    expect(calls[0]).toBe("CUSTOM PROMPT");
    expect(out[0]?.content.length).toBeGreaterThan(0);
  });
});