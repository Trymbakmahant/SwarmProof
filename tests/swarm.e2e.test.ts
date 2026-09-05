import { describe, expect, it } from "vitest";
import { StubProvider } from "@swarmproof/agents";
import { SwarmRunner } from "@swarmproof/swarm";
import { MockVerifier, createVerifier } from "@swarmproof/verification";
import { MockHederaClient } from "@swarmproof/hedera";
import { MemoryLedger } from "@swarmproof/payments";
import { createToolRegistry } from "@swarmproof/mcp";

describe("swarm e2e (stub provider)", () => {
  it("runs an audit end-to-end with stub + mock tools", async () => {
    const provider = new StubProvider();
    const runner = new SwarmRunner({ provider });
    const events: string[] = [];

    runner.on("phase", (role) => events.push(role));

    const result = await runner.run({
      runId: "e2e-1",
      contractName: "ReentrancyVault",
      contractSource: "contract ReentrancyVault {}",
      agents: {},
    });

    expect(events).toContain("analyzer");
    expect(events).toContain("judge");
    expect(result.findings).toBeDefined();
  });

  it("verifier reproduces corpus-style findings in mock mode", async () => {
    const verifier: MockVerifier = createVerifier("mock");
    const res = await verifier.verify({
      findingId: "f1",
      tool: "mock",
      contractPath: "contracts/vulnerable/ReentrancyVault.sol",
      commandArgs: [],
    });
    expect(res.reproduced).toBe(true);
  });

  it("hedera mock anchors a report", async () => {
    const hedera = new MockHederaClient();
    const anchor = await hedera.submitReport(
      "0.0.1001",
      JSON.stringify({ runId: "e2e-2" }),
    );
    expect(anchor.runId).toBe("e2e-2");
    expect(anchor.contentHash).toContain("sha256:");
  });

  it("payments payout follows severity schedule", async () => {
    const hedera = new MockHederaClient();
    const ledger = new MemoryLedger(hedera);
    await ledger.createBounty({
      id: "b1",
      contractName: "ReentrancyVault",
      tokenId: "0.0.2001",
      payer: "alice",
    });
    await ledger.escrow("b1", 10_000);
    const t = await ledger.payout("b1", "bob", "critical");
    expect(t.amount).toBe(5000);
    expect((await ledger.getBounty("b1"))?.status).toBe("paid");
  });

  it("mcp registry exposes the four core tools", () => {
    const hedera = new MockHederaClient();
    const ledger = new MemoryLedger(hedera);
    const tools = createToolRegistry({
      swarm: new SwarmRunner({ provider: new StubProvider() }),
      verifier: createVerifier("mock"),
      payments: ledger,
      reports: new Map(),
    });
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(["audit_contract", "get_report", "verify_finding", "check_bounty"]),
    );
  });
});