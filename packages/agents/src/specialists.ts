import type { AgentIdentity, SecurityTask } from "./identity.js";
import type { Finding, Severity } from "./index.js";
import { createLLMProviderFromEnv, parseLLMFindings, type LLMProvider } from "./llm.js";
import {
  parseSoliditySource,
  runReentrancyHarness,
  runAccessControlHarness,
  runStaticAnalysisHarness,
  runBusinessLogicHarness,
  runEconomicHarness,
} from "./harness.js";

/**
 * Specialist security agents.
 *
 * Every specialist is a stateless, independently-executable detector:
 *   analyze(task) -> Finding[]
 *
 * MVP implementation is deterministic (pattern/semantic heuristics) so the
 * whole flow runs offline and is fully unit-testable. A specialist may later
 * consult an LLM or external tools — the interface stays the same.
 *
 * Agents MUST NOT know about payments or Hedera. The only payment concern is
 * `identity.paymentAddress`, read by the gateway.
 */
export interface SecurityAgent {
  identity: AgentIdentity;
  /** Independent analysis. Must be safe to run in parallel (no shared state). */
  analyze(task: SecurityTask): Promise<Finding[]>;
}

export const CORE_SPECIALIST_IDS = [
  "reentrancy-agent",
  "access-control-agent",
  "business-logic-agent",
  "economic-agent",
  "static-agent",
] as const;

export const DUAL_SPECIALIST_IDS = [
  ...CORE_SPECIALIST_IDS,
  "reentrancy-sentinel",
  "access-sentinel",
  "invariant-agent",
  "mev-sentinel",
  "bytecode-verifier",
] as const;

export const SPECIALIST_IDS = DUAL_SPECIALIST_IDS;
export type SpecialistId = (typeof SPECIALIST_IDS)[number];

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const DEFAULT_SEVERITY: Severity = "medium";

function makeFinding(
  agentId: string,
  seq: number,
  category: string,
  severity: Severity,
  location: string,
  detail: string,
): Finding {
  return {
    id: `${agentId}-${category}-${seq}`,
    title: `${category.replace(/-/g, " ")} (${agentId})`,
    category,
    severity,
    location,
    evidence: [detail],
    status: "proposed",
  };
}

/** External value-transfer call sites (reentrancy-relevant). */
function valueTransferCalls(src: string): Array<{ pattern: string; loc: string }> {
  const out: Array<{ pattern: string; loc: string }> = [];
  const re = /(\.call\{value:[^}]*\}|\.transfer\(|\.send\()/g;
  for (const m of src.matchAll(re)) {
    const before = src.slice(0, m.index).split("\n");
    const line = before.length;
    const near = src.slice(Math.max(0, (m.index ?? 0) - 120), (m.index ?? 0) + 20);
    out.push({ pattern: m[0] ?? "", loc: `line ${line}` + (/\bfunction\b/.test(near) ? "" : "") });
  }
  return out;
}

function hasNonReentrantGuard(src: string): boolean {
  return /nonReentrant|reentrancyGuard|lock\s*=|_locked|mutex|onlyOwner/i.test(src);
}

/** Split source into top-level function bodies for scoped heuristics. */
function functionBodies(src: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  const re = /function\s+([A-Za-z0-9_]+)\s*\([^)]*\)[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      if (src[i] === "}") depth--;
      i++;
    }
    if (depth === 0) out.push({ name: m[1] ?? "", body: src.slice(start, i - 1) });
  }
  return out;
}

