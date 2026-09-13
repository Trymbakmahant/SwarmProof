import { describe, it, expect } from "vitest";
import {
  createSpecialistAgents,
  AgentAuditHarness,
  BENCHMARK_SUITES,
  evaluateAgentBenchmark,
  type SecurityTask,
} from "@swarmproof/agents";

describe("Specialist Agent Auditing & Static Analysis Harness", () => {
  const agents = createSpecialistAgents({ autoDetectEnv: false });

  describe("1. Reentrancy Specialist & Sentinel", () => {
    it("audits BenchmarkReentrancyVault and passes benchmark qualification without falling for traps", async () => {
      const suite = BENCHMARK_SUITES["reentrancy"];
      const task: SecurityTask = {
        contractName: suite.contractName,
        source: suite.contractSource,
        network: "ethereum",
      };

      const findings = await agents["reentrancy-agent"].analyze(task);
      expect(findings.length).toBeGreaterThanOrEqual(2);

      const result = evaluateAgentBenchmark("reentrancy", findings);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.truePositivesCount).toBe(2);
      expect(result.falsePositiveTrapsTriggered.length).toBe(0);

      // Verify locations and details
      const withdrawFinding = findings.find((f) => f.location.includes("withdraw"));
      expect(withdrawFinding).toBeDefined();
      expect(withdrawFinding?.category).toBe("reentrancy");

      const transferCreditFinding = findings.find((f) => f.location.includes("transferCredit"));
      expect(transferCreditFinding).toBeDefined();

      // Challenger sentinel also verifies
      const sentinelFindings = await agents["reentrancy-sentinel"].analyze(task);
      expect(sentinelFindings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("2. Access Control Specialist & Sentinel", () => {
    it("audits BenchmarkAccessControlVault and catches missing modifiers and tx.origin phishing", async () => {
      const suite = BENCHMARK_SUITES["access-control"];
      const task: SecurityTask = {
        contractName: suite.contractName,
        source: suite.contractSource,
        network: "ethereum",
      };

      const findings = await agents["access-control-agent"].analyze(task);
      expect(findings.length).toBeGreaterThanOrEqual(2);

      const result = evaluateAgentBenchmark("access-control", findings);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.truePositivesCount).toBe(2);
      expect(result.falsePositiveTrapsTriggered.length).toBe(0);

      // Challenger sentinel verification
      const sentinelFindings = await agents["access-sentinel"].analyze(task);
      expect(sentinelFindings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("3. Static Analysis Agent & Bytecode Verifier", () => {
    it("audits BenchmarkStaticAnalysis for unchecked calls and arbitrary delegatecalls", async () => {
      const suite = BENCHMARK_SUITES["static-analysis"];
      const task: SecurityTask = {
        contractName: suite.contractName,
        source: suite.contractSource,
        network: "ethereum",
      };

      const findings = await agents["static-agent"].analyze(task);
      expect(findings.length).toBeGreaterThanOrEqual(2);

      const result = evaluateAgentBenchmark("static-analysis", findings);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.truePositivesCount).toBe(2);
      expect(result.falsePositiveTrapsTriggered.length).toBe(0);

      // Bytecode verifier finds arbitrary delegatecall
      const bytecodeFindings = await agents["bytecode-verifier"].analyze(task);
      expect(bytecodeFindings.some((f) => f.category === "delegatecall")).toBe(true);
    });
  });

  describe("4. Business Logic Agent & Invariant Sentinel", () => {
    it("audits BenchmarkBusinessLogicVault for share inflation and zero-input validation", async () => {
      const suite = BENCHMARK_SUITES["business-logic"];
      const task: SecurityTask = {
        contractName: suite.contractName,
        source: suite.contractSource,
        network: "ethereum",
      };

      const findings = await agents["business-logic-agent"].analyze(task);
      expect(findings.length).toBeGreaterThanOrEqual(2);

      const result = evaluateAgentBenchmark("business-logic", findings);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.truePositivesCount).toBe(2);
      expect(result.falsePositiveTrapsTriggered.length).toBe(0);

      // Invariant challenger verifies
      const invariantFindings = await agents["invariant-agent"].analyze(task);
      expect(invariantFindings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("5. Economic Security Agent & MEV Sentinel", () => {
    it("audits BenchmarkEconomicLending for spot AMM oracle manipulation and flash loan drains", async () => {
      const suite = BENCHMARK_SUITES["economic-oracle"];
      const task: SecurityTask = {
        contractName: suite.contractName,
        source: suite.contractSource,
        network: "ethereum",
      };

      const findings = await agents["economic-agent"].analyze(task);
      expect(findings.length).toBeGreaterThanOrEqual(2);

      const result = evaluateAgentBenchmark("economic-oracle", findings);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.truePositivesCount).toBe(2);
      expect(result.falsePositiveTrapsTriggered.length).toBe(0);

      // MEV sentinel verifies
      const mevFindings = await agents["mev-sentinel"].analyze(task);
      expect(mevFindings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("6. Master Harness & Zero-False-Positive Guarantee", () => {
    it("produces zero false positive findings on clean smart contracts", async () => {
      const cleanTask: SecurityTask = {
        contractName: "Clean",
        source: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract CleanVault {
    uint256 public totalStored;

    function getStored() external view returns (uint256) {
        return totalStored;
    }
}`,
        network: "ethereum",
      };

      const harnessResults = AgentAuditHarness.analyzeAll(cleanTask);
      expect(harnessResults.all.length).toBe(0);

      for (const [agentId, agent] of Object.entries(agents)) {
        const findings = await agent.analyze(cleanTask);
        expect(findings.length, `Agent ${agentId} should produce 0 findings on clean contract`).toBe(0);
      }
    });

    it("runs AgentAuditHarness.analyzeAll to get consolidated multi-domain findings in one pass", () => {
      const complexSource = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract ComplexDefi {
    address public platformAdmin;
    mapping(address => uint256) public balances;

    function setPlatformAdmin(address newAdmin) external {
        platformAdmin = newAdmin;
    }

    function withdraw(uint256 amount) external {
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok);
        balances[msg.sender] -= amount;
    }
}`;

      const res = AgentAuditHarness.analyzeAll({
        contractName: "ComplexDefi",
        source: complexSource,
      });

      expect(res.accessControl.length).toBeGreaterThanOrEqual(1);
      expect(res.reentrancy.length).toBeGreaterThanOrEqual(1);
      expect(res.all.length).toBeGreaterThanOrEqual(2);
    });
  });
});
