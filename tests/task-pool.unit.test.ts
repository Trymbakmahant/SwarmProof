import { describe, it, expect, vi } from "vitest";
import { AuditTaskPool } from "../apps/api/src/pool";
import type { Finding } from "@swarmproof/agents";

describe("AuditTaskPool Unit Tests (Stage B.1 & B.3)", () => {
  it("creates a task in PENDING_ESCROW by default", () => {
    const pool = new AuditTaskPool({ defaultWindowSeconds: 60 });
    const task = pool.createTask({
      contractName: "TestVault",
      source: "contract TestVault {}",
    });

    expect(task.id).toMatch(/^task_/);
    expect(task.status).toBe("PENDING_ESCROW");
    expect(task.escrowStatus).toBe("unpaid");
    expect(task.claims).toHaveLength(0);
    expect(task.submissions).toHaveLength(0);
    expect(task.requiredRoles).toEqual([
      "reentrancy",
      "access-control",
      "static-analysis",
      "business-logic",
      "economic-oracle",
    ]);
  });

  it("opens task for submissions and activates countdown deadline", () => {
    const pool = new AuditTaskPool();
    const task = pool.createTask({
      contractName: "TestVault",
      source: "contract TestVault {}",
    });

    const opened = pool.openTaskForSubmissions(task.id, 30);
    expect(opened.status).toBe("OPEN_FOR_SUBMISSIONS");
    expect(opened.escrowStatus).toBe("escrowed");
    expect(opened.openedAt).toBeDefined();
    expect(opened.submissionDeadline).toBeDefined();
    expect(pool.isWindowOpen(opened)).toBe(true);
    expect(pool.getRemainingSeconds(opened)).toBeGreaterThan(0);
    expect(pool.getRemainingSeconds(opened)).toBeLessThanOrEqual(30);
  });

  it("permits active agents to claim matching role slots", () => {
    const pool = new AuditTaskPool();
    const task = pool.createTask({
      contractName: "TestVault",
      source: "contract TestVault {}",
      autoOpen: true,
      submissionWindowSeconds: 60,
    });

    const claimRes = pool.claimSlot(task.id, {
      agentId: "reentrancy-sentinel-01",
      role: "reentrancy",
      paymentAddress: "0.0.10119346",
    });

    expect(claimRes.ok).toBe(true);
    expect(task.claims).toHaveLength(1);
    expect(task.claims[0]!.agentId).toBe("reentrancy-sentinel-01");
    expect(task.claims[0]!.role).toBe("reentrancy");

    // Rejects invalid roles
    const invalidRoleClaim = pool.claimSlot(task.id, {
      agentId: "unrelated-agent",
      role: "invalid-arbitrary-role",
    });
    expect(invalidRoleClaim.ok).toBe(false);
    expect(invalidRoleClaim.message).toContain("not in required task roles");
  });

  it("rejects candidate submissions after time window expiration", () => {
    const pool = new AuditTaskPool();
    const task = pool.createTask({
      contractName: "TestVault",
      source: "contract TestVault {}",
      autoOpen: true,
      submissionWindowSeconds: 1, // 1 second window
    });

    // Artificially advance deadline to the past
    task.submissionDeadline = new Date(Date.now() - 5000).toISOString();

    const subRes = pool.submitFindings(task.id, {
      agentId: "late-agent",
      role: "reentrancy",
      findings: [
        {
          id: "f1",
          title: "Late finding",
          category: "reentrancy",
          severity: "high",
          location: "withdraw",
          evidence: ["late code snippet"],
          status: "proposed",
        },
      ],
    });

    expect(subRes.ok).toBe(false);
    expect(subRes.message).toContain("closed");
    expect(task.submissions).toHaveLength(0);
  });

  it("accepts candidate findings within active window", () => {
    const pool = new AuditTaskPool();
    const task = pool.createTask({
      contractName: "TestVault",
      source: "contract TestVault {}",
      autoOpen: true,
      submissionWindowSeconds: 120,
    });

    const finding: Finding = {
      id: "f_reentrancy_1",
      title: "State updated after transfer",
      category: "reentrancy",
      severity: "critical",
      location: "withdraw",
      evidence: ["balances[msg.sender] updated after external call"],
      status: "proposed",
    };

    const subRes = pool.submitFindings(task.id, {
      agentId: "agent-alpha",
      role: "reentrancy",
      findings: [finding],
    });

    expect(subRes.ok).toBe(true);
    expect(task.submissions).toHaveLength(1);
    expect(task.submissions[0]!.agentId).toBe("agent-alpha");
    expect(task.submissions[0]!.findings).toHaveLength(1);

    // Prevents duplicate submissions from the same agent
    const dupRes = pool.submitFindings(task.id, {
      agentId: "agent-alpha",
      role: "reentrancy",
      findings: [finding],
    });
    expect(dupRes.ok).toBe(false);
    expect(dupRes.message).toContain("already submitted");
  });

  it("automatically flags consensus readiness when all required roles submit findings", () => {
    const requiredRoles = ["reentrancy", "access-control"];
    const pool = new AuditTaskPool();
    const task = pool.createTask({
      contractName: "DualRoleVault",
      source: "contract DualRoleVault {}",
      autoOpen: true,
      requiredRoles,
      submissionWindowSeconds: 300,
    });

    expect(pool.canTriggerConsensus(task)).toBe(false);

    // Sub 1: reentrancy
    const s1 = pool.submitFindings(task.id, {
      agentId: "agent-1",
      role: "reentrancy",
      findings: [
        {
          id: "f1",
          title: "Reentrancy flaw",
          category: "reentrancy",
          severity: "critical",
          location: "withdraw()",
          evidence: ["external call"],
          status: "proposed",
        },
      ],
    });
    expect(s1.autoConsensusTriggered).toBe(false);
    expect(pool.canTriggerConsensus(task)).toBe(false);

    // Sub 2: access-control
    const s2 = pool.submitFindings(task.id, {
      agentId: "agent-2",
      role: "access-control",
      findings: [
        {
          id: "f2",
          title: "Missing onlyAdmin modifier",
          category: "access-control",
          severity: "high",
          location: "setFee()",
          evidence: ["missing require(msg.sender == owner)"],
          status: "proposed",
        },
      ],
    });
    expect(s2.autoConsensusTriggered).toBe(true);
    expect(pool.canTriggerConsensus(task)).toBe(true);
  });

  it("executes quorum consensus on windowed submissions and anchors HCS proof", async () => {
    const pool = new AuditTaskPool();
    const task = pool.createTask({
      contractName: "BankContract",
      source: "contract BankContract {}",
      autoOpen: true,
      requiredRoles: ["reentrancy"],
      submissionWindowSeconds: 60,
    });

    pool.submitFindings(task.id, {
      agentId: "agent-reentrancy",
      role: "reentrancy",
      findings: [
        {
          id: "f1",
          title: "Reentrancy drain",
          category: "reentrancy",
          severity: "critical",
          location: "withdraw",
          evidence: ["CEI violation"],
          status: "proposed",
        },
      ],
    });

    const settled = await pool.triggerConsensus(task.id);
    expect(settled.status).toBe("SETTLED");
    expect(settled.escrowStatus).toBe("distributed");
    expect(settled.consensusReport).toBeDefined();
    expect(settled.reportHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(settled.proofReceipt).toBeDefined();
    expect(settled.proofReceipt?.hcsTopicId).toBe("0.0.10417469");
    expect(settled.score).toBeDefined();
    expect(settled.score).toBeLessThan(100); // reduced due to critical finding
  });
});
