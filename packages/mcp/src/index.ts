/**
 * SwarmProof MCP server — thin client over the SwarmProof API.
 *
 * Per the architecture, the MCP layer contains NO business logic: every tool
 * calls the API gateway (base URL via SWARMPROOF_API_URL / McpClient config).
 *
 * Future transports (stdio/SSE via @modelcontextprotocol/sdk) wrap this same
 * tool registry — the SDK wiring is milestone M6.
 */

export interface MCPTool<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(input: TInput): Promise<TOutput>;
}

export interface McpClientConfig {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_API = "http://localhost:3001";

/** Minimal typed HTTP helper against the SwarmProof API. */
export class SwarmProofApiClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: McpClientConfig = {}) {
    this.base = (config.apiBaseUrl ?? process.env.SWARMPROOF_API_URL ?? DEFAULT_API).replace(/\/$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as T;
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.base}${path}`);
    if (!res.ok && res.status !== 404) throw new Error(`API ${path} -> ${res.status}`);
    return (await res.json()) as T;
  }
}

export const createToolRegistry = (client: SwarmProofApiClient = new SwarmProofApiClient()): MCPTool[] => [
  {
    name: "audit_contract",
    description:
      "Submit a contract for a SwarmProof audit: creates the job + payment requirement, confirms payment (mock/x402), runs the 5-agent swarm, consensus, verification, and returns the report + HCS proof.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Solidity source code" },
        contractName: { type: "string", description: "Contract name" },
        network: { type: "string", description: "Chain (default ethereum)" },
        total: { type: "string", description: "Payment total (default 1.00)" },
      },
      required: ["source", "contractName"],
    },
    async run(input: { source: string; contractName: string; network?: string; total?: string }) {
      // 1. Create the job + payment requirement (client sees allocation BEFORE paying).
      const created = await client.post<{ auditId: string; status: string; payment?: unknown }>("/audit", {
        contractName: input.contractName,
        source: input.source,
        network: input.network,
        total: input.total,
      });
      // 2. Confirm the single job payment (mock auto-pays; x402 expects a reference).
      const paid = await client.post<{ auditId: string; status: string; payment?: unknown }>(
        `/audits/${created.auditId}/pay`,
        { reference: input.total ? `mcp:${input.total}` : "mcp:default" },
      );
      // 3. Poll until the swarm finishes.
      let report: { status: string } | undefined;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const s = await client.get<{ status: string }>(`/audits/${created.auditId}/status`);
        if (s.status === "done" || s.status === "failed") {
          report = s;
          break;
        }
      }
      const proof = await client.get<unknown>(`/audits/${created.auditId}/proof`);
      const findings = await client.get<{ findings: unknown[] }>(`/audits/${created.auditId}/findings`);
      return {
        auditId: created.auditId,
        payment: created.payment, // total / recipients / network / paymentId — visible to the caller
        paymentStatus: paid.status,
        status: report?.status,
        findingCount: findings.findings.length,
        reportHash: (proof as { reportHash?: string })?.reportHash,
        proof: proof as { hcsTopicId?: string; transactionId?: string; consensusTimestamp?: string; verified?: boolean },
      };
    },
  },
  {
    name: "get_audit_status",
    description: "Get an audit's lifecycle + payment status.",
    inputSchema: {
      type: "object",
      properties: { auditId: { type: "string" } },
      required: ["auditId"],
    },
    async run(input: { auditId: string }) {
      return client.get(`/audits/${input.auditId}/status`);
    },
  },
  {
    name: "get_findings",
    description: "Get the audit's accepted findings + verification artifacts.",
    inputSchema: {
      type: "object",
      properties: { auditId: { type: "string" } },
      required: ["auditId"],
    },
    async run(input: { auditId: string }) {
      return client.get(`/audits/${input.auditId}/findings`);
    },
  },
  {
    name: "verify_finding",
    description: "Reproduce a single finding with the verification engine.",
    inputSchema: {
      type: "object",
      properties: {
        auditId: { type: "string" },
        findingId: { type: "string" },
      },
      required: ["auditId", "findingId"],
    },
    async run(input: { auditId: string; findingId: string }) {
      return client.post(`/audits/${input.auditId}/verify`, { findingId: input.findingId });
    },
  },
  {
    name: "get_audit_proof",
    description: "Get the HCS-anchored tamper-evident proof for an audit.",
    inputSchema: {
      type: "object",
      properties: { auditId: { type: "string" } },
      required: ["auditId"],
    },
    async run(input: { auditId: string }) {
      return client.get(`/audits/${input.auditId}/proof`);
    },
  },
  {
    name: "list_agents",
    description: "List the specialist agents available in the SwarmProof ecosystem.",
    inputSchema: { type: "object", properties: {}, required: [] },
    async run() {
      return client.get("/agents");
    },
  },
];