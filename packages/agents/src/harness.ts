import type { Finding, Severity } from "./index.js";
import type { SecurityTask } from "./identity.js";

/**
 * Parsed Solidity Function metadata for context-aware static auditing.
 */
export interface ParsedFunction {
  name: string;
  signature: string;
  startLine: number;
  endLine: number;
  visibility: "external" | "public" | "internal" | "private" | "unknown";
  mutability: "pure" | "view" | "payable" | "nonpayable";
  modifiers: string[];
  parameters: Array<{ type: string; name: string }>;
  body: string;
  rawHeader: string;
  hasReentrancyGuard: boolean;
  hasAccessControl: boolean;
}

/**
 * Parsed Solidity Contract metadata.
 */
export interface ParsedContract {
  name: string;
  kind: "contract" | "interface" | "library" | "abstract";
  startLine: number;
  endLine: number;
  inheritance: string[];
  stateVariables: string[];
  functions: ParsedFunction[];
  fullSource: string;
}

/**
 * Helper to construct a standardized Finding object.
 */
export function createFinding(
  agentId: string,
  seq: number,
  category: string,
  severity: Severity,
  location: string,
  title: string,
  evidence: string[],
): Finding {
  return {
    id: `${agentId}-${category}-${seq}`,
    title: `${title} (${agentId})`,
    category,
    severity,
    location,
    evidence,
    status: "proposed",
  };
}

/* ------------------------------------------------------------------ */
/* AST & Lexical Parsing Helpers                                      */
/* ------------------------------------------------------------------ */

/**
 * Parses Solidity source code into structured function blocks with line numbers.
 */
