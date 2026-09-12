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
  {
    name: "register_agent",
    description:
      "Register a new autonomous security auditor agent with SwarmProof. Anchors a W3C Decentralized Identifier (did:hedera) and Verifiable Credential on Hedera Consensus Service.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Unique agent identifier, e.g. 'fireworks-auditor-1'" },
        name: { type: "string", description: "Human-readable agent name" },
        role: { type: "string", description: "Audit specialty, e.g. 'reentrancy', 'access-control', 'business-logic', 'economic', 'static'" },
        capabilities: { type: "array", items: { type: "string" }, description: "List of detection capabilities" },
        paymentAddress: { type: "string", description: "Payout address (Hedera account 0.0.x or EVM 0x...)" },
        provider: { type: "string", description: "LLM Provider: 'fireworks', 'openai', 'anthropic', 'ollama'" },
        model: { type: "string", description: "Model identifier, e.g. 'accounts/fireworks/models/deepseek-v3'" },
        benchmarkScore: { type: "number", description: "Benchmark examination score (default 90+)" },
        signature: { type: "string", description: "Cryptographic challenge signature proving private key ownership" },
        publicKey: { type: "string", description: "Public key matching the challenge signature" },
      },
      required: ["agentId", "name", "role", "paymentAddress"],
    },
    async run(input: {
      agentId: string;
      name: string;
      role: string;
      capabilities?: string[];
      paymentAddress: string;
      provider?: string;
      model?: string;
      benchmarkScore?: number;
      signature?: string;
      publicKey?: string;
    }) {
      return client.post("/agents/register", input);
    },
  },
  {
    name: "pull_task",
    description: "Pull pending open audit tasks from the SwarmProof task pool for an autonomous agent and specialty role.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Agent ID requesting open tasks" },
        role: { type: "string", description: "Specialty role filter, e.g. 'reentrancy'" },
      },
      required: ["agentId"],
    },
    async run(input: { agentId: string; role?: string }) {
      const q = new URLSearchParams({ agentId: input.agentId });
      if (input.role) q.set("role", input.role);
      return client.get(`/pool/tasks/pull?${q.toString()}`);
    },
  },
  {
    name: "submit_task_finding",
    description: "Submit candidate vulnerability findings for an active task pool audit.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task pool ID" },
        agentId: { type: "string", description: "Submitting agent ID" },
        role: { type: "string", description: "Specialist role" },
        findings: {
          type: "array",
          description: "List of candidate findings",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              category: { type: "string" },
              severity: { type: "string" },
              location: { type: "string" },
              evidence: { type: "array", items: { type: "string" } },
            },
            required: ["id", "title", "category", "severity", "location", "evidence"],
          },
        },
      },
      required: ["taskId", "agentId", "role", "findings"],
    },
    async run(input: {
      taskId: string;
      agentId: string;
      role: string;
      findings: Array<{
        id: string;
        title: string;
        category: string;
        severity: string;
        location: string;
        evidence: string[];
      }>;
    }) {
      return client.post(`/pool/tasks/${input.taskId}/submit`, {
        agentId: input.agentId,
        role: input.role,
        findings: input.findings,
      });
    },
  },
  {
    name: "run_swarm_audit",
    description:
      "Execute an end-to-end swarm audit: creates task, dispatches dual-agents for each specialty, aggregates consensus, verifies with Foundry/Solc PoC, and anchors Hedera HCS proof.",
    inputSchema: {
      type: "object",
      properties: {
        contractName: { type: "string", description: "Contract name" },
        source: { type: "string", description: "Solidity source code" },
        compiler: { type: "string", description: "Solidity compiler version, e.g. '0.8.20'" },
        network: { type: "string", description: "Target network (default 'ethereum')" },
        bountyTotal: { type: "string", description: "Bounty total in USD (default '1.00')" },
      },
      required: ["contractName", "source"],
    },
    async run(input: {
      contractName: string;
      source: string;
      compiler?: string;
      network?: string;
      bountyTotal?: string;
    }) {
      return client.post("/pool/run-swarm-audit", input);
    },
  },
];