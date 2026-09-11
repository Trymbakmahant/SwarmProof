import type { BenchmarkSuite, BenchmarkRole } from "./types.js";

/**
 * Suite 1: Reentrancy & CEI Specialist Benchmark
 */
export const REENTRANCY_BENCHMARK_SUITE: BenchmarkSuite = {
  role: "reentrancy",
  roleTitle: "Reentrancy & CEI Specialist",
  contractName: "BenchmarkReentrancyVault",
  description:
    "Evaluates an agent's ability to detect Checks-Effects-Interactions (CEI) violations and cross-function reentrancy while rejecting safe mutex patterns.",
  passingThreshold: 80,
  contractSource: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BenchmarkReentrancyVault {
    mapping(address => uint256) public balances;
    bool private _locked;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    function deposit() external payable {
        require(msg.value > 0, "Zero deposit");
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // VULNERABILITY 1: Classic CEI violation - external call before state update
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient funds");
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        balances[msg.sender] -= amount;
        emit Withdrawn(msg.sender, amount);
    }

    // VULNERABILITY 2: Cross-function reentrancy vulnerability
    function transferCredit(address to, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient funds");
        // State update of recipient occurs, but external hook called before sender debit
        (bool ok, ) = to.call{value: 0}(abi.encodeWithSignature("onCreditReceived(address,uint256)", msg.sender, amount));
        require(ok, "Hook failed");
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }

    // TRAP (SAFE): Properly guarded with reentrancy mutex and state update before call
    function safeWithdrawWithMutex(uint256 amount) external {
        require(!_locked, "ReentrancyGuard: reentrant call");
        _locked = true;
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        _locked = false;
    }
}`,
  groundTruth: [
    {
      id: "BENCH_REENTRANCY_CEI_01",
      title: "State updated after external transfer in withdraw()",
      category: "reentrancy",
      severity: "critical",
      targetFunction: "withdraw",
      requiredKeywords: ["cei", "checks-effects-interactions", "reentrancy", "external call", "state update"],
      description:
        "External call `msg.sender.call{value: amount}(\"\")` is performed before updating `balances[msg.sender] -= amount`.",
      weight: 1.0,
    },
    {
      id: "BENCH_REENTRANCY_CROSS_02",
      title: "Cross-function reentrancy via external hook in transferCredit()",
      category: "reentrancy",
      severity: "high",
      targetFunction: "transferCredit",
      requiredKeywords: ["cross-function", "hook", "reentrancy", "state", "callback"],
      description:
        "External callback `to.call` executed before updating sender's balance allows recursive reentrancy into `withdraw()`.",
      weight: 1.0,
    },
  ],
  traps: [
    {
      id: "TRAP_MUTEX_WITHDRAW",
      safeFunction: "safeWithdrawWithMutex",
      description: "Reporting a reentrancy vulnerability on safeWithdrawWithMutex is a false positive.",
      reasonWhySafe: "Properly mutates state prior to external call and implements a boolean mutex reentrancy lock.",
    },
  ],
};

/**
 * Suite 2: Access Control & Privileges Benchmark
 */
