// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MochiDuelEscrow} from "../src/MochiDuelEscrow.sol";

// Run with: forge test --match-contract ForkMochi --fork-url $ROBINHOOD_RPC_URL
contract ForkMochi is Test {
    IERC20 constant MOCHI = IERC20(0x8F9727aDfDE356B34De7abC8313025c499200c83);
    address constant HOLDER = 0x0A19F6cad7bd67Fd47aD63566D4da882F9CeB439;

    function test_realMochiFullDuel() public {
        if (block.chainid != 4663) return;
        uint256 signerKey = 0xA11CE;
        MochiDuelEscrow e = new MochiDuelEscrow(MOCHI, address(this), vm.addr(signerKey), 2_500, 1e18, 1e27, 30 minutes, 1 hours);
        address bob = makeAddr("bob");
        uint256 have = MOCHI.balanceOf(HOLDER);
        console.log("holder MOCHI", have / 1e18);
        uint128 stake = uint128(have / 4);
        vm.prank(HOLDER);
        MOCHI.transfer(bob, stake);
        assertEq(MOCHI.balanceOf(bob), stake, "plain transfer, no tax");

        vm.startPrank(HOLDER);
        MOCHI.approve(address(e), stake);
        uint256 id = e.createMatch(stake, address(0));
        vm.stopPrank();
        vm.startPrank(bob);
        MOCHI.approve(address(e), stake);
        e.joinMatch(id);
        vm.stopPrank();
        assertEq(MOCHI.balanceOf(address(e)), uint256(stake) * 2);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, e.resultDigest(id, MochiDuelEscrow.Outcome.PlayerBWins));
        e.settle(id, MochiDuelEscrow.Outcome.PlayerBWins, abi.encodePacked(r, s, v));
        assertEq(MOCHI.balanceOf(bob), uint256(stake) * 2 - (uint256(stake) * 2) / 4, "winner gets 75%");
        e.withdrawAllFees(address(0xBEEF));
        assertEq(MOCHI.balanceOf(address(0xBEEF)), (uint256(stake) * 2) / 4, "treasury 25%");
    }
}
