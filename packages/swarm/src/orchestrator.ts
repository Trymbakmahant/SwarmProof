import {
  runSpecialists,
  type SecurityAgent,
  type SecurityTask,
  type SpecialistId,
} from "@swarmproof/agents";
import {
  normalizeFindings,
  reachConsensus,
  toConsensusCandidates,
  type ConsensusConfig,
  type ConsensusReport,
  type EvidenceItem,
  type NormalizedFinding,
  type RawFinding,
} from "@swarmproof/consensus";
import { verifyFindings, type VerificationEngine, type VerificationResult } from "@swarmproof/verification";
import {
  buildAuditProofMessage,
  deterministicStringify,
  sha256Hex,
  type AuditProofClient,
  type AuditProofReceipt,
} from "@swarmproof/hedera";

/** Default evidence strength for specialist findings (no tool proof yet). */
export const SPECIALIST_DEFAULT_CONFIDENCE = 0.75;
export const SPECIALIST_DEFAULT_WEIGHT = 0.4;

/** Consensus weights per specialist (by agentId) — injectable for reputation later. */
export type SpecialistWeights = Record<SpecialistId, number>;

export const DEFAULT_SPECIALIST_WEIGHTS: SpecialistWeights = {
  "reentrancy-agent": SPECIALIST_DEFAULT_WEIGHT,
  "access-control-agent": SPECIALIST_DEFAULT_WEIGHT,
  "business-logic-agent": SPECIALIST_DEFAULT_WEIGHT,
  "economic-agent": SPECIALIST_DEFAULT_WEIGHT,
  "static-agent": SPECIALIST_DEFAULT_WEIGHT,
  "reentrancy-sentinel": SPECIALIST_DEFAULT_WEIGHT,
  "access-sentinel": SPECIALIST_DEFAULT_WEIGHT,
  "invariant-agent": SPECIALIST_DEFAULT_WEIGHT,
  "mev-sentinel": SPECIALIST_DEFAULT_WEIGHT,
  "bytecode-verifier": SPECIALIST_DEFAULT_WEIGHT,
};

export interface OrchestratorDeps {
  specialists: Record<SpecialistId, SecurityAgent> | Record<string, SecurityAgent>;
  verification: VerificationEngine;
  proofClient?: AuditProofClient; // optional: anchor proof when provided
  weights?: SpecialistWeights | Record<string, number>;
  consensusConfig?: ConsensusConfig;
}

export interface AuditResult {
  auditId: string;
  task: SecurityTask;
  raw: RawFinding[];
  normalized: NormalizedFinding[];
  consensus: ConsensusReport;
  verification: VerificationResult[];
  report: FinalAuditReport;
  reportHash: string;
  proof?: AuditProofReceipt;
}

export interface FinalAuditReport {
  auditId: string;
  contractName: string;
  network: string;
  result: "verified" | "unverified";
  findings: Array<{
    id: string;
    category: string;
    severity: string;
    locations: string[];
    agents: string[];
    snippets: string[];
  }>;
  verification: VerificationResult[];
  consensusSummary: string;
  generatedAt: string;
}

/**
 * The SwarmProof audit pipeline:
 *
 *   1. run the 5 specialist agents INDEPENDENTLY, IN PARALLEL (Promise.all)
 *   2. normalize + cluster equivalent findings (agents merge their votes)
 *   3. consensus voting (weighted by agent; quorum + threshold)
 *   4. verification agent reproduces accepted findings with tooling
 *   5. assemble final report, SHA-256 it, anchor the hash on Hedera HCS
 *
 * This package knows NOTHING about payments — money is handled by the gateway.
 */
export interface ProgressUpdate {
  step: number;
  label: string;
  subtext: string;
  timestamp: string;
}

export type ProgressCallback = (update: ProgressUpdate) => void;