/** Detect a state write (mapping/slot assignment) inside a body. */
const STATE_WRITE = /(\w+(\[\s*\w+\s*\])?)\s*[\+\-]?=\s|(?:require|assert)/;
const ETH_TRANSFER_OUT =
  /\b(?:transfer|send|call\{value[^}]*\})\(|withdraw\s*\(|claim\w*\s*\(|payout\s*\(/i;

/* ------------------------------------------------------------------ */
/* 1. Reentrancy agent                                                 */
/* ------------------------------------------------------------------ */

async function analyzeReentrancy(task: SecurityTask): Promise<Finding[]> {
  const parsed = parseSoliditySource(task.source);
  return runReentrancyHarness(task, parsed);
}

/* ------------------------------------------------------------------ */
/* 2. Access control agent                                             */
/* ------------------------------------------------------------------ */

async function analyzeAccessControl(task: SecurityTask): Promise<Finding[]> {
  const parsed = parseSoliditySource(task.source);
  return runAccessControlHarness(task, parsed);
}

/* ------------------------------------------------------------------ */
/* 3. Business logic agent                                             */
/* ------------------------------------------------------------------ */

async function analyzeBusinessLogic(task: SecurityTask): Promise<Finding[]> {
  const parsed = parseSoliditySource(task.source);
  return runBusinessLogicHarness(task, parsed);
}

/* ------------------------------------------------------------------ */
/* 4. Economic security agent                                          */
/* ------------------------------------------------------------------ */

async function analyzeEconomic(task: SecurityTask): Promise<Finding[]> {
  const parsed = parseSoliditySource(task.source);
  return runEconomicHarness(task, parsed);
}

/* ------------------------------------------------------------------ */
/* 5. Static analysis agent                                            */
/* ------------------------------------------------------------------ */

async function analyzeStatic(task: SecurityTask): Promise<Finding[]> {
  const parsed = parseSoliditySource(task.source);
  const findings = runStaticAnalysisHarness(task, parsed);
  // Cross-signal: like Slither, static agent also flags classic call-before-write reentrancy
  // so consensus forms a strong multi-agent quorum on severe vulnerabilities.
  const reentrancy = runReentrancyHarness(task, parsed);
  const firstReentrancy = reentrancy[0];
  if (firstReentrancy && !findings.some((f) => f.category === "reentrancy")) {
    findings.push({
      ...firstReentrancy,
      id: `static-agent-reentrancy-${findings.length}`,
      title: `Static Cross-Signal: ${firstReentrancy.title.replace(/\s*\([^)]*\)$/, "")} (static-agent)`,
    });
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* 6. Challenger Specialists (Dual Swarm Agents)                       */
/* ------------------------------------------------------------------ */

async function analyzeReentrancySentinel(task: SecurityTask): Promise<Finding[]> {
  const parsed = parseSoliditySource(task.source);
  const findings = runReentrancyHarness(task, parsed);
  return findings.map((f, i) => ({
    ...f,
    id: `reentrancy-sentinel-reentrancy-${i}`,
    title: `Reentrancy Sentinel: ${f.title.replace(/\s*\([^)]*\)$/, "")} (reentrancy-sentinel)`,
  }));
}

async function analyzeAccessSentinel(task: SecurityTask): Promise<Finding[]> {
  const parsed = parseSoliditySource(task.source);
  const findings = runAccessControlHarness(task, parsed);
  return findings.map((f, i) => ({
    ...f,
    id: `access-sentinel-access-control-${i}`,
    title: `Access Sentinel: ${f.title.replace(/\s*\([^)]*\)$/, "")} (access-sentinel)`,
  }));
}

async function analyzeInvariant(task: SecurityTask): Promise<Finding[]> {
  const parsed = parseSoliditySource(task.source);
  const findings = runBusinessLogicHarness(task, parsed);
  return findings.map((f, i) => ({
    ...f,
    id: `invariant-agent-business-logic-${i}`,
    title: `Invariant Agent: ${f.title.replace(/\s*\([^)]*\)$/, "")} (invariant-agent)`,
  }));
}

async function analyzeMevSentinel(task: SecurityTask): Promise<Finding[]> {
  const parsed = parseSoliditySource(task.source);
  const findings = runEconomicHarness(task, parsed);
  return findings.map((f, i) => ({
    ...f,
    id: `mev-sentinel-economic-${i}`,
    title: `MEV Sentinel: ${f.title.replace(/\s*\([^)]*\)$/, "")} (mev-sentinel)`,
  }));
}

async function analyzeBytecodeVerifier(task: SecurityTask): Promise<Finding[]> {
  const parsed = parseSoliditySource(task.source);
  const findings = runStaticAnalysisHarness(task, parsed);
  return findings.map((f, i) => ({
    ...f,
    id: `bytecode-verifier-static-${i}`,
    title: `Bytecode Verifier: ${f.title.replace(/\s*\([^)]*\)$/, "")} (bytecode-verifier)`,
  }));
}

/* ------------------------------------------------------------------ */
/* LLM Specialist Prompts                                             */
/* ------------------------------------------------------------------ */

export const SPECIALIST_SYSTEM_PROMPTS: Record<SpecialistId, string> = {
  "reentrancy-agent": `You are the Reentrancy Specialist Agent in SwarmProof, an adversarial multi-agent smart contract security swarm.
Your SOLE responsibility is detecting reentrancy vulnerabilities in Solidity contracts:
- Checks-Effects-Interactions (CEI) pattern violations (external value calls or token transfers before internal state updates).
- Missing nonReentrant modifiers or mutex locks on external/public state-modifying functions.
- Cross-function reentrancy (re-entering a different function sharing state before completion).
- Read-only reentrancy (external view function queried by third-party protocol while state is mid-transition).
- ERC-777 / ERC-721 / ERC-1155 token recipient callbacks (tokensReceived, onERC721Received).

IMPORTANT: Return ONLY a valid JSON object with the following schema, and no other text:
{
  "findings": [
    {
      "title": "Short descriptive title",
      "category": "reentrancy",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "location": "line X or functionName()",
      "evidence": ["Exact code snippet or line reference", "Why this constitutes a reentrancy path"],
      "reasoning": "Step-by-step exploit scenario explaining how an attacker could drain or corrupt funds"
    }
  ]
}
If no reentrancy vulnerabilities are detected, return {"findings": []}.`,

  "reentrancy-sentinel": `You are the Reentrancy Sentinel (Challenger Agent) in SwarmProof, an adversarial multi-agent security swarm.
Your SOLE responsibility is deep cross-contract callback validation, ERC recipient hooks (ERC-777, ERC-721, ERC-1155), and transient state reentrancy.
Confirm or contest potential reentrancy attack vectors. Verify if functions are protected by mutexes or nonReentrant modifiers.

IMPORTANT: Return ONLY a valid JSON object with the following schema, and no other text:
{
  "findings": [
    {
      "title": "Short descriptive title",
      "category": "reentrancy",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "location": "line X or functionName()",
      "evidence": ["Exact code snippet or hook invocation", "Callback analysis"],
      "reasoning": "Step-by-step cross-contract reentrancy exploit scenario"
    }
  ]
}
If no reentrancy vulnerabilities are detected, return {"findings": []}.`,

  "access-control-agent": `You are the Access Control Specialist Agent in SwarmProof, an adversarial multi-agent smart contract security swarm.
Your SOLE responsibility is detecting authorization and privilege vulnerabilities in Solidity contracts:
- Missing onlyOwner, onlyRole, or custom authorization modifiers on critical/sensitive state-changing functions.
- Dangerous use of tx.origin for authentication instead of msg.sender (phishing vector).
- Uninitialized contracts or unshielded initializer functions in upgradeable proxies.
- Default public or external visibility on administrative or internal functions.
- Arbitrary parameter manipulation leading to privilege escalation or unauthorized state change.

IMPORTANT: Return ONLY a valid JSON object with the following schema, and no other text:
{
  "findings": [
    {
      "title": "Short descriptive title",
      "category": "access-control",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "location": "line X or functionName()",
      "evidence": ["Exact code snippet or line reference", "Why authorization fails here"],
      "reasoning": "Exploit scenario explaining how an unauthorized caller can invoke or abuse this function"
    }
  ]
}
If no access control vulnerabilities are detected, return {"findings": []}.`,

  "access-sentinel": `You are the Access Sentinel (Challenger Agent) in SwarmProof, an adversarial multi-agent security swarm.
Your SOLE responsibility is detecting privilege escalation vectors, proxy implementation slots, and authentication bypasses (such as tx.origin usage or missing authorization modifiers).

IMPORTANT: Return ONLY a valid JSON object with the following schema, and no other text:
{
  "findings": [
    {
      "title": "Short descriptive title",
      "category": "access-control",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "location": "line X or functionName()",
      "evidence": ["Exact code snippet", "Why privilege bypass is possible"],
      "reasoning": "Step-by-step privilege escalation exploit scenario"
    }
  ]
}
If no access control vulnerabilities are detected, return {"findings": []}.`,

  "business-logic-agent": `You are the Business Logic Specialist Agent in SwarmProof, an adversarial multi-agent smart contract security swarm.
Your SOLE responsibility is detecting contract-specific accounting and business logic flaws in Solidity:
- State machine inconsistency (invalid status transitions, double spending, skipping lifecycle steps).
- Missing or weak input validation (zero-address checks, zero-amount checks, unbounded arrays).
- Arithmetic precision loss (division before multiplication, truncation causing lost funds).
- Accounting mismatches between internal balances and actual contract asset holdings.
- Inconsistent fee calculations, improper rounding favors, or token transfer discrepancy.

IMPORTANT: Return ONLY a valid JSON object with the following schema, and no other text:
{
  "findings": [
    {
      "title": "Short descriptive title",
      "category": "business-logic",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "location": "line X or functionName()",
      "evidence": ["Exact code snippet or line reference", "Detailed explanation of the logic flaw"],
      "reasoning": "Walkthrough of how the state or accounting is corrupted under edge cases"
    }
  ]
}
If no business logic vulnerabilities are detected, return {"findings": []}.`,

  "invariant-agent": `You are the Invariant Challenger Agent in SwarmProof, an adversarial multi-agent security swarm.
Your SOLE responsibility is auditing strict accounting equality, precision preservation, and balance tracking invariants.
Check for division before multiplication, rounding-to-zero in share math (e.g. ERC-4626 first-depositor inflation), and missing boundary validations.

IMPORTANT: Return ONLY a valid JSON object with the following schema, and no other text:
{
  "findings": [
    {
      "title": "Short descriptive title",
      "category": "business-logic" | "input-validation",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "location": "line X or functionName()",
      "evidence": ["Exact code snippet", "Mathematical or invariant violation"],
      "reasoning": "Detailed explanation of accounting drift, inflation attack, or precision truncation"
    }
  ]
}
If no invariant vulnerabilities are detected, return {"findings": []}.`,

  "economic-agent": `You are the Economic Security Specialist Agent in SwarmProof, an adversarial multi-agent smart contract security swarm.
Your SOLE responsibility is detecting economic, market, and financial attack vectors in Solidity:
- Spot price oracle manipulation (using reserves or spot prices from AMMs without TWAP or decentralized oracles like Chainlink).
- Flash loan vulnerability (borrowing large capital in one transaction to skew pools or bypass collateral thresholds).
- MEV exposure, frontrunning/sandwich attack vulnerability due to missing or zero slippage protection.
- Reward distribution inflation, yield calculation exploits, or unfair staking reward dilution.
- Block timestamp or block number manipulation for financial randomness or payout timing.

IMPORTANT: Return ONLY a valid JSON object with the following schema, and no other text:
{
  "findings": [
    {
      "title": "Short descriptive title",
      "category": "economic",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "location": "line X or functionName()",
      "evidence": ["Exact code snippet or line reference", "Financial mechanism that can be exploited"],
      "reasoning": "Economic exploit scenario including flash loans, pool skewing, or sandwiching"
    }
  ]
}
If no economic vulnerabilities are detected, return {"findings": []}.`,

  "mev-sentinel": `You are the MEV & Flash Loan Sentinel in SwarmProof, an adversarial multi-agent security swarm.
Your SOLE responsibility is detecting atomic arbitrage, sandwich vulnerabilities, liquidity pool manipulation, and spot price oracle frontrunning.
Focus on missing slippage bounds, instantaneous getReserves() reads, and single-block insolvency vectors.

IMPORTANT: Return ONLY a valid JSON object with the following schema, and no other text:
{
  "findings": [
    {
      "title": "Short descriptive title",
      "category": "economic" | "oracle-manipulation" | "flash-loan",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "location": "line X or functionName()",
      "evidence": ["Exact code snippet", "MEV / oracle risk mechanism"],
      "reasoning": "Step-by-step flash loan or sandwich exploit scenario"
    }
  ]
}
If no MEV/economic vulnerabilities are detected, return {"findings": []}.`,

  "static-agent": `You are the Static Analysis Specialist Agent in SwarmProof, an adversarial multi-agent smart contract security swarm.
Your SOLE responsibility is detecting code safety, low-level call hazards, and compiler-level issues in Solidity:
- Unchecked return values of low-level calls (.call(), .delegatecall(), .staticcall()).
- Dangerous delegatecall to untrusted or user-supplied target addresses.
- Use of deprecated or unsafe constructs (selfdestruct, block.difficulty, inline assembly without memory guards).
- Unchecked arithmetic blocks where overflow/underflow is possible and dangerous.
- Cross-signal validation of high-risk external interactions and call-before-write patterns.

IMPORTANT: Return ONLY a valid JSON object with the following schema, and no other text:
{
  "findings": [
    {
      "title": "Short descriptive title",
      "category": "reentrancy" | "delegatecall" | "unchecked-call" | "arithmetic" | "static-analysis",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "location": "line X or functionName()",
      "evidence": ["Exact code snippet or line reference", "Safety hazard or unchecked return value"],
      "reasoning": "Technical explanation of how the EVM state can be compromised"
    }
  ]
}
If no code safety/static analysis vulnerabilities are detected, return {"findings": []}.`,

  "bytecode-verifier": `You are the Bytecode & Opcode Verifier in SwarmProof, an adversarial multi-agent security swarm.
Your SOLE responsibility is detecting low-level assembly safety hazards, arbitrary delegatecall patterns, dirty memory, and unchecked call return values.

IMPORTANT: Return ONLY a valid JSON object with the following schema, and no other text:
{
  "findings": [
    {
      "title": "Short descriptive title",
      "category": "delegatecall" | "static-analysis" | "unchecked-call",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "location": "line X or functionName()",
      "evidence": ["Exact code snippet", "Low-level hazard explanation"],
      "reasoning": "EVM bytecode execution trace explaining storage corruption or execution hijack"
    }
  ]
}
If no bytecode/static vulnerabilities are detected, return {"findings": []}.`,
};

/* ------------------------------------------------------------------ */
/* Registry & Factory                                                 */
/* ------------------------------------------------------------------ */

import {
  SPECIALIST_KEYPAIRS,
  SPECIALIST_PAYMENT_ADDRESSES,
  SPECIALIST_EVM_ADDRESSES,
  getSpecialistKeypair,
  type SpecialistKeypair,
} from "./agentKeypairs.js";
export {
  SPECIALIST_KEYPAIRS,
  SPECIALIST_PAYMENT_ADDRESSES,
  SPECIALIST_EVM_ADDRESSES,
  getSpecialistKeypair,
  type SpecialistKeypair,
};

export interface SpecialistFactoryOptions {
  /** Payout addresses per specialist (Hedera account IDs or EVM addresses). */
  addresses?: Record<SpecialistId, string>;
  /** Global LLM provider, or per-agent LLM provider mapping. */
  llmProvider?: LLMProvider | Partial<Record<SpecialistId, LLMProvider>>;
  /** Set to false to prevent auto-detecting an LLM provider from environment variables. */
  autoDetectEnv?: boolean;
}

function resolveProvider(
  agentId: SpecialistId,
  providerOption?: LLMProvider | Partial<Record<SpecialistId, LLMProvider>>,
): LLMProvider | undefined {
  if (!providerOption) return undefined;
  if ("complete" in providerOption && typeof (providerOption as LLMProvider).complete === "function") {
    return providerOption as LLMProvider;
  }
  return (providerOption as Partial<Record<SpecialistId, LLMProvider>>)[agentId];
}

/**
 * Build specialists with identities and analysis runners.
 * Supports dual specialists (at least 2 agents per specialty).
 *
 * When an LLM provider is available (either passed in or detected via ANTHROPIC_API_KEY,
 * OPENAI_API_KEY, or OLLAMA_BASE_URL), the specialist uses real LLM analysis.
 * If no LLM provider is configured, or if an LLM call fails, it cleanly falls back
 * to deterministic AST/regex heuristics so offline tests and CI stay 100% green.
 */
export function createSpecialistAgents(
  optsOrAddresses?: Record<string, string> | SpecialistFactoryOptions,
): Record<SpecialistId, SecurityAgent> {
  let addresses: Record<SpecialistId, string> = SPECIALIST_PAYMENT_ADDRESSES;
  let providerOpt: LLMProvider | Partial<Record<SpecialistId, LLMProvider>> | undefined = undefined;

  if (optsOrAddresses) {
    if (typeof (optsOrAddresses as Record<string, string>)["reentrancy-agent"] === "string") {
      addresses = { ...SPECIALIST_PAYMENT_ADDRESSES, ...(optsOrAddresses as Record<string, string>) };
      providerOpt = createLLMProviderFromEnv();
    } else {
      const opts = optsOrAddresses as SpecialistFactoryOptions;
      if (opts.addresses) {
        addresses = { ...SPECIALIST_PAYMENT_ADDRESSES, ...opts.addresses };
      }
      providerOpt = opts.llmProvider ?? (opts.autoDetectEnv !== false ? createLLMProviderFromEnv() : undefined);
    }
  } else {
    providerOpt = createLLMProviderFromEnv();
  }

  const id = (agentId: SpecialistId, name: string, capabilities: string[]): AgentIdentity => {
    const p = resolveProvider(agentId, providerOpt);
    const kp = SPECIALIST_KEYPAIRS[agentId];
    return {
      agentId,
      name: p ? `${name} [${p.name}]` : name,
      capabilities,
      paymentAddress: addresses[agentId] || kp.hederaAccountId,
      publicKey: kp.publicKey,
      hederaAccountId: kp.hederaAccountId,
      evmAddress: kp.evmAddress,
      version: "1.0.0",
    };
  };

  const wrapAnalysis = (
    agentId: SpecialistId,
    heuristicFn: (task: SecurityTask) => Promise<Finding[]>,
  ): ((task: SecurityTask) => Promise<Finding[]>) => {
    const provider = resolveProvider(agentId, providerOpt);

    return async (task: SecurityTask): Promise<Finding[]> => {
      if (!provider) {
        console.log(`⚙️ [Swarm Agent: ${agentId}] Running heuristic analysis on ${task.contractName}...`);
        const findings = await heuristicFn(task);
        console.log(`✓ [Swarm Agent: ${agentId}] Heuristic analyzer produced ${findings.length} findings.`);
        return findings;
      }

      try {
        console.log(`🤖 [Swarm Agent: ${agentId}] Running LLM inference on ${task.contractName}...`);
        const systemPrompt = SPECIALIST_SYSTEM_PROMPTS[agentId];
        const precomputed = await heuristicFn(task);
        const cluesText = precomputed.length > 0
          ? `\nPre-computed Static Analysis AST Clues:\n${precomputed.map((f) => `- [${f.category}] ${f.title} at ${f.location}: ${f.evidence.join("; ")}`).join("\n")}\nVerify, contest, or deepen these clues with concrete exploit analysis.\n`
          : "";

        const userPrompt = `Audit the following Solidity smart contract for vulnerabilities in your domain (${agentId}):

Contract Name: ${task.contractName}
${task.network ? `Target Network: ${task.network}` : ""}
${cluesText}
\`\`\`solidity
${task.source}
\`\`\`
Analyze the code carefully and return your findings strictly in the specified JSON format.`;

        const response = await provider.complete(systemPrompt, [{ role: "user", content: userPrompt }], {
          temperature: 0.1,
          maxTokens: 2500,
        });

        const findings = parseLLMFindings(response, agentId);
        console.log(`✓ [Swarm Agent: ${agentId}] Inference completed: ${findings.length} finding(s) detected [${findings.map((f) => f.severity).join(", ") || "clean"}].`);
        if (findings.length === 0 && precomputed.some((f) => f.severity === "critical" || f.severity === "high")) {
          return precomputed;
        }
        return findings;
      } catch (err) {
        console.warn(
          `⚠️ [Swarm Agent: ${agentId}] LLM analysis encountered error, falling back to heuristic detector: ${(err as Error).message}`,
        );
        const findings = await heuristicFn(task);
        console.log(`✓ [Swarm Agent: ${agentId}] Fallback heuristic produced ${findings.length} findings.`);
        return findings;
      }
    };
  };

  return {
    "reentrancy-agent": {
      identity: id("reentrancy-agent", "Reentrancy Agent", ["reentrancy-detection", "cei-violation"]),
      analyze: wrapAnalysis("reentrancy-agent", analyzeReentrancy),
    },
    "access-control-agent": {
      identity: id("access-control-agent", "Access Control Agent", ["access-control", "tx-origin"]),
      analyze: wrapAnalysis("access-control-agent", analyzeAccessControl),
    },
    "business-logic-agent": {
      identity: id("business-logic-agent", "Business Logic Agent", ["business-logic", "input-validation"]),
      analyze: wrapAnalysis("business-logic-agent", analyzeBusinessLogic),
    },
    "economic-agent": {
      identity: id("economic-agent", "Economic Security Agent", ["oracle-manipulation", "flash-loan", "timestamp-dependency"]),
      analyze: wrapAnalysis("economic-agent", analyzeEconomic),
    },
    "static-agent": {
      identity: id("static-agent", "Static Analysis Agent", ["delegatecall", "unchecked-arithmetic", "low-level-call"]),
      analyze: wrapAnalysis("static-agent", analyzeStatic),
    },
    "reentrancy-sentinel": {
      identity: id("reentrancy-sentinel", "Reentrancy Sentinel", ["reentrancy-detection", "cross-function-reentrancy"]),
      analyze: wrapAnalysis("reentrancy-sentinel", analyzeReentrancySentinel),
    },
    "access-sentinel": {
      identity: id("access-sentinel", "Access Sentinel", ["access-control", "authorization-bypass"]),
      analyze: wrapAnalysis("access-sentinel", analyzeAccessSentinel),
    },
    "invariant-agent": {
      identity: id("invariant-agent", "Invariant Agent", ["business-logic", "precision-loss"]),
      analyze: wrapAnalysis("invariant-agent", analyzeInvariant),
    },
    "mev-sentinel": {
      identity: id("mev-sentinel", "MEV Sentinel", ["flash-loan", "oracle-manipulation", "mev-protection"]),
      analyze: wrapAnalysis("mev-sentinel", analyzeMevSentinel),
    },
    "bytecode-verifier": {
      identity: id("bytecode-verifier", "Bytecode Verifier", ["low-level-call", "delegatecall"]),
      analyze: wrapAnalysis("bytecode-verifier", analyzeBytecodeVerifier),
    },
  };
}

/** Run all specialists independently, in parallel with smooth dispatch. */
export async function runSpecialists(
  agents: Record<string, SecurityAgent>,
  task: SecurityTask,
): Promise<Array<{ agentId: string; findings: Finding[] }>> {
  const entries = Object.entries(agents).map(async ([agentId, agent], index) => {
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, index * 80));
    }
    const findings = await agent.analyze(task);
    return { agentId, findings };
  });
  return Promise.all(entries);
}