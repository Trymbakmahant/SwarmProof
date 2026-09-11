import { describe, it, expect, beforeAll } from "vitest";
import { createApp } from "../apps/api/src/app.js";
import { PrivateKey, MockIdentityRegistrar } from "@swarmproof/hedera";
import type { Finding } from "@swarmproof/agents";

describe("Automated Agent Qualification & Hedera HCS Proof (A.2 & A.3)", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  it("1. GET /benchmarks returns all 5 specialist benchmark suites", async () => {
    const res = await app.request("/benchmarks");
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.benchmarks).toBeDefined();
    expect(data.benchmarks.length).toBe(5);

    const roles = data.benchmarks.map((b: any) => b.role);
    expect(roles).toContain("reentrancy");
    expect(roles).toContain("access-control");
    expect(roles).toContain("static-analysis");
    expect(roles).toContain("business-logic");
    expect(roles).toContain("economic-oracle");
  });

  it("2. GET /benchmarks/:role returns the benchmark contract source and instructions", async () => {
    const res = await app.request("/benchmarks/reentrancy");
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.role).toBe("reentrancy");
    expect(data.contractName).toBe("BenchmarkReentrancyVault");
    expect(data.contractSource).toContain("contract BenchmarkReentrancyVault");
    expect(data.passingThreshold).toBe(80);
  });

  it("3. Reject qualification when candidate findings miss critical vulnerabilities", async () => {
    const fakeAgentId = "failing-agent";
    const incompleteFindings: Finding[] = [
      {
        id: "f1",
        title: "Some generic note",
        category: "info",
        severity: "low",
        location: "deposit",
        evidence: ["deposit() was called"],
        status: "proposed",
      },
    ];

    const res = await app.request("/agents/qualify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: fakeAgentId,
        name: "Failing Agent",
        role: "reentrancy",
        findings: incompleteFindings,
      }),
    });

    expect(res.status).toBe(422);
    const data = (await res.json()) as any;
    expect(data.ok).toBe(false);
    expect(data.passed).toBe(false);
    expect(data.score).toBeLessThan(80);
    expect(data.status).toBe("FAILED_EXAM");
    expect(data.evaluation.missedVulnerabilities.length).toBeGreaterThan(0);
  });

  it("4. Full lifecycle: Create fake agent, sign challenge, pass benchmark exam, anchor HCS proof, and register on Hedera", async () => {
    const fakeAgentId = `sentinel-agent-${Date.now()}`;
    const fakeAgentName = "Shadow Sentinel";
    const fakeHederaAccount = "0.0.10417469";

    // Step A: Request cryptographic challenge nonce
    const challengeRes = await app.request(`/agents/challenge?agentId=${fakeAgentId}&accountId=${fakeHederaAccount}`);
    expect(challengeRes.status).toBe(200);
    const challengeData = (await challengeRes.json()) as any;
    expect(challengeData.ok).toBe(true);
    expect(challengeData.challenge).toContain("SwarmProof Sovereign Agent Registration Challenge");

    // Step B: Sign challenge with private key
    const privKey = PrivateKey.generateED25519();
    const pubKey = privKey.publicKey;
    const signatureBytes = privKey.sign(Buffer.from(challengeData.challenge, "utf8"));
    const signatureHex = Buffer.from(signatureBytes).toString("hex");

    // Step C: Prepare accurate ground-truth findings for Reentrancy role
    const candidateFindings: Finding[] = [
      {
        id: "find_cei",
        title: "Critical CEI violation in withdraw: external call before balance deduction",
        category: "reentrancy",
        severity: "critical",
        location: "withdraw",
        evidence: ["(bool ok, ) = msg.sender.call{value: amount}(\"\") occurs before balances[msg.sender] -= amount"],
        status: "proposed",
      },
      {
        id: "find_cross",
        title: "Cross-function reentrancy vulnerability via external callback in transferCredit",
        category: "reentrancy",
        severity: "high",
        location: "transferCredit",
        evidence: ["to.call with onCreditReceived hook allows reentering withdraw()"],
        status: "proposed",
      },
    ];

    // Step D: Submit qualification request to POST /agents/qualify
    const qualifyRes = await app.request("/agents/qualify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: fakeAgentId,
        name: fakeAgentName,
        role: "reentrancy",
        paymentAddress: "0x3333333333333333333333333333333333333333",
        publicKey: pubKey.toStringRaw(),
        signature: signatureHex,
        challenge: challengeData.challenge,
        findings: candidateFindings,
        shape: "icosahedron",
        color: "#00f5ff",
      }),
    });

    expect(qualifyRes.status).toBe(200);
    const qualData = (await qualifyRes.json()) as any;

    expect(qualData.ok).toBe(true);
    expect(qualData.passed).toBe(true);
    expect(qualData.score).toBe(100);
    expect(qualData.status).toBe("ACTIVE_SPECIALIST");

    // Verify Hedera HCS Qualification Proof
    expect(qualData.qualificationProof).toBeDefined();
    expect(qualData.qualificationProof.hcsTopicId).toBeDefined();
    expect(qualData.qualificationProof.transactionId).toBeDefined();
    expect(qualData.qualificationProof.consensusTimestamp).toBeDefined();
    expect(qualData.qualificationProof.did).toContain(`did:hedera:testnet:`);
    expect(qualData.qualificationProof.did).toContain(fakeAgentId);

    // Verify W3C Verifiable Credential
    const vc = qualData.verifiableCredential;
    expect(vc).toBeDefined();
    expect(vc.type).toContain("SwarmSecurityAuditorCredential");
    expect(vc.credentialSubject.id).toBe(qualData.qualificationProof.did);
    expect(vc.credentialSubject.trustScore).toBe(100);
    expect(vc.proof.type).toBe("HederaHCSConsensusProof");
    expect(vc.proof.transactionId).toBe(qualData.qualificationProof.transactionId);

    // Step E: Verify GET /agents/:id/qualification returns the official proof
    const getQualRes = await app.request(`/agents/${fakeAgentId}/qualification`);
    expect(getQualRes.status).toBe(200);
    const getQualData = (await getQualRes.json()) as any;
    expect(getQualData.ok).toBe(true);
    expect(getQualData.qualification.agentId).toBe(fakeAgentId);
    expect(getQualData.qualification.benchmarkScore).toBe(100);
    expect(getQualData.qualification.passed).toBe(true);

    // Step F: Verify GET /agents includes the newly qualified specialist
    const agentsRes = await app.request("/agents");
    expect(agentsRes.status).toBe(200);
    const agentsData = (await agentsRes.json()) as any;
    const registeredAgent = agentsData.agents.find((a: any) => a.agentId === fakeAgentId);
    expect(registeredAgent).toBeDefined();
    expect(registeredAgent.name).toBe(fakeAgentName);
    expect(registeredAgent.status).toBe("ACTIVE_SPECIALIST");
    expect(registeredAgent.benchmarkScore).toBe(100);
    expect(registeredAgent.did).toContain(fakeAgentId);

    // Step G: Verify GET /agents/:id/did resolves W3C DID Document
    const didRes = await app.request(`/agents/${fakeAgentId}/did`);
    expect(didRes.status).toBe(200);
    const didDoc = (await didRes.json()) as any;
    expect(didDoc.id).toBe(qualData.qualificationProof.did);
    expect(didDoc.verificationMethod.length).toBeGreaterThan(0);
    expect(didDoc.service[0].paymentAddress).toBe("0x3333333333333333333333333333333333333333");

    // Step H: Verify GET /agents/:id/credential resolves W3C Verifiable Credential
    const credRes = await app.request(`/agents/${fakeAgentId}/credential`);
    expect(credRes.status).toBe(200);
    const credDoc = (await credRes.json()) as any;
    expect(credDoc.credentialSubject.agentId).toBe(fakeAgentId);
    expect(credDoc.proof.consensusTimestamp).toBeDefined();
  });
});
