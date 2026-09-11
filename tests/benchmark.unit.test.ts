import { describe, it, expect } from "vitest";
import {
  BENCHMARK_SUITES,
  evaluateAgentBenchmark,
  type Finding,
  type BenchmarkRole,
} from "@swarmproof/agents";

describe("Benchmark Suite for Specialist Roles (A.1)", () => {
  const roles: BenchmarkRole[] = [
    "reentrancy",
    "access-control",
    "static-analysis",
    "business-logic",
    "economic-oracle",
  ];

  it("registers all 5 specialist benchmark suites with valid Solidity source and ground truth", () => {
    for (const role of roles) {
      const suite = BENCHMARK_SUITES[role];
      expect(suite).toBeDefined();
      expect(suite.role).toBe(role);
      expect(suite.roleTitle.length).toBeGreaterThan(0);
      expect(suite.contractName.length).toBeGreaterThan(0);
      expect(suite.contractSource).toContain("pragma solidity");
      expect(suite.groundTruth.length).toBeGreaterThanOrEqual(2);
      expect(suite.traps.length).toBeGreaterThanOrEqual(1);
      expect(suite.passingThreshold).toBe(80);
    }
  });

  describe("Reentrancy & CEI Specialist Benchmark", () => {
    it("awards 100/100 and passes when all ground-truth vulnerabilities are accurately identified", () => {
      const candidateFindings: Finding[] = [
        {
          id: "f1",
          title: "Critical CEI violation in withdraw function allows recursive call",
          category: "reentrancy",
          severity: "critical",
          location: "withdraw",
          evidence: ["msg.sender.call{value: amount}(\"\") before balances[msg.sender] -= amount"],
          status: "proposed",
        },
        {
          id: "f2",
          title: "Cross-function reentrancy in transferCredit hook",
          category: "reentrancy",
          severity: "high",
          location: "transferCredit",
          evidence: ["to.call external hook triggers reentrancy"],
          status: "proposed",
        },
      ];

      const result = evaluateAgentBenchmark("reentrancy", candidateFindings);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.truePositivesCount).toBe(2);
      expect(result.falsePositivesCount).toBe(0);
      expect(result.falseNegativesCount).toBe(0);
      expect(result.precision).toBe(1.0);
      expect(result.recall).toBe(1.0);
      expect(result.falsePositiveTrapsTriggered.length).toBe(0);
      expect(result.feedback).toContain("Passed with distinction");
    });

    it("fails when agent misses a ground-truth vulnerability", () => {
      const candidateFindings: Finding[] = [
        {
          id: "f1",
          title: "Reentrancy state update flaw",
          category: "reentrancy",
          severity: "critical",
          location: "withdraw",
          evidence: ["CEI violation in withdraw()"],
          status: "proposed",
        },
      ];

      const result = evaluateAgentBenchmark("reentrancy", candidateFindings);
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(80);
      expect(result.truePositivesCount).toBe(1);
      expect(result.falseNegativesCount).toBe(1);
      expect(result.missedVulnerabilities.length).toBe(1);
      expect(result.missedVulnerabilities[0].targetFunction).toBe("transferCredit");
      expect(result.feedback).toContain("Qualification failed");
    });

    it("fails immediately when agent falls into the false-positive safe trap", () => {
      const candidateFindings: Finding[] = [
        {
          id: "f1",
          title: "Reentrancy in withdraw",
          category: "reentrancy",
          severity: "critical",
          location: "withdraw",
          evidence: ["External call before state update"],
          status: "proposed",
        },
        {
          id: "f2",
          title: "Cross-function reentrancy in transferCredit",
          category: "reentrancy",
          severity: "high",
          location: "transferCredit",
          evidence: ["External hook"],
          status: "proposed",
        },
        // Hallucinated trap finding on a safe function!
        {
          id: "f3_trap",
          title: "Reentrancy detected in safeWithdrawWithMutex",
          category: "reentrancy",
          severity: "medium",
          location: "safeWithdrawWithMutex",
          evidence: ["Has an external call"],
          status: "proposed",
        },
      ];

      const result = evaluateAgentBenchmark("reentrancy", candidateFindings);
      expect(result.passed).toBe(false);
      expect(result.falsePositiveTrapsTriggered.length).toBe(1);
      expect(result.falsePositiveTrapsTriggered[0].safeFunction).toBe("safeWithdrawWithMutex");
      expect(result.feedback).toContain("Qualification failed due to false-positive trap violations");
    });
  });

  describe("Access Control Benchmark", () => {
    it("successfully matches missing access control on setPlatformAdmin and tx.origin in emergencyDrain", () => {
      const candidateFindings: Finding[] = [
        {
          id: "ac1",
          title: "Missing authorization modifier on setPlatformAdmin",
          category: "access-control",
          severity: "critical",
          location: "setPlatformAdmin",
          evidence: ["No onlyOwner modifier found"],
          status: "proposed",
        },
        {
          id: "ac2",
          title: "Dangerous use of tx.origin for authentication in emergencyDrain",
          category: "access-control",
          severity: "high",
          location: "emergencyDrain",
          evidence: ["tx.origin == owner allows phishing attack"],
          status: "proposed",
        },
      ];

      const result = evaluateAgentBenchmark("access-control", candidateFindings);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.truePositivesCount).toBe(2);
    });

    it("detects false positive when transferOwnership is falsely flagged", () => {
      const candidateFindings: Finding[] = [
        {
          id: "ac1",
          title: "Missing authorization on setPlatformAdmin",
          category: "access-control",
          severity: "critical",
          location: "setPlatformAdmin",
          evidence: ["No modifier"],
          status: "proposed",
        },
        {
          id: "ac2",
          title: "tx.origin in emergencyDrain",
          category: "access-control",
          severity: "high",
          location: "emergencyDrain",
          evidence: ["tx.origin"],
          status: "proposed",
        },
        {
          id: "ac3",
          title: "Ownership takeover in transferOwnership",
          category: "access-control",
          severity: "high",
          location: "transferOwnership",
          evidence: ["transfers owner"],
          status: "proposed",
        },
      ];

      const result = evaluateAgentBenchmark("access-control", candidateFindings);
      expect(result.passed).toBe(false);
      expect(result.falsePositiveTrapsTriggered.length).toBe(1);
      expect(result.falsePositiveTrapsTriggered[0].safeFunction).toBe("transferOwnership");
    });
  });

  describe("Static Analysis & Low-Level Calls Benchmark", () => {
    it("detects unchecked call in batchPayout and arbitrary delegatecall in forwardExecution", () => {
      const candidateFindings: Finding[] = [
        {
          id: "sa1",
          title: "Unchecked return value of low-level call in batchPayout",
          category: "unchecked-call",
          severity: "high",
          location: "batchPayout",
          evidence: ["recipients[i].call{value: amount}(\"\") unchecked"],
          status: "proposed",
        },
        {
          id: "sa2",
          title: "Arbitrary delegatecall execution in forwardExecution",
          category: "delegatecall",
          severity: "critical",
          location: "forwardExecution",
          evidence: ["target.delegatecall(data) executes arbitrary bytecode"],
          status: "proposed",
        },
      ];

      const result = evaluateAgentBenchmark("static-analysis", candidateFindings);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.truePositivesCount).toBe(2);
    });
  });

  describe("Business Logic & State Invariant Benchmark", () => {
    it("identifies first-depositor share price inflation and zero-amount input flaw", () => {
      const candidateFindings: Finding[] = [
        {
          id: "bl1",
          title: "First depositor share inflation and rounding to zero in deposit",
          category: "business-logic",
          severity: "critical",
          location: "deposit",
          evidence: ["shares = (assets * totalShares) / totalAssets without virtual offset"],
          status: "proposed",
        },
        {
          id: "bl2",
          title: "Missing input boundary validation for zero amount in recordActivity",
          category: "input-validation",
          severity: "medium",
          location: "recordActivity",
          evidence: ["Allows 0 value parameter"],
          status: "proposed",
        },
      ];

      const result = evaluateAgentBenchmark("business-logic", candidateFindings);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.truePositivesCount).toBe(2);
    });
  });

  describe("Economic Security & Oracle Manipulation Benchmark", () => {
    it("identifies spot AMM price manipulation and flash loan borrow vector", () => {
      const candidateFindings: Finding[] = [
        {
          id: "eo1",
          title: "Spot price oracle manipulation via AMM reserves in getCollateralPrice",
          category: "oracle-manipulation",
          severity: "critical",
          location: "getCollateralPrice",
          evidence: ["Reading reserves directly without TWAP observation"],
          status: "proposed",
        },
        {
          id: "eo2",
          title: "Flash loan borrow drain vector in borrow()",
          category: "flash-loan",
          severity: "high",
          location: "borrow",
          evidence: ["Borrow relies on manipulated spot price"],
          status: "proposed",
        },
      ];

      const result = evaluateAgentBenchmark("economic-oracle", candidateFindings);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.truePositivesCount).toBe(2);
    });
  });

  it("handles unknown benchmark role gracefully with an informative error", () => {
    expect(() => evaluateAgentBenchmark("non-existent-role" as BenchmarkRole, [])).toThrow(
      "Unknown benchmark role: non-existent-role"
    );
  });
});