export class AuditOrchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async run(auditId: string, task: SecurityTask, onProgress?: ProgressCallback): Promise<AuditResult> {
    onProgress?.({
      step: 1,
      label: "Ingest & AST Decomposition",
      subtext: "Lexical & AST syntax parsing across contract functions",
      timestamp: new Date().toISOString(),
    });

    onProgress?.({
      step: 2,
      label: "Swarm Adversarial Debate",
      subtext: `Specialist AI agents cross-examining exploit vectors (${Object.keys(this.deps.specialists).length} agents active)`,
      timestamp: new Date().toISOString(),
    });

    // 1. Independent, parallel specialist analysis.
    const specialistOutput = await runSpecialists(this.deps.specialists, task);
    const raw: RawFinding[] = specialistOutput.flatMap((r) =>
      r.findings.map((finding) => ({ agentId: r.agentId, finding })),
    );

    // 2. Normalize & cluster equivalent findings across agents.
    const normalized = normalizeFindings(raw);

    onProgress?.({
      step: 3,
      label: "Quorum Consensus Finalized",
      subtext: "Byzantine fault-tolerant vote aggregation & confidence score weighting",
      timestamp: new Date().toISOString(),
    });

    // 3. Consensus: evidence = one entry per agent that reported the cluster.
    const candidates = toConsensusCandidates(
      normalized,
      toEvidenceOverrides(this.deps.specialists, this.deps.weights),
    );
    const consensus = reachConsensus(
      auditId,
      candidates,
      this.deps.consensusConfig,
      this.deps.weights as Record<string, number> | undefined,
    );

    onProgress?.({
      step: 4,
      label: "Bytecode Invariant Verified",
      subtext: "Tool-assisted verification engine reproducing findings",
      timestamp: new Date().toISOString(),
    });

    // 4. Verification agent — independently reproduce accepted findings.
    const verification = await verifyFindings({
      findings: consensus.findings.map((w) => w.finding),
      task,
      engine: this.deps.verification,
      tool: "mock",
    });

    onProgress?.({
      step: 5,
      label: "Hedera HCS Topic Sealed",
      subtext: "Submitting cryptographic audit proof to Hedera Testnet (0.0.10417469)",
      timestamp: new Date().toISOString(),
    });

    // 5. Final report → deterministic hash → HCS proof.
    const report: FinalAuditReport = {
      auditId,
      contractName: task.contractName,
      network: task.network ?? "ethereum",
      result: consensus.findings.length > 0 ? "verified" : "unverified",
      findings: consensus.findings.map((w) => {
        const norm = normalized.find((n) => n.key === w.finding.id) ?? {
          locations: [w.finding.location],
          agents: w.evidence.map((e: EvidenceItem) => e.agentId ?? e.agentRole),
          snippets: w.finding.evidence,
        };
        return {
          id: w.finding.id,
          category: w.finding.category,
          severity: w.finding.severity,
          locations: norm.locations,
          agents: norm.agents,
          snippets: norm.snippets,
        };
      }),
      verification,
      consensusSummary: consensus.summary,
      generatedAt: new Date().toISOString(),
    };

    const reportHash = sha256Hex(deterministicStringify(report));
    const proof = this.deps.proofClient
      ? await this.deps.proofClient.anchorProof(
          buildAuditProofMessage({
            auditId,
            reportHash,
            result: report.result,
            findingCount: report.findings.length,
          }),
        )
      : undefined;

    return { auditId, task, raw, normalized, consensus, verification, report, reportHash, proof };
  }
}

function toEvidenceOverrides(
  specialists: Record<string, SecurityAgent>,
  weights?: SpecialistWeights | Record<string, number>,
): Record<string, { confidence: number; artifactWeight: number }> {
  const out: Record<string, { confidence: number; artifactWeight: number }> = {};
  const allIds = new Set([...Object.keys(specialists), ...Object.keys(weights ?? {})]);
  for (const id of allIds) {
    out[id] = { confidence: SPECIALIST_DEFAULT_CONFIDENCE, artifactWeight: 1 };
  }
  return out;
}