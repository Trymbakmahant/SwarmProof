import type { AgentIdentity } from "@swarmproof/agents";
import { HederaTopicClient, topicConfigFromEnv, hasTopicCredentials, type TopicSubmitConfig } from "./topic.js";

/**
 * W3C Decentralized Identifier (DID) & Verifiable Credential (VC) Architecture
 * built on Hedera Consensus Service (HCS).
 *
 * Implements:
 * - W3C DID Core 1.0 (did:hedera method)
 * - W3C Verifiable Credentials Data Model v1.1 / v2.0
 * - HCS-14 Agent Identity Registry (anchored on topic)
 */

export function formatHederaDID(network: string, topicId: string, agentId: string): string {
  const cleanNet = network.includes("mainnet") ? "mainnet" : "testnet";
  return `did:hedera:${cleanNet}:${topicId}_${agentId}`;
}

export interface AgentDIDDocument {
  "@context": ["https://www.w3.org/ns/did/v1", "https://identity.hedera.com/did/v1"];
  id: string; // e.g. did:hedera:testnet:0.0.10417469_mev-sentinel
  alsoKnownAs?: string[];
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    blockchainAccountId: string;
  }>;
  authentication: string[];
  assertionMethod: string[];
  service: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
    description: string;
    paymentAddress: string;
    capabilities: string[];
  }>;
}

export interface AgentVerifiableCredential {
  "@context": ["https://www.w3.org/2018/credentials/v1", "https://identity.hedera.com/vc/v1"];
  id: string; // e.g. vc:hedera:testnet:0.0.10417469:mev-sentinel
  type: ["VerifiableCredential", "SwarmSecurityAuditorCredential"];
  issuer: {
    id: string; // e.g. did:hedera:testnet:0.0.10417469
    name: string;
  };
  issuanceDate: string;
  credentialSubject: {
    id: string; // did:hedera:...
    agentId: string;
    name: string;
    role: string;
    capabilities: string[];
    paymentAddress: string;
    authorizedQuorum: boolean;
    trustScore: number;
    auditSpecialty: string;
  };
  proof: {
    type: "HederaHCSConsensusProof";
    created: string;
    verificationMethod: string;
    topicId: string;
    transactionId: string;
    consensusTimestamp: string;
    proofPurpose: "assertionMethod";
  };
}

export interface HCS14IdentityMessage {
  type: "hcs-14.identity";
  version: "2";
  did: string;
  agentId: string;
  name: string;
  agentVersion: string;
  capabilities: string[];
  paymentAddress: string;
  credentialId: string;
  service: "swarmproof";
  timestamp: string;
}

export interface RegisterIdentityOptions {
  role?: string;
  serviceEndpoint?: string;
  trustScore?: number;
}

export function buildDIDDocument(
  network: string,
  topicId: string,
  identity: AgentIdentity,
  options?: RegisterIdentityOptions,
): AgentDIDDocument {
  const did = formatHederaDID(network, topicId, identity.agentId);
  const keyId = `${did}#key-1`;
  const cleanNet = network.includes("mainnet") ? "mainnet" : "testnet";

  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://identity.hedera.com/did/v1"],
    id: did,
    alsoKnownAs: [`https://hashscan.io/${cleanNet}/topic/${topicId}`],
    verificationMethod: [
      {
        id: keyId,
        type: "Ed25519VerificationKey2020",
        controller: did,
        blockchainAccountId: `hedera:${cleanNet}:${identity.paymentAddress}`,
      },
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
    service: [
      {
        id: `${did}#security-audit-agent`,
        type: "SecurityAuditAgent",
        serviceEndpoint: options?.serviceEndpoint ?? `http://localhost:3001/agents/${identity.agentId}`,
        description: options?.role ?? "Autonomous Smart Contract Security Specialist Agent",
        paymentAddress: identity.paymentAddress,
        capabilities: identity.capabilities ?? [],
      },
    ],
  };
}

export function buildVerifiableCredential(
  network: string,
  topicId: string,
  identity: AgentIdentity,
  txId: string,
  consensusTimestamp: string,
  options?: RegisterIdentityOptions,
): AgentVerifiableCredential {
  const did = formatHederaDID(network, topicId, identity.agentId);
  const cleanNet = network.includes("mainnet") ? "mainnet" : "testnet";

  return {
    "@context": ["https://www.w3.org/2018/credentials/v1", "https://identity.hedera.com/vc/v1"],
    id: `vc:hedera:${cleanNet}:${topicId}:${identity.agentId}`,
    type: ["VerifiableCredential", "SwarmSecurityAuditorCredential"],
    issuer: {
      id: `did:hedera:${cleanNet}:${topicId}`,
      name: "SwarmProof Decentralized Security Quorum",
    },
    issuanceDate: consensusTimestamp,
    credentialSubject: {
      id: did,
      agentId: identity.agentId,
      name: identity.name,
      role: options?.role ?? "Smart Contract Security Specialist",
      capabilities: identity.capabilities ?? [],
      paymentAddress: identity.paymentAddress,
      authorizedQuorum: true,
      trustScore: options?.trustScore ?? 98.5,
      auditSpecialty: identity.capabilities?.[0] ?? "security-auditing",
    },
    proof: {
      type: "HederaHCSConsensusProof",
      created: consensusTimestamp,
      verificationMethod: `${did}#key-1`,
      topicId,
      transactionId: txId,
      consensusTimestamp,
      proofPurpose: "assertionMethod",
    },
  };
}