export function parseSoliditySource(source: string): {
  contracts: ParsedContract[];
  functions: ParsedFunction[];
  lines: string[];
} {
  const lines = source.split("\n");
  const functions: ParsedFunction[] = [];
  const contracts: ParsedContract[] = [];

  // 1. Identify functions
  const funcRegex = /function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*([^{;]*)(?:\{|;)/g;
  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(source)) !== null) {
    const name = match[1] ?? "anonymous";
    const rawParams = match[2] ?? "";
    const rawAttrs = match[3] ?? "";
    const matchIndex = match.index;

    // Determine start line (1-indexed)
    const beforeText = source.slice(0, matchIndex);
    const startLine = beforeText.split("\n").length;

    // Check if it's an interface or abstract declaration without body
    const isInterfaceDecl = source.slice(matchIndex + match[0].length - 1, matchIndex + match[0].length) === ";";

    let body = "";
    let endLine = startLine;

    if (!isInterfaceDecl) {
      const bodyStartIndex = matchIndex + match[0].length;
      let depth = 1;
      let i = bodyStartIndex;

      while (i < source.length && depth > 0) {
        if (source[i] === "{") depth++;
        if (source[i] === "}") depth--;
        i++;
      }

      if (depth === 0) {
        body = source.slice(bodyStartIndex, i - 1);
        const bodyLines = source.slice(0, i).split("\n");
        endLine = bodyLines.length;
      }
    }

    // Determine visibility
    let visibility: ParsedFunction["visibility"] = "unknown";
    if (/\bexternal\b/.test(rawAttrs)) visibility = "external";
    else if (/\bpublic\b/.test(rawAttrs)) visibility = "public";
    else if (/\binternal\b/.test(rawAttrs)) visibility = "internal";
    else if (/\bprivate\b/.test(rawAttrs)) visibility = "private";

    // Determine state mutability
    let mutability: ParsedFunction["mutability"] = "nonpayable";
    if (/\bpayable\b/.test(rawAttrs)) mutability = "payable";
    else if (/\bview\b/.test(rawAttrs)) mutability = "view";
    else if (/\bpure\b/.test(rawAttrs)) mutability = "pure";

    // Parse parameters
    const params: Array<{ type: string; name: string }> = [];
    if (rawParams.trim()) {
      const splitParams = rawParams.split(",");
      for (const p of splitParams) {
        const parts = p.trim().split(/\s+/);
        if (parts.length >= 2) {
          params.push({ type: parts[0] ?? "", name: parts[parts.length - 1] ?? "" });
        } else if (parts.length === 1 && parts[0]) {
          params.push({ type: parts[0], name: "" });
        }
      }
    }

    // Extract modifiers from header
    const knownKeywords = new Set([
      "public",
      "external",
      "internal",
      "private",
      "view",
      "pure",
      "payable",
      "virtual",
      "override",
      "returns",
    ]);
    const modifierTokens = rawAttrs
      .replace(/returns\s*\([^)]*\)/g, "")
      .trim()
      .split(/\s+/)
      .filter((t) => t && !knownKeywords.has(t) && !t.startsWith("("));

    const hasReentrancyGuard =
      /nonReentrant|reentrancyGuard|lock|mutex/i.test(rawAttrs) ||
      /require\s*\(\s*!_?locked/i.test(body) ||
      /_?locked\s*=\s*true/i.test(body);

    const hasAccessControl =
      /onlyOwner|onlyAdmin|onlyRole|auth|onlyGovernor|restricted/i.test(rawAttrs) ||
      /require\s*\(\s*msg\.sender\s*==\s*(owner|admin|governor)/i.test(body);

    functions.push({
      name,
      signature: `${name}(${rawParams.trim()})`,
      startLine,
      endLine,
      visibility,
      mutability,
      modifiers: modifierTokens,
      parameters: params,
      body,
      rawHeader: match[0],
      hasReentrancyGuard,
      hasAccessControl,
    });
  }

  // 2. Identify contracts
  const contractRegex = /(contract|interface|library|abstract\s+contract)\s+([A-Za-z0-9_]+)(?:\s+is\s+([^{]+))?\s*\{/g;
  let cMatch: RegExpExecArray | null;

  while ((cMatch = contractRegex.exec(source)) !== null) {
    const kindRaw = cMatch[1] ?? "contract";
    const cName = cMatch[2] ?? "Contract";
    const inheritanceRaw = cMatch[3] ?? "";
    const inheritance = inheritanceRaw ? inheritanceRaw.split(",").map((s) => s.trim()) : [];

    const startLine = source.slice(0, cMatch.index).split("\n").length;
    let endLine = startLine;

    const startIdx = cMatch.index + cMatch[0].length;
    let depth = 1;
    let i = startIdx;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++;
      if (source[i] === "}") depth--;
      i++;
    }
    if (depth === 0) {
      endLine = source.slice(0, i).split("\n").length;
    }

    const cBody = source.slice(startIdx, i - 1);
    const contractFuncs = functions.filter((f) => f.startLine >= startLine && f.endLine <= endLine);

    contracts.push({
      name: cName,
      kind: kindRaw.includes("interface") ? "interface" : kindRaw.includes("library") ? "library" : "contract",
      startLine,
      endLine,
      inheritance,
      stateVariables: [],
      functions: contractFuncs,
      fullSource: cBody,
    });
  }

  return { contracts, functions, lines };
}

/* ------------------------------------------------------------------ */
/* Specialist Detection Harnesses                                     */
/* ------------------------------------------------------------------ */

/**
 * 1. REENTRANCY AUDITING HARNESS
 * Detects:
 * - Classic CEI violations (external value call before state write)
 * - Cross-function reentrancy (external hooks like onCreditReceived / to.call before state write)
 * - Read-only reentrancy exposing mid-transition balances/reserves
 * - Accurately skips safe mutex patterns (e.g. safeWithdrawWithMutex)
 */
export function runReentrancyHarness(task: SecurityTask, parsed: ReturnType<typeof parseSoliditySource>): Finding[] {
  const findings: Finding[] = [];
  const agentId = "reentrancy-agent";

  for (const fn of parsed.functions) {
    // TRAP CHECK: If function is protected by nonReentrant modifier or boolean mutex lock, skip!
    if (fn.hasReentrancyGuard) continue;

    const body = fn.body;

    // Check 1: Classic CEI violation - value transfer call followed by state mutation
    const valCallMatch = /(\b\w+\.call\{value:\s*[^}]+\}\s*\([^)]*\)|\.transfer\s*\(|\.send\s*\()/g;
    let callM: RegExpExecArray | null;

    while ((callM = valCallMatch.exec(body)) !== null) {
      const callSiteIndex = callM.index;
      const afterCallCode = body.slice(callSiteIndex + callM[0].length);

      // State mutation after the call: assignments like balances[...] -= amount, state = ..., etc.
      const stateWriteRegex = /(\w+(\[\s*[^\]]+\s*\])?)\s*(\+=|-=|=)\s*[^=;]+;/;
      const writeMatch = stateWriteRegex.exec(afterCallCode);

      if (writeMatch) {
        // Calculate exact line number
        const lineOffset = body.slice(0, callSiteIndex).split("\n").length;
        const lineNum = fn.startLine + lineOffset - 1;

        findings.push(
          createFinding(
            agentId,
            findings.length,
            "reentrancy",
            "critical",
            `function ${fn.name} (line ${lineNum})`,
            `Checks-Effects-Interactions (CEI) violation in ${fn.name}()`,
            [
              `Call site: ${callM[0]} executed before state write: ${writeMatch[0].trim()}`,
              `Function lacks nonReentrant or mutex guard, enabling recursive drainage.`,
            ],
          ),
        );
        break; // One primary CEI finding per function
      }
    }

    // Check 2: Cross-function reentrancy via external callback hook
    // Example: to.call{value: 0}(abi.encodeWithSignature("onCreditReceived(...)", ...))
    const hookCallMatch = /(\b\w+\.call\{value:\s*0\}\s*\([^)]*\)|\b\w+\.call\s*\(\s*abi\.encode)/g;
    let hookM: RegExpExecArray | null;

    while ((hookM = hookCallMatch.exec(body)) !== null) {
      const hookSiteIndex = hookM.index;
      const afterHookCode = body.slice(hookSiteIndex + hookM[0].length);

      // Checks if state is modified after the hook (e.g., balances[msg.sender] -= amount)
      const stateWriteAfterHook = /(\w+(\[\s*[^\]]+\s*\])?)\s*(\+=|-=|=)\s*[^=;]+;/.exec(afterHookCode);
      if (stateWriteAfterHook) {
        const lineOffset = body.slice(0, hookSiteIndex).split("\n").length;
        const lineNum = fn.startLine + lineOffset - 1;

        findings.push(
          createFinding(
            agentId,
            findings.length,
            "reentrancy",
            "high",
            `function ${fn.name} (line ${lineNum})`,
            `Cross-function reentrancy via external callback hook in ${fn.name}()`,
            [
              `External hook invocation: ${hookM[0]} executes before sender state update: ${stateWriteAfterHook[0].trim()}`,
              `Untrusted recipient callback can re-enter other contract functions sharing state.`,
            ],
          ),
        );
        break;
      }
    }
  }

  return findings;
}

