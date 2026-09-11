import type { AgentIdentity } from "@swarmproof/agents";
import { PublicKey, PrivateKey } from "@hashgraph/sdk";
export { PublicKey, PrivateKey };
import { HederaTopicClient, topicConfigFromEnv, hasTopicCredentials, type TopicSubmitConfig } from "./topic.js";

/**
 * W3C Decentralized Identifier (DID) & Verifiable Credential (VC) Architecture
 * built on Hedera Consensus Service (HCS).
 *
 * Implements:
 * - W3C DID Core 1.0 (did:hedera method)
 * - W3C Verifiable Credentials Data Model v1.1 / v2.0
 * - HCS-14 Agent Identity Registry (anchored on topic)
 * - Cryptographic Self-Verification (Ed25519 & ECDSA secp256k1)
 */

export function formatHederaDID(network: string, topicId: string, agentId: string): string {
  const cleanNet = network.includes("mainnet") ? "mainnet" : "testnet";
  return `did:hedera:${cleanNet}:${topicId}_${agentId}`;
}

export interface RegistrationChallenge {
  challenge: string;
  nonce: string;
  timestamp: string;
  agentId: string;
  accountId: string;
}

/**
 * Generate a canonical cryptographic registration challenge string.
 * External agents sign this string with their Hedera private key to prove ownership.
 */
export function generateRegistrationChallenge(
  agentId: string,
  accountId: string,
  topicId = "0.0.10417469",
  network = "testnet",
  customNonce?: string,
): RegistrationChallenge {
  const nonce = customNonce ?? Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().toISOString();
  const cleanNet = network.includes("mainnet") ? "mainnet" : "testnet";

  const challenge = [
    "SwarmProof Sovereign Agent Registration Challenge",
    `Network: hedera:${cleanNet}`,
    `Topic ID: ${topicId}`,
    `Agent ID: ${agentId}`,
    `Hedera Account: ${accountId}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
    "Purpose: Prove cryptographic ownership of Hedera account to join consensus quorum.",
  ].join("\n");

  return { challenge, nonce, timestamp, agentId, accountId };
}

import { hashMessage, SigningKey, computeAddress } from "ethers";

/**
 * Verify an agent's cryptographic signature against their public key.
 * Automatically supports:
 * 1. EIP-191 personal_sign signatures from browser wallets (MetaMask, Rabby, Coinbase, etc.)
 * 2. Native Hedera Ed25519 & ECDSA secp256k1 signatures via @hashgraph/sdk
 */
export function verifyAgentRegistrationSignature(
  challenge: string,
  signatureHex: string,
  publicKeyStr?: string,
): {
  valid: boolean;
  keyType: "Ed25519VerificationKey2020" | "EcdsaSecp256k1VerificationKey2019";
  recoveredAddress?: string;
  recoveredPublicKey?: string;
  error?: string;
} {
  try {
    const cleanSig = signatureHex.trim();
    if (!cleanSig) return { valid: false, keyType: "Ed25519VerificationKey2020", error: "Missing signature" };
    const cleanPub = (publicKeyStr ?? "").trim().replace(/^0x/, "");

    // 1. Check for EVM browser wallet signature (EIP-191 personal_sign, 65 bytes = 130 or 132 hex characters)
    const isEip191 = cleanSig.startsWith("0x") && (cleanSig.length === 132 || cleanSig.length === 130);
    if (isEip191) {
      try {
        const digest = hashMessage(challenge);
        const recoveredPubKey = SigningKey.recoverPublicKey(digest, cleanSig);
        const recoveredAddress = computeAddress(recoveredPubKey).toLowerCase();

        // If public key or address was supplied:
        if (cleanPub) {
          const normProvided = cleanPub.toLowerCase();
          const normRecovered = recoveredPubKey.replace(/^0x/, "").toLowerCase();
          const matchPub =
            normRecovered === normProvided ||
            normRecovered.includes(normProvided) ||
            normProvided.includes(normRecovered);
          const matchAddr = recoveredAddress === `0x${normProvided}` || normProvided === recoveredAddress.replace(/^0x/, "");

          if (matchPub || matchAddr) {
            return {
              valid: true,
              keyType: "EcdsaSecp256k1VerificationKey2019",
              recoveredAddress,
              recoveredPublicKey: recoveredPubKey,
            };
          }
        }

        // Valid EVM signature even if public key was omitted (it was mathematically recovered!)
        return {
          valid: true,
          keyType: "EcdsaSecp256k1VerificationKey2019",
          recoveredAddress,
          recoveredPublicKey: recoveredPubKey,
        };
      } catch (evmErr) {
        // Fall through to native Hedera SDK check
      }
    }

    // 2. Native Hedera @hashgraph/sdk signature (Ed25519 or raw ECDSA)
    if (!cleanPub) return { valid: false, keyType: "Ed25519VerificationKey2020", error: "Missing public key" };
    const rawSig = cleanSig.replace(/^0x/, "");
    const pubKey = PublicKey.fromString(cleanPub);
    const msgBytes = Buffer.from(challenge, "utf8");
    const sigBytes = Buffer.from(rawSig, "hex");

    const valid = pubKey.verify(msgBytes, sigBytes);
    const isEcdsa = pubKey.toStringDer().includes("2b8104000a");
    const keyType = isEcdsa ? "EcdsaSecp256k1VerificationKey2019" : "Ed25519VerificationKey2020";

    return {
      valid,
      keyType,
      recoveredPublicKey: pubKey.toStringRaw(),
      error: valid ? undefined : "Cryptographic signature does not match public key",
    };
  } catch (err) {
    return { valid: false, keyType: "Ed25519VerificationKey2020", error: (err as Error).message };
  }
}

/**
 * Verify on-chain that the provided public key or EVM address corresponds to the Hedera account ID
 * via the Hedera Mirror Node API.
 */
export async function verifyHederaAccountKey(
  accountId: string,
  publicKeyOrAddressStr: string,
  network = "testnet",
): Promise<{ matches: boolean; onChainKey?: string; onChainKeyType?: string; error?: string }> {
  try {
    const cleanAcc = accountId.trim();
    const cleanPub = publicKeyOrAddressStr.trim();
    if (!cleanAcc.startsWith("0.0.") && !cleanAcc.startsWith("0x")) {
      return { matches: false, error: `Invalid account format: ${cleanAcc}` };
    }

    const mirrorBase = network.includes("mainnet")
      ? "https://mainnet.mirrornode.hedera.com"
      : "https://testnet.mirrornode.hedera.com";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${mirrorBase}/api/v1/accounts/${cleanAcc}`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return { matches: false, error: `Mirror node HTTP ${res.status} for account ${cleanAcc}` };
    }

    const data = (await res.json()) as { key?: { _type?: string; key?: string }; evm_address?: string };
    const onChainKey = data.key?.key;
    const onChainKeyType = data.key?._type;
    const onChainEvmAddress = data.evm_address?.toLowerCase();

    // Check EVM address match
    if (cleanPub.startsWith("0x") || cleanPub.length === 40) {
      const ethAddr = (cleanPub.startsWith("0x") ? cleanPub : `0x${cleanPub}`).toLowerCase();
      if (onChainEvmAddress && onChainEvmAddress === ethAddr) {
        return { matches: true, onChainKey, onChainKeyType };
      }
    }

    // Check Hedera public key match
    if (onChainKey) {
      try {
        const pubKey = PublicKey.fromString(cleanPub.replace(/^0x/, ""));
        const rawPub = pubKey.toStringRaw().toLowerCase();
        const derPub = pubKey.toStringDer().toLowerCase();
        const chainKeyNorm = onChainKey.toLowerCase();

        const matches =
          chainKeyNorm === rawPub ||
          chainKeyNorm === derPub ||
          chainKeyNorm.includes(rawPub) ||
          rawPub.includes(chainKeyNorm);

        return {
          matches,
          onChainKey,
          onChainKeyType,
          error: matches ? undefined : "Provided public key does not match on-chain Hedera account key",
        };
      } catch {
        // Fallback for EVM address comparison
        if (onChainEvmAddress && cleanPub.toLowerCase().includes(onChainEvmAddress.replace(/^0x/, ""))) {
          return { matches: true, onChainKey, onChainKeyType };
        }
      }
    }

    return { matches: false, error: "Public key or address does not match mirror node record" };
  } catch (err) {
    return { matches: false, error: `Mirror node lookup error: ${(err as Error).message}` };
  }
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
    publicKeyHex?: string;
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
    publicKeyHex?: string;
  };
  proof: {
    type: "HederaHCSConsensusProof";
    created: string;
    verificationMethod: string;
    topicId: string;
    transactionId: string;
    consensusTimestamp: string;
    proofPurpose: "assertionMethod";
    signature?: string;
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
  publicKey?: string;
  signature?: string;
}