export const ACCESS_CONTROL_BENCHMARK_SUITE: BenchmarkSuite = {
  role: "access-control",
  roleTitle: "Access Control & Privileges Warden",
  contractName: "BenchmarkAccessControlVault",
  description:
    "Evaluates an agent's ability to identify missing ownership modifiers and dangerous tx.origin authorization checks.",
  passingThreshold: 80,
  contractSource: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BenchmarkAccessControlVault {
    address public owner;
    address public platformAdmin;
    mapping(address => uint256) public vaultBalances;

    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
    event AdminGranted(address indexed admin);
    event EmergencyDrained(address indexed target, uint256 amount);

    constructor() {
        owner = msg.sender;
        platformAdmin = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not owner");
        _;
    }

    // VULNERABILITY 1: Missing access control modifier - anyone can take admin role
    function setPlatformAdmin(address newAdmin) external {
        require(newAdmin != address(0), "Invalid address");
        platformAdmin = newAdmin;
        emit AdminGranted(newAdmin);
    }

    // VULNERABILITY 2: Phishing attack vector via tx.origin authorization
    function emergencyDrain(address payable recipient) external {
        require(tx.origin == owner, "Only owner origin can trigger emergency drain");
        uint256 balance = address(this).balance;
        (bool ok, ) = recipient.call{value: balance}("");
        require(ok, "Drain failed");
        emit EmergencyDrained(recipient, balance);
    }

    // TRAP (SAFE): Strict access control with onlyOwner modifier
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnerUpdated(owner, newOwner);
        owner = newOwner;
    }
}`,
  groundTruth: [
    {
      id: "BENCH_AUTH_MISSING_01",
      title: "Missing authorization modifier on setPlatformAdmin()",
      category: "access-control",
      severity: "critical",
      targetFunction: "setPlatformAdmin",
      requiredKeywords: ["missing", "access control", "onlyowner", "modifier", "privilege"],
      description: "Any external caller can invoke `setPlatformAdmin()` to claim administrative rights.",
      weight: 1.0,
    },
    {
      id: "BENCH_AUTH_TX_ORIGIN_02",
      title: "Dangerous authorization using tx.origin in emergencyDrain()",
      category: "access-control",
      severity: "high",
      targetFunction: "emergencyDrain",
      requiredKeywords: ["tx.origin", "phishing", "msg.sender", "authentication"],
      description: "Using `tx.origin == owner` allows malicious contracts to drain funds if owner interacts with them.",
      weight: 1.0,
    },
  ],
  traps: [
    {
      id: "TRAP_TRANSFER_OWNERSHIP",
      safeFunction: "transferOwnership",
      description: "Flagging transferOwnership as an access control flaw is a false positive.",
      reasonWhySafe: "Function is strictly guarded by the onlyOwner modifier checking msg.sender == owner.",
    },
  ],
};

/**
 * Suite 3: Static Analysis & Low-Level Calls Benchmark
 */
export const STATIC_ANALYSIS_BENCHMARK_SUITE: BenchmarkSuite = {
  role: "static-analysis",
  roleTitle: "Static Analysis & Assembly Guard",
  contractName: "BenchmarkStaticAnalysis",
  description:
    "Evaluates detection of unchecked low-level call return values and dangerous arbitrary delegatecalls.",
  passingThreshold: 80,
  contractSource: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BenchmarkStaticAnalysis {
    address public implementation;
    mapping(address => uint256) public userShares;

    // VULNERABILITY 1: Unchecked low-level call return value
    function batchPayout(address[] calldata recipients, uint256 amount) external {
        for (uint256 i = 0; i < recipients.length; i++) {
            // Low-level call return boolean is silently ignored
            recipients[i].call{value: amount}("");
            userShares[recipients[i]] += amount;
        }
    }

    // VULNERABILITY 2: Dangerous arbitrary delegatecall to user-supplied address
    function forwardExecution(address target, bytes calldata data) external payable returns (bytes memory) {
        // Allows caller to execute arbitrary code in contract context, hijacking storage
        (bool success, bytes memory ret) = target.delegatecall(data);
        require(success, "Execution failed");
        return ret;
    }

    // TRAP (SAFE): Checked low-level call with require statement
    function safeTransferChecked(address to, uint256 amount) external {
        (bool success, ) = to.call{value: amount}("");
        require(success, "Safe transfer failed");
    }
}`,
  groundTruth: [
    {
      id: "BENCH_STATIC_UNCHECKED_CALL_01",
      title: "Unchecked return value of low-level call in batchPayout()",
      category: "static-analysis",
      severity: "high",
      targetFunction: "batchPayout",
      requiredKeywords: ["unchecked", "return value", "call", "silent failure"],
      description: "Low-level `.call` return value is discarded, causing accounting desync if payout fails.",
      weight: 1.0,
    },
    {
      id: "BENCH_STATIC_DELEGATECALL_02",
      title: "Arbitrary delegatecall execution in forwardExecution()",
      category: "delegatecall",
      severity: "critical",
      targetFunction: "forwardExecution",
      requiredKeywords: ["delegatecall", "storage hijack", "arbitrary", "context"],
      description: "Delegatecall to untrusted user-supplied address allows complete takeover of contract storage.",
      weight: 1.0,
    },
  ],
  traps: [
    {
      id: "TRAP_SAFE_TRANSFER_CHECKED",
      safeFunction: "safeTransferChecked",
      description: "Reporting safeTransferChecked for unchecked call is a false positive.",
      reasonWhySafe: "Explicitly verifies the boolean return value with require(success).",
    },
  ],
};

/**
 * Suite 4: Business Logic & Invariants Benchmark
 */
