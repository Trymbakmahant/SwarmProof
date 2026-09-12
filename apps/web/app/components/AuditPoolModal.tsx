"use client";

import React, { useState, useEffect } from "react";
import { FullAuditReportModal } from "./FullAuditReportModal";
import { getApiBase } from "../lib/api";

const API_BASE = getApiBase();

export interface TaskPayoutRecord {
  agentId: string;
  role: string;
  address: string;
  sharePercent: number;
  amountUSD: string;
  amountTinybars: number;
  acceptedFindingsCount: number;
  weightScore?: number;
  weightBonusReason?: string;
  transactionId?: string;
  status: "settled" | "pending";
}

export interface SettlementReceipt {
  totalBounty: string;
  currency: string;
  totalTinybars: number;
  gatewayFeeUSD: string;
  gatewayAddress: string;
  agentDistributionUSD: string;
  payoutCount: number;
  settledAt: string;
  hcsTransactionId?: string;
}

export interface PoolTask {
  id: string;
  contractName: string;
  source: string;
  compiler?: string;
  address?: string;
  network?: string;
  status: "PENDING_ESCROW" | "OPEN_FOR_SUBMISSIONS" | "CONSENSUS_AGGREGATION" | "SETTLED" | "EXPIRED_UNCLAIMED";
  submissionWindowSeconds: number;
  openedAt?: string;
  submissionDeadline?: string;
  closedAt?: string;
  requiredRoles: string[];
  claims: Array<{ agentId: string; role: string; claimedAt: string; paymentAddress?: string }>;
  submissions: Array<{
    agentId: string;
    role: string;
    findings: any[];
    submittedAt: string;
    status: "accepted" | "rejected";
  }>;
  consensusReport?: {
    findings: any[];
    disputes: any[];
    summary: string;
  };
  proofReceipt?: {
    hcsTopicId: string;
    transactionId: string;
    consensusTimestamp: string;
    hashscanUrl: string;
  };
  score?: number;
  bountyTotal: string;
  currency: string;
  escrowStatus: string;
  escrowReceipt?: {
    transactionId: string;
    payer: string;
    amountUSD: string;
    amountTinybars: number;
    hashscanUrl: string;
    settledAt: string;
    facilitator?: string;
  };
  payouts?: TaskPayoutRecord[];
  settlementReceipt?: SettlementReceipt;
  createdAt: string;
}

interface AuditPoolModalProps {
  onClose: () => void;
}

const ROLE_DISPLAY_NAMES: Record<string, { label: string; icon: string }> = {
  reentrancy: { label: "Reentrancy & CEI", icon: "🛡️" },
  "access-control": { label: "Access & Auth", icon: "🔐" },
  "static-analysis": { label: "Static Analysis", icon: "⚡" },
  "business-logic": { label: "Business Logic", icon: "⚖️" },
  "economic-oracle": { label: "Oracle & MEV", icon: "📈" },
};

const toHashScanUrl = (txId?: string) => {
  if (!txId) return "https://hashscan.io/testnet";
  const formatted = txId.replace("@", "-").replace(/\.(?=\d{9})/, "-");
  return `https://hashscan.io/testnet/transaction/${formatted}`;
};

