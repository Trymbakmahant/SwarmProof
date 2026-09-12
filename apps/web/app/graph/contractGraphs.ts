export interface GraphNode {
  id: string;
  name: string;
  label: string;
  type: string;
  x: number;
  y: number;
  r?: number;
  shape?: "circle" | "rect";
  width?: number;
  height?: number;
  startLine: number;
  endLine: number;
  isVuln: boolean;
  swcCode?: string;
  depth: string;
  desc: string;
  flaggedAgents: string[];
  codeSlice: Array<{ line: number; text: string; type: "normal" | "deleted" | "added" }>;
}

export interface GraphEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
  isExploit?: boolean;
  label?: string;
}

export interface AgentAttentionLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  agentLabel: string;
}

export interface ContractGraphConfig {
  id: string;
  name: string;
  fileName: string;
  badge: string;
  badgeClass: string;
  category: string;
  solidityVersion: string;
  linesCount: number;
  astNodesCount: number;
  callEdgesCount: number;
  quorumScore: number;
  quorumState: string;
  hcsSeq: string;
  hcsHash: string;
  hcsTimestamp: string;
  threatSummary: string;
  rootNode: {
    name: string;
    subtext: string;
    desc: string;
    lines: string;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
  agentLinks: AgentAttentionLink[];
}

export const CONTRACT_GRAPHS: Record<string, ContractGraphConfig> = {
  flashlender: {
    id: "flashlender",
    name: "LoopFi Flashlender (ERC-3156)",
    fileName: "Flashlender.sol",
    badge: "🏆 Code4rena ($100k+ Pool)",
    badgeClass: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30",
    category: "DeFi CDP & Flash Lending",
    solidityVersion: "Solidity 0.8.19",
    linesCount: 141,
    astNodesCount: 28,
    callEdgesCount: 16,
    quorumScore: 92,
    quorumState: "92% Quorum Consensus",
    hcsSeq: "Seq #49,103,118",
    hcsHash: "0x01193461789203285759619560aaffcc88204",
    hcsTimestamp: "2026-09-12T08:54:52.385Z",
    threatSummary: "Self-contained ERC-3156 flash lender implementation from Code4rena. Protected by OpenZeppelin ReentrancyGuard nonReentrant modifier and callback hash validation.",
    rootNode: {
      name: "Flashlender",
      subtext: "ERC3156 Root",
      desc: "Flashlender enables flashlender minting / borrowing of Stablecoin and internal Credit using DssFlash blueprint.",
      lines: "Lines 1 - 141 (141 LOC)",
    },
    nodes: [
      {
        id: "flashLoan",
        name: "flashLoan()",
        label: "flashLoan()",
        type: "FunctionDefinition",
        x: 260,
        y: 180,
        r: 26,
        startLine: 34,
        endLine: 58,
        isVuln: false,
        depth: "AST Depth: 3",
        desc: "Core ERC-3156 flash loan disbursement. Transmits tokens, triggers receiver.onFlashLoan(), verifies CALLBACK_SUCCESS hash, and transfers back amount + fee.",
        flaggedAgents: ["Reentrancy Sentinel", "Logic Sentinel"],
        codeSlice: [
          { line: 39, text: "uint256 fee = flashFee(token, amount);", type: "normal" },
          { line: 40, text: "underlyingToken.transfer(address(receiver), amount);", type: "normal" },
          { line: 41, text: "require(receiver.onFlashLoan(msg.sender, token, amount, fee, data) == CALLBACK_SUCCESS, 'callback failed');", type: "normal" },
          { line: 42, text: "underlyingToken.transferFrom(address(receiver), address(this), amount + fee);", type: "normal" },
        ],
      },
      {
        id: "flashFee",
        name: "flashFee()",
        label: "flashFee()",
        type: "FunctionDefinition",
        x: 620,
        y: 210,
        r: 22,
        startLine: 60,
        endLine: 72,
        isVuln: false,
        depth: "AST Depth: 2",
        desc: "Calculates protocol flash loan fee using fixed-point wmul(amount, protocolFee). Validates token support.",
        flaggedAgents: ["Economic Agent"],
        codeSlice: [
          { line: 61, text: "require(token == address(underlyingToken), 'unsupported');", type: "normal" },
          { line: 62, text: "return wmul(amount, protocolFee);", type: "normal" },
        ],
      },
      {
        id: "maxFlashLoan",
        name: "maxFlashLoan()",
        label: "maxFlashLoan()",
        type: "FunctionDefinition",
        x: 680,
        y: 380,
        r: 22,
        startLine: 74,
        endLine: 82,
        isVuln: false,
        depth: "AST Depth: 2",
        desc: "Returns maximum available liquidity in the lending vault: underlyingToken.balanceOf(address(this)).",
        flaggedAgents: ["Static Verifier"],
        codeSlice: [
          { line: 75, text: "return token == address(underlyingToken) ? underlyingToken.balanceOf(address(this)) : 0;", type: "normal" },
        ],
      },
      {
        id: "underlyingToken",
        name: "underlyingToken",
        label: "underlyingToken",
        type: "VariableDeclaration",
        shape: "rect",
        x: 170,
        y: 290,
        width: 64,
        height: 28,
        startLine: 24,
        endLine: 25,
        isVuln: false,
        depth: "AST Level: Storage",
        desc: "Immutable IERC20 asset contract address. Read-only storage pointer.",
        flaggedAgents: ["Bytecode Verifier"],
        codeSlice: [
          { line: 24, text: "IERC20 public immutable underlyingToken;", type: "normal" },
        ],
      },
      {
        id: "protocolFee",
        name: "protocolFee",
        label: "protocolFee",
        type: "VariableDeclaration",
        shape: "rect",
        x: 330,
        y: 390,
        width: 58,
        height: 28,
        startLine: 22,
        endLine: 23,
        isVuln: false,
        depth: "AST Level: Storage",
        desc: "Immutable protocol fee coefficient, where WAD (1e18) represents 100%.",
        flaggedAgents: ["Economic Sentinel"],
        codeSlice: [
          { line: 22, text: "uint256 public immutable protocolFee;", type: "normal" },
        ],
      },
      {
        id: "nonReentrant",
        name: "nonReentrant",
        label: "nonReentrant",
        type: "ModifierInvocation",
        x: 460,
        y: 440,
        r: 20,
        startLine: 10,
        endLine: 12,
        isVuln: false,
        depth: "AST Level: Guard",
        desc: "OpenZeppelin ReentrancyGuard mutex lock preventing reentrancy across flash loan callbacks.",
        flaggedAgents: ["Reentrancy Agent"],
        codeSlice: [
          { line: 11, text: "modifier nonReentrant() { _nonReentrantBefore(); _; _nonReentrantAfter(); }", type: "normal" },
        ],
      },
      {
        id: "CALLBACK_SUCCESS",
        name: "CALLBACK_SUCCESS",
        label: "CALLBACK_HASH",
        type: "ConstantDeclaration",
        x: 780,
        y: 240,
        r: 22,
        startLine: 17,
        endLine: 19,
        isVuln: false,
        depth: "AST Level: Invariant",
        desc: "keccak256('ERC3156FlashBorrower.onFlashLoan') constant hash verified after loan execution.",
        flaggedAgents: ["Logic Sentinel"],
        codeSlice: [
          { line: 17, text: "bytes32 public constant CALLBACK_SUCCESS = keccak256('ERC3156FlashBorrower.onFlashLoan');", type: "normal" },
        ],
      },
    ],
    edges: [
      { x1: 460, y1: 280, x2: 260, y2: 180 },
      { x1: 460, y1: 280, x2: 620, y2: 210 },
      { x1: 460, y1: 280, x2: 680, y2: 380 },
      { x1: 460, y1: 280, x2: 330, y2: 390 },
      { x1: 460, y1: 280, x2: 460, y2: 440 },
      { x1: 260, y1: 180, x2: 170, y2: 290, dashed: true },
      { x1: 260, y1: 180, x2: 620, y2: 210, dashed: true },
      { x1: 620, y1: 210, x2: 780, y2: 240 },
      { x1: 260, y1: 180, x2: 460, y2: 440 },
    ],
    agentLinks: [
      { x1: 140, y1: 100, x2: 260, y2: 180, color: "#00bcd4", agentLabel: "Reentrancy Agent" },
      { x1: 720, y1: 90, x2: 620, y2: 210, color: "#ff9800", agentLabel: "Economic Agent" },
      { x1: 820, y1: 460, x2: 680, y2: 380, color: "#006c49", agentLabel: "Static Verifier" },
      { x1: 100, y1: 390, x2: 170, y2: 290, color: "#2196f3", agentLabel: "Bytecode Agent" },
    ],
  },

  redeemescrow: {
    id: "redeemescrow",
    name: "Monetrix RedeemEscrow (HyperEVM)",
    fileName: "RedeemEscrow.sol",
    badge: "🏆 Code4rena ($22k Pool)",
    badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    category: "Synthetic Dollar & Escrow Custody",
    solidityVersion: "Solidity 0.8.27",
    linesCount: 83,
    astNodesCount: 22,
    callEdgesCount: 12,
    quorumScore: 100,
    quorumState: "100% Immutable Consensus",
    hcsSeq: "Seq #49,102,994",
    hcsHash: "0x01193461789202091937708698aaee339910",
    hcsTimestamp: "2026-09-12T08:34:57.962Z",
    threatSummary: "Holds USDC reserved for pending redemptions of synthetic USDM. Only MonetrixVault can move funds out. Gated by 48h timelock for proxy upgrades.",
    rootNode: {
      name: "RedeemEscrow",
      subtext: "Escrow Root",
      desc: "USDC liquidity vault for pending synthetic dollar redemptions. Hot-path onlyVault restricted execution.",
      lines: "Lines 1 - 83 (83 LOC)",
    },
    nodes: [
      {
        id: "addObligation",
        name: "addObligation()",
        label: "addObligation()",
        type: "FunctionDefinition",
        x: 260,
        y: 180,
        r: 24,
        startLine: 38,
        endLine: 44,
        isVuln: false,
        depth: "AST Depth: 2",
        desc: "Records new redemption obligation. Gated strictly by onlyVault modifier (msg.sender == vault).",
        flaggedAgents: ["Access Sentinel"],
        codeSlice: [
          { line: 38, text: "function addObligation(uint256 amount) external onlyVault {", type: "normal" },
          { line: 39, text: "    totalOwed += amount;", type: "normal" },
          { line: 40, text: "    emit ObligationAdded(amount, totalOwed);", type: "normal" },
          { line: 41, text: "}", type: "normal" },
        ],
      },
      {
        id: "payOut",
        name: "payOut()",
        label: "payOut()",
        type: "FunctionDefinition",
        x: 620,
        y: 210,
        r: 24,
        startLine: 46,
        endLine: 55,
        isVuln: false,
        depth: "AST Depth: 3",
        desc: "Pays USDC to redeem claimant and decrements totalOwed. Gated by onlyVault modifier with SafeERC20 transfer.",
        flaggedAgents: ["Access Control Agent"],
        codeSlice: [
          { line: 48, text: "require(usdc.balanceOf(address(this)) >= amount, 'insufficient liquidity');", type: "normal" },
          { line: 49, text: "totalOwed -= amount;", type: "normal" },
          { line: 50, text: "usdc.safeTransfer(recipient, amount);", type: "normal" },
        ],
      },
      {
        id: "reclaimTo",
        name: "reclaimTo()",
        label: "reclaimTo()",
        type: "FunctionDefinition",
        x: 330,
        y: 390,
        r: 24,
        startLine: 57,
        endLine: 67,
        isVuln: false,
        depth: "AST Depth: 3",
        desc: "Reclaims excess USDC while asserting bal >= amount + totalOwed to guarantee obligation solvency.",
        flaggedAgents: ["Invariant Agent"],
        codeSlice: [
          { line: 60, text: "uint256 bal = usdc.balanceOf(address(this));", type: "normal" },
          { line: 61, text: "require(bal >= amount + totalOwed, 'would underfund obligations');", type: "normal" },
          { line: 62, text: "usdc.safeTransfer(to, amount);", type: "normal" },
        ],
      },
      {
        id: "shortfall",
        name: "shortfall()",
        label: "shortfall()",
        type: "FunctionDefinition",
        x: 680,
        y: 380,
        r: 20,
        startLine: 69,
        endLine: 74,
        isVuln: false,
        depth: "AST Depth: 2",
        desc: "View function returning unpaid obligation deficit if totalOwed > balance.",
        flaggedAgents: ["Static Verifier"],
        codeSlice: [
          { line: 71, text: "return totalOwed > bal ? totalOwed - bal : 0;", type: "normal" },
        ],
      },
      {
        id: "totalOwed",
        name: "totalOwed",
        label: "totalOwed",
        type: "VariableDeclaration",
        shape: "rect",
        x: 170,
        y: 290,
        width: 58,
        height: 28,
        startLine: 20,
        endLine: 21,
        isVuln: false,
        depth: "AST Level: Storage",
        desc: "Outstanding user redemption debt tracked on-chain.",
        flaggedAgents: ["Invariant Agent"],
        codeSlice: [
          { line: 20, text: "uint256 public totalOwed;", type: "normal" },
        ],
      },
      {
        id: "onlyVault",
        name: "onlyVault",
        label: "onlyVault",
        type: "ModifierInvocation",
        x: 460,
        y: 440,
        r: 20,
        startLine: 76,
        endLine: 80,
        isVuln: false,
        depth: "AST Level: Guard",
        desc: "Caller verification guard ensuring only msg.sender == vault can trigger funds movement.",
        flaggedAgents: ["Access Control Agent"],
        codeSlice: [
          { line: 77, text: "require(msg.sender == vault, 'RedeemEscrow: caller is not vault');", type: "normal" },
        ],
      },
      {
        id: "usdc",
        name: "usdc (ERC20)",
        label: "usdc",
        type: "VariableDeclaration",
        shape: "rect",
        x: 780,
        y: 240,
        width: 54,
        height: 28,
        startLine: 18,
        endLine: 19,
        isVuln: false,
        depth: "AST Level: External Token",
        desc: "USDC backing token interface utilizing OpenZeppelin SafeERC20.",
        flaggedAgents: ["Static Verifier"],
        codeSlice: [
          { line: 18, text: "IERC20 public usdc;", type: "normal" },
        ],
      },
    ],
    edges: [
      { x1: 460, y1: 280, x2: 260, y2: 180 },
      { x1: 460, y1: 280, x2: 620, y2: 210 },
      { x1: 460, y1: 280, x2: 330, y2: 390 },
      { x1: 460, y1: 280, x2: 680, y2: 380 },
      { x1: 460, y1: 280, x2: 460, y2: 440 },
      { x1: 260, y1: 180, x2: 170, y2: 290, dashed: true },
      { x1: 330, y1: 390, x2: 170, y2: 290, dashed: true },
      { x1: 620, y1: 210, x2: 780, y2: 240 },
    ],
    agentLinks: [
      { x1: 140, y1: 100, x2: 260, y2: 180, color: "#ff9800", agentLabel: "Access Sentinel" },
      { x1: 720, y1: 90, x2: 620, y2: 210, color: "#ff9800", agentLabel: "Access Control Agent" },
      { x1: 820, y1: 460, x2: 330, y2: 390, color: "#e91e63", agentLabel: "Invariant Agent" },
      { x1: 100, y1: 390, x2: 460, y2: 440, color: "#006c49", agentLabel: "Static Verifier" },
    ],
  },

  ethervault: {
    id: "ethervault",
    name: "Classic Reentrancy (EtherVault)",
    fileName: "EtherVault.sol",
    badge: "CRITICAL SEVERITY (SWC-107)",
    badgeClass: "bg-red-500/20 text-red-400 border border-red-500/30",
    category: "Reentrancy & CEI Violation",
    solidityVersion: "Solidity 0.8.20",
    linesCount: 21,
    astNodesCount: 14,
    callEdgesCount: 8,
    quorumScore: 10,
    quorumState: "Vulnerability Verified",
    hcsSeq: "Seq #49,102,842",
    hcsHash: "0x9f4a8b7c3d2e1f0088bbee42ac910817469aabbc11",
    hcsTimestamp: "2026-03-30T14:18:22.091Z",
    threatSummary: "Line 16 transfers ether via msg.sender.call{value: bal}('') before zeroing balance on Line 19. An adversarial recipient contract can execute recursive callbacks into withdraw() to drain reserves.",
    rootNode: {
      name: "EtherVault",
      subtext: "Vulnerable Root",
      desc: "Depository contract with critical Checks-Effects-Interactions (CEI) violation.",
      lines: "Lines 1 - 21 (21 LOC)",
    },
    nodes: [
      {
        id: "withdraw",
        name: "withdraw()",
        label: "withdraw()",
        type: "FunctionDefinition",
        x: 260,
        y: 180,
        r: 26,
        startLine: 11,
        endLine: 20,
        isVuln: true,
        swcCode: "SWC-107: REENTRANCY",
        depth: "AST Depth: 4",
        desc: "CRITICAL: External low-level call msg.sender.call{value: bal}('') executed prior to balances[msg.sender] = 0.",
        flaggedAgents: ["A1 Reentrancy", "A5 Bytecode"],
        codeSlice: [
          { line: 12, text: "uint256 bal = balances[msg.sender];", type: "normal" },
          { line: 13, text: "require(bal > 0, 'Insufficient balance');", type: "normal" },
          { line: 16, text: "- (bool success, ) = msg.sender.call{value: bal}('');", type: "deleted" },
          { line: 17, text: "require(success, 'Transfer failed');", type: "normal" },
          { line: 19, text: "+ balances[msg.sender] = 0; // MUST BE BEFORE CALL", type: "added" },
        ],
      },
      {
        id: "deposit",
        name: "deposit() payable",
        label: "deposit()",
        type: "FunctionDefinition",
        x: 330,
        y: 390,
        r: 22,
        startLine: 7,
        endLine: 9,
        isVuln: false,
        depth: "AST Depth: 2",
        desc: "Payable deposit function updating sender credit storage slot.",
        flaggedAgents: ["A2 Access Control"],
        codeSlice: [
          { line: 8, text: "balances[msg.sender] += msg.value;", type: "normal" },
        ],
      },
      {
        id: "balances",
        name: "mapping(address=>uint256) balances",
        label: "balances[]",
        type: "VariableDeclaration",
        shape: "rect",
        x: 170,
        y: 290,
        width: 58,
        height: 28,
        startLine: 5,
        endLine: 6,
        isVuln: true,
        depth: "AST Level: Storage Slot 0",
        desc: "Vulnerable balance mapping subject to recursive withdrawal desynchronization.",
        flaggedAgents: ["A1 Reentrancy"],
        codeSlice: [
          { line: 5, text: "mapping(address => uint256) public balances;", type: "normal" },
        ],
      },
    ],
    edges: [
      { x1: 460, y1: 280, x2: 260, y2: 180, isExploit: true },
      { x1: 460, y1: 280, x2: 330, y2: 390 },
      { x1: 260, y1: 180, x2: 170, y2: 290, dashed: true, isExploit: true },
      { x1: 330, y1: 390, x2: 170, y2: 290 },
    ],
    agentLinks: [
      { x1: 140, y1: 100, x2: 260, y2: 180, color: "#00bcd4", agentLabel: "A1 Reentrancy" },
      { x1: 100, y1: 390, x2: 170, y2: 290, color: "#2196f3", agentLabel: "A5 Bytecode" },
    ],
  },

  multisig: {
    id: "multisig",
    name: "Privilege Bypass (MultiSigAuth)",
    fileName: "MultiSigAuth.sol",
    badge: "HIGH SEVERITY (SWC-115)",
    badgeClass: "bg-red-500/20 text-red-400 border border-red-500/30",
    category: "Access Control & tx.origin",
    solidityVersion: "Solidity 0.8.20",
    linesCount: 18,
    astNodesCount: 12,
    callEdgesCount: 6,
    quorumScore: 25,
    quorumState: "Vulnerability Verified",
    hcsSeq: "Seq #49,102,710",
    hcsHash: "0x88bb112233445566778899aabbccddeeff001122",
    hcsTimestamp: "2026-03-30T13:40:11.102Z",
    threatSummary: "Uses tx.origin instead of msg.sender for ownership authentication, allowing phishing attack contracts to hijack ownership.",
    rootNode: {
      name: "MultiSigAuth",
      subtext: "Auth Root",
      desc: "Authentication manager vulnerable to tx.origin impersonation attacks.",
      lines: "Lines 1 - 18 (18 LOC)",
    },
    nodes: [
      {
        id: "transferOwnership",
        name: "transferOwnership()",
        label: "transferOwnership()",
        type: "FunctionDefinition",
        x: 260,
        y: 180,
        r: 26,
        startLine: 8,
        endLine: 12,
        isVuln: true,
        swcCode: "SWC-115: TX.ORIGIN AUTH",
        depth: "AST Depth: 3",
        desc: "CRITICAL: require(tx.origin == owner) allows intermediary attacker contracts to bypass authorization.",
        flaggedAgents: ["Access Control Agent"],
        codeSlice: [
          { line: 9, text: "- require(tx.origin == owner, 'Not authorized');", type: "deleted" },
          { line: 10, text: "+ require(msg.sender == owner, 'Not authorized'); // FIX", type: "added" },
          { line: 11, text: "owner = newOwner;", type: "normal" },
        ],
      },
      {
        id: "owner",
        name: "address public owner",
        label: "owner",
        type: "VariableDeclaration",
        shape: "rect",
        x: 170,
        y: 290,
        width: 54,
        height: 28,
        startLine: 5,
        endLine: 6,
        isVuln: true,
        depth: "AST Level: Storage Slot 0",
        desc: "Contract owner variable hijackable via malicious external contracts.",
        flaggedAgents: ["Access Control Agent"],
        codeSlice: [
          { line: 5, text: "address public owner;", type: "normal" },
        ],
      },
    ],
    edges: [
      { x1: 460, y1: 280, x2: 260, y2: 180, isExploit: true },
      { x1: 260, y1: 180, x2: 170, y2: 290, dashed: true, isExploit: true },
    ],
    agentLinks: [
      { x1: 140, y1: 100, x2: 260, y2: 180, color: "#ff9800", agentLabel: "Access Control" },
    ],
  },

  securevault: {
    id: "securevault",
    name: "CEI Compliant (SecureVault)",
    fileName: "SecureVault.sol",
    badge: "FORMAL INVARIANT (100%)",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    category: "Verified Invariant Custody",
    solidityVersion: "Solidity 0.8.20",
    linesCount: 22,
    astNodesCount: 16,
    callEdgesCount: 9,
    quorumScore: 100,
    quorumState: "100% Verified Invariant",
    hcsSeq: "Seq #49,102,600",
    hcsHash: "0x1234567890abcdef1234567890abcdef12345678",
    hcsTimestamp: "2026-03-30T12:15:00.000Z",
    threatSummary: "State variables modified strictly prior to calling external execution environments. No reentrancy paths, tx.origin spoofing, or arithmetic anomalies detected.",
    rootNode: {
      name: "SecureVault",
      subtext: "Guarded Root",
      desc: "Fully compliant Checks-Effects-Interactions vault custody contract.",
      lines: "Lines 1 - 22 (22 LOC)",
    },
    nodes: [
      {
        id: "withdraw",
        name: "withdraw()",
        label: "withdraw()",
        type: "FunctionDefinition",
        x: 260,
        y: 180,
        r: 24,
        startLine: 7,
        endLine: 16,
        isVuln: false,
        depth: "AST Depth: 3",
        desc: "Checks-Effects-Interactions pattern strictly enforced. _balances[msg.sender] = 0 set prior to external call.",
        flaggedAgents: ["Reentrancy Agent", "Logic Sentinel"],
        codeSlice: [
          { line: 9, text: "require(amount > 0, 'Empty');", type: "normal" },
          { line: 12, text: "_balances[msg.sender] = 0;", type: "added" },
          { line: 14, text: "(bool ok, ) = msg.sender.call{value: amount}('');", type: "normal" },
          { line: 15, text: "require(ok, 'Fail');", type: "normal" },
        ],
      },
      {
        id: "_balances",
        name: "_balances private mapping",
        label: "_balances",
        type: "VariableDeclaration",
        shape: "rect",
        x: 170,
        y: 290,
        width: 58,
        height: 28,
        startLine: 5,
        endLine: 6,
        isVuln: false,
        depth: "AST Level: Storage",
        desc: "Private balance mapping modified prior to external transfer.",
        flaggedAgents: ["Bytecode Verifier"],
        codeSlice: [
          { line: 5, text: "mapping(address => uint256) private _balances;", type: "normal" },
        ],
      },
    ],
    edges: [
      { x1: 460, y1: 280, x2: 260, y2: 180 },
      { x1: 260, y1: 180, x2: 170, y2: 290, dashed: true },
    ],
    agentLinks: [
      { x1: 140, y1: 100, x2: 260, y2: 180, color: "#006c49", agentLabel: "Verified Guard" },
    ],
  },
};
