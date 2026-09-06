/**
 * SwarmProof MCP server — exposes the swarm audit toolset to any MCP client.
 * M6 wires @modelcontextprotocol/sdk with stdio + SSE transports.
 * This module defines the tool registry that the transport layer serves.
 */

import type { SwarmRunner } from "@swarmproof/swarm";
import type { ConsensusReport, WeightedFinding } from "@swarmproof/consensus";
import type { VerificationEngine } from "@swarmproof/verification";
import type { PaymentLedger } from "@swarmproof/payments";
import type { AgentRegistry, AgentPlugin } from "@swarmproof/plugins";

export interface MCPTool<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(input: TInput): Promise<TOutput>;
}

export interface McpDeps {
  swarm: SwarmRunner;
  verifier: VerificationEngine;
  payments: PaymentLedger;
  reports: Map<string, ConsensusReport>;
  /** Plugin ecosystem registry — powers list_agents. */
  registry?: AgentRegistry;
}

export function createToolRegistry(deps: McpDeps): MCPTool[] {
  return [
    {
      name: "audit_contract",
      description: "Run a full swarm audit on Solidity source. Returns the consensus report.",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string", description: "Solidity source code" },
          contractName: { type: "string" },
        },
        required: ["source", "contractName"],
      },
      async run(input: { source: string; contractName: string }) {
        const result = await deps.swarm.run({
          runId: `mcp-${Date.now()}`,
          contractName: input.contractName,
          contractSource: input.source,
          agents: {},
          plugins: deps.registry?.list() ?? [],
        });
        return { runId: result.runId, findingCount: result.findings.length };
      },
    },
    {
      name: "get_report",
      description: "Fetch a completed consensus report by run id.",
      inputSchema: {
        type: "object",
        properties: { runId: { type: "string" } },
        required: ["runId"],
      },
      async run(input: { runId: string }): Promise<ConsensusReport | undefined> {
        return deps.reports.get(input.runId);
      },
    },
    {
      name: "verify_finding",
      description: "Reproduce a finding with the verification engine.",
      inputSchema: {
        type: "object",
        properties: {
          findingId: { type: "string" },
          contractPath: { type: "string" },
          tool: { type: "string" },
        },
        required: ["findingId", "contractPath"],
      },
      async run(input: { findingId: string; contractPath: string; tool?: string }) {
        return deps.verifier.verify({
          findingId: input.findingId,
          tool: (input.tool as "solc" | "slither" | "forge" | "mock") ?? "mock",
          contractPath: input.contractPath,
          commandArgs: [],
        });
      },
    },
    {
      name: "check_bounty",
      description: "Inspect a bounty's escrow and payout state.",
      inputSchema: {
        type: "object",
        properties: { bountyId: { type: "string" } },
        required: ["bountyId"],
      },
      async run(input: { bountyId: string }) {
        return deps.payments.getBounty(input.bountyId);
      },
    },
    {
      name: "list_agents",
      description:
        "List every agent registered in the SwarmProof ecosystem (built-in roles + third-party plugins).",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
      async run(): Promise<Array<Record<string, unknown>>> {
        const plugins: AgentPlugin[] = deps.registry?.list() ?? [];
        return [
          ...["analyzer", "exploiter", "verifier", "judge"].map((role) => ({
            id: `builtin:${role}`,
            name: role.charAt(0).toUpperCase() + role.slice(1),
            role,
            version: "core",
            source: "built-in",
          })),
          ...plugins.map((p) => ({
            id: p.manifest.id,
            name: p.manifest.name,
            role: p.manifest.role,
            version: p.manifest.version,
            description: p.manifest.description,
            executor: p.executor.type,
            weight: p.manifest.weight ?? null,
            source: "plugin",
          })),
        ];
      },
    },
  ];
}

export function listFindings(report: ConsensusReport): WeightedFinding[] {
  return report.findings;
}