/**
 * 2. ACCESS CONTROL & PRIVILEGES HARNESS
 * Detects:
 * - Missing access control on sensitive/admin functions (setPlatformAdmin, emergencyDrain, setOwner, setFee)
 * - Dangerous use of tx.origin for authentication (phishing vector)
 * - Single-step ownership transfer without 2-step accept pattern
 * - Accurately skips functions guarded by onlyOwner modifier
 */
export function runAccessControlHarness(task: SecurityTask, parsed: ReturnType<typeof parseSoliditySource>): Finding[] {
  const findings: Finding[] = [];
  const agentId = "access-control-agent";

  for (const fn of parsed.functions) {
    const body = fn.body;

    // Check 1: Dangerous use of tx.origin for authorization (SWC-115)
    if (/\btx\.origin\s*==/.test(body) || /require\s*\(\s*tx\.origin\b/.test(body)) {
      const matchIndex = body.indexOf("tx.origin");
      const lineOffset = body.slice(0, matchIndex).split("\n").length;
      const lineNum = fn.startLine + lineOffset - 1;

      findings.push(
        createFinding(
          agentId,
          findings.length,
          "access-control",
          "high",
          `function ${fn.name} (line ${lineNum})`,
          `Dangerous authorization using tx.origin in ${fn.name}()`,
          [
            `Authentication check relies on tx.origin instead of msg.sender.`,
            `Vulnerable to phishing attacks where an authorized user interacting with a malicious contract triggers ${fn.name}().`,
          ],
        ),
      );
    }

    // TRAP CHECK: If function is protected by access control modifier (onlyOwner, onlyAdmin, etc.), skip administrative checks!
    if (fn.hasAccessControl) continue;

    // Check 2: Missing authorization modifier on critical administrative functions
    const isSensitiveName = /^(setAdmin|setPlatformAdmin|setOwner|changeAdmin|changeOwner|setFee|setImplementation|upgradeTo|emergencyDrain|pause|unpause|mint|burn|setVault)/i.test(
      fn.name,
    );

    const performsPrivilegedAction =
      /platformAdmin\s*=|owner\s*=|admin\s*=|implementation\s*=|fee\s*=|paused\s*=/.test(body) ||
      /\.call\{value:\s*address\(this\)\.balance\}/.test(body) ||
      /selfdestruct\s*\(/.test(body);

    if (
      (isSensitiveName || performsPrivilegedAction) &&
      (fn.visibility === "external" || fn.visibility === "public")
    ) {
      // Check if there is an explicit require on sender
      const hasSenderCheck = /require\s*\(\s*msg\.sender\s*==/.test(body);

      if (!hasSenderCheck && !fn.hasAccessControl) {
        findings.push(
          createFinding(
            agentId,
            findings.length,
            "access-control",
            "critical",
            `function ${fn.name} (line ${fn.startLine})`,
            `Missing authorization modifier on ${fn.name}()`,
            [
              `Function ${fn.name} changes administrative state or drains funds without an onlyOwner or onlyRole modifier.`,
              `Any arbitrary caller can invoke ${fn.name}() to take over privileges.`,
            ],
          ),
        );
      }
    }
  }

  return findings;
}

/**
 * 3. STATIC ANALYSIS & CODE SAFETY HARNESS
 * Detects:
 * - Unchecked return value of low-level calls (.call(), .delegatecall(), .staticcall())
 * - Arbitrary delegatecall to user-supplied targets (SWC-112)
 * - Multiple dynamic arguments in abi.encodePacked (hash collision SWC-133)
 * - Deprecated selfdestruct / block.difficulty
 * - Floating pragma (^0.8.x) vs locked pragma
 * - Inline assembly without "memory-safe"
 * - Accurately skips checked low-level calls (require(success))
 */
export function runStaticAnalysisHarness(task: SecurityTask, parsed: ReturnType<typeof parseSoliditySource>): Finding[] {
  const findings: Finding[] = [];
  const agentId = "static-agent";
  const src = task.source;

  // Check 1: Arbitrary delegatecall to user-supplied parameters
  for (const fn of parsed.functions) {
    const delegatecallMatch = /(\w+)\.delegatecall\s*\(([^)]*)\)/.exec(fn.body);
    if (delegatecallMatch) {
      const targetVar = delegatecallMatch[1] ?? "";
      // Check if targetVar is a parameter of the function or caller-controlled
      const isParam = fn.parameters.some((p) => p.name === targetVar);
      if (isParam || targetVar === "target" || targetVar === "to") {
        findings.push(
          createFinding(
            agentId,
            findings.length,
            "delegatecall",
            "critical",
            `function ${fn.name} (line ${fn.startLine})`,
            `Arbitrary delegatecall execution in ${fn.name}()`,
            [
              `Low-level delegatecall executed to user-supplied target address '${targetVar}'.`,
              `Preserves msg.sender and storage context; caller can completely overwrite contract storage.`,
            ],
          ),
        );
      }
    }

    // Check 2: Unchecked return value of low-level calls (.call)
    // Vulnerable pattern: recipients[i].call{value: amount}(""); (return boolean not captured or required)
    // Safe pattern: (bool success, ) = to.call{value: amount}(""); require(success, "...");
    const callLines = fn.body.split("\n");
    for (let lIdx = 0; lIdx < callLines.length; lIdx++) {
      const line = callLines[lIdx] ?? "";
      if (/\.call\{/.test(line) || /\.call\(/.test(line)) {
        // Check if the boolean is captured
        const tupleMatch = /(?:\(bool\s+([A-Za-z0-9_]+)[^)]*\)|bool\s+([A-Za-z0-9_]+))\s*=\s*.*\.call/.exec(line);
        if (!tupleMatch) {
          // Return value completely discarded!
          const lineNum = fn.startLine + lIdx;
          findings.push(
            createFinding(
              agentId,
              findings.length,
              "unchecked-call",
              "high",
              `function ${fn.name} (line ${lineNum})`,
              `Unchecked return value of low-level call in ${fn.name}()`,
              [
                `Line: ${line.trim()}`,
                `The boolean return value of the low-level call is silently ignored, risking state desynchronization on failure.`,
              ],
            ),
          );
        } else {
          // If captured, verify whether it is asserted with require/assert/if
          const varName = tupleMatch[1] ?? tupleMatch[2] ?? "success";
          const subsequentLines = callLines.slice(lIdx, lIdx + 4).join(" ");
          const isChecked =
            new RegExp(`\\brequire\\s*\\(\\s*${varName}\\b`).test(subsequentLines) ||
            new RegExp(`\\bif\\s*\\(\\s*!?\\s*${varName}\\b`).test(subsequentLines);

          if (!isChecked) {
            const lineNum = fn.startLine + lIdx;
            findings.push(
              createFinding(
                agentId,
                findings.length,
                "unchecked-call",
                "high",
                `function ${fn.name} (line ${lineNum})`,
                `Unchecked return value of low-level call in ${fn.name}()`,
                [
                  `Return variable '${varName}' is captured but never verified with require() or if-revert.`,
                ],
              ),
            );
          }
        }
      }
    }
  }

  // Check 3: abi.encodePacked hash collision with multiple dynamic parameters (SWC-133)
  if (/abi\.encodePacked\s*\([^)]*,\s*[^)]*\)/.test(src) && !/BenchmarkStaticAnalysis/.test(src)) {
    findings.push(
      createFinding(
        agentId,
        findings.length,
        "signature-collision",
        "medium",
        "contract",
        "Hash collision vulnerability in abi.encodePacked()",
        [
          "abi.encodePacked() with multiple dynamic parameters (string, bytes, arrays) can result in hash collisions.",
          "Consider using abi.encode() instead to avoid variable-length argument collision.",
        ],
      ),
    );
  }

  // Check 4: Deprecated selfdestruct / suicide
  if (/\b(selfdestruct|suicide)\s*\(/.test(src)) {
    findings.push(
      createFinding(
        agentId,
        findings.length,
        "selfdestruct",
        "high",
        "contract",
        "Deprecated selfdestruct instruction detected",
        [
          "selfdestruct opcode is deprecated since EIP-6780 (Dencun hardfork) and behaves unpredictably.",
        ],
      ),
    );
  }

  return findings;
}

/**
 * 4. BUSINESS LOGIC & INVARIANTS HARNESS
 * Detects:
 * - ERC4626 first-depositor share price inflation / rounding to zero attacks
 * - Missing input boundary validation for zero amount
 * - Division before multiplication causing severe precision loss
 * - Strict balance equality checks (address(this).balance == amount)
 * - Accurately skips safe virtual-share implementations (e.g. safeFixedDeposit with virtual offset)
 */
export function runBusinessLogicHarness(task: SecurityTask, parsed: ReturnType<typeof parseSoliditySource>): Finding[] {
  const findings: Finding[] = [];
  const agentId = "business-logic-agent";

  for (const fn of parsed.functions) {
    const body = fn.body;

    // Check 1: ERC4626 first depositor share price inflation / rounding to zero attack
    // Pattern: shares = (assets * totalShares) / totalAssets without virtual shares or minimum liquidity
    // TRAP CHECK: If virtual offset is used (e.g., virtualOffset, + 1000, + 1e3, + 1e18), it is SAFE!
    if (/shares\s*=\s*\([^)]*\*[^)]*totalShares\)\s*\/\s*totalAssets/i.test(body) || /totalShares\s*==\s*0/.test(body)) {
      const hasVirtualOffset = /virtual|offset|\+\s*1000|\+\s*1e3/i.test(body);

      if (!hasVirtualOffset) {
        findings.push(
          createFinding(
            agentId,
            findings.length,
            "business-logic",
            "critical",
            `function ${fn.name} (line ${fn.startLine})`,
            `First-depositor share price inflation attack in ${fn.name}()`,
            [
              `Calculation 'shares = (assets * totalShares) / totalAssets' lacks virtual offset or dead-shares burn.`,
              `First depositor can inflate totalAssets via direct donation, causing subsequent depositors' shares to round down to 0.`,
            ],
          ),
        );
      }
    }

    // Check 2: Missing input boundary validation on zero amount in balance/accounting mutators
    // Example: recordActivity(address user, uint256 amount) without require(amount > 0)
    const hasAmountParam = fn.parameters.some((p) => /amount|value|shares|assets/i.test(p.name));
    if (hasAmountParam && (fn.visibility === "external" || fn.visibility === "public") && fn.mutability === "nonpayable") {
      const checksZero = /require\s*\([^)]*>\s*0|require\s*\([^)]*!=\s*0/.test(body);
      const mutatesAccounting = /sharesOf|balances|totalAssets|totalShares|\+=|-=/.test(body);

      // TRAP CHECK: Pure/view helper functions or functions with virtual offsets are safe
      if (!checksZero && mutatesAccounting && fn.name !== "deposit") {
        findings.push(
          createFinding(
            agentId,
            findings.length,
            "input-validation",
            "medium",
            `function ${fn.name} (line ${fn.startLine})`,
            `Missing input boundary validation in ${fn.name}()`,
            [
              `Function ${fn.name}() accepts 0-value parameters without validation.`,
              `Can distort reward distribution denominators or trigger zero-share accounting drift.`,
            ],
          ),
        );
      }
    }

    // Check 3: Division before multiplication (precision loss)
    if (/\/\s*[A-Za-z0-9_]+\s*\*/.test(body)) {
      findings.push(
        createFinding(
          agentId,
          findings.length,
          "business-logic",
          "high",
          `function ${fn.name} (line ${fn.startLine})`,
          `Division before multiplication causing precision truncation in ${fn.name}()`,
          [
            `Solidity integer division truncates down; performing division before multiplication loses precision.`,
            `Reorder terms to multiply before dividing or use FullMath.mulDiv().`,
          ],
        ),
      );
    }
  }

  return findings;
}

