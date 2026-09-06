import { describe, expect, it } from "vitest";
import {
  createSpecialistAgents,
  StubProvider,
  type SecurityTask,
} from "@swarmproof/agents";
import { AuditOrchestrator, DEFAULT_SPECIALIST_WEIGHTS } from "@swarmproof/swarm";
import { createVerifier } from "@swarmproof/verification";
import { MockAuditProofClient, sha256Hex, deterministicStringify } from "@swarmproof/hedera";

const REENTRANCY_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Vault {
  mapping(address => uint256) public balances;
  function withdraw() external {
    uint256 amt = balances[msg.sender];
    (bool ok, ) = msg.sender.call{value: amt}("");
    require(ok);
    balances[msg.sender] = 0;
  }
}`;

const task: SecurityTask = {
  contractName: "Vault",
  source: REENTRANCY_SOURCE,
  network: "ethereum",
};

function makeOrchestrator(proofClient?: MockAuditProofClient) {
  return new AuditOrchestrator({
    specialists: createSpecialistAgents(),
    verification: createVerifier("mock"),
    proofClient,
    weights: DEFAULT_SPECIALIST_WEIGHTS,
  });
}

describe("swarm orchestration (P0 spec flow)", () => {
  it("1+5: parallel specialists → consensus → verification → report → HCS-proof", async () => {
    const proof = new MockAuditProofClient("0.0.12345");
    const result = await makeOrchestrator(proof).run("audit_flow", task);

    // Specialists ran independently (Promise.all).
    expect(result.raw.length).toBeGreaterThanOrEqual(1);
    // Consensus accepted the reentrancy cluster.
    expect(result.consensus.summary).toContain("accepted");
    expect(result.report.result).toBe("verified");

    // Report + hash + proof.
    expect(result.proof?.hcsTopicId).toBe("0.0.12345");
    expect(result.proof?.verified).toBe(true);
    expect(result.reportHash).toBe(sha256Hex(deterministicStringify(result.report)));

    // Deterministic serialization is stable.
    expect(deterministicStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(deterministicStringify({ a: { c: 3, d: 2 }, b: 1 }));

    // Tamper evidence: changing the report changes the hash; mock verifier catches it.
    const check = await proof.verifyReport(result.report, { reportHash: result.reportHash });
    expect(check.verified).toBe(true);
    const tampered = await proof.verifyReport({ ...result.report, findings: [] }, { reportHash: result.reportHash });
    expect(tampered.verified).toBe(false);
  });

  it("consensus-only acceptance when quorum met (multi-agent cluster)", async () => {
    const result = await makeOrchestrator().run("audit_cluster", task);
    const accepted = result.consensus.findings;
    expect(accepted.length).toBeGreaterThan(0);
    // Every accepted cluster has distinct supporting agents (quorum >= 2).
    for (const w of accepted) {
      const agents = new Set(w.evidence.map((e) => e.agentId));
      expect(agents.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("low-priority clusters without quorum become disputes, not accepted", async () => {
    // A contract with only one specialist hit (static-only) has no quorum.
    const clean = await makeOrchestrator().run("audit_clean", {
      contractName: "Clean",
      source: "contract Clean { uint256 x; }",
    });
    expect(clean.report.result).toBe("unverified");
  });
});

describe("hedera proof primitives", () => {
  it("buildAuditProofMessage produces the spec-shaped HCS message", async () => {
    const { buildAuditProofMessage } = await import("@swarmproof/hedera");
    const msg = buildAuditProofMessage({
      auditId: "audit_123",
      reportHash: "sha256abc",
      result: "verified",
      findingCount: 4,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(msg).toEqual({
      type: "swarmproof.audit",
      version: "1",
      auditId: "audit_123",
      reportHash: "sha256abc",
      result: "verified",
      findingCount: 4,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(typeof msg.reportHash).toBe("string");
    expect(msg.reportHash).toBe("sha256abc");
  });

  it("sha256 hex is 64 chars", () => {
    expect(sha256Hex("hello")).toMatch(/^[0-9a-f]{64}$/);
  });
});

void StubProvider;
void createSpecialistAgents;