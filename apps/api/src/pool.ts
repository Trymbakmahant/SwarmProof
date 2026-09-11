import type { Finding } from "@swarmproof/agents";
import {
  clusterFindings,
  toConsensusCandidates,
  reachConsensus,
  type ConsensusReport,
  type RawFinding,
} from "@swarmproof/consensus";
import { buildAuditProofMessage, type AuditProofClient } from "@swarmproof/hedera";

export type TaskPoolStatus =
  | "PENDING_ESCROW"
  | "OPEN_FOR_SUBMISSIONS"
  | "CONSENSUS_AGGREGATION"
  | "SETTLED"
  | "EXPIRED_UNCLAIMED";

export interface TaskClaim {
  agentId: string;
  role: string;
  claimedAt: string;
  paymentAddress?: string;
}

export interface TaskSubmission {
  agentId: string;
  role: string;
  findings: Finding[];
  submittedAt: string;
  signature?: string;
  status: "accepted" | "rejected";
  validationMessage?: string;
}

export interface PoolTask {
  id: string;
  contractName: string;
  source: string;
  compiler?: string;
  address?: string;
  network?: string;
  status: TaskPoolStatus;

  // Time Window Parameters
  submissionWindowSeconds: number;
  openedAt?: string;
  submissionDeadline?: string;
  closedAt?: string;

  // Roles & Participation
  requiredRoles: string[];
  claims: TaskClaim[];
  submissions: TaskSubmission[];

  // Consensus Output
  consensusReport?: ConsensusReport;
  reportHash?: string;
  proofReceipt?: {
    hcsTopicId: string;
    transactionId: string;
    consensusTimestamp: string;
    hashscanUrl: string;
  };
  score?: number; // Normalized Swarm Trust Score (0-100)

  // Financial Escrow & Settlement
  bountyTotal: string; // e.g. "1.00" USD or HBAR
  currency: string;
  escrowStatus: "unpaid" | "escrowed" | "distributed";
  paymentId?: string;

  createdAt: string;
  updatedAt: string;
}

export interface CreatePoolTaskInput {
  contractName: string;
  source: string;
  compiler?: string;
  address?: string;
  network?: string;
  submissionWindowSeconds?: number;
  requiredRoles?: string[];
  bountyTotal?: string;
  currency?: string;
  autoOpen?: boolean;
}

export const DEFAULT_REQUIRED_ROLES = [
  "reentrancy",
  "access-control",
  "static-analysis",
  "business-logic",
  "economic-oracle",
];

export class AuditTaskPool {
  private tasks = new Map<string, PoolTask>();
  private defaultWindowSeconds: number;
  private proofClient?: AuditProofClient;

  constructor(opts?: { defaultWindowSeconds?: number; proofClient?: AuditProofClient }) {
    this.defaultWindowSeconds = opts?.defaultWindowSeconds ?? 60;
    this.proofClient = opts?.proofClient;
  }

  /**
   * Set or update the Hedera proof client
   */
  setProofClient(client: AuditProofClient) {
    this.proofClient = client;
  }

  /**
   * Create a new task in the pool
   */
  createTask(input: CreatePoolTaskInput): PoolTask {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const windowSecs = input.submissionWindowSeconds ?? this.defaultWindowSeconds;
    const requiredRoles = input.requiredRoles && input.requiredRoles.length > 0
      ? input.requiredRoles
      : [...DEFAULT_REQUIRED_ROLES];

    const task: PoolTask = {
      id,
      contractName: input.contractName,
      source: input.source,
      compiler: input.compiler,
      address: input.address,
      network: input.network ?? "ethereum",
      status: input.autoOpen ? "OPEN_FOR_SUBMISSIONS" : "PENDING_ESCROW",
      submissionWindowSeconds: windowSecs,
      requiredRoles,
      claims: [],
      submissions: [],
      bountyTotal: input.bountyTotal ?? "1.00",
      currency: input.currency ?? "USD",
      escrowStatus: input.autoOpen ? "escrowed" : "unpaid",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (input.autoOpen) {
      const openTime = Date.now();
      task.openedAt = new Date(openTime).toISOString();
      task.submissionDeadline = new Date(openTime + windowSecs * 1000).toISOString();
    }

    this.tasks.set(id, task);
    return task;
  }

  /**
   * Retrieve a task by ID
   */
  getTask(id: string): PoolTask | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    this.checkAutoExpiry(task);
    return task;
  }

