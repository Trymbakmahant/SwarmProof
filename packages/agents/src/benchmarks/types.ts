import { z } from "zod";
import type { Finding } from "../index.js";

/** Certified specialist roles that an AI agent can benchmark for. */
export const BenchmarkRole = z.enum([
  "reentrancy",
  "access-control",
  "static-analysis",
  "business-logic",
  "economic-oracle",
]);
export type BenchmarkRole = z.infer<typeof BenchmarkRole>;

/** Ground-truth vulnerability defined in the benchmark suite. */
export interface GroundTruthVulnerability {
  id: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  targetFunction: string;
  requiredKeywords: string[];
  description: string;
  weight: number; // Relative weight in score calculation (default: 1)
}

/** Known safe pattern in benchmark code used to test false-positive resistance. */
export interface BenchmarkTrap {
  id: string;
  safeFunction: string;
  description: string;
  reasonWhySafe: string;
}

/** Complete benchmark suite for a specific specialist role. */
export interface BenchmarkSuite {
  role: BenchmarkRole;
  roleTitle: string;
  contractName: string;
  description: string;
  contractSource: string;
  groundTruth: GroundTruthVulnerability[];
  traps: BenchmarkTrap[];
  passingThreshold: number; // Minimum score (0 - 100) to pass (default: 80)
}

/** Detailed evaluation report after evaluating candidate findings against ground truth. */
export interface BenchmarkEvaluationResult {
  passed: boolean;
  score: number; // 0 to 100 scale
  passingThreshold: number;
  role: BenchmarkRole;
  roleTitle: string;
  contractName: string;
  evaluatedFindingsCount: number;
  truePositivesCount: number;
  falsePositivesCount: number;
  falseNegativesCount: number;
  precision: number; // 0.0 to 1.0
  recall: number; // 0.0 to 1.0
  f1Score: number; // 0.0 to 1.0
  matchedFindings: Array<{
    groundTruthId: string;
    findingId: string;
    findingTitle: string;
    categoryMatch: boolean;
    locationMatch: boolean;
    severityMatch: boolean;
  }>;
  missedVulnerabilities: Array<{
    groundTruthId: string;
    title: string;
    targetFunction: string;
    severity: string;
  }>;
  falsePositiveTrapsTriggered: Array<{
    trapId: string;
    safeFunction: string;
    findingTitle: string;
    reasonWhySafe: string;
  }>;
  feedback: string;
  evaluatedAt: string;
}
