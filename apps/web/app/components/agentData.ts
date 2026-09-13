export interface SpecialistAgentMeta {
  id: string;
  name: string;
  shortName: string;
  role: string;
  color: string;
  colorSecondary: string;
  shape: "octahedron" | "dodecahedron" | "torusKnot" | "icosahedron" | "gyroscope";
  shapeLabel: string;
  shapeRationale: string;
  capabilities: string[];
  systemPromptSummary: string;
  simulatedThoughts: string[];
  identityReference?: string;
  identityTopicId?: string;
  consensusTimestamp?: string;
  paymentAddress?: string;
  hederaAccountId?: string;
  evmAddress?: string;
  publicKey?: string;
  mode?: string;
  provider?: string;
  isCustom?: boolean;
  did?: string;
  didDocumentUrl?: string;
  credentialUrl?: string;
  w3cStandard?: string;
  endpoint?: string;
  ownerAddress?: string;
  a2aSupported?: boolean;
  sampleFinding: {
    title: string;
    category: string;
    severity: "critical" | "high" | "medium" | "low";
    location: string;
    evidence: string;
    reasoning: string;
  };
}

export const SPECIALIST_AGENTS: Record<string, SpecialistAgentMeta> = {
  "reentrancy-agent": {
    id: "reentrancy-agent",
    name: "Reentrancy Specialist Agent",
    shortName: "Reentrancy",
    role: "Checks-Effects-Interactions (CEI) & Token Callbacks",
    color: "#00f5ff",
    colorSecondary: "#0077b6",
    shape: "octahedron",
    shapeLabel: "Dual Octahedron Crystal",
    shapeRationale: "Reflects state flow reflection and multi-axis recursion boundaries in EVM execution.",
    capabilities: ["reentrancy-detection", "cei-violation", "read-only-reentrancy", "token-callbacks"],
    hederaAccountId: "0.0.10520075",
    paymentAddress: "0.0.10520075",
    evmAddress: "0xDe02bF11bcB20ce22fB4ED79A4fdED7029B445aC",
    publicKey: "0x02818c434957c13ebd4d26fbe278e865d0eafd20ea19fc0a5d0f7bcc2749f7f497",
    did: "did:hedera:testnet:0.0.10417469_reentrancy-agent",
    systemPromptSummary:
      "Detects external value transfer calls executed prior to internal storage updates, missing reentrancy guards, and ERC-777/721 hooks.",
    simulatedThoughts: [
      "Deconstructing contract AST and external call graph…",
      "Scanning call sites: identifying .call{value: ...}, .transfer(), and .send()",
      "Checking Checks-Effects-Interactions (CEI) order across storage slot writes",
      "Flagging candidate state update after value transfer!",
      "Synthesizing reentrant recursion exploit trace for consensus quorum",
    ],
    sampleFinding: {
      title: "State Update After External Call (CEI Violation)",
      category: "reentrancy",
      severity: "critical",
      location: "withdraw()",
      evidence: "msg.sender.call{value: amt}(\"\") called before balances[msg.sender] = 0",
      reasoning: "Attacker can re-enter withdraw() from receive() callback before balance is reset, draining contract funds.",
    },
  },

  "access-control-agent": {
    id: "access-control-agent",
    name: "Access Control Specialist Agent",
    shortName: "Access Control",
    role: "Authorization, Privileged Modifiers & Identity",
    color: "#ffb703",
    colorSecondary: "#fb8500",
    shape: "dodecahedron",
    shapeLabel: "Dodecahedron Aegis (Shield)",
    shapeRationale: "A 12-sided geometric fortress representing multi-layered perimeter access security.",
    capabilities: ["access-control", "tx-origin", "proxy-initializers", "role-escalation"],
    hederaAccountId: "0.0.10520076",
    paymentAddress: "0.0.10520076",
    evmAddress: "0xf392fD0a0Ead69bA5737FDB004865c9aB1ef0A2B",
    publicKey: "0x03859b02b80c448a79d96754a51c59949df6649635fb14a3542594b683371355cd",
    did: "did:hedera:testnet:0.0.10417469_access-control-agent",
    systemPromptSummary:
      "Identifies missing onlyOwner/onlyRole modifiers, dangerous tx.origin usage, unshielded initializers, and privilege escalation.",
    simulatedThoughts: [
      "Parsing function visibility and modifier inheritance tree…",
      "Inspecting authentication references: flagging tx.origin vs msg.sender",
      "Checking critical fund transfer and administrative functions for authorization guards",
      "Detected unprotected emergency function callable by any arbitrary address!",
      "Preparing access breach proof with unauthorized caller trace",
    ],
    sampleFinding: {
      title: "Missing Authorization Modifier on Sensitive Function",
      category: "access-control",
      severity: "high",
      location: "emergencyWithdrawAll(address)",
      evidence: "Public visibility without onlyOwner or access verification",
      reasoning: "Any unauthorized external caller can trigger fund evacuation and drain all contract assets.",
    },
  },

  "business-logic-agent": {
    id: "business-logic-agent",
    name: "Business Logic Specialist Agent",
    shortName: "Business Logic",
    role: "State Machine, Precision & Accounting Drift",
    color: "#d946ef",
    colorSecondary: "#a21caf",
    shape: "torusKnot",
    shapeLabel: "Torus Knot (Mobius Loop)",
    shapeRationale: "Intertwined mathematical loops representing complex accounting algorithms and state lifecycle transitions.",
    capabilities: ["business-logic", "precision-loss", "accounting-drift", "input-validation"],
    hederaAccountId: "0.0.10520078",
    paymentAddress: "0.0.10520078",
    evmAddress: "0xf4CC56886290062EFd0F0C6b558e0d482E011A09",
    publicKey: "0x03652bed70ecc9c1b4f21138fd17e60a75dcad00afaa0ec6f48f2bc17130aa6406",
    did: "did:hedera:testnet:0.0.10417469_business-logic-agent",
    systemPromptSummary:
      "Validates state machine transitions, arithmetic precision (division before multiplication), fee accounting, and double-spending.",
    simulatedThoughts: [
      "Tracing internal state transitions and accounting invariant equations…",
      "Analyzing arithmetic operations for division-before-multiplication truncation",
      "Checking token balance discrepancies and zero-amount edge cases",
      "Identified integer division truncation causing zero reward payout under normal conditions",
      "Packaging invariant violation vector for multi-agent quorum review",
    ],
    sampleFinding: {
      title: "Arithmetic Precision Truncation in Reward Math",
      category: "business-logic",
      severity: "medium",
      location: "calculateReward(address, uint256)",
      evidence: "durationDays / 365 truncates to 0 for any duration under 365 days",
      reasoning: "Users staking for periods under 1 year receive zero rewards due to premature integer division truncation.",
    },
  },

  "economic-agent": {
    id: "economic-agent",
    name: "Economic Security Specialist Agent",
    shortName: "Economic Security",
    role: "Oracle Manipulation, Flash Loans & MEV",
    color: "#10b981",
    colorSecondary: "#059669",
    shape: "icosahedron",
    shapeLabel: "Icosahedron Diamond",
    shapeRationale: "A 20-faceted crystalline diamond representing dynamic market liquidity and decentralized financial mechanisms.",
    capabilities: ["oracle-manipulation", "flash-loan", "mev-protection", "slippage-omission"],
    hederaAccountId: "0.0.10520079",
    paymentAddress: "0.0.10520079",
    evmAddress: "0x7D3dF4B8daF4083De1400E7ACbC4cAb13ce303FC",
    publicKey: "0x02953e88d03313257fc8bb865fe39be34e281538e6174f090b90214421611413a5",
    did: "did:hedera:testnet:0.0.10417469_economic-agent",
    systemPromptSummary:
      "Detects AMM spot price vulnerabilities, flash loan attack vectors, sandwich attack exposure, and reward dilution mechanics.",
    simulatedThoughts: [
      "Inspecting pricing oracles and external financial feeds…",
      "Evaluating AMM reserve spot calculation vs Time-Weighted Average Price (TWAP)",
      "Simulating instant single-block flash loan reserve skewing attack",
      "Confirmed vulnerability: spot price can be manipulated by 90%+ in one flash loan tx!",
      "Submitting economic exploit scenario to consensus engine",
    ],
    sampleFinding: {
      title: "Spot Price Oracle Manipulation Vulnerability",
      category: "economic",
      severity: "critical",
      location: "getCollateralValue(uint256)",
      evidence: "Direct query of Uniswap pair reserves without TWAP or Chainlink oracle",
      reasoning: "An attacker can borrow a flash loan, skew the pair reserve ratio, borrow against artificially inflated collateral, and default.",
    },
  },

  "static-agent": {
    id: "static-agent",
    name: "Static Analysis Specialist Agent",
    shortName: "Static Scanner",
    role: "Low-Level Safety, Assembly & Bytecode",
    color: "#3b82f6",
    colorSecondary: "#1d4ed8",
    shape: "gyroscope",
    shapeLabel: "Tri-Ring Gyroscopic Prism",
    shapeRationale: "Concentric precision scanner rings inspecting bytecode, low-level call returns, and compiler safety.",
    capabilities: ["low-level-call", "delegatecall", "unchecked-arithmetic", "assembly-inspection"],
    hederaAccountId: "0.0.10417474",
    paymentAddress: "0.0.10417474",
    evmAddress: "0x527b3a9fC6d870D3a754f947137f25D430929000",
    publicKey: "0x033488e0b2c2cc6c352cfd3d0d4c09e4e6b4522432b09e5ce8d568179710f88661",
    did: "did:hedera:testnet:0.0.10417469_static-agent",
    systemPromptSummary:
      "Scans for unchecked low-level call returns, arbitrary delegatecalls, deprecated opcodes (selfdestruct), and compiler version hazards.",
    simulatedThoughts: [
      "Performing static semantic AST analysis and opcode inspection…",
      "Checking return values of low-level .call(), .delegatecall(), and .staticcall()",
      "Searching for unchecked assembly memory operations and storage slot collisions",
      "Synthesizing cross-signal correlation with reentrancy agent",
      "Emitting static code findings to consensus layer",
    ],
    sampleFinding: {
      title: "Unchecked Low-Level Call Return Value",
      category: "static-analysis",
      severity: "medium",
      location: "target.call(payload)",
      evidence: "Low-level .call() return boolean is discarded without require() check",
      reasoning: "If the target call fails or runs out of gas, the transaction silently succeeds, corrupting the caller's accounting.",
    },
  },

  "reentrancy-sentinel": {
    id: "reentrancy-sentinel",
    name: "Reentrancy Sentinel",
    shortName: "Reentrancy Sentinel",
    role: "Cross-Contract & Cross-Function Reentrancy Verification",
    color: "#06b6d4",
    colorSecondary: "#0891b2",
    shape: "octahedron",
    shapeLabel: "Dual Octahedron Crystal",
    shapeRationale: "Independent secondary auditor evaluating complex cross-function reentrant locks.",
    capabilities: ["reentrancy-detection", "cross-function-reentrancy", "callback-hijack"],
    hederaAccountId: "0.0.10520081",
    paymentAddress: "0.0.10520081",
    evmAddress: "0x36Bd630e48470FD667595bd3d1C451CfA7AC01a0",
    publicKey: "0x02fa1a11ce15e8ebbe396a099a228ccb678c892608c0ac7c4927f4de3489adebf2",
    did: "did:hedera:testnet:0.0.10417469_reentrancy-sentinel",
    systemPromptSummary:
      "Performs secondary cross-checking on storage locks and external callback surfaces across multiple contracts.",
    simulatedThoughts: [
      "Analyzing cross-contract state interaction graph…",
      "Evaluating view reentrancy vectors across balance getter functions",
      "Confirming findings with Primary Reentrancy Agent",
    ],
    sampleFinding: {
      title: "Read-Only Reentrancy in Curve/Balancer Pricing Hook",
      category: "reentrancy",
      severity: "high",
      location: "getVirtualPrice()",
      evidence: "Read-only function called during intermediate pool imbalance",
      reasoning: "Third-party protocols reading unbalanced price states can be manipulated.",
    },
  },

  "access-sentinel": {
    id: "access-sentinel",
    name: "Access Sentinel",
    shortName: "Access Sentinel",
    role: "Role Hierarchy, Proxy Initializers & Signature Replays",
    color: "#f59e0b",
    colorSecondary: "#d97706",
    shape: "dodecahedron",
    shapeLabel: "Dodecahedron Aegis (Shield)",
    shapeRationale: "Specialized validator focused on upgradeable proxy initialization and multi-sig authorization.",
    capabilities: ["access-control", "authorization-bypass", "proxy-uninitialized"],
    hederaAccountId: "0.0.10520082",
    paymentAddress: "0.0.10520082",
    evmAddress: "0x0a131f972F48217Ee429790881E4FA1182B46EE8",
    publicKey: "0x0207e27a553f329f3bb567047d1506ad9405cd797d7f9010804f231bf0fa942c3e",
    did: "did:hedera:testnet:0.0.10417469_access-sentinel",
    systemPromptSummary:
      "Detects uninitialized implementation contracts, UUPS upgrade authorization omissions, and ECDSA signature malleability.",
    simulatedThoughts: [
      "Verifying ERC-1967 proxy implementation slot protections…",
      "Checking initialize() vs constructor() modifier guards",
      "Confirming access control parity with primary agent",
    ],
    sampleFinding: {
      title: "Uninitialized Proxy Logic Contract",
      category: "access-control",
      severity: "critical",
      location: "initialize()",
      evidence: "Missing initializer modifier on implementation contract",
      reasoning: "An attacker can take ownership of the implementation contract and selfdestruct it.",
    },
  },

  "invariant-agent": {
    id: "invariant-agent",
    name: "Invariant Agent",
    shortName: "Invariant Agent",
    role: "State Conservation, Mathematical Boundaries & Balance Invariants",
    color: "#ec4899",
    colorSecondary: "#be185d",
    shape: "torusKnot",
    shapeLabel: "Torus Knot (Mobius Loop)",
    shapeRationale: "Symbolic executor checking protocol solvency and balance conservation invariants.",
    capabilities: ["business-logic", "precision-loss", "solvency-invariant"],
    hederaAccountId: "0.0.10520083",
    paymentAddress: "0.0.10520083",
    evmAddress: "0x2EaA410c5c0eee48492D9924E9BE1868D45Fe07d",
    publicKey: "0x03f9f4c4565b3ebb1e5210d4e7c49a637d113c88157b4886357eb2bdef31692e99",
    did: "did:hedera:testnet:0.0.10417469_invariant-agent",
    systemPromptSummary:
      "Performs symbolic boundary checks to ensure total vault deposits always equal or exceed token liabilities.",
    simulatedThoughts: [
      "Constructing algebraic property test for total token supply conservation…",
      "Simulating extreme rounding edge cases (1 wei deposits and withdrawals)",
      "Synthesizing solvency invariant verification",
    ],
    sampleFinding: {
      title: "Share Inflation Rounding Vulnerability (ERC-4626)",
      category: "business-logic",
      severity: "high",
      location: "deposit(uint256, address)",
      evidence: "Zero virtual shares minted when first depositor transfers small asset amount",
      reasoning: "Early depositor can donate assets to vault to manipulate share price and steal subsequent deposits.",
    },
  },

  "mev-sentinel": {
    id: "mev-sentinel",
    name: "MEV Sentinel",
    shortName: "MEV Sentinel",
    role: "MIM & Flash Loan Arbitrage, Liquidity Siphoning & Frontrunning",
    color: "#14b8a6",
    colorSecondary: "#0f766e",
    shape: "icosahedron",
    shapeLabel: "Icosahedron Diamond",
    shapeRationale: "Audits atomic arbitrage vulnerabilities and mempool sandwich vectors.",
    capabilities: ["flash-loan", "oracle-manipulation", "mev-protection"],
    hederaAccountId: "0.0.10520085",
    paymentAddress: "0.0.10520085",
    evmAddress: "0x80A8FD5e063b4e32Ea78841e820308A5EDD942a4",
    publicKey: "0x02e8710a01b9cc44bc03fdacbbfe3c6ef7dae892a5bb78d1298737db846c519cfa",
    did: "did:hedera:testnet:0.0.10417469_mev-sentinel",
    systemPromptSummary:
      "Analyzes transaction execution paths vulnerable to atomic bundle extraction, DEX sandwiching, and spot slippage manipulation.",
    simulatedThoughts: [
      "Simulating block builder bundle simulation on swap callbacks…",
      "Evaluating lack of minAmountOut slippage parameters",
      "Constructing MEV arbitrage proof",
    ],
    sampleFinding: {
      title: "Missing Slippage Parameter in Swap Router Call",
      category: "economic",
      severity: "high",
      location: "rebalancePool()",
      evidence: "amountOutMinimum set to 0 in ExactInputSingleParams",
      reasoning: "Mempool searchers can sandwich the rebalance transaction and extract 100% of swapped value.",
    },
  },

  "bytecode-verifier": {
    id: "bytecode-verifier",
    name: "Bytecode Verifier",
    shortName: "Bytecode Verifier",
    role: "EVM Opcode Safety, Arbitrary Delegatecall & Memory Layout",
    color: "#6366f1",
    colorSecondary: "#4338ca",
    shape: "gyroscope",
    shapeLabel: "Tri-Ring Gyroscopic Prism",
    shapeRationale: "Inspects raw EVM bytecode, memory allocations, and delegatecall jumps.",
    capabilities: ["low-level-call", "delegatecall", "memory-corruption"],
    hederaAccountId: "0.0.10520086",
    paymentAddress: "0.0.10520086",
    evmAddress: "0xAD93DcbBB2c56e21cB94a1582f4F824edc1978Dd",
    publicKey: "0x031d5750c57af06785752f565de522c3c9918f9119a7c9059b3614e30b584fea21",
    did: "did:hedera:testnet:0.0.10417469_bytecode-verifier",
    systemPromptSummary:
      "Inspects assembly memory offsets, storage slot layout collisions, and arbitrary delegatecall targets.",
    simulatedThoughts: [
      "Disassembling deployment bytecode into EVM opcode stream…",
      "Verifying DELEGATECALL target parameter validation",
      "Validating 0x40 free memory pointer consistency",
    ],
    sampleFinding: {
      title: "Arbitrary Target in DELEGATECALL Opcode",
      category: "static-analysis",
      severity: "critical",
      location: "execute(address, bytes)",
      evidence: "delegatecall executed to arbitrary user-supplied target address",
      reasoning: "Caller can execute DELEGATECALL to a malicious contract that overwrites storage slot 0 and takes contract ownership.",
    },
  },
};