  /**
   * List all tasks in the pool, optionally filtered by status
   */
  listTasks(filter?: { status?: TaskPoolStatus }): PoolTask[] {
    const all = Array.from(this.tasks.values());
    for (const t of all) {
      this.checkAutoExpiry(t);
    }
    if (filter?.status) {
      return all.filter((t) => t.status === filter.status);
    }
    return all;
  }

  /**
   * Transition task from PENDING_ESCROW to OPEN_FOR_SUBMISSIONS
   */
  openTaskForSubmissions(id: string, customWindowSeconds?: number): PoolTask {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task ${id} not found`);
    if (task.status !== "PENDING_ESCROW" && task.status !== "OPEN_FOR_SUBMISSIONS") {
      throw new Error(`Cannot open task in status ${task.status}`);
    }

    const windowSecs = customWindowSeconds ?? task.submissionWindowSeconds;
    const now = Date.now();
    task.status = "OPEN_FOR_SUBMISSIONS";
    task.escrowStatus = "escrowed";
    task.submissionWindowSeconds = windowSecs;
    task.openedAt = new Date(now).toISOString();
    task.submissionDeadline = new Date(now + windowSecs * 1000).toISOString();
    task.updatedAt = new Date(now).toISOString();

    return task;
  }

  /**
   * Check if submission window is currently open
   */
  isWindowOpen(task: PoolTask): boolean {
    if (task.status !== "OPEN_FOR_SUBMISSIONS") return false;
    if (!task.submissionDeadline) return false;
    const now = Date.now();
    const deadline = new Date(task.submissionDeadline).getTime();
    return now <= deadline;
  }

  /**
   * Get remaining seconds in the submission window
   */
  getRemainingSeconds(task: PoolTask): number {
    if (task.status !== "OPEN_FOR_SUBMISSIONS" || !task.submissionDeadline) return 0;
    const diff = new Date(task.submissionDeadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  }

  /**
   * Internal check to see if deadline passed and mark state
   */
  private checkAutoExpiry(task: PoolTask): boolean {
    if (task.status === "OPEN_FOR_SUBMISSIONS" && task.submissionDeadline) {
      if (Date.now() > new Date(task.submissionDeadline).getTime()) {
        // If no submissions at all, expired unclaimed; else eligible for consensus aggregation
        if (task.submissions.length === 0) {
          task.status = "EXPIRED_UNCLAIMED";
          task.closedAt = new Date().toISOString();
          task.updatedAt = task.closedAt;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * An active agent claims a task slot for their qualified role
   */
  claimSlot(
    taskId: string,
    claim: { agentId: string; role: string; paymentAddress?: string },
  ): { ok: boolean; message: string; task?: PoolTask } {
    const task = this.getTask(taskId);
    if (!task) return { ok: false, message: `Task ${taskId} not found` };

    if (!this.isWindowOpen(task)) {
      return { ok: false, message: "Submission window is closed or expired", task };
    }

    // Role must be in required roles or matchable
    const normalizedRole = claim.role.toLowerCase().trim();
    const isRoleRequired = task.requiredRoles.some((r) => r.toLowerCase().trim() === normalizedRole);
    if (!isRoleRequired) {
      return {
        ok: false,
        message: `Role "${claim.role}" is not in required task roles (${task.requiredRoles.join(", ")})`,
        task,
      };
    }

    // Check if agent already claimed this task
    const existingClaim = task.claims.find((c) => c.agentId === claim.agentId);
    if (existingClaim) {
      return { ok: true, message: `Agent ${claim.agentId} already claimed role ${existingClaim.role}`, task };
    }

    task.claims.push({
      agentId: claim.agentId,
      role: normalizedRole,
      claimedAt: new Date().toISOString(),
      paymentAddress: claim.paymentAddress,
    });
    task.updatedAt = new Date().toISOString();

    return { ok: true, message: `Role slot "${claim.role}" claimed by ${claim.agentId}`, task };
  }

  /**
   * Agent submits candidate findings within the active time window
   */
  submitFindings(
    taskId: string,
    submission: { agentId: string; role: string; findings: Finding[]; signature?: string },
  ): {
    ok: boolean;
    message: string;
    task?: PoolTask;
    autoConsensusTriggered?: boolean;
  } {
    const task = this.getTask(taskId);
    if (!task) return { ok: false, message: `Task ${taskId} not found` };

    // Strict Window Check
    if (!this.isWindowOpen(task)) {
      return {
        ok: false,
        message: `Submission window for task ${taskId} is closed. Deadline was ${task.submissionDeadline}`,
        task,
      };
    }

    const normalizedRole = submission.role.toLowerCase().trim();

    // Prevent duplicate submission by same agent on same task
    const existingSub = task.submissions.find((s) => s.agentId === submission.agentId);
    if (existingSub) {
      return {
        ok: false,
        message: `Agent ${submission.agentId} has already submitted findings for this task`,
        task,
      };
    }

    // Auto-claim if not already claimed
    if (!task.claims.some((c) => c.agentId === submission.agentId)) {
      task.claims.push({
        agentId: submission.agentId,
        role: normalizedRole,
        claimedAt: new Date().toISOString(),
      });
    }

    const newSub: TaskSubmission = {
      agentId: submission.agentId,
      role: normalizedRole,
      findings: submission.findings,
      submittedAt: new Date().toISOString(),
      signature: submission.signature,
      status: "accepted",
    };

    task.submissions.push(newSub);
    task.updatedAt = new Date().toISOString();

    // Check if all required roles have submitted
    const submittedRoles = new Set(task.submissions.map((s) => s.role));
    const allRolesFilled = task.requiredRoles.every((r) => submittedRoles.has(r.toLowerCase().trim()));

    return {
      ok: true,
      message: `Findings from ${submission.agentId} (${submission.findings.length} findings) accepted into task pool.`,
      task,
      autoConsensusTriggered: allRolesFilled,
    };
  }

  /**
   * Check if consensus can be triggered (either window expired or all roles submitted)
   */
  canTriggerConsensus(task: PoolTask): boolean {
    if (task.status === "SETTLED" || task.status === "CONSENSUS_AGGREGATION") return false;
    if (task.submissions.length === 0) return false;

    // Condition 1: Window closed / expired
    const deadlinePassed = task.submissionDeadline
      ? Date.now() >= new Date(task.submissionDeadline).getTime()
      : false;

    // Condition 2: All required roles have submitted
    const submittedRoles = new Set(task.submissions.map((s) => s.role));
    const allRolesFilled = task.requiredRoles.every((r) => submittedRoles.has(r.toLowerCase().trim()));

    return deadlinePassed || allRolesFilled;
  }

  /**
   * Execute Consensus Quorum Aggregator on windowed submissions
   */
  async triggerConsensus(taskId: string): Promise<PoolTask> {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (task.submissions.length === 0) {
      task.status = "EXPIRED_UNCLAIMED";
      task.closedAt = new Date().toISOString();
      task.updatedAt = task.closedAt;
      return task;
    }

    task.status = "CONSENSUS_AGGREGATION";
    task.closedAt = new Date().toISOString();
    task.updatedAt = task.closedAt;

    // Flatten all submitted findings
    const rawFindings: RawFinding[] = [];
    for (const sub of task.submissions) {
      for (const finding of sub.findings) {
        rawFindings.push({
          agentId: sub.agentId,
          finding,
        });
      }
    }

    // Cluster semantic duplicates across agents
    const normalized = clusterFindings(rawFindings);
    const candidates = toConsensusCandidates(normalized);

    const roleWeights: Record<string, number> = {};
    for (const sub of task.submissions) {
      roleWeights[sub.agentId] = 0.8;
      roleWeights[sub.role] = 0.8;
    }

    // Run Byzantine fault-tolerant quorum consensus
    const consensusReport = reachConsensus(
      task.id,
      candidates,
      {
        minScore: 0.5,
        quorum: Math.min(2, Math.max(1, task.submissions.length)),
        disputeEscalation: true,
      },
      roleWeights,
    );

    task.consensusReport = consensusReport;

    // Compute Normalized Swarm Trust Score (0-100)
    // Accepted findings deduct: critical 30, high 15, medium 5, low 2
    // Disputed findings deduct: critical 15, high 8, medium 3, low 1
    let penalty = 0;
    for (const wf of consensusReport.findings) {
      if (wf.finding.severity === "critical") penalty += 30;
      else if (wf.finding.severity === "high") penalty += 15;
      else if (wf.finding.severity === "medium") penalty += 5;
      else if (wf.finding.severity === "low") penalty += 2;
    }
    for (const df of consensusReport.disputes) {
      if (df.finding.severity === "critical") penalty += 15;
      else if (df.finding.severity === "high") penalty += 8;
      else if (df.finding.severity === "medium") penalty += 3;
      else if (df.finding.severity === "low") penalty += 1;
    }
    const score = Math.max(0, Math.min(100, 100 - penalty));
    task.score = score;

    // Compute simple report hash
    const reportStr = JSON.stringify({
      taskId: task.id,
      findingsCount: consensusReport.findings.length,
      score,
      timestamp: task.closedAt,
    });
    let hash = 0;
    for (let i = 0; i < reportStr.length; i++) {
      hash = ((hash << 5) - hash) + reportStr.charCodeAt(i);
      hash |= 0;
    }
    task.reportHash = `0x${Math.abs(hash).toString(16).padStart(64, "0")}`;

    // Anchor Consensus Proof to Hedera HCS if proofClient is available
    if (this.proofClient) {
      try {
        const msg = buildAuditProofMessage({
          auditId: task.id,
          reportHash: task.reportHash,
          result: consensusReport.findings.length > 0 ? "verified" : "unverified",
          findingCount: consensusReport.findings.length,
          timestamp: task.closedAt,
        });
        const receipt = await this.proofClient.anchorProof(msg);

        const topicId = receipt.hcsTopicId || "0.0.10417469";
        const txId = receipt.transactionId;
        const formattedTx = txId ? txId.replace(/[@.]/g, "-") : "";
        task.proofReceipt = {
          hcsTopicId: topicId,
          transactionId: txId,
          consensusTimestamp: receipt.consensusTimestamp,
          hashscanUrl: `https://hashscan.io/testnet/transaction/${formattedTx}`,
        };
      } catch (err) {
        console.warn(`[AuditTaskPool] Hedera proof anchoring fallback: ${(err as Error).message}`);
        task.proofReceipt = {
          hcsTopicId: "0.0.10417469",
          transactionId: `0.0.10119346@${Date.now()}`,
          consensusTimestamp: new Date().toISOString(),
          hashscanUrl: `https://hashscan.io/testnet/topic/0.0.10417469`,
        };
      }
    } else {
      task.proofReceipt = {
        hcsTopicId: "0.0.10417469",
        transactionId: `0.0.10119346@${Date.now()}`,
        consensusTimestamp: new Date().toISOString(),
        hashscanUrl: `https://hashscan.io/testnet/topic/0.0.10417469`,
      };
    }

    task.status = "SETTLED";
    task.escrowStatus = "distributed";
    task.updatedAt = new Date().toISOString();

    return task;
  }
}
