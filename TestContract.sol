// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title TestContract
 * @notice SwarmProof MCP Test Contract for multi-agent security audit verification.
 * 
 * Known Invariants & Vulnerabilities for Verification:
 * 1. Checks-Effects-Interactions (CEI) violation in withdraw() enabling reentrancy.
 * 2. Unprotected emergencyWithdraw() lacking access control (anyone can call).
 * 3. Unchecked return value in unsafeTransfer().
 */
contract TestContract {
    address public owner;
    mapping(address => uint256) public balances;
    uint256 public totalDeposits;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Deposit funds into the contract
    function deposit() external payable {
        require(msg.value > 0, "Deposit must be greater than zero");
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw caller's deposited balance
    /// @dev VULNERABILITY 1: External call occurs BEFORE updating balances[msg.sender].
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Insufficient balance");

        // External call to recipient before updating state
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        // State update after external call (Reentrancy flaw)
        balances[msg.sender] = 0;
        totalDeposits -= amount;
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Emergency drain of contract funds
    /// @dev VULNERABILITY 2: Missing access control (anyone can drain all funds)
    function emergencyWithdraw(address payable recipient) external {
        // Missing require(msg.sender == owner)
        uint256 contractBalance = address(this).balance;
        (bool success, ) = recipient.call{value: contractBalance}("");
        require(success, "Emergency withdraw failed");
    }

    /// @notice Low-level transfer function
    /// @dev VULNERABILITY 3: Unchecked low-level call return value
    function unsafeTransfer(address payable to, uint256 amount) external {
        require(msg.sender == owner, "Only owner");
        // Return value ignored
        to.call{value: amount}("");
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
    }
}
