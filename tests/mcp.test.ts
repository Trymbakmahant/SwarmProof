import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createToolRegistry, SwarmProofApiClient } from "swarmproof-mcp";

/**
 * MCP = thin client over the SwarmProof API. We stub the API with a tiny
 * HTTP server that exercises the tool->endpoint mapping (no business logic
 * exists in the MCP layer by design).
 */
describe("mcp tools (thin client over API)", () => {
  let server: Server;
  let baseUrl: string;
  const calls: string[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = req.url ?? "/";
      calls.push(`${req.method} ${url}`);
      res.writeHead(200, { "content-type": "application/json" });
      if (url === "/audit" && req.method === "POST") {
        res.end(JSON.stringify({ auditId: "audit_123", status: "payment-required", payment: { paymentId: "p1", total: "1.00", currency: "USD", recipients: [], network: "hedera:testnet" } }));
      } else if (url.startsWith("/audits/audit_123/pay")) {
        res.end(JSON.stringify({ auditId: "audit_123", status: "running", payment: { status: "paid" } }));
      } else if (url.endsWith("/status")) {
        res.end(JSON.stringify({ auditId: "audit_123", status: "done", paymentStatus: "paid" }));
      } else if (url.endsWith("/findings")) {
        res.end(JSON.stringify({ auditId: "audit_123", findings: [{ id: "f1" }], verification: [] }));
      } else if (url.endsWith("/proof")) {
        res.end(JSON.stringify({ auditId: "audit_123", reportHash: "0xabc", hcsTopicId: "0.0.1", transactionId: "t1", consensusTimestamp: "ts", verified: true }));
      } else if (url.endsWith("/verify") && req.method === "POST") {
        res.end(JSON.stringify({ findingId: "f1", reproduced: true }));
      } else if (url === "/agents") {
        res.end(JSON.stringify({ agents: [{ agentId: "reentrancy-agent" }] }));
      } else if (url === "/agents/register" && req.method === "POST") {
        res.end(JSON.stringify({
          ok: true,
          agentId: "mcp-agent-1",
          did: "did:hedera:testnet:0.0.10417469_mcp-agent-1",
          transactionId: "0.0.10417469@123.456",
          status: "ACTIVE_SPECIALIST",
        }));
      } else if (url.startsWith("/pool/tasks/pull")) {
        res.end(JSON.stringify({
          ok: true,
          agentId: "mcp-agent-1",
          tasks: [{ id: "task-1", contractName: "Vault", status: "OPEN_FOR_SUBMISSIONS" }],
        }));
      } else if (url.startsWith("/pool/tasks/") && url.endsWith("/submit") && req.method === "POST") {
        res.end(JSON.stringify({ ok: true, taskId: "task-1", status: "accepted" }));
      } else if (url === "/pool/run-swarm-audit" && req.method === "POST") {
        res.end(JSON.stringify({
          ok: true,
          auditId: "task-swarm-1",
          status: "SETTLED",
          agentsParticipated: 10,
        }));
      } else {
        res.end(JSON.stringify({ error: "not found" }));
      }
    });
    await new Promise<void>((r) => server.listen(0, r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => server.close());

  it("exposes all spec and autonomous swarm MCP tools", () => {
    const tools = createToolRegistry(new SwarmProofApiClient({ apiBaseUrl: baseUrl }));
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "audit_contract",
        "get_audit_status",
        "get_findings",
        "verify_finding",
        "get_audit_proof",
        "list_agents",
        "register_agent",
        "pull_task",
        "submit_task_finding",
        "run_swarm_audit",
      ]),
    );
  });

  it("register_agent: allows an external agent to register and receive did:hedera", async () => {
    const tools = createToolRegistry(new SwarmProofApiClient({ apiBaseUrl: baseUrl }));
    const register = tools.find((t) => t.name === "register_agent")!;
    const res = (await register.run({
      agentId: "mcp-fireworks-auditor",
      name: "Fireworks Autonomous Auditor",
      role: "reentrancy",
      paymentAddress: "0.0.10119346",
      provider: "fireworks",
      model: "accounts/fireworks/models/deepseek-v3",
    })) as { ok: boolean; did: string; status: string };

    expect(res.ok).toBe(true);
    expect(res.did).toContain("did:hedera");
    expect(res.status).toBe("ACTIVE_SPECIALIST");
  });

  it("pull_task: queries pending open tasks from task pool", async () => {
    const tools = createToolRegistry(new SwarmProofApiClient({ apiBaseUrl: baseUrl }));
    const pull = tools.find((t) => t.name === "pull_task")!;
    const res = (await pull.run({
      agentId: "mcp-fireworks-auditor",
      role: "reentrancy",
    })) as { ok: boolean; tasks: any[] };

    expect(res.ok).toBe(true);
    expect(res.tasks).toHaveLength(1);
    expect(res.tasks[0].id).toBe("task-1");
  });

  it("submit_task_finding: submits findings to active audit task", async () => {
    const tools = createToolRegistry(new SwarmProofApiClient({ apiBaseUrl: baseUrl }));
    const submit = tools.find((t) => t.name === "submit_task_finding")!;
    const res = (await submit.run({
      taskId: "task-1",
      agentId: "mcp-fireworks-auditor",
      role: "reentrancy",
      findings: [
        {
          id: "mcp-f1",
          title: "Reentrancy detected by MCP agent",
          category: "reentrancy",
          severity: "critical",
          location: "withdraw()",
          evidence: ["External call before balance reset"],
        },
      ],
    })) as { ok: boolean; status: string };

    expect(res.ok).toBe(true);
    expect(res.status).toBe("accepted");
  });

  it("run_swarm_audit: triggers end-to-end swarm execution", async () => {
    const tools = createToolRegistry(new SwarmProofApiClient({ apiBaseUrl: baseUrl }));
    const run = tools.find((t) => t.name === "run_swarm_audit")!;
    const res = (await run.run({
      contractName: "McpTestContract",
      source: "contract McpTestContract {}",
    })) as { ok: boolean; status: string; agentsParticipated: number };

    expect(res.ok).toBe(true);
    expect(res.status).toBe("SETTLED");
    expect(res.agentsParticipated).toBe(10);
  });

  it("audit_contract: create → pay → poll → proof, returning the full summary", async () => {
    const tools = createToolRegistry(new SwarmProofApiClient({ apiBaseUrl: baseUrl }));
    const audit = tools.find((t) => t.name === "audit_contract")!;
    const out = (await audit.run({
      source: "contract V {}",
      contractName: "V",
      paymentTransactionId: "0.0.10119346@1789228801.123456789",
    })) as {
      auditId: string;
      findingCount: number;
      proof: { hcsTopicId: string };
    };
    expect(out.auditId).toBe("audit_123");
    expect(out.findingCount).toBe(1);
    expect(out.proof.hcsTopicId).toBe("0.0.1");
  });

  it("each tool maps to exactly one API endpoint", async () => {
    const tools = createToolRegistry(new SwarmProofApiClient({ apiBaseUrl: baseUrl }));
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    await byName["get_audit_status"]!.run({ auditId: "audit_123" });
    await byName["get_findings"]!.run({ auditId: "audit_123" });
    await byName["verify_finding"]!.run({ auditId: "audit_123", findingId: "f1" });
    await byName["get_audit_proof"]!.run({ auditId: "audit_123" });
    expect(calls).toEqual(expect.arrayContaining([
      "GET /audits/audit_123/status",
      "GET /audits/audit_123/findings",
      "GET /audits/audit_123/proof",
    ]));
  });
});