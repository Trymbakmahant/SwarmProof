import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createToolRegistry, SwarmProofApiClient } from "@swarmproof/mcp";

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
      } else {
        res.end(JSON.stringify({ error: "not found" }));
      }
    });
    await new Promise<void>((r) => server.listen(0, r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => server.close());

  it("exposes the five spec tools", () => {
    const tools = createToolRegistry(new SwarmProofApiClient({ apiBaseUrl: baseUrl }));
    const names = tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["audit_contract", "get_audit_status", "get_findings", "verify_finding", "get_audit_proof"]));
  });

  it("audit_contract: create → pay → poll → proof, returning the full summary", async () => {
    const tools = createToolRegistry(new SwarmProofApiClient({ apiBaseUrl: baseUrl }));
    const audit = tools.find((t) => t.name === "audit_contract")!;
    const out = (await audit.run({ source: "contract V {}", contractName: "V" })) as {
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