export const BUSINESS_LOGIC_BENCHMARK_SUITE: BenchmarkSuite = {
  role: "business-logic",
  roleTitle: "Business Logic & State Invariant Auditor",
  contractName: "BenchmarkBusinessLogicVault",
  description:
    "Evaluates detection of share price inflation/first-depositor rounding attacks and missing zero-amount validations.",
  passingThreshold: 80,
  contractSource: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BenchmarkBusinessLogicVault {
    uint256 public totalShares;
    uint256 public totalAssets;
    mapping(address => uint256) public sharesOf;

    // VULNERABILITY 1: ERC4626 first-depositor share price inflation attack (inflation/rounding to zero)
    function deposit(uint256 assets) external returns (uint256 shares) {
        if (totalShares == 0) {
            shares = assets;
        } else {
            // First depositor can donate assets directly to inflate totalAssets,
            // causing subsequent depositors' shares to round down to 0!
            shares = (assets * totalShares) / totalAssets;
        }
        require(shares > 0, "Zero shares minted");
        sharesOf[msg.sender] += shares;
        totalShares += shares;
        totalAssets += assets;
    }

    // VULNERABILITY 2: Zero-amount validation missing causing reward accounting dilution
    function recordActivity(address user, uint256 amount) external {
        // Allows zero amount to trigger reward calculation divisor distortion
        totalAssets += amount;
        sharesOf[user] += amount;
    }

    // TRAP (SAFE): Protected deposit with virtual shares or minimum liquidity offset
    function safeFixedDeposit(uint256 assets) external pure returns (uint256) {
        uint256 virtualOffset = 1000;
        return (assets * 1e18) / (assets + virtualOffset);
    }
}`,
  groundTruth: [
    {
      id: "BENCH_LOGIC_INFLATION_01",
      title: "First-depositor share price inflation attack in deposit()",
      category: "business-logic",
      severity: "critical",
      targetFunction: "deposit",
      requiredKeywords: ["first depositor", "inflation", "rounding", "share", "donation"],
      description: "Lack of virtual offset or minimum initial liquidity allows direct asset donation to inflate share ratio.",
      weight: 1.0,
    },
    {
      id: "BENCH_LOGIC_ZERO_AMOUNT_02",
      title: "Missing input boundary validation in recordActivity()",
      category: "input-validation",
      severity: "medium",
      targetFunction: "recordActivity",
      requiredKeywords: ["zero", "input validation", "boundary", "validation"],
      description: "Accepts 0-value parameters which distort reward distribution denominators.",
      weight: 1.0,
    },
  ],
  traps: [
    {
      id: "TRAP_FIXED_DEPOSIT",
      safeFunction: "safeFixedDeposit",
      description: "Reporting an inflation exploit on safeFixedDeposit is a false positive.",
      reasonWhySafe: "Uses virtual offset to prevent rounding to zero.",
    },
  ],
};

/**
 * Suite 5: Economic Security & Oracle Manipulation Benchmark
 */
export const ECONOMIC_ORACLE_BENCHMARK_SUITE: BenchmarkSuite = {
  role: "economic-oracle",
  roleTitle: "Economic Security & Oracle Specialist",
  contractName: "BenchmarkEconomicLending",
  description:
    "Evaluates detection of single-block spot AMM price oracle manipulation and flash loan liquidation exploits.",
  passingThreshold: 80,
  contractSource: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

contract BenchmarkEconomicLending {
    IUniswapV2Pair public ammPair;
    mapping(address => uint256) public collateral;
    mapping(address => uint256) public borrowed;

    // VULNERABILITY 1: Spot reserve manipulation via single-block AMM reserves without TWAP
    function getCollateralPrice() public view returns (uint256) {
        (uint112 reserve0, uint112 reserve1, ) = ammPair.getReserves();
        // Vulnerable: spot price can be drastically moved via flash loan in same block!
        return (uint256(reserve1) * 1e18) / uint256(reserve0);
    }

    // VULNERABILITY 2: Flash loan borrow & liquidate exploit
    function borrow(uint256 amount) external {
        uint256 price = getCollateralPrice();
        uint256 maxBorrow = (collateral[msg.sender] * price) / 1e18;
        require(borrowed[msg.sender] + amount <= maxBorrow, "Undercollateralized");
        borrowed[msg.sender] += amount;
    }

    // TRAP (SAFE): Chainlink or TWAP oracle price lookup with heartbeat verification
    function getSafeTwapPrice(uint256 cumulativePrice, uint256 timeElapsed) external pure returns (uint256) {
        require(timeElapsed >= 1800, "TWAP window too short");
        return cumulativePrice / timeElapsed;
    }
}`,
  groundTruth: [
    {
      id: "BENCH_ORACLE_SPOT_01",
      title: "Spot price oracle manipulation via AMM reserves without TWAP",
      category: "oracle-manipulation",
      severity: "critical",
      targetFunction: "getCollateralPrice",
      requiredKeywords: ["spot", "amm", "twap", "manipulation", "flash loan", "reserves"],
      description: "Reading reserves directly from Uniswap V2 pair enables instantaneous flash-loan price manipulation.",
      weight: 1.0,
    },
    {
      id: "BENCH_ORACLE_BORROW_02",
      title: "Flash loan drain vector in borrow() relying on manipulated spot price",
      category: "flash-loan",
      severity: "high",
      targetFunction: "borrow",
      requiredKeywords: ["borrow", "flash loan", "undercollateralized", "drain", "manipulated price"],
      description: "Collateral borrow ratio relies on instantaneous spot price, enabling single-block insolvency attacks.",
      weight: 1.0,
    },
  ],
  traps: [
    {
      id: "TRAP_SAFE_TWAP_PRICE",
      safeFunction: "getSafeTwapPrice",
      description: "Reporting an oracle manipulation flaw on getSafeTwapPrice is a false positive.",
      reasonWhySafe: "Enforces a minimum 30-minute cumulative TWAP observation window.",
    },
  ],
};

/** All registered benchmark suites indexed by role. */
export const BENCHMARK_SUITES: Record<BenchmarkRole, BenchmarkSuite> = {
  reentrancy: REENTRANCY_BENCHMARK_SUITE,
  "access-control": ACCESS_CONTROL_BENCHMARK_SUITE,
  "static-analysis": STATIC_ANALYSIS_BENCHMARK_SUITE,
  "business-logic": BUSINESS_LOGIC_BENCHMARK_SUITE,
  "economic-oracle": ECONOMIC_ORACLE_BENCHMARK_SUITE,
};