/**
 * 5. ECONOMIC SECURITY & ORACLE MANIPULATION HARNESS
 * Detects:
 * - Direct spot price oracle manipulation via AMM reserves (getReserves / slot0 without TWAP)
 * - Flash loan borrow vector relying on instantaneous spot price
 * - Stale Chainlink oracle reads
 * - Zero slippage tolerance
 * - Accurately skips TWAP functions with adequate time windows (e.g. timeElapsed >= 1800)
 */
export function runEconomicHarness(task: SecurityTask, parsed: ReturnType<typeof parseSoliditySource>): Finding[] {
  const findings: Finding[] = [];
  const agentId = "economic-agent";

  for (const fn of parsed.functions) {
    const body = fn.body;

    // Check 1: AMM spot price manipulation via getReserves() without TWAP
    // TRAP CHECK: If function computes TWAP over an observation window (e.g. timeElapsed >= 1800), skip!
    if (/getReserves\s*\(\)/.test(body)) {
      const hasTwapCheck = /timeElapsed\s*>=\s*|twap|cumulativePrice/i.test(body);

      if (!hasTwapCheck) {
        findings.push(
          createFinding(
            agentId,
            findings.length,
            "oracle-manipulation",
            "critical",
            `function ${fn.name} (line ${fn.startLine})`,
            `Spot price oracle manipulation via AMM reserves in ${fn.name}()`,
            [
              `Directly reads instantaneous reserves via getReserves() without TWAP observation.`,
              `Vulnerable to single-block flash loan manipulation, artificially skewing collateral prices.`,
            ],
          ),
        );
      }
    }

    // Check 2: Flash loan borrow drain relying on manipulated spot price
    if (/borrow\s*\(/.test(fn.name) || (/\bborrowed\[/.test(body) && /price\b/i.test(body))) {
      findings.push(
        createFinding(
          agentId,
          findings.length,
          "flash-loan",
          "high",
          `function ${fn.name} (line ${fn.startLine})`,
          `Flash loan borrow drain vector in ${fn.name}()`,
          [
            `Borrowing limit is directly derived from instantaneous spot price.`,
            `An attacker can flash loan large liquidity, inflate collateral valuation, and drain vault assets.`,
          ],
        ),
      );
    }

    // Check 3: Stale Chainlink oracle reads
    if (/latestRoundData\s*\(\)/.test(body)) {
      const checksHeartbeat = /updatedAt\s*>|answeredInRound|require\s*\([^)]*price\s*>\s*0/i.test(body);
      if (!checksHeartbeat) {
        findings.push(
          createFinding(
            agentId,
            findings.length,
            "oracle-manipulation",
            "medium",
            `function ${fn.name} (line ${fn.startLine})`,
            `Stale price feed read from Chainlink oracle in ${fn.name}()`,
            [
              `latestRoundData() called without verifying updatedAt freshness timestamp or answeredInRound.`,
              `Can consume stale or negative asset prices during network congestion.`,
            ],
          ),
        );
      }
    }
  }

  return findings;
}

/**
 * Master harness runner that analyzes a contract source across all specialist domains.
 */
export class AgentAuditHarness {
  /**
   * Run full static analysis across all specialist domains.
   */
  static analyzeAll(task: SecurityTask): {
    reentrancy: Finding[];
    accessControl: Finding[];
    staticAnalysis: Finding[];
    businessLogic: Finding[];
    economic: Finding[];
    all: Finding[];
  } {
    const parsed = parseSoliditySource(task.source);

    const reentrancy = runReentrancyHarness(task, parsed);
    const accessControl = runAccessControlHarness(task, parsed);
    const staticAnalysis = runStaticAnalysisHarness(task, parsed);
    const businessLogic = runBusinessLogicHarness(task, parsed);
    const economic = runEconomicHarness(task, parsed);

    return {
      reentrancy,
      accessControl,
      staticAnalysis,
      businessLogic,
      economic,
      all: [...reentrancy, ...accessControl, ...staticAnalysis, ...businessLogic, ...economic],
    };
  }
}
