// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AccessControlAdmin
 * @notice Missing access control: privileged functions callable by anyone.
 * Ground truth: high — anyone can become admin and drain funds.
 */
contract AccessControlAdmin {
    address public admin;

    constructor() {
        admin = msg.sender;
    }

    // VULNERABILITY: no onlyAdmin modifier
    function setAdmin(address newAdmin) external {
        admin = newAdmin;
    }

    function withdrawAll() external {
        // VULNERABILITY: anyone can call and drain
        (bool ok, ) = admin.call{value: address(this).balance}("");
        require(ok, "transfer failed");
    }

    receive() external payable {}
}