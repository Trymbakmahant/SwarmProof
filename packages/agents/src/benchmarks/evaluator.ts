import type { Finding } from "../index.js";
import type {
  BenchmarkRole,
  BenchmarkSuite,
  BenchmarkEvaluationResult,
  GroundTruthVulnerability,
  BenchmarkTrap,
} from "./types.js";
import { BENCHMARK_SUITES } from "./suites.js";

/** Category compatibility mapping for fuzzy matching specialist terms. */
const CATEGORY_ALIASES: Record<string, string[]> = {
  reentrancy: ["reentrancy", "cei-violation", "reentrancy-detection", "state-update"],
  "access-control": ["access-control", "authorization", "privilege-escalation", "tx-origin", "ownable"],
  "static-analysis": ["static-analysis", "unchecked-call", "unchecked-arithmetic", "low-level-call", "delegatecall"],
  delegatecall: ["delegatecall", "low-level-call", "arbitrary-call", "static-analysis"],
  "business-logic": ["business-logic", "accounting", "invariant", "inflation", "rounding", "share-price"],
  "input-validation": ["input-validation", "business-logic", "zero-check", "boundary"],
  "oracle-manipulation": ["oracle-manipulation", "economic", "spot-price", "amm-reserves", "twap"],
  "flash-loan": ["flash-loan", "economic", "liquidation", "arbitrage", "oracle-manipulation"],
};

function normalizeText(text: string): string {
  return (text || "").toLowerCase().replace(/[-_]/g, " ");
}

function doesCategoryMatch(expectedCategory: string, candidateCategory: string): boolean {
  const normExpected = normalizeText(expectedCategory);
  const normCandidate = normalizeText(candidateCategory);

  if (normExpected === normCandidate) return true;

  const aliases = CATEGORY_ALIASES[expectedCategory] || [];
  return aliases.some((alias) => normalizeText(alias) === normCandidate || normCandidate.includes(normalizeText(alias)));
}

function doesLocationMatch(targetFunction: string, finding: Finding): boolean {
  const normTarget = normalizeText(targetFunction);
  const normLocation = normalizeText(finding.location);
  const normTitle = normalizeText(finding.title);
  const normEvidence = normalizeText((finding.evidence || []).join(" "));

  return (
    normLocation.includes(normTarget) ||
    normTitle.includes(normTarget) ||
    normEvidence.includes(normTarget)
  );
}

function doesSemanticMatch(gt: GroundTruthVulnerability, finding: Finding): boolean {
  const allText = normalizeText(
    `${finding.title} ${finding.category} ${finding.location} ${(finding.evidence || []).join(" ")}`
  );

  return gt.requiredKeywords.some((kw: string) => allText.includes(normalizeText(kw)));
}

/**
 * Evaluates candidate findings from an AI agent against the official benchmark suite for a role.
 */
