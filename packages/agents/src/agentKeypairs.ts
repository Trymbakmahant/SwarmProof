import type { SpecialistId } from "./specialists.js";

/**
 * Authentic Sovereign Cryptographic Keypairs & Hedera Testnet Wallets
 * for the 10 SwarmProof Quorum Specialist Agents.
 *
 * Each agent possesses:
 * - A 32-byte SECP256k1 private key
 * - A compressed SECP256k1 public key
 * - A derived EVM checksummed wallet address
 * - A dedicated Hedera testnet account ID (0.0.10417470 - 0.0.10417479)
 * - An immutable W3C DID anchored to Hedera Topic 0.0.10417469
 */

export interface SpecialistKeypair {
  id: SpecialistId;
  name: string;
  privateKey: string;
  publicKey: string;
  evmAddress: string;
  hederaAccountId: string;
  did: string;
}

export const SPECIALIST_KEYPAIRS: Record<SpecialistId, SpecialistKeypair> = {
  "reentrancy-agent": {
    id: "reentrancy-agent",
    name: "Reentrancy Specialist Agent",
    privateKey: "0xb92fb70568ec792b52c7b379dca723635cb90ae548b828e5314a34f7be45b3ed",
    publicKey: "0x02818c434957c13ebd4d26fbe278e865d0eafd20ea19fc0a5d0f7bcc2749f7f497",
    evmAddress: "0xDe02bF11bcB20ce22fB4ED79A4fdED7029B445aC",
    hederaAccountId: "0.0.10520075",
    did: "did:hedera:testnet:0.0.10417469_reentrancy-agent",
  },
  "access-control-agent": {
    id: "access-control-agent",
    name: "Access Control Specialist Agent",
    privateKey: "0xf1268d4b175483e5efb22ffc65b91ada118d0de8a2baeb4245f8566aabd6e425",
    publicKey: "0x03859b02b80c448a79d96754a51c59949df6649635fb14a3542594b683371355cd",
    evmAddress: "0xf392fD0a0Ead69bA5737FDB004865c9aB1ef0A2B",
    hederaAccountId: "0.0.10520076",
    did: "did:hedera:testnet:0.0.10417469_access-control-agent",
  },
  "business-logic-agent": {
    id: "business-logic-agent",
    name: "Business Logic Specialist Agent",
    privateKey: "0xeab88b9515275e451896f36f647e8cd3c04b96ae5218fce6609d80e031352248",
    publicKey: "0x03652bed70ecc9c1b4f21138fd17e60a75dcad00afaa0ec6f48f2bc17130aa6406",
    evmAddress: "0xf4CC56886290062EFd0F0C6b558e0d482E011A09",
    hederaAccountId: "0.0.10520078",
    did: "did:hedera:testnet:0.0.10417469_business-logic-agent",
  },
  "economic-agent": {
    id: "economic-agent",
    name: "Economic Security Agent",
    privateKey: "0x0ec2437e1d9e73320b0c5e3116ecb019fa7736d5c62155bf8b78469fd49e7427",
    publicKey: "0x02953e88d03313257fc8bb865fe39be34e281538e6174f090b90214421611413a5",
    evmAddress: "0x7D3dF4B8daF4083De1400E7ACbC4cAb13ce303FC",
    hederaAccountId: "0.0.10520079",
    did: "did:hedera:testnet:0.0.10417469_economic-agent",
  },
  "static-agent": {
    id: "static-agent",
    name: "Static Analysis Agent",
    privateKey: "0xc125cadda67ece1268e56ee30790eddc0d6e495dd37e9a1ccaad643d9b2c9070",
    publicKey: "0x033488e0b2c2cc6c352cfd3d0d4c09e4e6b4522432b09e5ce8d568179710f88661",
    evmAddress: "0x527b3a9fC6d870D3a754f947137f25D430929000",
    hederaAccountId: "0.0.10417474",
    did: "did:hedera:testnet:0.0.10417469_static-agent",
  },
  "reentrancy-sentinel": {
    id: "reentrancy-sentinel",
    name: "Reentrancy Sentinel",
    privateKey: "0x729dfc7667d9f5d1b48f831acfee74cd5e9bec090ff9f8867b357146cc2fe90c",
    publicKey: "0x02fa1a11ce15e8ebbe396a099a228ccb678c892608c0ac7c4927f4de3489adebf2",
    evmAddress: "0x36Bd630e48470FD667595bd3d1C451CfA7AC01a0",
    hederaAccountId: "0.0.10520081",
    did: "did:hedera:testnet:0.0.10417469_reentrancy-sentinel",
  },
  "access-sentinel": {
    id: "access-sentinel",
    name: "Access Sentinel",
    privateKey: "0xa0e4c37f2a1ef3c78eeca0b5b37591af37f6c3a1ce5758095ff1443eee77fd14",
    publicKey: "0x0207e27a553f329f3bb567047d1506ad9405cd797d7f9010804f231bf0fa942c3e",
    evmAddress: "0x0a131f972F48217Ee429790881E4FA1182B46EE8",
    hederaAccountId: "0.0.10520082",
    did: "did:hedera:testnet:0.0.10417469_access-sentinel",
  },
  "invariant-agent": {
    id: "invariant-agent",
    name: "Invariant Agent",
    privateKey: "0xcc68184695a8386cd11a62d5aadc92c7a45e2706c02d1bf043764adf90eb1824",
    publicKey: "0x03f9f4c4565b3ebb1e5210d4e7c49a637d113c88157b4886357eb2bdef31692e99",
    evmAddress: "0x2EaA410c5c0eee48492D9924E9BE1868D45Fe07d",
    hederaAccountId: "0.0.10520083",
    did: "did:hedera:testnet:0.0.10417469_invariant-agent",
  },
  "mev-sentinel": {
    id: "mev-sentinel",
    name: "MEV Sentinel",
    privateKey: "0x6461b8d976a8bb14233059ac834b52f9045e1816e56a3a3a836b74fe8e1c07ab",
    publicKey: "0x02e8710a01b9cc44bc03fdacbbfe3c6ef7dae892a5bb78d1298737db846c519cfa",
    evmAddress: "0x80A8FD5e063b4e32Ea78841e820308A5EDD942a4",
    hederaAccountId: "0.0.10520085",
    did: "did:hedera:testnet:0.0.10417469_mev-sentinel",
  },
  "bytecode-verifier": {
    id: "bytecode-verifier",
    name: "Bytecode Verifier",
    privateKey: "0x303bbb9471a953002e6a927811d0e8c08ff6529f8b9d44f8ac78c39b7beb1bb9",
    publicKey: "0x031d5750c57af06785752f565de522c3c9918f9119a7c9059b3614e30b584fea21",
    evmAddress: "0xAD93DcbBB2c56e21cB94a1582f4F824edc1978Dd",
    hederaAccountId: "0.0.10520086",
    did: "did:hedera:testnet:0.0.10417469_bytecode-verifier",
  },
};

