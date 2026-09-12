import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PoolTask, TaskClaim, TaskSubmission, TaskPayoutRecord } from "./pool.js";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log(`[Supabase] Connected to database at: ${url}`);
      return supabaseClient;
    } catch (err) {
      console.warn(`[Supabase] Client initialization error: ${(err as Error).message}`);
      return null;
    }
  }

  return null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
}

/**
 * Persist or update a pool task in Supabase
 */
export async function dbSaveTask(task: PoolTask): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  try {
    const { error } = await sb.from("pool_tasks").upsert(
      {
        id: task.id,
        contract_name: task.contractName,
        source: task.source,
        compiler: task.compiler,
        address: task.address,
        network: task.network ?? "ethereum",
        status: task.status,
        submission_window_seconds: task.submissionWindowSeconds,
        opened_at: task.openedAt,
        submission_deadline: task.submissionDeadline,
        closed_at: task.closedAt,
        required_roles: task.requiredRoles,
        bounty_total: task.bountyTotal,
        currency: task.currency,
        escrow_status: task.escrowStatus,
        score: task.score,
        report_hash: task.reportHash,
        hcs_topic_id: task.proofReceipt?.hcsTopicId,
        proof_transaction_id: task.proofReceipt?.transactionId,
        escrow_receipt: task.escrowReceipt,
        settlement_receipt: task.settlementReceipt,
        consensus_report: task.consensusReport,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.warn(`[Supabase] Failed to upsert task ${task.id}:`, error.message);
      return false;
    }

    // Upsert payouts if present
    if (task.payouts && task.payouts.length > 0) {
      const payoutRows = task.payouts.map((p) => ({
        task_id: task.id,
        agent_id: p.agentId,
        role: p.role,
        address: p.address,
        share_percent: p.sharePercent,
        amount_usd: p.amountUSD,
        amount_tinybars: p.amountTinybars,
        accepted_findings_count: p.acceptedFindingsCount,
        weight_score: p.weightScore ?? 1.0,
        weight_bonus_reason: p.weightBonusReason,
        transaction_id: p.transactionId,
        status: p.status,
      }));

      await sb.from("agent_payouts").upsert(payoutRows);
    }

    return true;
  } catch (err) {
    console.warn(`[Supabase] dbSaveTask exception for ${task.id}:`, (err as Error).message);
    return false;
  }
}

/**
 * Persist a slot claim
 */
export async function dbSaveClaim(taskId: string, claim: TaskClaim): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  try {
    const { error } = await sb.from("task_claims").upsert(
      {
        task_id: taskId,
        agent_id: claim.agentId,
        role: claim.role,
        payment_address: claim.paymentAddress,
        claimed_at: claim.claimedAt,
      },
      { onConflict: "task_id,agent_id,role" }
    );

    return !error;
  } catch {
    return false;
  }
}

/**
 * Persist an agent submission
 */
export async function dbSaveSubmission(taskId: string, sub: TaskSubmission): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  try {
    const { error } = await sb.from("task_submissions").upsert(
      {
        task_id: taskId,
        agent_id: sub.agentId,
        role: sub.role,
        findings: sub.findings,
        status: sub.status,
        validation_message: sub.validationMessage,
        submitted_at: sub.submittedAt,
      },
      { onConflict: "task_id,agent_id" }
    );

    return !error;
  } catch {
    return false;
  }
}

/**
 * Load all tasks and their related claims, submissions, and payouts from Supabase
 */
export async function dbLoadAllTasks(): Promise<PoolTask[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  try {
    const { data: taskRows, error } = await sb
      .from("pool_tasks")
      .select(`
        *,
        task_claims (*),
        task_submissions (*),
        agent_payouts (*)
      `)
      .order("created_at", { ascending: false });

    if (error || !taskRows) {
      console.warn(`[Supabase] Failed to load tasks:`, error?.message);
      return [];
    }

    return taskRows.map((r: any): PoolTask => {
      const claims: TaskClaim[] = (r.task_claims || []).map((c: any) => ({
        agentId: c.agent_id,
        role: c.role,
        claimedAt: c.claimed_at,
        paymentAddress: c.payment_address,
      }));

      const submissions: TaskSubmission[] = (r.task_submissions || []).map((s: any) => ({
        agentId: s.agent_id,
        role: s.role,
        findings: s.findings || [],
        submittedAt: s.submitted_at,
        status: s.status,
        validationMessage: s.validation_message,
      }));

      const payouts: TaskPayoutRecord[] = (r.agent_payouts || []).map((p: any) => ({
        agentId: p.agent_id,
        role: p.role,
        address: p.address,
        sharePercent: parseFloat(p.share_percent || "0"),
        amountUSD: p.amount_usd,
        amountTinybars: Number(p.amount_tinybars || 0),
        acceptedFindingsCount: p.accepted_findings_count || 0,
        weightScore: p.weight_score ? parseFloat(p.weight_score) : 1.0,
        weightBonusReason: p.weight_bonus_reason,
        transactionId: p.transaction_id,
        status: p.status,
      }));

      return {
        id: r.id,
        contractName: r.contract_name,
        source: r.source,
        compiler: r.compiler,
        address: r.address,
        network: r.network,
        status: r.status,
        submissionWindowSeconds: r.submission_window_seconds,
        openedAt: r.opened_at,
        submissionDeadline: r.submission_deadline,
        closedAt: r.closed_at,
        requiredRoles: r.required_roles || [],
        claims,
        submissions,
        bountyTotal: r.bounty_total || "1.00",
        currency: r.currency || "USD",
        escrowStatus: r.escrow_status || "unpaid",
        score: r.score ? parseFloat(r.score) : undefined,
        reportHash: r.report_hash,
        proofReceipt: r.proof_transaction_id
          ? {
              hcsTopicId: r.hcs_topic_id || "0.0.10417469",
              transactionId: r.proof_transaction_id,
              consensusTimestamp: r.closed_at || new Date().toISOString(),
              hashscanUrl: `https://hashscan.io/testnet/transaction/${r.proof_transaction_id}`,
            }
          : undefined,
        escrowReceipt: r.escrow_receipt,
        settlementReceipt: r.settlement_receipt,
        consensusReport: r.consensus_report,
        payouts: payouts.length > 0 ? payouts : undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  } catch (err) {
    console.warn(`[Supabase] dbLoadAllTasks exception:`, (err as Error).message);
    return [];
  }
}
