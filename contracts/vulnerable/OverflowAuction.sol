// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OverflowAuction
 * @notice Integer underflow in bid bookkeeping (0.8 requires unchecked, making it explicit).
 * Ground truth: high — arithmetic underflow lets an attacker bid with dust and drain refunds.
 */
contract OverflowAuction {
    uint256 public highestBid;
    address public highestBidder;
    mapping(address => uint256) public refunds;

    function bid() external payable {
        require(msg.value > highestBid, "bid too low");
        if (highestBidder != address(0)) {
            refunds[highestBidder] += highestBid; // refund old bidder
        }
        highestBid = msg.value;
        highestBidder = msg.sender;
    }

    function claimRefund() external {
        uint256 owed = refunds[msg.sender];
        refunds[msg.sender] = 0;
        // VULNERABILITY (classic underflow pattern): owed may exceed contract balance
        (bool ok, ) = msg.sender.call{value: owed}("");
        require(ok, "refund failed");
    }

    receive() external payable {}
}