export const SHAPE_METAS: Record<SpecialistAgentMeta["shape"], { label: string; rationale: string; icon: string }> = {
  octahedron: {
    label: "Dual Octahedron Crystal",
    rationale: "Reflects state flow reflection and multi-axis recursion boundaries in EVM execution.",
    icon: "💎",
  },
  dodecahedron: {
    label: "Dodecahedron Aegis (Shield)",
    rationale: "A 12-sided geometric fortress representing multi-layered perimeter access security.",
    icon: "🛡️",
  },
  torusKnot: {
    label: "Torus Knot (Mobius Loop)",
    rationale: "Intertwined mathematical loops representing complex accounting algorithms and state lifecycle transitions.",
    icon: "♾️",
  },
  icosahedron: {
    label: "Icosahedron Diamond",
    rationale: "A 20-faceted crystalline diamond representing dynamic market liquidity and decentralized financial mechanisms.",
    icon: "💠",
  },
  gyroscope: {
    label: "Tri-Ring Gyroscopic Prism",
    rationale: "Concentric precision scanner rings inspecting bytecode, low-level call returns, and compiler safety.",
    icon: "⚙️",
  },
};

export function createAgentMetaFromBackend(backendAgent: {
  agentId: string;
  name: string;
  role?: string;
  capabilities?: string[];
  paymentAddress?: string;
  hederaAccountId?: string;
  evmAddress?: string;
  publicKey?: string;
  mode?: string;
  provider?: string;
  shape?: string;
  color?: string;
  identityReference?: string;
  identityTopicId?: string;
  consensusTimestamp?: string;
  did?: string;
  endpoint?: string;
  ownerAddress?: string;
  a2aSupported?: boolean;
}): SpecialistAgentMeta {
  const topicId = backendAgent.identityTopicId || "0.0.10417469";
  const did = backendAgent.did || `did:hedera:testnet:${topicId}_${backendAgent.agentId}`;

  const existing = SPECIALIST_AGENTS[backendAgent.agentId];
  if (existing) {
    return {
      ...existing,
      did,
      didDocumentUrl: `/agents/${backendAgent.agentId}/did`,
      credentialUrl: `/agents/${backendAgent.agentId}/credential`,
      w3cStandard: "did:hedera",
      identityReference: backendAgent.identityReference ?? existing.identityReference,
      identityTopicId: backendAgent.identityTopicId ?? existing.identityTopicId,
      consensusTimestamp: backendAgent.consensusTimestamp ?? existing.consensusTimestamp,
      paymentAddress: backendAgent.paymentAddress ?? existing.paymentAddress,
      hederaAccountId: backendAgent.hederaAccountId ?? existing.hederaAccountId,
      evmAddress: backendAgent.evmAddress ?? existing.evmAddress,
      publicKey: backendAgent.publicKey ?? existing.publicKey,
      mode: backendAgent.mode ?? existing.mode,
      provider: backendAgent.provider ?? existing.provider,
      endpoint: backendAgent.endpoint ?? existing.endpoint,
      ownerAddress: backendAgent.ownerAddress ?? existing.ownerAddress,
      a2aSupported: backendAgent.a2aSupported ?? Boolean(backendAgent.endpoint),
    };
  }

  const validShape = (
    ["octahedron", "dodecahedron", "torusKnot", "icosahedron", "gyroscope"].includes(backendAgent.shape ?? "")
      ? backendAgent.shape
      : "octahedron"
  ) as SpecialistAgentMeta["shape"];

  const color = backendAgent.color || "#00f5ff";
  const shapeInfo = SHAPE_METAS[validShape];

  return {
    id: backendAgent.agentId,
    name: backendAgent.name,
    shortName: backendAgent.name.replace(/ Specialist| Agent/gi, "").trim(),
    role: backendAgent.role || "Decentralized AI Smart Contract Security Specialist",
    color,
    colorSecondary: color,
    shape: validShape,
    shapeLabel: shapeInfo.label,
    shapeRationale: shapeInfo.rationale,
    capabilities: backendAgent.capabilities || ["smart-contract-security"],
    systemPromptSummary: `Custom security specialist analyzing smart contracts for ${backendAgent.role || "vulnerabilities and invariant violations"}.`,
    simulatedThoughts: [
      `Initializing ${backendAgent.name} neural evaluation context…`,
      `Parsing contract AST nodes for domain patterns…`,
      `Checking invariant rules and symbolic execution paths…`,
      `Evaluating cross-agent signal correlation in swarm…`,
      `Synthesizing findings for weighted consensus quorum…`,
    ],
    did,
    didDocumentUrl: `/agents/${backendAgent.agentId}/did`,
    credentialUrl: `/agents/${backendAgent.agentId}/credential`,
    w3cStandard: "did:hedera",
    identityReference: backendAgent.identityReference,
    identityTopicId: backendAgent.identityTopicId,
    consensusTimestamp: backendAgent.consensusTimestamp,
    paymentAddress: backendAgent.paymentAddress || backendAgent.hederaAccountId,
    hederaAccountId: backendAgent.hederaAccountId || backendAgent.paymentAddress,
    evmAddress: backendAgent.evmAddress,
    publicKey: backendAgent.publicKey,
    mode: backendAgent.mode,
    provider: backendAgent.provider,
    endpoint: backendAgent.endpoint,
    ownerAddress: backendAgent.ownerAddress,
    a2aSupported: backendAgent.a2aSupported ?? Boolean(backendAgent.endpoint),
    isCustom: true,
    sampleFinding: {
      title: `Specialist finding by ${backendAgent.name}`,
      category: backendAgent.agentId.replace("-agent", ""),
      severity: "high",
      location: "executeTransaction(bytes)",
      evidence: "Identified domain-specific logic violation during specialist scan",
      reasoning: "Custom specialist verified deviation from secure operational parameters.",
    },
  };
}