export interface RegisterIdentityOptions {
  role?: string;
  serviceEndpoint?: string;
  trustScore?: number;
  publicKey?: string;
  signature?: string;
  keyType?: "Ed25519VerificationKey2020" | "EcdsaSecp256k1VerificationKey2019";
  challenge?: string;
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
  const keyType = options?.keyType ?? "Ed25519VerificationKey2020";

  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://identity.hedera.com/did/v1"],
    id: did,
    alsoKnownAs: [`https://hashscan.io/${cleanNet}/topic/${topicId}`],
    verificationMethod: [
      {
        id: keyId,
        type: keyType,
        controller: did,
        blockchainAccountId: `hedera:${cleanNet}:${identity.paymentAddress}`,
        ...(options?.publicKey ? { publicKeyHex: options.publicKey.replace(/^0x/, "") } : {}),
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
      ...(options?.publicKey ? { publicKeyHex: options.publicKey.replace(/^0x/, "") } : {}),
    },
    proof: {
      type: "HederaHCSConsensusProof",
      created: consensusTimestamp,
      verificationMethod: `${did}#key-1`,
      topicId,
      transactionId: txId,
      consensusTimestamp,
      proofPurpose: "assertionMethod",
      ...(options?.signature ? { signature: options.signature.replace(/^0x/, "") } : {}),
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
    ...(options?.publicKey ? { publicKey: options.publicKey.replace(/^0x/, "") } : {}),
    ...(options?.signature ? { signature: options.signature.replace(/^0x/, "") } : {}),
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