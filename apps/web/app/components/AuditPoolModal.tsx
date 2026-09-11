"use client";

import React, { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

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
          if (!selectedTaskId && data.tasks.length > 0) {
            setSelectedTaskId(data.tasks[0].id);
          }
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

  // Simulate Swarm Specialist Inflow
  const handleSimulateSwarm = async (taskId: string) => {
    try {
      setIsSimulating((prev) => ({ ...prev, [taskId]: true }));
      const res = await fetch(`${API_BASE}/pool/tasks/${taskId}/simulate-submissions`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setIsSimulating((prev) => ({ ...prev, [taskId]: false }));
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
          autoOpen: true,
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

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? tasks[0];

  const filteredTasks = tasks.filter((t) => {
    if (filter === "OPEN") return t.status === "OPEN_FOR_SUBMISSIONS";
    if (filter === "SETTLED") return t.status === "SETTLED";
    return true;
  });

  return (
    <div className="swarm-modal-backdrop" onClick={onClose}>
      <div
        className="swarm-modal-window"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 960,
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e4e4e7",
          backgroundColor: "#ffffff",
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
              onClick={() => setShowCreateTask(!showCreateTask)}
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
          <div style={{ display: "grid", gridTemplateColumns: "310px 1fr", gap: 16 }}>
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
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      style={{
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
                    </div>
                  );
                })
              )}
            </div>

            {/* Task Detail View */}
            {selectedTask ? (
              <div
                style={{
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

                {/* Action Buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: "auto" }}>
                  {selectedTask.status === "OPEN_FOR_SUBMISSIONS" && (
                    <>
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
                        {isSimulating[selectedTask.id] ? "Swarming Agents in..." : "🤖 Simulate Swarm Specialist Inflow →"}
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
                          Trigger Consensus Now ⚖️
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