export function evaluateAgentBenchmark(
  role: BenchmarkRole,
  findings: Finding[],
  customSuite?: BenchmarkSuite
): BenchmarkEvaluationResult {
  const suite = customSuite ?? BENCHMARK_SUITES[role as keyof typeof BENCHMARK_SUITES];
  if (!suite) {
    throw new Error(`Unknown benchmark role: ${role}`);
  }

  const matchedFindings: BenchmarkEvaluationResult["matchedFindings"] = [];
  const matchedGtIds = new Set<string>();
  const usedFindingIds = new Set<string>();

  // 1. Evaluate True Positives against Ground Truth
  for (const gt of suite.groundTruth) {
    for (const finding of findings) {
      if (usedFindingIds.has(finding.id)) continue;

      const locMatch = doesLocationMatch(gt.targetFunction, finding);
      const catMatch = doesCategoryMatch(gt.category, finding.category);
      const semMatch = doesSemanticMatch(gt, finding);

      // Match condition: targeted correct function AND (category matches OR relevant keywords present)
      if (locMatch && (catMatch || semMatch)) {
        matchedGtIds.add(gt.id);
        usedFindingIds.add(finding.id);

        matchedFindings.push({
          groundTruthId: gt.id,
          findingId: finding.id,
          findingTitle: finding.title,
          categoryMatch: catMatch,
          locationMatch: locMatch,
          severityMatch: finding.severity === gt.severity,
        });
        break; // Match 1 finding per ground truth item
      }
    }
  }

  // 2. Evaluate Traps (Known safe patterns flagged as false positives)
  const falsePositiveTrapsTriggered: BenchmarkEvaluationResult["falsePositiveTrapsTriggered"] = [];
  for (const trap of suite.traps) {
    for (const finding of findings) {
      if (doesLocationMatch(trap.safeFunction, finding)) {
        falsePositiveTrapsTriggered.push({
          trapId: trap.id,
          safeFunction: trap.safeFunction,
          findingTitle: finding.title,
          reasonWhySafe: trap.reasonWhySafe,
        });
      }
    }
  }

  // 3. Compute Missed Vulnerabilities (False Negatives)
  const missedVulnerabilities = suite.groundTruth
    .filter((gt: GroundTruthVulnerability) => !matchedGtIds.has(gt.id))
    .map((gt: GroundTruthVulnerability) => ({
      groundTruthId: gt.id,
      title: gt.title,
      targetFunction: gt.targetFunction,
      severity: gt.severity,
    }));

  // 4. Calculate Precision, Recall, and F1 Score
  const truePositivesCount = matchedGtIds.size;
  const falseNegativesCount = missedVulnerabilities.length;
  // False positives = findings that matched neither ground truth + any traps triggered
  const unmatchedFindingsCount = Math.max(0, findings.length - usedFindingIds.size);
  const falsePositivesCount = unmatchedFindingsCount + falsePositiveTrapsTriggered.length;

  const precision =
    truePositivesCount + falsePositivesCount > 0
      ? truePositivesCount / (truePositivesCount + falsePositivesCount)
      : 0;

  const recall =
    truePositivesCount + falseNegativesCount > 0
      ? truePositivesCount / (truePositivesCount + falseNegativesCount)
      : 0;

  const f1Score =
    precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // Scale score to 0 - 100
  let score = Math.round(f1Score * 100);
  if (truePositivesCount === suite.groundTruth.length && falsePositivesCount === 0) {
    score = 100;
  }

  const passed = score >= suite.passingThreshold && falsePositiveTrapsTriggered.length === 0;

  // Feedback generator
  let feedback = "";
  if (passed) {
    feedback = `Passed with distinction: Identified ${truePositivesCount}/${suite.groundTruth.length} core vulnerabilities with 0 false-positive trap violations. Score: ${score}/100.`;
  } else if (falsePositiveTrapsTriggered.length > 0) {
    feedback = `Qualification failed due to false-positive trap violations: Agent falsely flagged safe pattern(s): ${falsePositiveTrapsTriggered.map((t: { safeFunction: string }) => t.safeFunction).join(", ")}. Score: ${score}/100.`;
  } else {
    feedback = `Qualification failed: Score ${score}/100 is below the ${suite.passingThreshold}/100 passing threshold. Missed: ${missedVulnerabilities.map((m: { title: string }) => m.title).join("; ")}.`;
  }

  return {
    passed,
    score,
    passingThreshold: suite.passingThreshold,
    role: suite.role,
    roleTitle: suite.roleTitle,
    contractName: suite.contractName,
    evaluatedFindingsCount: findings.length,
    truePositivesCount,
    falsePositivesCount,
    falseNegativesCount,
    precision: parseFloat(precision.toFixed(3)),
    recall: parseFloat(recall.toFixed(3)),
    f1Score: parseFloat(f1Score.toFixed(3)),
    matchedFindings,
    missedVulnerabilities,
    falsePositiveTrapsTriggered,
    feedback,
    evaluatedAt: new Date().toISOString(),
  };
}