export function buildIdentityMessage(
  network: string,
  topicId: string,
  identity: AgentIdentity,
  options?: RegisterIdentityOptions,
): HCS14IdentityMessage {
  const did = formatHederaDID(network, topicId, identity.agentId);
  const cleanNet = network.includes("mainnet") ? "mainnet" : "testnet";
  return {
    type: "hcs-14.identity",
    version: "2",
    did,
    agentId: identity.agentId,
    name: identity.name,
    agentVersion: identity.version ?? "1.0.0",
    capabilities: identity.capabilities ?? [],
    paymentAddress: identity.paymentAddress,
    credentialId: `vc:hedera:${cleanNet}:${topicId}:${identity.agentId}`,
    service: "swarmproof",
    timestamp: new Date().toISOString(),
  };
}

export interface IdentityRegistration {
  agentId: string;
  did: string;
  hcsTopicId: string;
  transactionId: string;
  consensusTimestamp: string;
  message: HCS14IdentityMessage;
  didDocument: AgentDIDDocument;
  verifiableCredential: AgentVerifiableCredential;
}

export interface IdentityRegistrar {
  readonly mode: "mock" | "hedera";
  readonly topicId: string;
  readonly network: string;
  register(identity: AgentIdentity, options?: RegisterIdentityOptions): Promise<IdentityRegistration>;
  lastRegistration(agentId: string): IdentityRegistration | undefined;
  resolveDID(didUriOrAgentId: string): AgentDIDDocument | undefined;
  getCredential(agentId: string): AgentVerifiableCredential | undefined;
  allRegistrations(): IdentityRegistration[];
}

export class MockIdentityRegistrar implements IdentityRegistrar {
  readonly mode = "mock" as const;
  readonly topicId: string;
  readonly network: string;
  private registrations = new Map<string, IdentityRegistration>();
  private seq = 0;

  constructor(topicId = "0.0.mock-identity-topic", network = "testnet") {
    this.topicId = topicId;
    this.network = network;
  }

  async register(identity: AgentIdentity, options?: RegisterIdentityOptions): Promise<IdentityRegistration> {
    this.seq += 1;
    const txId = `0.0.idtrx-${this.seq}-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const did = formatHederaDID(this.network, this.topicId, identity.agentId);

    const message = buildIdentityMessage(this.network, this.topicId, identity, options);
    const didDocument = buildDIDDocument(this.network, this.topicId, identity, options);
    const verifiableCredential = buildVerifiableCredential(
      this.network,
      this.topicId,
      identity,
      txId,
      timestamp,
      options,
    );

    const registration: IdentityRegistration = {
      agentId: identity.agentId,
      did,
      hcsTopicId: this.topicId,
      transactionId: txId,
      consensusTimestamp: timestamp,
      message,
      didDocument,
      verifiableCredential,
    };
    this.registrations.set(identity.agentId, registration);
    return registration;
  }

  lastRegistration(agentId: string): IdentityRegistration | undefined {
    return this.registrations.get(agentId);
  }

  resolveDID(didUriOrAgentId: string): AgentDIDDocument | undefined {
    for (const reg of this.registrations.values()) {
      if (reg.did === didUriOrAgentId || reg.agentId === didUriOrAgentId) {
        return reg.didDocument;
      }
    }
    return undefined;
  }

  getCredential(agentId: string): AgentVerifiableCredential | undefined {
    return this.registrations.get(agentId)?.verifiableCredential;
  }

  allRegistrations(): IdentityRegistration[] {
    return Array.from(this.registrations.values());
  }
}

export class HederaIdentityRegistrar implements IdentityRegistrar {
  readonly mode = "hedera" as const;
  readonly topicId: string;
  readonly network: string;
  private registrations = new Map<string, IdentityRegistration>();

  constructor(private readonly config: TopicSubmitConfig, private readonly submitDelayMs = 2000) {
    this.topicId = config.topicId;
    this.network = config.network ?? "testnet";
  }

  async register(identity: AgentIdentity, options?: RegisterIdentityOptions): Promise<IdentityRegistration> {
    const did = formatHederaDID(this.network, this.topicId, identity.agentId);
    const message = buildIdentityMessage(this.network, this.topicId, identity, options);

    // Anchor the identity message to Hedera Consensus Service Topic
    const topic = new HederaTopicClient(this.config, this.submitDelayMs);
    const submitted = await topic.submit(JSON.stringify(message));

    const didDocument = buildDIDDocument(this.network, this.topicId, identity, options);
    const verifiableCredential = buildVerifiableCredential(
      this.network,
      this.topicId,
      identity,
      submitted.transactionId,
      submitted.consensusTimestamp,
      options,
    );

    const registration: IdentityRegistration = {
      agentId: identity.agentId,
      did,
      hcsTopicId: this.topicId,
      transactionId: submitted.transactionId,
      consensusTimestamp: submitted.consensusTimestamp,
      message,
      didDocument,
      verifiableCredential,
    };

    this.registrations.set(identity.agentId, registration);
    return registration;
  }

  lastRegistration(agentId: string): IdentityRegistration | undefined {
    return this.registrations.get(agentId);
  }

  resolveDID(didUriOrAgentId: string): AgentDIDDocument | undefined {
    for (const reg of this.registrations.values()) {
      if (reg.did === didUriOrAgentId || reg.agentId === didUriOrAgentId) {
        return reg.didDocument;
      }
    }
    return undefined;
  }

  getCredential(agentId: string): AgentVerifiableCredential | undefined {
    return this.registrations.get(agentId)?.verifiableCredential;
  }

  allRegistrations(): IdentityRegistration[] {
    return Array.from(this.registrations.values());
  }
}

export function createIdentityRegistrar(env: NodeJS.ProcessEnv = process.env): IdentityRegistrar {
  const config = topicConfigFromEnv(env);
  if (hasTopicCredentials(config)) return new HederaIdentityRegistrar(config);
  return new MockIdentityRegistrar();
}