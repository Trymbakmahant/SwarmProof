import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { StubProvider } from "@swarmproof/agents";
import { SwarmRunner } from "@swarmproof/swarm";
import { reachConsensus } from "@swarmproof/consensus";
import { createVerifier } from "@swarmproof/verification";
import { MockHederaClient } from "@swarmproof/hedera";
import { MemoryLedger } from "@swarmproof/payments";

interface AuditRecord {
  id: string;
  contractName: string;
  status: string;
  report?: unknown;
}

const provider = new StubProvider();
const hedera = new MockHederaClient();
const payments = new MemoryLedger(hedera);
const verifier = createVerifier("mock");
const reports = new Map<string, unknown>();
const audits = new Map<string, AuditRecord>();

function makeSwarm(runId: string): SwarmRunner {
  const runner = new SwarmRunner({ provider });
  runner.on("finding", (f) => {
    void f;
  });
  runner.on("done", ({ findings }) => {
    const report = reachConsensus(
      runId,
      findings.map((finding) => ({
        finding,
        evidence: [
          { agentRole: "verifier", confidence: 0.9, artifactWeight: 1 },
          { agentRole: "analyzer", confidence: 0.7, artifactWeight: 1 },
        ],
      })),
    );
    reports.set(runId, report);
    void verifier;
  });
  return runner;
}

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "swarmproof-api" }));

// Submit an audit job.
app.post("/audits", async (c) => {
  const body = await c.req.json<{ contractName: string; source: string }>();
  const id = `audit-${Date.now()}`;
  audits.set(id, { id, contractName: body.contractName, status: "queued" });

  const runner = makeSwarm(id);
  runner
    .run({
      runId: id,
      contractName: body.contractName,
      contractSource: body.source,
      agents: {},
    })
    .then((r) => {
      const rec = audits.get(id);
      if (rec) {
        rec.status = "done";
        rec.report = reports.get(r.runId);
      }
    })
    .catch((err: unknown) => {
      const rec = audits.get(id);
      if (rec) rec.status = `failed: ${String(err)}`;
    });

  return c.json({ id, status: "queued" }, 202);
});

// Fetch the final report.
app.get("/audits/:id", (c) => {
  const rec = audits.get(c.req.param("id"));
  if (!rec) return c.json({ error: "not found" }, 404);
  return c.json(rec);
});

// Live swarm event stream (SSE).
app.get("/audits/:id/stream", (c) => {
  const runId = c.req.param("id");
  const runner = makeSwarm(runId); // NOTE: M4 wires a real in-flight runner store
  return streamSSE(c, async (stream) => {
    runner.on("message", (m) => stream.writeSSE({ event: "message", data: JSON.stringify(m) }));
    await runner.run({
      runId,
      contractName: "streamed",
      contractSource: "// source streamed via SSE demo",
      agents: {},
    });
    stream.writeSSE({ event: "done", data: JSON.stringify({ runId }) });
  });
});

// Bounty endpoints.
app.post("/bounties", async (c) => {
  const body = await c.req.json<{ contractName: string; tokenId: string; payer: string }>();
  const bounty = await payments.createBounty({
    id: `bounty-${Date.now()}`,
    ...body,
  });
  return c.json(bounty, 201);
});

app.get("/bounties/:id", (c) => c.json(payments.getBounty(c.req.param("id"))));

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`@swarmproof/api listening on http://localhost:${info.port}`);
});