import type { SecurityTask } from "@swarmproof/agents";
import type { PaymentRequirement, PaymentVerification } from "@swarmproof/payments";

export type AuditStatus = "payment-required" | "running" | "done" | "failed" | "unpaid";

export interface AuditRecord {
  id: string;
  task: SecurityTask;
  status: AuditStatus;
  payment?: PaymentRequirement;
  paymentStatus?: PaymentVerification;
  report?: any;
  reportHash?: string;
  proof?: {
    auditId: string;
    reportHash: string;
    hcsTopicId: string;
    transactionId: string;
    consensusTimestamp: string;
    verified: boolean;
  };
  findings?: any;
  verification?: any;
  paymentProofReceipt?: { paymentId: string; transactionId: string; consensusTimestamp: string };
  error?: string;
  createdAt: string;
}

export interface CustomAgentMeta {
  role?: string;
  shape?: string;
  color?: string;
  systemPrompt?: string;
  model?: string;
  endpoint?: string;
  ownerAddress?: string;
  status?: "ACTIVE_SPECIALIST" | "CANDIDATE" | "SUSPENDED";
  qualifiedRole?: string;
  benchmarkScore?: number;
  qualificationTimestamp?: string;
}
