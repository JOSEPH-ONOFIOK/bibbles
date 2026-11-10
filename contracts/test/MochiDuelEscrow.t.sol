// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MochiDuelEscrow} from "../src/MochiDuelEscrow.sol";

contract MockMochi is ERC20 {
    constructor() ERC20("Mochi", "MOCHI") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Takes 1% on every transfer, to check the escrow refuses fee-on-transfer tokens.
contract TaxToken is ERC20 {
    constructor() ERC20("Tax", "TAX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 tax = value / 100;
            super._update(from, address(0xdead), tax);
            value -= tax;
        }
        super._update(from, to, value);
    }
}

contract MochiDuelEscrowTest is Test {
    MockMochi token;
    MochiDuelEscrow escrow;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address treasury = makeAddr("treasury");
    uint256 signerKey = 0xA11CE;
    address signer;

    uint128 constant STAKE = 1_000e18;

    function setUp() public {
        signer = vm.addr(signerKey);
        token = new MockMochi();
        escrow = new MochiDuelEscrow(IERC20(address(token)), owner, signer, 2_500, 10e18, 1_000_000e18, 30 minutes, 1 hours);
        for (uint256 i; i < 3; i++) {
            address p = [alice, bob, carol][i];
            token.mint(p, 10_000e18);
            vm.prank(p);
            token.approve(address(escrow), type(uint256).max);
        }
    }

    // ------------------------------------------------------------- helpers

    function _sign(uint256 key, uint256 matchId, MochiDuelEscrow.Outcome outcome) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, escrow.resultDigest(matchId, outcome));
        return abi.encodePacked(r, s, v);
    }

    function _locked() internal returns (uint256 id) {
        vm.prank(alice);
        id = escrow.createMatch(STAKE, address(0));
        vm.prank(bob);
        escrow.joinMatch(id);
    }

    // --------------------------------------------------------------- tests

    function test_winnerGets75PercentAndTreasuryAccrues25() public {
        uint256 id = _locked();
        assertEq(token.balanceOf(address(escrow)), 2_000e18);

        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerAWins, _sign(signerKey, id, MochiDuelEscrow.Outcome.PlayerAWins));

        assertEq(token.balanceOf(alice), 10_000e18 - 1_000e18 + 1_500e18);
        assertEq(token.balanceOf(bob), 9_000e18);
        assertEq(escrow.accruedFees(), 500e18);
        assertEq(token.balanceOf(address(escrow)), 500e18);
        assertEq(uint8(escrow.getMatch(id).status), uint8(MochiDuelEscrow.Status.Settled));
    }

    function test_playerBCanWin() public {
        uint256 id = _locked();
        vm.prank(carol); // anyone can submit; money still goes to the winner
        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerBWins, _sign(signerKey, id, MochiDuelEscrow.Outcome.PlayerBWins));
        assertEq(token.balanceOf(bob), 10_500e18);
        assertEq(token.balanceOf(carol), 10_000e18);
    }

    function test_quote() public view {
        (uint256 pot, uint256 fee, uint256 payout) = escrow.quote(STAKE);
        assertEq(pot, 2_000e18);
        assertEq(fee, 500e18);
        assertEq(payout, 1_500e18);
    }

    function test_voidRefundsBothWithNoFee() public {
        uint256 id = _locked();
        escrow.settle(id, MochiDuelEscrow.Outcome.Void, _sign(signerKey, id, MochiDuelEscrow.Outcome.Void));
        assertEq(token.balanceOf(alice), 10_000e18);
        assertEq(token.balanceOf(bob), 10_000e18);
        assertEq(escrow.accruedFees(), 0);
    }

    function test_rejectsForgedSignature() public {
        uint256 id = _locked();
        bytes memory forged = _sign(0xBAD, id, MochiDuelEscrow.Outcome.PlayerBWins);
        vm.expectRevert(MochiDuelEscrow.InvalidSignature.selector);
        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerBWins, forged);
    }

    function test_rejectsSignatureForOtherOutcomeOrMatch() public {
        uint256 id = _locked();
        bytes memory aWins = _sign(signerKey, id, MochiDuelEscrow.Outcome.PlayerAWins);
        vm.expectRevert(MochiDuelEscrow.InvalidSignature.selector);
        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerBWins, aWins);

        uint256 id2 = _locked();
        vm.expectRevert(MochiDuelEscrow.InvalidSignature.selector);
        escrow.settle(id2, MochiDuelEscrow.Outcome.PlayerAWins, aWins);
    }

    function test_cannotSettleTwice() public {
        uint256 id = _locked();
        bytes memory sig = _sign(signerKey, id, MochiDuelEscrow.Outcome.PlayerAWins);
        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerAWins, sig);
        vm.expectRevert(MochiDuelEscrow.InvalidStatus.selector);
        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerAWins, sig);
    }

    function test_cannotSettleOpenMatch() public {
        vm.prank(alice);
        uint256 id = escrow.createMatch(STAKE, address(0));
        bytes memory sig = _sign(signerKey, id, MochiDuelEscrow.Outcome.PlayerAWins);
        vm.expectRevert(MochiDuelEscrow.InvalidStatus.selector);
        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerAWins, sig);
    }

    function test_creatorCancelsUnjoinedMatch() public {
        vm.prank(alice);
        uint256 id = escrow.createMatch(STAKE, address(0));
        vm.prank(bob);
        vm.expectRevert(MochiDuelEscrow.NotAllowed.selector);
        escrow.cancelOpenMatch(id);

        vm.prank(alice);
        escrow.cancelOpenMatch(id);
        assertEq(token.balanceOf(alice), 10_000e18);
    }

    function test_anyoneCancelsAfterJoinWindow() public {
        vm.prank(alice);
        uint256 id = escrow.createMatch(STAKE, address(0));
        vm.warp(block.timestamp + 31 minutes);

        vm.prank(bob);
        vm.expectRevert(MochiDuelEscrow.JoinWindowClosed.selector);
        escrow.joinMatch(id);

        vm.prank(carol);
        escrow.cancelOpenMatch(id);
        assertEq(token.balanceOf(alice), 10_000e18);
    }

    function test_refundExpiredOnlyAfterSettleWindow() public {
        uint256 id = _locked();
        vm.expectRevert(MochiDuelEscrow.SettleWindowOpen.selector);
        escrow.refundExpired(id);

        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(carol);
        escrow.refundExpired(id);
        assertEq(token.balanceOf(alice), 10_000e18);
        assertEq(token.balanceOf(bob), 10_000e18);
    }

    function test_invitedOpponentOnly() public {
        vm.prank(alice);
        uint256 id = escrow.createMatch(STAKE, bob);
        vm.prank(carol);
        vm.expectRevert(MochiDuelEscrow.NotAllowed.selector);
        escrow.joinMatch(id);
        vm.prank(bob);
        escrow.joinMatch(id);
    }

    function test_cannotJoinOwnMatch() public {
        vm.prank(alice);
        uint256 id = escrow.createMatch(STAKE, address(0));
        vm.prank(alice);
        vm.expectRevert(MochiDuelEscrow.NotAllowed.selector);
        escrow.joinMatch(id);
    }

    function test_stakeLimits() public {
        vm.startPrank(alice);
        vm.expectRevert(MochiDuelEscrow.InvalidStake.selector);
        escrow.createMatch(1e18, address(0));
        vm.expectRevert(MochiDuelEscrow.InvalidStake.selector);
        escrow.createMatch(2_000_000e18, address(0));
        vm.stopPrank();
    }

    function test_feeLockedPerMatch() public {
        uint256 id = _locked();
        vm.prank(owner);
        escrow.setFee(0);
        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerAWins, _sign(signerKey, id, MochiDuelEscrow.Outcome.PlayerAWins));
        assertEq(escrow.accruedFees(), 500e18); // still 25%, the rate when the match was created
    }

    function test_feeCappedAt25Percent() public {
        vm.prank(owner);
        vm.expectRevert(MochiDuelEscrow.InvalidConfig.selector);
        escrow.setFee(2_501);
    }

    function test_withdrawOnlyEarnedFees() public {
        uint256 id = _locked();
        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerAWins, _sign(signerKey, id, MochiDuelEscrow.Outcome.PlayerAWins));
        _locked(); // a live match: 2,000 more in escrow

        vm.prank(alice);
        vm.expectRevert();
        escrow.withdrawAllFees(alice);

        vm.startPrank(owner);
        vm.expectRevert(MochiDuelEscrow.InvalidConfig.selector);
        escrow.withdrawFees(treasury, 501e18);

        escrow.withdrawFees(treasury, 200e18);
        escrow.withdrawAllFees(treasury);
        vm.stopPrank();

        assertEq(token.balanceOf(treasury), 500e18);
        assertEq(escrow.accruedFees(), 0);
        assertEq(token.balanceOf(address(escrow)), 2_000e18); // live stakes untouched
    }

    function test_pauseStopsNewMatchesButNotPayouts() public {
        uint256 id = _locked();
        vm.prank(alice);
        uint256 open = escrow.createMatch(STAKE, address(0));

        vm.prank(owner);
        escrow.pause();

        vm.prank(carol);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.createMatch(STAKE, address(0));
        vm.prank(carol);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.joinMatch(open);

        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerBWins, _sign(signerKey, id, MochiDuelEscrow.Outcome.PlayerBWins));
        vm.prank(alice);
        escrow.cancelOpenMatch(open);
    }

    function test_rotatedSignerOldKeyRejected() public {
        uint256 id = _locked();
        vm.prank(owner);
        escrow.setResultSigner(vm.addr(0xB0B));
        bytes memory oldSig = _sign(signerKey, id, MochiDuelEscrow.Outcome.PlayerAWins);
        vm.expectRevert(MochiDuelEscrow.InvalidSignature.selector);
        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerAWins, oldSig);
        escrow.settle(id, MochiDuelEscrow.Outcome.PlayerAWins, _sign(0xB0B, id, MochiDuelEscrow.Outcome.PlayerAWins));
    }

    function test_onlyOwnerAdmin() public {
        vm.startPrank(alice);
        vm.expectRevert();
        escrow.setFee(0);
        vm.expectRevert();
        escrow.setResultSigner(alice);
        vm.expectRevert();
        escrow.pause();
        vm.stopPrank();
    }

    function test_rejectsFeeOnTransferToken() public {
        TaxToken tax = new TaxToken();
        MochiDuelEscrow e = new MochiDuelEscrow(IERC20(address(tax)), owner, signer, 2_500, 10e18, 1_000_000e18, 30 minutes, 1 hours);
        tax.mint(alice, 10_000e18);
        vm.startPrank(alice);
        tax.approve(address(e), type(uint256).max);
        vm.expectRevert(MochiDuelEscrow.UnexpectedTransferAmount.selector);
        e.createMatch(STAKE, address(0));
        vm.stopPrank();
    }

    /// Whatever happens, the escrow always holds exactly the live stakes plus unwithdrawn fees.
    function testFuzz_payoutSplit(uint128 stake, uint16 feeBps, bool aWins) public {
        feeBps = uint16(bound(feeBps, 0, 2_500));
        stake = uint128(bound(stake, 10e18, 5_000e18));
        vm.prank(owner);
        escrow.setFee(feeBps);
        vm.prank(alice);
        uint256 id = escrow.createMatch(stake, address(0));
        vm.prank(bob);
        escrow.joinMatch(id);

        MochiDuelEscrow.Outcome o = aWins ? MochiDuelEscrow.Outcome.PlayerAWins : MochiDuelEscrow.Outcome.PlayerBWins;
        escrow.settle(id, o, _sign(signerKey, id, o));

        uint256 fee = (uint256(stake) * 2 * feeBps) / 10_000;
        assertEq(escrow.accruedFees(), fee);
        assertEq(token.balanceOf(address(escrow)), fee);
        assertEq(token.balanceOf(alice) + token.balanceOf(bob) + fee, 20_000e18);
    }
}
