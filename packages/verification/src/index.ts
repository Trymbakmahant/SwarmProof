export type VerifyTool = "solc" | "slither" | "forge" | "mock";

export interface VerificationRequest {
  findingId: string;
  tool: VerifyTool;
  contractPath: string;
  commandArgs: string[];
  proofContract?: string; // PoC solidity source
}

export interface VerificationResult {
  findingId: string;
  tool: VerifyTool;
  reproduced: boolean;
  command: string;
  outputExcerpt: string;
  artifactUrl?: string;
  adjustedSeverity?: "critical" | "high" | "medium" | "low";
}

export interface VerificationEngine {
  name: string;
  verify(req: VerificationRequest): Promise<VerificationResult>;
}

/**
 * In-process mock verifier for CI & offline demo.
 * Matches tool + contract path keywords to simulate reproduced findings.
 */
export class MockVerifier implements VerificationEngine {
  readonly name = "mock";

  async verify(req: VerificationRequest): Promise<VerificationResult> {
    const reproduced =
      req.tool === "mock" || /reentrancy|overflow|access/i.test(req.contractPath);
    return {
      findingId: req.findingId,
      tool: req.tool,
      reproduced,
      command: `${req.tool} ${req.commandArgs.join(" ")}`,
      outputExcerpt: `[mock] ${reproduced ? "VULNERABILITY REPRODUCED" : "no violation found"} — ${req.contractPath}`,
    };
  }
}

/**
 * Real tool runner: shells out to solc / slither / forge with timeouts.
 * Hidden behind the same interface — wired up in milestone M3.
 */
export class ToolVerifier implements VerificationEngine {
  readonly name = "tool";

  async verify(_req: VerificationRequest): Promise<VerificationResult> {
    throw new Error(
      "ToolVerifier not yet wired — install slither/forge (M3) or use MockVerifier.",
    );
  }
}

export function createVerifier(mode: "mock" | "tool" = "mock"): VerificationEngine {
  return mode === "mock" ? new MockVerifier() : new ToolVerifier();
}

/* ------------------------------------------------------------------ */
/* Verification agent — independently verifies consensus findings       */
/* ------------------------------------------------------------------ */

/** Verify a batch of (accepted) findings with the engine. */
export async function verifyFindings(input: {
  findings: Array<{ id: string; title: string; category: string; severity: string; location: string }>;
  task: { contractName: string; source: string };
  engine: VerificationEngine;
  tool?: VerifyTool;
}): Promise<VerificationResult[]> {
  const tool = input.tool ?? "mock";
  return Promise.all(
    input.findings.map(async (f) =>
      input.engine.verify({
        findingId: f.id,
        tool,
        contractPath: f.location,
        commandArgs: [input.task.contractName],
      }),
    ),
  );
}