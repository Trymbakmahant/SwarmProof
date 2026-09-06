import type { AgentIdentity } from "@swarmproof/agents";
import { HederaTopicClient, topicConfigFromEnv, hasTopicCredentials, type TopicSubmitConfig } from "./topic.js";

/**
 * HCS-14 flavored agent identity — the "on-chain agent identity" extra point.
 * Every SwarmProof specialist (and any registered plugin agent) can publish a
 * canonical identity message to the HCS topic. Consumers look it up on the
 * mirror node to verify who is charging how much for what.
 */

export interface HCS14IdentityMessage {
  type: "hcs-14.identity";
  version: "1";
  agentId: string;
  name: string;
  /** The agent's own semver (not the message format version). */
  agentVersion: string;
  capabilities: string[];
  paymentAddress: string;
  service: "swarmproof";
  timestamp: string;
}

export function buildIdentityMessage(identity: AgentIdentity): HCS14IdentityMessage {
  return {
    type: "hcs-14.identity",
    version: "1",
    agentId: identity.agentId,
    name: identity.name,
    agentVersion: identity.version ?? "1.0.0",
    capabilities: identity.capabilities ?? [],
    paymentAddress: identity.paymentAddress,
    service: "swarmproof",
    timestamp: new Date().toISOString(),
  };
}

export interface IdentityRegistration {
  agentId: string;
  hcsTopicId: string;
  transactionId: string;
  consensusTimestamp: string;
  message: HCS14IdentityMessage;
}

export interface IdentityRegistrar {
  readonly mode: "mock" | "hedera";
  readonly topicId: string;
  register(identity: AgentIdentity): Promise<IdentityRegistration>;
  /** Last registration per agentId (mock = memory; hedera = cache of last submit). */
  lastRegistration(agentId: string): IdentityRegistration | undefined;
}

export class MockIdentityRegistrar implements IdentityRegistrar {
  readonly mode = "mock" as const;
  readonly topicId: string;
  private registrations = new Map<string, IdentityRegistration>();
  private seq = 0;

  constructor(topicId = "0.0.mock-identity-topic") {
    this.topicId = topicId;
  }

  async register(identity: AgentIdentity): Promise<IdentityRegistration> {
    this.seq += 1;
    const registration: IdentityRegistration = {
      agentId: identity.agentId,
      hcsTopicId: this.topicId,
      transactionId: `0.0.idtrx-${this.seq}-${Date.now()}`,
      consensusTimestamp: new Date().toISOString(),
      message: buildIdentityMessage(identity),
    };
    this.registrations.set(identity.agentId, registration);
    return registration;
  }

  lastRegistration(agentId: string): IdentityRegistration | undefined {
    return this.registrations.get(agentId);
  }
}

export class HederaIdentityRegistrar implements IdentityRegistrar {
  readonly mode = "hedera" as const;
  readonly topicId: string;
  private registrations = new Map<string, IdentityRegistration>();

  constructor(private readonly config: TopicSubmitConfig, private readonly submitDelayMs = 2000) {
    this.topicId = config.topicId;
  }

  async register(identity: AgentIdentity): Promise<IdentityRegistration> {
    const message = buildIdentityMessage(identity);
    const topic = new HederaTopicClient(this.config, this.submitDelayMs);
    const submitted = await topic.submit(JSON.stringify(message));
    const registration: IdentityRegistration = {
      agentId: identity.agentId,
      hcsTopicId: this.topicId,
      transactionId: submitted.transactionId,
      consensusTimestamp: submitted.consensusTimestamp,
      message,
    };
    this.registrations.set(identity.agentId, registration);
    return registration;
  }

  lastRegistration(agentId: string): IdentityRegistration | undefined {
    return this.registrations.get(agentId);
  }
}

export function createIdentityRegistrar(env: NodeJS.ProcessEnv = process.env): IdentityRegistrar {
  const config = topicConfigFromEnv(env);
  if (hasTopicCredentials(config)) return new HederaIdentityRegistrar(config);
  return new MockIdentityRegistrar();
}