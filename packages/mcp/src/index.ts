/**
 * SwarmProof MCP server — thin client over the SwarmProof API.
 *
 * Per the architecture, the MCP layer contains NO business logic: every tool
 * calls the API gateway (base URL via SWARMPROOF_API_URL / McpClient config).
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
    if (!res.ok && res.status !== 400 && res.status !== 402 && res.status !== 404) {
      throw new Error(`API POST ${path} -> HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.base}${path}`);
    if (!res.ok && res.status !== 404) throw new Error(`API GET ${path} -> HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}

export const createToolRegistry = (client: SwarmProofApiClient = new SwarmProofApiClient()): MCPTool[] => [
  {
    name: "audit_contract",
    description:
      "Submit a Solidity contract for a multi-agent consensus audit. Dispatches to 10+ AI security specialists, aggregates consensus, verifies exploits in sandbox, and anchors proof on Hedera Consensus Service Topic 0.0.10417469.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Solidity source code" },
        contractName: { type: "string", description: "Contract name" },
        network: { type: "string", description: "Target network (default 'ethereum')" },
        total: { type: "string", description: "Audit bounty total in USD (default '1.00')" },
      },
      required: ["source", "contractName"],
    },
    async run(input: { source: string; contractName: string; network?: string; total?: string }) {
      try {
        const direct = await client.post<any>("/audits", {
          contractName: input.contractName,
          source: input.source,
          network: input.network,
          total: input.total,
        });

        if (direct && (direct.id || direct.auditId)) {
          const auditId = direct.id || direct.auditId;
          const proof = direct.proofReceipt || direct.proof || (await client.get<any>(`/audits/${auditId}/proof`).catch(() => ({})));
          const rawFindings = direct.findings || direct.report?.findings || [];
          const txId = proof?.transactionId;

          return {
            auditId,
            status: direct.status || "done",
            findingCount: Array.isArray(rawFindings) ? rawFindings.length : 0,
            findings: rawFindings,
            consensusReport: direct.report || direct.consensusReport,
            proof: proof,
            hashScanUrl: txId
              ? `https://hashscan.io/testnet/transaction/${txId.replace("@", "-").replace(/\.(?=\d{9})/, "-")}`
              : undefined,
          };
        }
      } catch {
        // Fall back to 2-step challenge/payment flow if needed
      }

      // 1. Create the job + payment requirement
      const created = await client.post<{ auditId: string; status: string; payment?: unknown }>("/audit", {
        contractName: input.contractName,
        source: input.source,
        network: input.network,
        total: input.total,
      });

      // 2. Confirm payment
      const paid = await client.post<{ auditId: string; status: string; payment?: unknown }>(
        `/audits/${created.auditId}/pay`,
        { reference: input.total ? `mcp:${input.total}` : "mcp:default" },
      );

      // 3. Poll until the swarm finishes
      let report: { status: string } | undefined;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 600));
        const s = await client.get<{ status: string }>(`/audits/${created.auditId}/status`);
        if (s.status === "done" || s.status === "failed") {
          report = s;
          break;
        }
      }

      const proof = await client.get<any>(`/audits/${created.auditId}/proof`).catch(() => ({}));
      const findings = await client.get<{ findings: unknown[] }>(`/audits/${created.auditId}/findings`).catch(() => ({ findings: [] }));
      const txId = proof?.transactionId;

      return {
        auditId: created.auditId,
        payment: created.payment,
        paymentStatus: paid.status,
        status: report?.status,
        findingCount: findings.findings.length,
        reportHash: proof?.reportHash,
        proof,
        hashScanUrl: txId
          ? `https://hashscan.io/testnet/transaction/${txId.replace("@", "-").replace(/\.(?=\d{9})/, "-")}`
          : undefined,
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
    description: "Get verified vulnerability findings with line locations, severities, and remediation advice.",
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
    description: "Reproduce a candidate vulnerability with the simulation verification engine.",
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
    description: "Get the tamper-evident proof anchored on Hedera Consensus Service Topic 0.0.10417469.",
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
    description: "List active security specialist agents in the SwarmProof ecosystem with roles and Hedera accounts.",
    inputSchema: { type: "object", properties: {}, required: [] },
    async run() {
      return client.get("/agents");
    },
  },
  {
    name: "get_agent_challenge",
    description: "Request an anti-replay cryptographic challenge nonce for enrolling an agent on Hedera Consensus Service.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Desired agent ID" },
        accountId: { type: "string", description: "Hedera account ID (0.0.x) or EVM address" },
      },
      required: ["agentId"],
    },
    async run(input: { agentId: string; accountId?: string }) {
      const q = new URLSearchParams({ agentId: input.agentId });
      if (input.accountId) q.set("accountId", input.accountId);
      return client.get(`/agents/challenge?${q.toString()}`);
    },
  },
  {
    name: "register_agent",
    description:
      "Register an autonomous security auditor agent with SwarmProof. Anchors a W3C Decentralized Identifier (did:hedera) and Verifiable Credential on Hedera Consensus Service.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Unique agent identifier, e.g. 'custom-sentinel-01'" },
        name: { type: "string", description: "Human-readable agent name" },
        role: { type: "string", description: "Audit specialty, e.g. 'reentrancy', 'access-control', 'business-logic', 'economic', 'static'" },
        capabilities: { type: "array", items: { type: "string" }, description: "List of detection capabilities" },
        paymentAddress: { type: "string", description: "Payout address (Hedera account 0.0.x or EVM 0x...)" },
        publicKey: { type: "string", description: "Public key matching the challenge signature" },
        signature: { type: "string", description: "Cryptographic challenge signature proving private key ownership" },
        shape: { type: "string", description: "Visual shape: 'octahedron', 'dodecahedron', 'torusKnot', 'icosahedron', 'gyroscope'" },
        color: { type: "string", description: "Hex brand color, e.g. '#00f5ff'" },
        systemPrompt: { type: "string", description: "Custom LLM security system prompt" },
        model: { type: "string", description: "Model identifier, e.g. 'deepseek-reasoner'" },
      },
      required: ["agentId", "name", "role", "paymentAddress"],
    },
    async run(input: Record<string, unknown>) {
      return client.post("/agents/register", input);
    },
  },
  {
    name: "get_agent_did",
    description: "Resolve the official W3C Decentralized Identifier (DID) document for a registered agent.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Agent ID to resolve" },
      },
      required: ["agentId"],
    },
    async run(input: { agentId: string }) {
      return client.get(`/agents/${input.agentId}/did`);
    },
  },
  {
    name: "get_agent_credential",
    description: "Fetch the W3C Verifiable Credential issued to a registered agent, anchored on Hedera HCS.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Agent ID" },
      },
      required: ["agentId"],
    },
    async run(input: { agentId: string }) {
      return client.get(`/agents/${input.agentId}/credential`);
    },
  },
  {
    name: "list_pool_tasks",
    description: "List audit tasks in the decentralized task pool, with optional filter by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter status: 'OPEN_FOR_SUBMISSIONS', 'WINDOW_CLOSED', 'SETTLED', or undefined for all",
        },
      },
      required: [],
    },
    async run(input: { status?: string }) {
      const q = input.status ? `?status=${encodeURIComponent(input.status)}` : "";
      return client.get(`/pool/tasks${q}`);
    },
  },
  {
    name: "get_pool_task",
    description: "Get detailed status of a task pool audit including claimed slots, specialist submissions, consensus report, and on-chain Hedera micropayouts.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task pool ID" },
      },
      required: ["taskId"],
    },
    async run(input: { taskId: string }) {
      return client.get(`/pool/tasks/${input.taskId}`);
    },
  },
  {
    name: "create_pool_task",
    description: "Post a new smart contract audit bounty to the decentralized task pool.",
    inputSchema: {
      type: "object",
      properties: {
        contractName: { type: "string", description: "Contract name" },
        source: { type: "string", description: "Solidity source code" },
        bountyTotal: { type: "string", description: "Bounty total in USD (default '2.00')" },
        currency: { type: "string", description: "Currency (default 'USD')" },
        submissionWindowSeconds: { type: "number", description: "Submission window in seconds (default 180)" },
        autoOpen: { type: "boolean", description: "Open immediately for submissions (default true)" },
      },
      required: ["contractName", "source"],
    },
    async run(input: {
      contractName: string;
      source: string;
      bountyTotal?: string;
      currency?: string;
      submissionWindowSeconds?: number;
      autoOpen?: boolean;
    }) {
      return client.post("/pool/tasks", input);
    },
  },
  {
    name: "claim_task_slot",
    description: "Claim a specialist auditor slot on an open audit task before submitting findings.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task pool ID" },
        agentId: { type: "string", description: "Agent ID claiming slot" },
        role: { type: "string", description: "Specialist role domain" },
        paymentAddress: { type: "string", description: "Hedera payout account" },
      },
      required: ["taskId", "agentId", "role"],
    },
    async run(input: { taskId: string; agentId: string; role: string; paymentAddress?: string }) {
      return client.post(`/pool/tasks/${input.taskId}/claim`, input);
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