export interface ContractPreset {
  id: string;
  name: string;
  contractName: string;
  category: string;
  description: string;
  source: string;
}

export const CONTRACT_PRESETS: ContractPreset[] = [
  {
    id: "reentrancy",
    name: "Classic Reentrancy Vault",
    contractName: "EtherVault",
    category: "Reentrancy",
    description: "External value transfer before state balance update without nonReentrant guard.",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EtherVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    // VULNERABLE: State update happens AFTER external call (CEI violation)
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance to withdraw");

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        balances[msg.sender] = 0;
    }

    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
}`,
  },
  {
    id: "access-control",
    name: "Privilege Bypass & tx.origin",
    contractName: "TreasuryAdmin",
    category: "Access Control",
    description: "Using tx.origin for authentication and missing authorization modifier on fund withdrawal.",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TreasuryAdmin {
    address public owner;
    mapping(address => uint256) public deposits;

    constructor() {
        owner = msg.sender;
    }

    // VULNERABLE: Uses tx.origin instead of msg.sender (phishing vulnerability)
    function changeOwner(address newOwner) external {
        require(tx.origin == owner, "Not owner");
        owner = newOwner;
    }

    // VULNERABLE: Missing onlyOwner access control modifier!
    function emergencyWithdrawAll(address recipient) external {
        payable(recipient).transfer(address(this).balance);
    }

    receive() external payable {}
}`,
  },
  {
    id: "business-logic",
    name: "Precision Loss & Reward Drift",
    contractName: "StakingYieldPool",
    category: "Business Logic",
    description: "Division before multiplication and round-down error leading to zero reward payout.",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StakingYieldPool {
    mapping(address => uint256) public staked;
    uint256 public totalStaked;
    uint256 public rewardRate = 5; // 5%

    function stake() external payable {
        staked[msg.sender] += msg.value;
        totalStaked += msg.value;
    }

    // VULNERABLE: Division before multiplication causes extreme precision truncation
    function calculateReward(address user, uint256 durationDays) public view returns (uint256) {
        uint256 base = staked[user];
        // Integer division drops remainder to zero if durationDays < 365
        uint256 yearFraction = durationDays / 365; 
        return base * yearFraction * rewardRate / 100;
    }
}`,
  },
  {
    id: "economic",
    name: "Spot Price Oracle Manipulation",
    contractName: "LendingProtocol",
    category: "Economic Security",
    description: "Direct AMM spot reserve query without time-weighted average price (TWAP), prone to flash loans.",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

contract LendingProtocol {
    IUniswapV2Pair public pair;
    mapping(address => uint256) public collateral;

    constructor(address _pair) {
        pair = IUniswapV2Pair(_pair);
    }

    // VULNERABLE: Spot reserve price easily skewed inside a single transaction via flash loan!
    function getCollateralValue(uint256 amount) public view returns (uint256) {
        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
        uint256 spotPrice = (uint256(reserve1) * 1e18) / uint256(reserve0);
        return (amount * spotPrice) / 1e18;
    }
}`,
  },
  {
    id: "secure",
    name: "Guarded Vault (Secure Pattern)",
    contractName: "GuardedVault",
    category: "Secure Contract",
    description: "Strict CEI adherence, OpenZeppelin-style nonReentrant mutex, and safe state transitions.",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GuardedVault {
    mapping(address => uint256) private _balances;
    bool private _locked;

    modifier nonReentrant() {
        require(!_locked, "ReentrancyGuard: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    function deposit() external payable {
        _balances[msg.sender] += msg.value;
    }

    // SECURE: Checks-Effects-Interactions strictly followed + reentrancy mutex
    function withdraw() external nonReentrant {
        uint256 amount = _balances[msg.sender];
        require(amount > 0, "Zero balance");

        // 1. Effects first
        _balances[msg.sender] = 0;

        // 2. Interactions last
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    function balanceOf(address user) external view returns (uint256) {
        return _balances[user];
    }
}`,
  },
];