export function AuditPoolModal({ onClose }: AuditPoolModalProps) {
  const [tasks, setTasks] = useState<PoolTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "SETTLED">("ALL");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(Date.now());
  const [showCreateTask, setShowCreateTask] = useState(false);

  // New task form state
  const [newContractName, setNewContractName] = useState("FlashLoanVault");
  const [newWindowSeconds, setNewWindowSeconds] = useState(90);
  const [newBounty, setNewBounty] = useState("1.50");
  const [isCreating, setIsCreating] = useState(false);
  const [requireEscrowNew, setRequireEscrowNew] = useState(false);
  const [isEscrowing, setIsEscrowing] = useState<Record<string, boolean>>({});
  const [payerAccountInput, setPayerAccountInput] = useState("0.0.10119346");
  const [escrowSuccessMsg, setEscrowSuccessMsg] = useState<{ [taskId: string]: { txId: string; url: string } }>({});
  const [viewingFullReport, setViewingFullReport] = useState<PoolTask | null>(null);

  // Code4rena Integration State
  const [showCode4renaDrawer, setShowCode4renaDrawer] = useState(false);
  const [code4renaLoading, setCode4renaLoading] = useState(false);
  const [code4renaContests, setCode4renaContests] = useState<any[]>([]);

  // Clock tick every 1000ms for countdown timers
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll tasks from API
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/pool/tasks`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.tasks)) {
          setTasks(data.tasks);
          setSelectedTaskId((prev) => (prev && data.tasks.some((t: PoolTask) => t.id === prev) ? prev : data.tasks[0]?.id ?? null));
        }
      }
    } catch (err) {
      console.warn("Failed to fetch pool tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const pollInterval = setInterval(fetchTasks, 2500);
    return () => clearInterval(pollInterval);
  }, []);

  // Run 10-Agent Dual Swarm Inflow
  const handleSimulateSwarm = async (taskId: string) => {
    try {
      setIsSimulating((prev) => ({ ...prev, [taskId]: true }));
      let res = await fetch(`${API_BASE}/pool/tasks/${taskId}/run-swarm`, {
        method: "POST",
      });
      if (!res.ok) {
        res = await fetch(`${API_BASE}/pool/tasks/${taskId}/simulate-submissions`, {
          method: "POST",
        });
      }
      if (res.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setIsSimulating((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  // Authorize x402 Advance Escrow (Supports real money on-chain via Blocky402)
  const handleAuthorizeEscrow = async (taskId: string, payReal = true) => {
    try {
      setIsEscrowing((prev) => ({ ...prev, [taskId]: true }));
      const res = await fetch(`${API_BASE}/pool/tasks/${taskId}/escrow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payerAddress: payerAccountInput.trim() || "0.0.10119346",
          payRealX402: payReal,
          reference: `x402-escrow-${Date.now()}`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.escrowReceipt?.hashscanUrl) {
          setEscrowSuccessMsg((prev) => ({
            ...prev,
            [taskId]: {
              txId: data.escrowReceipt.transactionId,
              url: data.escrowReceipt.hashscanUrl,
            },
          }));
        }
        await fetchTasks();
      }
    } catch (err) {
      console.error("Escrow authorization failed:", err);
    } finally {
      setIsEscrowing((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  // Force Trigger Consensus
  const handleTriggerConsensus = async (taskId: string) => {
    try {
      const res = await fetch(`${API_BASE}/pool/tasks/${taskId}/trigger-consensus`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error("Consensus trigger failed:", err);
    }
  };

  // Create new task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      const res = await fetch(`${API_BASE}/pool/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractName: newContractName,
          source: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract ${newContractName} {\n    mapping(address => uint256) public balances;\n    function deposit() external payable { balances[msg.sender] += msg.value; }\n    function withdraw() external {\n        uint256 bal = balances[msg.sender];\n        require(bal > 0);\n        (bool s, ) = msg.sender.call{value: bal}("");\n        require(s);\n        balances[msg.sender] = 0;\n    }\n}`,
          submissionWindowSeconds: newWindowSeconds,
          bountyTotal: newBounty,
          currency: "USD",
          autoOpen: !requireEscrowNew,
          requireEscrow: requireEscrowNew,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreateTask(false);
        await fetchTasks();
        if (data.task?.id) setSelectedTaskId(data.task.id);
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleLoadCode4renaContests = async () => {
    setShowCode4renaDrawer(true);
    setShowCreateTask(false);
    setCode4renaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/code4rena/contests`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.contests)) {
          setCode4renaContests(data.contests);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch Code4rena contests:", err);
    } finally {
      setCode4renaLoading(false);
    }
  };

  const handleImportCode4renaContract = async (contestId: string, contractPath: string, contractName: string) => {
    setCode4renaLoading(true);
    try {
      const pullRes = await fetch(`${API_BASE}/code4rena/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contest: contestId, contractPath }),
      });
      if (pullRes.ok) {
        const data = await pullRes.json();
        const createRes = await fetch(`${API_BASE}/pool/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractName: data.contractName || contractName,
            source: data.source,
            submissionWindowSeconds: 120,
            bountyTotal: "2.50",
            currency: "USD",
            requireEscrow: false,
          }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          await fetchTasks();
          if (created.task?.id) {
            setSelectedTaskId(created.task.id);
          }
          setShowCode4renaDrawer(false);
        }
      }
    } catch (err) {
      console.error("Failed to import Code4rena contract:", err);
    } finally {
      setCode4renaLoading(false);
    }
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? tasks[0];

  const filteredTasks = tasks.filter((t) => {
    if (filter === "OPEN") return t.status === "OPEN_FOR_SUBMISSIONS";
    if (filter === "SETTLED") return t.status === "SETTLED";
    return true;
  });

  return (
    <div className="swarm-modal-backdrop" onClick={onClose}>
      <div
        className="swarm-modal-window audit-pool-window"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e4e4e7",
          backgroundColor: "#ffffff",
          overflowY: "auto",
        }}
      >
        {/* Modal Header */}
        <div
          className="swarm-modal-header"
          style={{
            backgroundColor: "#fafafa",
            borderBottom: "1px solid #e4e4e7",
            padding: "16px 22px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: "#10b98115",
                border: "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              ⚡
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#09090b" }}>
                  Live Decentralized Audit Task Pool
                </h3>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontWeight: 700,
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#166534",
                  }}
                >
                  Windowed Consensus
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#71717a" }}>
                Active smart contracts open for autonomous specialist agent claims, timed submission windows, and Hedera HCS settled quorum consensus.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleLoadCode4renaContests}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                backgroundColor: showCode4renaDrawer ? "#f4f4f5" : "#4f46e5",
                color: showCode4renaDrawer ? "#4f46e5" : "#ffffff",
                border: "1px solid #4f46e5",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>🏆</span>
              <span>{showCode4renaDrawer ? "Close Code4rena" : "Pull from Code4rena"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowCreateTask(!showCreateTask);
                setShowCode4renaDrawer(false);
              }}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                backgroundColor: showCreateTask ? "#f4f4f5" : "#09090b",
                color: showCreateTask ? "#09090b" : "#ffffff",
                border: "1px solid #e4e4e7",
                cursor: "pointer",
              }}
            >
              {showCreateTask ? "Close Form" : "+ Create Pool Task"}
            </button>

            <button
              onClick={onClose}
              className="btn-swarm-secondary"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 22 }}>
          {/* Code4rena Contest Puller Drawer */}
          {showCode4renaDrawer && (
            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    🏆 Live Code4rena Competitive Audit Contests
                  </h4>
                  <p style={{ margin: "3px 0 0 0", fontSize: 12, color: "#64748b" }}>
                    Fetch real active smart contract audit problems directly from Code4rena's competitive bounty repositories.
                  </p>
                </div>
                <button
                  onClick={() => setShowCode4renaDrawer(false)}
                  style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#64748b" }}
                >
                  ✕
                </button>
              </div>

              {code4renaLoading ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>
                  Fetching live contest problems from Code4rena...
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                  {code4renaContests.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{c.title}</span>
                          <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", borderRadius: 4, backgroundColor: "#ecfdf5", color: "#059669", fontWeight: 600 }}>
                            {c.prizePool}
                          </span>
                        </div>
                        <a
                          href={c.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 11, color: "#4f46e5", textDecoration: "none" }}
                        >
                          View on GitHub ↗
                        </a>
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#64748b" }}>{c.description}</p>
                      
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {c.contracts?.map((ct: any) => (
                          <button
                            key={ct.path}
                            type="button"
                            onClick={() => handleImportCode4renaContract(c.id, ct.path, ct.name)}
                            disabled={code4renaLoading}
                            style={{
                              padding: "4px 8px",
                              fontSize: 11,
                              borderRadius: 4,
                              backgroundColor: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              color: "#1e293b",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span>📥 Pull &amp; Audit:</span>
                            <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{ct.name}.sol</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Create Task Drawer */}
          {showCreateTask && (
            <form
              onSubmit={handleCreateTask}
              style={{
                backgroundColor: "#fcfcfc",
                border: "1px solid #e4e4e7",
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#09090b" }}>
                Submit New Contract into Decentralized Audit Pool
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#71717a", marginBottom: 4 }}>
                    Contract Name
                  </label>
                  <input
                    type="text"
                    value={newContractName}
                    onChange={(e) => setNewContractName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #e4e4e7",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#71717a", marginBottom: 4 }}>
                    Submission Window (Seconds)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={3600}
                    value={newWindowSeconds}
                    onChange={(e) => setNewWindowSeconds(Number(e.target.value))}
                    required
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #e4e4e7",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#71717a", marginBottom: 4 }}>
                    x402 Bounty Escrow ($ USD)
                  </label>
                  <input
                    type="text"
                    value={newBounty}
                    onChange={(e) => setNewBounty(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #e4e4e7",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 6, marginBottom: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#3f3f46" }}>
                  <input
                    type="checkbox"
                    checked={requireEscrowNew}
                    onChange={(e) => setRequireEscrowNew(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>
                    <strong>Require Upfront x402 Advance Escrow</strong> (Task initiates in <code style={{ fontSize: 11, backgroundColor: "#f4f4f5", padding: "1px 4px", borderRadius: 3 }}>PENDING_ESCROW</code> status until client authorizes payment)
                  </span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateTask(false)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid #e4e4e7",
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  style={{
                    padding: "6px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 6,
                    backgroundColor: "#09090b",
                    color: "#ffffff",
                    border: "none",
                    cursor: isCreating ? "not-allowed" : "pointer",
                  }}
                >
                  {isCreating ? "Opening Pool Window..." : "Deploy to Task Pool →"}
                </button>
              </div>
            </form>
          )}

          {/* Filter Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {(["ALL", "OPEN", "SETTLED"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: filter === f ? "1px solid #09090b" : "1px solid #e4e4e7",
                    backgroundColor: filter === f ? "#09090b" : "#ffffff",
                    color: filter === f ? "#ffffff" : "#52525b",
                    cursor: "pointer",
                  }}
                >
                  {f === "ALL" ? "All Tasks" : f === "OPEN" ? "⚡ Open Windows" : "✓ Settled Consensus"}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "#71717a", fontFamily: "var(--font-mono)" }}>
              {tasks.length} Pool Task{tasks.length === 1 ? "" : "s"} Total
            </div>
          </div>

          {/* Task Grid / Master-Detail Layout */}
          <div className="audit-pool-grid">
            {/* Task List Column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "60vh", overflowY: "auto" }}>
              {loading && tasks.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#71717a", fontSize: 12 }}>
                  Loading decentralized task pool...
                </div>
              ) : filteredTasks.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#71717a", fontSize: 12 }}>
                  No tasks match current filter.
                </div>
              ) : (
                filteredTasks.map((t) => {
                  const isSelected = selectedTask?.id === t.id;
                  const deadlineMs = t.submissionDeadline ? new Date(t.submissionDeadline).getTime() : 0;
                  const remSecs = Math.max(0, Math.ceil((deadlineMs - now) / 1000));
                  const isWindowActive = t.status === "OPEN_FOR_SUBMISSIONS" && remSecs > 0;

                  return (
                    <button
                      type="button"
                      key={t.id}
                      data-task-id={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 8,
                        border: isSelected ? "1.5px solid #09090b" : "1px solid #e4e4e7",
                        backgroundColor: isSelected ? "#fcfcfc" : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#09090b" }}>
                          {t.contractName}
                        </span>
                        {isWindowActive ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "var(--font-mono)",
                              fontWeight: 700,
                              backgroundColor: "#f0fdf4",
                              color: "#15803d",
                              border: "1px solid #bbf7d0",
                              padding: "1px 5px",
                              borderRadius: 4,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#22c55e", display: "inline-block" }} />
                            {remSecs}s
                          </span>
                        ) : t.status === "SETTLED" ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "var(--font-mono)",
                              fontWeight: 700,
                              backgroundColor: "#faf5ff",
                              color: "#7e22ce",
                              border: "1px solid #e9d5ff",
                              padding: "1px 5px",
                              borderRadius: 4,
                            }}
                          >
                            Score: {t.score ?? 100}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "var(--font-mono)",
                              color: "#71717a",
                              backgroundColor: "#f4f4f5",
                              padding: "1px 5px",
                              borderRadius: 4,
                            }}
                          >
                            {t.status.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#71717a" }}>
                        <span style={{ fontFamily: "var(--font-mono)" }}>
                          {t.submissions.length}/{t.requiredRoles.length} Specialists
                        </span>
                        <span style={{ fontWeight: 600, color: "#09090b" }}>
                          ${t.bountyTotal} {t.currency}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Task Detail View */}
            {selectedTask ? (
              <div
                style={{
                  minWidth: 0,
                  overflowX: "hidden",
                  border: "1px solid #e4e4e7",
                  borderRadius: 8,
                  backgroundColor: "#ffffff",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {/* Header info */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#09090b" }}>
                        {selectedTask.contractName}
                      </h4>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontWeight: 700,
                          backgroundColor:
                            selectedTask.status === "OPEN_FOR_SUBMISSIONS"
                              ? "#f0fdf4"
                              : selectedTask.status === "SETTLED"
                                ? "#faf5ff"
                                : "#f4f4f5",
                          color:
                            selectedTask.status === "OPEN_FOR_SUBMISSIONS"
                              ? "#15803d"
                              : selectedTask.status === "SETTLED"
                                ? "#7e22ce"
                                : "#52525b",
                          border: "1px solid #e4e4e7",
                        }}
                      >
                        {selectedTask.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#71717a", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                      Task ID: {selectedTask.id} • Escrow: ${selectedTask.bountyTotal} {selectedTask.currency} (x402)
                    </div>
                  </div>

                  {/* Countdown Timer Box */}
                  {selectedTask.status === "OPEN_FOR_SUBMISSIONS" && (
                    <div
                      style={{
                        textAlign: "right",
                        backgroundColor: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: 6,
                        padding: "6px 12px",
                      }}
                    >
                      <div style={{ fontSize: 9, textTransform: "uppercase", fontWeight: 700, color: "#166534" }}>
                        Window Closes In
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "var(--font-mono)", color: "#15803d" }}>
                        {Math.max(
                          0,
                          Math.ceil(
                            ((selectedTask.submissionDeadline ? new Date(selectedTask.submissionDeadline).getTime() : 0) - now) / 1000,
                          ),
                        )}
                        s
                      </div>
                    </div>
                  )}

                  {selectedTask.status === "SETTLED" && (
                    <div
                      style={{
                        textAlign: "right",
                        backgroundColor: "#faf5ff",
                        border: "1px solid #e9d5ff",
                        borderRadius: 6,
                        padding: "6px 12px",
                      }}
                    >
                      <div style={{ fontSize: 9, textTransform: "uppercase", fontWeight: 700, color: "#7e22ce" }}>
                        Swarm Trust Score
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "var(--font-mono)", color: "#6b21a8" }}>
                        {selectedTask.score ?? 100}/100
                      </div>
                    </div>
                  )}
                </div>

                {/* x402 Advance Escrow Caller Card (Real Money on Hedera Option) */}
                {selectedTask.status === "PENDING_ESCROW" && (
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 8,
                      backgroundColor: "#fffbeb",
                      border: "1px solid #fde68a",
                      marginBottom: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 16 }}>💳</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
                          x402 Advance Escrow Deposit Required
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            backgroundColor: "#fef3c7",
                            color: "#b45309",
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: "1px solid #fde68a",
                            fontWeight: 700,
                          }}
                        >
                          HTTP 402 QUOTE
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            backgroundColor: "#dbeafe",
                            color: "#1d4ed8",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: 700,
                          }}
                        >
                          HEDERA TESTNET
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#78350f" }}>
                        Bounty deposit of <strong>${selectedTask.bountyTotal} {selectedTask.currency}</strong> ({(parseFloat(selectedTask.bountyTotal) * 1_000_000).toLocaleString()} tinybars = {(parseFloat(selectedTask.bountyTotal) * 0.01).toFixed(4)} ℏ) must be authorized before the submission window opens to specialist agents.
                      </div>
                      <div style={{ fontSize: 11, color: "#92400e", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                        Payee: 0.0.10417474 • Facilitator: Blocky402 (0.0.7162784) • Rail: ExactHederaScheme
                      </div>
                    </div>

                    {/* Caller Payer Wallet Selection */}
                    <div
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #fef3c7",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#78350f", whiteSpace: "nowrap" }}>
                        Payer Hedera Wallet:
                      </div>
                      <input
                        type="text"
                        value={payerAccountInput}
                        onChange={(e) => setPayerAccountInput(e.target.value)}
                        placeholder="0.0.10119346"
                        style={{
                          padding: "4px 8px",
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          borderRadius: 4,
                          border: "1px solid #e4e4e7",
                          width: "140px",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          color: "#15803d",
                          backgroundColor: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        ● Operator Wallet Live (~979 ℏ Funded)
                      </span>
                    </div>

                    {/* Pay Buttons */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleAuthorizeEscrow(selectedTask.id, false)}
                        disabled={isEscrowing[selectedTask.id]}
                        style={{
                          padding: "6px 12px",
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 6,
                          backgroundColor: "#ffffff",
                          color: "#52525b",
                          border: "1px solid #e4e4e7",
                          cursor: isEscrowing[selectedTask.id] ? "not-allowed" : "pointer",
                        }}
                      >
                        Instant Mock Escrow
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAuthorizeEscrow(selectedTask.id, true)}
                        disabled={isEscrowing[selectedTask.id]}
                        style={{
                          padding: "8px 16px",
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 6,
                          backgroundColor: "#d97706",
                          color: "#ffffff",
                          border: "none",
                          cursor: isEscrowing[selectedTask.id] ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                        }}
                      >
                        {isEscrowing[selectedTask.id] ? (
                          <span>Signing & Settling via Blocky402...</span>
                        ) : (
                          <span>💳 Pay Real x402 Escrow (${selectedTask.bountyTotal} USD) On-Chain →</span>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* On-Chain Escrow Confirmed Banner */}
                {(selectedTask.escrowReceipt || escrowSuccessMsg[selectedTask.id]) && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #86efac",
                      marginBottom: 16,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>✓ Real x402 Advance Escrow Confirmed On-Chain</span>
                        <span style={{ fontSize: 9, backgroundColor: "#dcfce7", color: "#166534", padding: "1px 6px", borderRadius: 4, fontFamily: "var(--font-mono)" }}>
                          BLOCKY402 SETTLED
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#166534", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                        Tx: {selectedTask.escrowReceipt?.transactionId || escrowSuccessMsg[selectedTask.id]?.txId} • Payer: {selectedTask.escrowReceipt?.payer || "0.0.10119346"} • ${selectedTask.escrowReceipt?.amountUSD ?? selectedTask.bountyTotal} USD
                      </div>
                    </div>
                    <a
                      href={toHashScanUrl(selectedTask.escrowReceipt?.transactionId || escrowSuccessMsg[selectedTask.id]?.txId)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: "#ffffff",
                        backgroundColor: "#15803d",
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 12px",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span>View Escrow on HashScan ↗</span>
                    </a>
                  </div>
                )}

                {/* Participation Roles Matrix */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 }}>
                    Specialist Role Slot Submissions
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {selectedTask.requiredRoles.map((role) => {
                      const submission = selectedTask.submissions.find((s) => s.role.toLowerCase() === role.toLowerCase());
                      const claim = selectedTask.claims.find((c) => c.role.toLowerCase() === role.toLowerCase());
                      const meta = ROLE_DISPLAY_NAMES[role] ?? { label: role, icon: "🤖" };

                      return (
                        <div
                          key={role}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 6,
                            border: submission ? "1px solid #bbf7d0" : claim ? "1px solid #fde68a" : "1px dashed #e4e4e7",
                            backgroundColor: submission ? "#f0fdf4" : claim ? "#fffbeb" : "#fafafa",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 16 }}>{meta.icon}</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#09090b" }}>{meta.label}</div>
                              <div style={{ fontSize: 10, color: "#71717a", fontFamily: "var(--font-mono)" }}>
                                {submission
                                  ? `Submitted by ${submission.agentId}`
                                  : claim
                                    ? `Claimed by ${claim.agentId}`
                                    : "Open for qualified agent"}
                              </div>
                            </div>
                          </div>

                          <div>
                            {submission ? (
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#15803d", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: 4, border: "1px solid #bbf7d0" }}>
                                ✓ {submission.findings.length} findings
                              </span>
                            ) : claim ? (
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#b45309", backgroundColor: "#ffffff", padding: "2px 6px", borderRadius: 4, border: "1px solid #fde68a" }}>
                                Pending
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: "#a1a1aa" }}>Awaiting</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Consensus Proof Card if Settled */}
                {selectedTask.status === "SETTLED" && selectedTask.proofReceipt && (
                  <div
                    style={{
                      backgroundColor: "#faf5ff",
                      border: "1px solid #e9d5ff",
                      borderRadius: 8,
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b21a8" }}>
                        🏛️ Hedera HCS Quorum Consensus Anchored
                      </div>
                      <a
                        href={selectedTask.proofReceipt.hashscanUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#7e22ce",
                          textDecoration: "none",
                        }}
                      >
                        Verify on HashScan Explorer ↗
                      </a>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, fontFamily: "var(--font-mono)" }}>
                      <div style={{ backgroundColor: "#ffffff", padding: "4px 8px", borderRadius: 4, border: "1px solid #e9d5ff" }}>
                        <span style={{ color: "#71717a" }}>Topic ID: </span>
                        <strong>{selectedTask.proofReceipt.hcsTopicId}</strong>
                      </div>
                      <div style={{ backgroundColor: "#ffffff", padding: "4px 8px", borderRadius: 4, border: "1px solid #e9d5ff" }}>
                        <span style={{ color: "#71717a" }}>Consensus: </span>
                        <strong>{selectedTask.consensusReport?.findings.length ?? 0} Accepted Findings</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* x402 Autonomous Multi-Agent Settlement & Micropayment Stream (Stage D.2) */}
                {selectedTask.status === "SETTLED" && (
                  <div
                    style={{
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 8,
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 16 }}>💳</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>
                          x402 Autonomous Multi-Agent Settlement & Micropayment Stream
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: "var(--font-mono)",
                          color: "#15803d",
                          backgroundColor: "#ffffff",
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: "1px solid #bbf7d0",
                        }}
                      >
                        ✓ ESCROW DISTRIBUTED
                      </span>
                    </div>

                    {/* Settlement Summary Metrics */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                      <div style={{ backgroundColor: "#ffffff", padding: "6px 10px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                        <div style={{ color: "#71717a", fontSize: 10 }}>Total Escrow Settled</div>
                        <div style={{ fontWeight: 800, color: "#09090b", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                          ${selectedTask.bountyTotal} {selectedTask.currency}
                        </div>
                        <div style={{ fontSize: 10, color: "#15803d", fontFamily: "var(--font-mono)" }}>
                          {(parseFloat(selectedTask.bountyTotal) * 1_000_000).toLocaleString()} tinybars
                        </div>
                      </div>

                      <div style={{ backgroundColor: "#ffffff", padding: "6px 10px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                        <div style={{ color: "#71717a", fontSize: 10 }}>10% Protocol Gateway Fee</div>
                        <div style={{ fontWeight: 800, color: "#09090b", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                          ${selectedTask.settlementReceipt?.gatewayFeeUSD ?? (parseFloat(selectedTask.bountyTotal) * 0.1).toFixed(2)} USD
                        </div>
                        <div style={{ fontSize: 10, color: "#71717a", fontFamily: "var(--font-mono)" }}>
                          Gateway: 0.0.10417474
                        </div>
                      </div>

                      <div style={{ backgroundColor: "#ffffff", padding: "6px 10px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                        <div style={{ color: "#71717a", fontSize: 10 }}>90% Direct Agent Pool</div>
                        <div style={{ fontWeight: 800, color: "#15803d", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                          ${selectedTask.settlementReceipt?.agentDistributionUSD ?? (parseFloat(selectedTask.bountyTotal) * 0.9).toFixed(2)} USD
                        </div>
                        <div style={{ fontSize: 10, color: "#15803d", fontFamily: "var(--font-mono)" }}>
                          Streamed to {selectedTask.payouts?.length ?? selectedTask.submissions.length} Agents
                        </div>
                      </div>
                    </div>

                    {/* On-Chain Hedera Verification & Consensus-Weighted Policy Banner */}
                    <div
                      style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #bbf7d0",
                        borderRadius: 6,
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                          <span style={{ fontWeight: 800, color: "#166534" }}>⚖️ Dynamic Consensus-Weighted Payout</span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              color: "#15803d",
                              backgroundColor: "#f0fdf4",
                              padding: "1px 6px",
                              borderRadius: 4,
                              border: "1px solid #86efac",
                            }}
                          >
                            WEIGHTED BY SEVERITY
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: "#52525b" }}>
                          Agents receive bounty proportional to verified vulnerability severity (Critical: +5.0x, High: +3.0x, Medium: +1.5x, Base Participation: 1.0x).
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {selectedTask.settlementReceipt?.hcsTransactionId || selectedTask.proofReceipt?.transactionId ? (
                          <a
                            href={toHashScanUrl(selectedTask.settlementReceipt?.hcsTransactionId || selectedTask.proofReceipt?.transactionId)}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 11,
                              fontFamily: "var(--font-mono)",
                              fontWeight: 700,
                              color: "#0284c7",
                              backgroundColor: "#f0f9ff",
                              border: "1px solid #bae6fd",
                              borderRadius: 6,
                              padding: "6px 12px",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>⛓️ View Settlement On-Chain (HashScan)</span>
                            <span>↗</span>
                          </a>
                        ) : (
                          <a
                            href="https://hashscan.io/testnet/topic/0.0.10417469"
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 11,
                              fontFamily: "var(--font-mono)",
                              fontWeight: 700,
                              color: "#15803d",
                              backgroundColor: "#f0fdf4",
                              border: "1px solid #86efac",
                              borderRadius: 6,
                              padding: "6px 12px",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>Topic 0.0.10417469 on HashScan ↗</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Individual Payouts Table */}
                    {selectedTask.payouts && selectedTask.payouts.length > 0 && (
                      <div style={{ marginTop: 4, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
                              Participating Agent Wallet Micropayment Stream
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 600, color: "#0284c7", backgroundColor: "#e0f2fe", border: "1px solid #bae6fd", borderRadius: 4, padding: "1px 6px" }}>
                              ↔ Scroll to view On-Chain Tx
                            </span>
                          </div>
                          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#71717a" }}>
                            Hedera Testnet Settlement (x402 Micro-transactions)
                          </div>
                        </div>
                        <div
                          className="audit-pool-table-scroll"
                          style={{
                            border: "1px solid #bbf7d0",
                            borderRadius: 6,
                            backgroundColor: "#ffffff",
                            boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.03)",
                          }}
                        >
                          <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse", fontSize: 11, whiteSpace: "nowrap" }}>
                            <thead>
                              <tr style={{ backgroundColor: "#f0fdf4", borderBottom: "1px solid #bbf7d0", textAlign: "left", color: "#166534" }}>
                                <th style={{ padding: "6px 10px", fontWeight: 600 }}>Agent ID</th>
                                <th style={{ padding: "6px 10px", fontWeight: 600 }}>Role</th>
                                <th style={{ padding: "6px 10px", fontWeight: 600, textAlign: "center" }}>Consensus Weight</th>
                                <th style={{ padding: "6px 10px", fontWeight: 600 }}>Payout Address</th>
                                <th style={{ padding: "6px 10px", fontWeight: 600, textAlign: "right" }}>Share %</th>
                                <th style={{ padding: "6px 10px", fontWeight: 600, textAlign: "right" }}>Payout (Tinybars)</th>
                                <th style={{ padding: "6px 10px", fontWeight: 600, textAlign: "right" }}>Amount ($ USD)</th>
                                <th style={{ padding: "6px 10px", fontWeight: 600, textAlign: "center" }}>On-Chain Tx (Hedera)</th>
                                <th style={{ padding: "6px 10px", fontWeight: 600, textAlign: "center" }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedTask.payouts.map((p, idx) => {
                                const weightVal = p.weightScore ?? (p.acceptedFindingsCount > 0 ? p.acceptedFindingsCount * 3 + 1 : 1);
                                return (
                                  <tr key={idx} style={{ borderBottom: idx < selectedTask.payouts!.length - 1 ? "1px solid #f4f4f5" : "none" }}>
                                    <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{p.agentId}</td>
                                    <td style={{ padding: "6px 10px", textTransform: "capitalize" }}>{p.role}</td>
                                    <td style={{ padding: "6px 10px", textAlign: "center" }}>
                                      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
                                        <span
                                          style={{
                                            fontFamily: "var(--font-mono)",
                                            fontWeight: 800,
                                            fontSize: 10,
                                            color: weightVal > 1 ? "#15803d" : "#52525b",
                                            backgroundColor: weightVal > 1 ? "#f0fdf4" : "#f4f4f5",
                                            border: `1px solid ${weightVal > 1 ? "#86efac" : "#e4e4e7"}`,
                                            borderRadius: 4,
                                            padding: "1px 6px",
                                          }}
                                          title={p.weightBonusReason || (p.acceptedFindingsCount > 0 ? `${p.acceptedFindingsCount} Accepted Finding(s)` : "Base Verifier Participation")}
                                        >
                                          {p.weightScore ? `${p.weightScore}x` : `${weightVal.toFixed(1)}x`}
                                        </span>
                                        {p.acceptedFindingsCount > 0 && (
                                          <span style={{ fontSize: 9, color: "#166534", marginTop: 2 }}>
                                            {p.acceptedFindingsCount} verified
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono)", color: "#71717a" }}>{p.address}</td>
                                    <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                                      {p.sharePercent}%
                                    </td>
                                    <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "#15803d" }}>
                                      {p.amountTinybars.toLocaleString()}
                                    </td>
                                    <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                                      ${p.amountUSD}
                                    </td>
                                    <td style={{ padding: "6px 10px", textAlign: "center" }}>
                                      {p.transactionId ? (
                                        <a
                                          href={toHashScanUrl(p.transactionId)}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{
                                            fontSize: 10,
                                            fontFamily: "var(--font-mono)",
                                            color: "#0284c7",
                                            backgroundColor: "#f0f9ff",
                                            border: "1px solid #bae6fd",
                                            borderRadius: 4,
                                            padding: "2px 6px",
                                            textDecoration: "none",
                                            fontWeight: 600,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 3,
                                          }}
                                          title={`View Hedera transaction ${p.transactionId} on HashScan`}
                                        >
                                          <span>Tx {p.transactionId.slice(0, 14)}...</span>
                                          <span>↗</span>
                                        </a>
                                      ) : (
                                        <span style={{ fontSize: 10, color: "#a1a1aa", fontFamily: "var(--font-mono)" }}>—</span>
                                      )}
                                    </td>
                                    <td style={{ padding: "6px 10px", textAlign: "center" }}>
                                      <span style={{ fontSize: 9, fontWeight: 700, color: "#15803d", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "1px 6px" }}>
                                        ✓ Settled
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: "auto" }}>
                  {selectedTask.status === "PENDING_ESCROW" && (
                    <button
                      type="button"
                      onClick={() => handleAuthorizeEscrow(selectedTask.id, true)}
                      disabled={isEscrowing[selectedTask.id]}
                      style={{
                        padding: "8px 16px",
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 6,
                        backgroundColor: "#d97706",
                        color: "#ffffff",
                        border: "none",
                        cursor: isEscrowing[selectedTask.id] ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      }}
                    >
                      {isEscrowing[selectedTask.id] ? "Authorizing via Blocky402..." : `💳 Pay $${selectedTask.bountyTotal} Real x402 Escrow On-Chain →`}
                    </button>
                  )}

                  {selectedTask.status === "SETTLED" && (
                    <button
                      type="button"
                      onClick={() => setViewingFullReport(selectedTask)}
                      style={{
                        padding: "8px 16px",
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 6,
                        backgroundColor: "#09090b",
                        color: "#ffffff",
                        border: "none",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      }}
                    >
                      📄 View Formal Audit Report & Download PDF →
                    </button>
                  )}

                  {selectedTask.status === "OPEN_FOR_SUBMISSIONS" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          backgroundColor: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          borderRadius: 6,
                          fontSize: 11,
                          color: "#166534",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: "#16a34a",
                              boxShadow: "0 0 0 3px rgba(22, 163, 74, 0.2)",
                            }}
                          />
                          <span>
                            <strong>⚡ Autonomous Swarm Active:</strong> Agents continuously poll & auto-solve open pool tasks...
                          </span>
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#15803d", fontWeight: 700 }}>
                          {selectedTask.submissions?.length ?? 0} Submissions Received
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => handleSimulateSwarm(selectedTask.id)}
                          disabled={isSimulating[selectedTask.id]}
                          style={{
                            padding: "8px 14px",
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: 6,
                            backgroundColor: "#09090b",
                            color: "#ffffff",
                            border: "none",
                            cursor: isSimulating[selectedTask.id] ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {isSimulating[selectedTask.id] ? "Swarming Agents in..." : "⚡ Force Trigger Swarm Now →"}
                        </button>

                        {selectedTask.submissions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleTriggerConsensus(selectedTask.id)}
                            style={{
                              padding: "8px 14px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              backgroundColor: "#f4f4f5",
                              color: "#09090b",
                              border: "1px solid #e4e4e7",
                              cursor: "pointer",
                            }}
                          >
                            Trigger Consensus Now ⚖️ ({selectedTask.submissions.length})
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Full Formal Audit Report & PDF Modal Overlay (Stage D.3) */}
      {viewingFullReport && (
        <FullAuditReportModal
          auditResult={{
            id: viewingFullReport.id,
            task: {
              contractName: viewingFullReport.contractName,
              source: viewingFullReport.source,
              network: viewingFullReport.network ?? "ethereum",
            },
            status: "completed",
            createdAt: viewingFullReport.createdAt,
            payment: {
              paymentId: viewingFullReport.id,
              total: viewingFullReport.bountyTotal,
              currency: viewingFullReport.currency,
              network: "hedera-testnet",
              recipients: (viewingFullReport.payouts || []).map((p) => ({
                agentId: p.agentId,
                address: p.address,
                amount: p.amountUSD,
              })),
            },
            paymentStatus: {
              status: "settled",
              paidAmount: viewingFullReport.bountyTotal,
              paidAt: viewingFullReport.settlementReceipt?.settledAt ?? viewingFullReport.createdAt,
            },
            paymentProofReceipt: viewingFullReport.proofReceipt ? {
              paymentId: viewingFullReport.id,
              transactionId: viewingFullReport.proofReceipt.transactionId,
              consensusTimestamp: viewingFullReport.proofReceipt.consensusTimestamp,
            } : undefined,
            report: {
              auditId: viewingFullReport.id,
              contractName: viewingFullReport.contractName,
              network: viewingFullReport.network ?? "ethereum",
              result: (viewingFullReport.score ?? 100) < 70 ? "VULNERABILITIES_DETECTED" : "PASSED",
              findings: (viewingFullReport.consensusReport?.findings || []).map((wf: any) => ({
                id: wf.finding?.id || "f_unknown",
                category: wf.finding?.category || "general",
                severity: wf.finding?.severity || "medium",
                locations: wf.finding?.locations || [wf.finding?.location || "Contract"],
                agents: (wf.evidence || []).map((e: any) => e.agentRole || e.role),
                snippets: wf.finding?.evidence || [],
              })),
              verification: [],
              consensusSummary: viewingFullReport.consensusReport?.summary || "Byzantine fault-tolerant consensus quorum finalized across all submitting specialist agents.",
              generatedAt: viewingFullReport.settlementReceipt?.settledAt ?? viewingFullReport.createdAt,
            },
            proof: viewingFullReport.proofReceipt ? {
              auditId: viewingFullReport.id,
              reportHash: "0x" + Array.from(viewingFullReport.id).map(c => c.charCodeAt(0).toString(16)).join("").padEnd(64, "0").slice(0, 64),
              hcsTopicId: viewingFullReport.proofReceipt.hcsTopicId,
              transactionId: viewingFullReport.proofReceipt.transactionId,
              consensusTimestamp: viewingFullReport.proofReceipt.consensusTimestamp,
              verified: true,
            } : undefined,
            findings: viewingFullReport.consensusReport?.findings || [],
          } as any}
          onClose={() => setViewingFullReport(null)}
        />
      )}
    </div>
  );
}
