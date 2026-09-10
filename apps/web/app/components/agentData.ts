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
  mode?: string;
  provider?: string;
  isCustom?: boolean;
  did?: string;
  didDocumentUrl?: string;
  credentialUrl?: string;
  w3cStandard?: string;
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
  mode?: string;
  provider?: string;
  shape?: string;
  color?: string;
  identityReference?: string;
  identityTopicId?: string;
  consensusTimestamp?: string;
  did?: string;
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
      mode: backendAgent.mode ?? existing.mode,
      provider: backendAgent.provider ?? existing.provider,
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
    paymentAddress: backendAgent.paymentAddress,
    mode: backendAgent.mode,
    provider: backendAgent.provider,
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

