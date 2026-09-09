import { describe, it, expect } from "vitest";
import {
  formatHederaDID,
  buildDIDDocument,
  buildVerifiableCredential,
  MockIdentityRegistrar,
} from "@swarmproof/hedera";
import type { AgentIdentity } from "@swarmproof/agents";

describe("W3C Decentralized Identity & Verifiable Credentials on Hedera", () => {
  const testIdentity: AgentIdentity = {
    agentId: "mev-sentinel",
    name: "MEV & Flash Loan Sentinel",
    version: "1.0.0",
    capabilities: ["flash-loan", "oracle-manipulation", "sandwich-attacks"],
    paymentAddress: "0.0.10417474",
  };

  it("formats compliant W3C did:hedera URIs", () => {
    const did = formatHederaDID("testnet", "0.0.10417469", "mev-sentinel");
    expect(did).toBe("did:hedera:testnet:0.0.10417469_mev-sentinel");
  });

  it("constructs compliant W3C DID Core 1.0 Documents", () => {
    const doc = buildDIDDocument("testnet", "0.0.10417469", testIdentity, {
      role: "Flash Loan Arbitrage & Slippage Protection",
      serviceEndpoint: "http://localhost:3001/agents/mev-sentinel",
    });

    expect(doc["@context"]).toContain("https://www.w3.org/ns/did/v1");
    expect(doc["@context"]).toContain("https://identity.hedera.com/did/v1");
    expect(doc.id).toBe("did:hedera:testnet:0.0.10417469_mev-sentinel");
    expect(doc.verificationMethod).toHaveLength(1);
    expect(doc.verificationMethod[0]?.blockchainAccountId).toBe("hedera:testnet:0.0.10417474");
    expect(doc.authentication).toContain("did:hedera:testnet:0.0.10417469_mev-sentinel#key-1");
    expect(doc.service[0]?.type).toBe("SecurityAuditAgent");
    expect(doc.service[0]?.capabilities).toContain("flash-loan");
  });

  it("constructs compliant W3C Verifiable Credentials with HCS consensus proof", () => {
    const vc = buildVerifiableCredential(
      "testnet",
      "0.0.10417469",
      testIdentity,
      "0.0.10119346@1789021885.521714338",
      "2026-09-10T06:31:30.510Z",
      { role: "Flash Loan Arbitrage Specialist" },
    );

    expect(vc["@context"]).toContain("https://www.w3.org/2018/credentials/v1");
    expect(vc.type).toContain("VerifiableCredential");
    expect(vc.type).toContain("SwarmSecurityAuditorCredential");
    expect(vc.issuer.id).toBe("did:hedera:testnet:0.0.10417469");
    expect(vc.credentialSubject.id).toBe("did:hedera:testnet:0.0.10417469_mev-sentinel");
    expect(vc.credentialSubject.authorizedQuorum).toBe(true);
    expect(vc.proof.type).toBe("HederaHCSConsensusProof");
    expect(vc.proof.topicId).toBe("0.0.10417469");
    expect(vc.proof.transactionId).toBe("0.0.10119346@1789021885.521714338");
    expect(vc.proof.consensusTimestamp).toBe("2026-09-10T06:31:30.510Z");
  });

  it("MockIdentityRegistrar registers agent and resolves W3C DID Document & Credential", async () => {
    const registrar = new MockIdentityRegistrar("0.0.10417469", "testnet");
    const reg = await registrar.register(testIdentity, {
      role: "Flash Loan Arbitrage Specialist",
    });

    expect(reg.did).toBe("did:hedera:testnet:0.0.10417469_mev-sentinel");
    expect(reg.hcsTopicId).toBe("0.0.10417469");
    expect(reg.transactionId).toMatch(/^0\.0\.idtrx-/);

    // Resolve DID
    const resolved = registrar.resolveDID("did:hedera:testnet:0.0.10417469_mev-sentinel");
    expect(resolved).toBeDefined();
    expect(resolved?.id).toBe("did:hedera:testnet:0.0.10417469_mev-sentinel");

    // Get Credential
    const cred = registrar.getCredential("mev-sentinel");
    expect(cred).toBeDefined();
    expect(cred?.credentialSubject.agentId).toBe("mev-sentinel");
  });
});
