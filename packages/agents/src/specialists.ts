import type { AgentIdentity, SecurityTask } from "./identity.js";
import type { Finding, Severity } from "./index.js";
import { createLLMProviderFromEnv, parseLLMFindings, type LLMProvider } from "./llm.js";

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

export const SPECIALIST_IDS = [
  "reentrancy-agent",
  "access-control-agent",
  "business-logic-agent",
  "economic-agent",
  "static-agent",
] as const;
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
  const src = task.source;
  const findings: Finding[] = [];
  if (hasNonReentrantGuard(src)) return findings;
  const calls = valueTransferCalls(src);
  const bodies = functionBodies(src);
  for (const c of calls) {
    // Find the enclosing function to check call-before-write.
    const owner = bodies.find((b) => b.body.includes(c.pattern));
    const writeAfter = owner ? STATE_WRITE.test(owner.body) : false;
    if (writeAfter) {
      findings.push(
        makeFinding(
          "reentrancy-agent",
          findings.length,
          "reentrancy",
          "critical",
          c.loc,
          `external ${c.pattern} before state update; no reentrancy guard detected`,
        ),
      );
      break; // one consolidated finding per audit is enough for the cluster
    }
  }
  if (findings.length === 0 && calls.length > 0) {
    findings.push(
      makeFinding(
        "reentrancy-agent",
        0,
        "reentrancy",
        "info",
        "contract",
        `external value transfers found but state-write-after-call not confirmed (${calls.length} call site(s)); deepening analysis recommended`,
      ),
    );
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* 2. Access control agent                                             */
/* ------------------------------------------------------------------ */

async function analyzeAccessControl(task: SecurityTask): Promise<Finding[]> {
  const src = task.source;
  const findings: Finding[] = [];
  const bodies = functionBodies(src);
  for (const b of bodies) {
    const isPrivileged = ETH_TRANSFER_OUT.test(b.body) || /setAdmin|setOwner|changeAdmin|transferOwnership|setFee|setImplementation/i.test(b.body);
    if (!isPrivileged) continue;
    const hasCheck = /require\s*\(|modifier\s+\w+/.test(b.body) || /onlyAdmin|onlyOwner|auth|permission/.test(b.body);
    if (!hasCheck) {
      findings.push(
        makeFinding(
          "access-control-agent",
          findings.length,
          "access-control",
          "high",
          `function ${b.name}`,
          `privileged action in ${b.name}() has no access check`,
        ),
      );
    }
  }
  if (/\btx\.origin\b/.test(src)) {
    findings.push(
      makeFinding(
        "access-control-agent",
        findings.length,
        "access-control",
        "medium",
        "contract",
        "tx.origin used for authorization — vulnerable to phishing-style attacks",
      ),
    );
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* 3. Business logic agent                                             */
/* ------------------------------------------------------------------ */

async function analyzeBusinessLogic(task: SecurityTask): Promise<Finding[]> {
  const src = task.source;
  const findings: Finding[] = [];
  const bodies = functionBodies(src);
  for (const b of bodies) {
    // Amount handling without zero/limit checks (donation/refund style bugs).
    if (/(msg\.value|amount|_amount|value)/.test(b.body) && !/require\s*\([^)]*>\s*0/.test(b.body) && !/require\s*\([^)]*<=/.test(b.body)) {
      // Only flag if it also moves funds or mutates balances based on input.
      if (/balance|balances|total|refund|claim/.test(b.body)) {
        findings.push(
          makeFinding(
            "business-logic-agent",
            findings.length,
            "business-logic",
            "medium",
            `function ${b.name}`,
            `function ${b.name}() handles value/amount input without a zero-or-limit validation`,
          ),
        );
      }
    }
    if (/assert\s*\(/.test(b.body)) {
      findings.push(
        makeFinding(
          "business-logic-agent",
          findings.length,
          "business-logic",
          "low",
          `function ${b.name}`,
          `assert() used in ${b.name}() — panic consumes all gas; prefer require()`,
        ),
      );
    }
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* 4. Economic security agent                                          */
/* ------------------------------------------------------------------ */

async function analyzeEconomic(task: SecurityTask): Promise<Finding[]> {
  const src = task.source;
  const findings: Finding[] = [];
  if (/block\.timestamp|now\b/.test(src) && /require|if\s*\(.*block/.test(src)) {
    findings.push(
      makeFinding(
        "economic-agent",
        0,
        "economic",
        "low",
        "contract",
        "block.timestamp used in decision logic — miners can influence timestamps by small amounts",
      ),
    );
  }
  if (/getReserves|price0Cumulative|slot0|Chainlink|AggregatorV3Interface|latestRoundData|oracle|spotPrice|getPrice/i.test(src)) {
    findings.push(
      makeFinding(
        "economic-agent",
        findings.length,
        "economic",
        "high",
        "contract",
        "external price/oracle dependency detected — check for price manipulation, stale reads, or flash-loan attacks",
      ),
    );
  }
  if (/flash|donate\(|skim|sync\s*\(/.test(src)) {
    findings.push(
      makeFinding(
        "economic-agent",
        findings.length,
        "economic",
        "medium",
        "contract",
        "flash-loan / AMM-manipulation surface detected (donate/skim/sync patterns)",
      ),
    );
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* 5. Static analysis agent                                            */
/* ------------------------------------------------------------------ */

async function analyzeStatic(task: SecurityTask): Promise<Finding[]> {
  const src = task.source;
  const findings: Finding[] = [];
  const checks: Array<{ re: RegExp; cat: string; sev: Severity; hint: string }> = [
    { re: /delegatecall/i, cat: "delegatecall", sev: "high", hint: "delegatecall used" },
    { re: /selfdestruct|suicide\s*\(/i, cat: "selfdestruct", sev: "high", hint: "selfdestruct present" },
    { re: /unchecked\s*\{/i, cat: "unchecked-arithmetic", sev: "medium", hint: "unchecked arithmetic block" },
    { re: /abi\.encodePacked/i, cat: "signature-collision", sev: "medium", hint: "abi.encodePacked used (signature/hash collision risk)" },
    { re: /\.call\{(?!value)/i, cat: "low-level-call", sev: "low", hint: "low-level .call without value" },
    { re: /assembly\s*\{/i, cat: "assembly", sev: "info", hint: "inline assembly (must be reviewed)" },
  ];
  for (const c of checks) {
    if (c.re.test(src)) {
      findings.push(
        makeFinding("static-agent", findings.length, c.cat, c.sev, "contract", c.hint),
      );
    }
  }
  // Cross-signal: like Slither, the static agent independently flags classic
  // call-before-write reentrancy — giving consensus a second, independent voice.
  if (!hasNonReentrantGuard(src) && !findings.some((f) => f.category === "reentrancy")) {
    const bodies = functionBodies(src);
    for (const c of valueTransferCalls(src)) {
      const owner = bodies.find((b) => b.body.includes(c.pattern));
      if (owner && STATE_WRITE.test(owner.body)) {
        findings.push(
          makeFinding(
            "static-agent",
            findings.length,
            "reentrancy",
            "critical",
            c.loc,
            `static cross-signal: external ${c.pattern} before state update in ${owner.name}(), no guard`,
          ),
        );
        break;
      }
    }
  }
  return findings;
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
};

/* ------------------------------------------------------------------ */
/* Registry & Factory                                                 */
/* ------------------------------------------------------------------ */

export const SPECIALIST_PAYMENT_ADDRESSES: Record<SpecialistId, string> = {
  "reentrancy-agent": "0x1111111111111111111111111111111111111111",
  "access-control-agent": "0x2222222222222222222222222222222222222222",
  "business-logic-agent": "0x3333333333333333333333333333333333333333",
  "economic-agent": "0x4444444444444444444444444444444444444444",
  "static-agent": "0x5555555555555555555555555555555555555555",
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
 * Build the five specialists with identities and analysis runners.
 *
 * When an LLM provider is available (either passed in or detected via ANTHROPIC_API_KEY,
 * OPENAI_API_KEY, or OLLAMA_BASE_URL), the specialist uses real LLM analysis.
 * If no LLM provider is configured, or if an LLM call fails, it cleanly falls back
 * to deterministic AST/regex heuristics so offline tests and CI stay 100% green.
 */
export function createSpecialistAgents(
  optsOrAddresses?: Record<SpecialistId, string> | SpecialistFactoryOptions,
): Record<SpecialistId, SecurityAgent> {
  let addresses: Record<SpecialistId, string> = SPECIALIST_PAYMENT_ADDRESSES;
  let providerOpt: LLMProvider | Partial<Record<SpecialistId, LLMProvider>> | undefined = undefined;

  if (optsOrAddresses) {
    if (typeof (optsOrAddresses as Record<string, string>)["reentrancy-agent"] === "string") {
      addresses = { ...SPECIALIST_PAYMENT_ADDRESSES, ...(optsOrAddresses as Record<SpecialistId, string>) };
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
    return {
      agentId,
      name: p ? `${name} [${p.name}]` : name,
      capabilities,
      paymentAddress: addresses[agentId],
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
        return heuristicFn(task);
      }

      try {
        const systemPrompt = SPECIALIST_SYSTEM_PROMPTS[agentId];
        const userPrompt = `Audit the following Solidity smart contract for vulnerabilities in your domain (${agentId}):

Contract Name: ${task.contractName}
${task.network ? `Target Network: ${task.network}` : ""}

\`\`\`solidity
${task.source}
\`\`\`
Analyze the code carefully and return your findings strictly in the specified JSON format.`;

        const response = await provider.complete(systemPrompt, [{ role: "user", content: userPrompt }], {
          temperature: 0.1,
          maxTokens: 1000,
        });

        const findings = parseLLMFindings(response, agentId);
        return findings;
      } catch (err) {
        console.warn(
          `[${agentId}] LLM analysis encountered error, falling back to heuristic detector: ${(err as Error).message}`,
        );
        return heuristicFn(task);
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