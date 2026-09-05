// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ReentrancyVault
 * @notice Classic reentrancy: state updates after external call.
 * Ground truth: critical — reentrancy (withdraw calls sender before deducting balance).
 */
contract ReentrancyVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        // VULNERABILITY: external call before state update → reentrancy
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
        balances[msg.sender] = 0;
    }

    receive() external payable {}
}