export function getSpecialistKeypair(agentId: string): SpecialistKeypair | undefined {
  return SPECIALIST_KEYPAIRS[agentId as SpecialistId];
}

export const SPECIALIST_PAYMENT_ADDRESSES: Record<SpecialistId, string> = {
  "reentrancy-agent": SPECIALIST_KEYPAIRS["reentrancy-agent"].hederaAccountId,
  "access-control-agent": SPECIALIST_KEYPAIRS["access-control-agent"].hederaAccountId,
  "business-logic-agent": SPECIALIST_KEYPAIRS["business-logic-agent"].hederaAccountId,
  "economic-agent": SPECIALIST_KEYPAIRS["economic-agent"].hederaAccountId,
  "static-agent": SPECIALIST_KEYPAIRS["static-agent"].hederaAccountId,
  "reentrancy-sentinel": SPECIALIST_KEYPAIRS["reentrancy-sentinel"].hederaAccountId,
  "access-sentinel": SPECIALIST_KEYPAIRS["access-sentinel"].hederaAccountId,
  "invariant-agent": SPECIALIST_KEYPAIRS["invariant-agent"].hederaAccountId,
  "mev-sentinel": SPECIALIST_KEYPAIRS["mev-sentinel"].hederaAccountId,
  "bytecode-verifier": SPECIALIST_KEYPAIRS["bytecode-verifier"].hederaAccountId,
};

export const SPECIALIST_EVM_ADDRESSES: Record<SpecialistId, string> = {
  "reentrancy-agent": SPECIALIST_KEYPAIRS["reentrancy-agent"].evmAddress,
  "access-control-agent": SPECIALIST_KEYPAIRS["access-control-agent"].evmAddress,
  "business-logic-agent": SPECIALIST_KEYPAIRS["business-logic-agent"].evmAddress,
  "economic-agent": SPECIALIST_KEYPAIRS["economic-agent"].evmAddress,
  "static-agent": SPECIALIST_KEYPAIRS["static-agent"].evmAddress,
  "reentrancy-sentinel": SPECIALIST_KEYPAIRS["reentrancy-sentinel"].evmAddress,
  "access-sentinel": SPECIALIST_KEYPAIRS["access-sentinel"].evmAddress,
  "invariant-agent": SPECIALIST_KEYPAIRS["invariant-agent"].evmAddress,
  "mev-sentinel": SPECIALIST_KEYPAIRS["mev-sentinel"].evmAddress,
  "bytecode-verifier": SPECIALIST_KEYPAIRS["bytecode-verifier"].evmAddress,
};
