// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title Mochi Duel escrow (DRAFT, not audited)
/// @notice Two players stake equal amounts of $MOCHI. A result signed by the game server decides the match.
///         The winner receives the pot minus a disclosed fee. The fee rate is fixed per match when the
///         match is created. Fees from decisive results build up in the contract's treasury and the owner
///         can withdraw them at any time. The owner can only withdraw fees already earned. Stakes still in
///         escrow can only go back to the players.
///
/// Published rules this contract enforces:
///  - Unmatched stake: the creator can cancel at any time before someone joins. After the join window
///    closes, anyone can cancel. The full stake goes back to the creator.
///  - Tie / void / disconnect with no fair result: the server signs `Void` and both players are refunded
///    in full. No fee is taken.
///  - Disconnect where the server rules a forfeit: the server signs a win for the other player.
///  - No result in time: once the settle window has passed, anyone can refund both players in full,
///    with no fee.
///  - Pausing only stops new matches from being created or joined. Settling and refunds always work.
contract MochiDuelEscrow is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- types

    enum Status {
        None,
        Open, // creator has staked and is waiting for an opponent
        Locked, // both have staked and are waiting for the result
        Settled, // paid out to the winner
        Refunded // stakes returned (cancelled, void or expired)
    }

    enum Outcome {
        None,
        PlayerAWins,
        PlayerBWins,
        Void
    }

    struct Match {
        address playerA;
        address playerB; // if set at creation, only this address may join
        uint128 stake; // per player, in token base units
        uint16 feeBps; // fee rate locked in when the match was created
        Status status;
        uint64 joinDeadline;
        uint64 settleDeadline; // set when the match locks
    }

    // ------------------------------------------------------------ constants

    uint16 public constant BPS = 10_000;
    uint16 public constant MAX_FEE_BPS = 2_500; // hard cap of 25%

    bytes32 public constant RESULT_TYPEHASH = keccak256("Result(uint256 matchId,uint8 outcome)");

    IERC20 public immutable token;

    // --------------------------------------------------------------- config

    uint16 public feeBps; // 2500 = 25% of the pot
    address public resultSigner; // game server key that signs verified results
    uint128 public minStake;
    uint128 public maxStake;
    uint64 public joinWindow; // seconds an open match waits for an opponent
    uint64 public settleWindow; // seconds after locking before a refund is allowed

    // ---------------------------------------------------------------- state

    uint256 public nextMatchId = 1;
    uint256 public accruedFees; // treasury: fees earned and not yet withdrawn
    mapping(uint256 => Match) public matches;

    // --------------------------------------------------------------- events

    event MatchCreated(
        uint256 indexed matchId, address indexed playerA, address indexed invited, uint256 stake, uint16 feeBps, uint64 joinDeadline
    );
    event MatchJoined(uint256 indexed matchId, address indexed playerB, uint64 settleDeadline);
    event MatchSettled(uint256 indexed matchId, address indexed winner, uint256 payout, uint256 fee);
    event MatchRefunded(uint256 indexed matchId, Outcome reason);
    event MatchCancelled(uint256 indexed matchId);

    event FeeUpdated(uint16 feeBps);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event ResultSignerUpdated(address resultSigner);
    event StakeLimitsUpdated(uint128 minStake, uint128 maxStake);
    event WindowsUpdated(uint64 joinWindow, uint64 settleWindow);

    // --------------------------------------------------------------- errors

    error InvalidConfig();
    error InvalidStake();
    error InvalidStatus();
    error NotAllowed();
    error JoinWindowClosed();
    error SettleWindowOpen();
    error InvalidOutcome();
    error InvalidSignature();
    error UnexpectedTransferAmount();

    // ---------------------------------------------------------- constructor

    constructor(
        IERC20 token_,
        address owner_,
        address resultSigner_,
        uint16 feeBps_,
        uint128 minStake_,
        uint128 maxStake_,
        uint64 joinWindow_,
        uint64 settleWindow_
    ) Ownable(owner_) EIP712("MochiDuelEscrow", "1") {
        if (address(token_) == address(0)) revert InvalidConfig();
        token = token_;
        _setFee(feeBps_);
        _setResultSigner(resultSigner_);
        _setStakeLimits(minStake_, maxStake_);
        _setWindows(joinWindow_, settleWindow_);
    }

    // -------------------------------------------------------------- players

    /// @notice Create a match and escrow your stake. Approve this contract for `stake` first.
    /// @param stake Amount each player stakes, in token base units.
    /// @param invited Optional opponent. Use address(0) to let anyone join.
    function createMatch(uint128 stake, address invited) external whenNotPaused nonReentrant returns (uint256 matchId) {
        if (stake < minStake || stake > maxStake) revert InvalidStake();
        if (invited == msg.sender) revert NotAllowed();

        matchId = nextMatchId++;
        uint64 joinDeadline = uint64(block.timestamp) + joinWindow;

        matches[matchId] = Match({
            playerA: msg.sender,
            playerB: invited,
            stake: stake,
            feeBps: feeBps,
            status: Status.Open,
            joinDeadline: joinDeadline,
            settleDeadline: 0
        });

        _pullExact(msg.sender, stake);
        emit MatchCreated(matchId, msg.sender, invited, stake, feeBps, joinDeadline);
    }

    /// @notice Join an open match by escrowing the same stake. Approve this contract for the stake first.
    function joinMatch(uint256 matchId) external whenNotPaused nonReentrant {
        Match storage m = matches[matchId];
        if (m.status != Status.Open) revert InvalidStatus();
        if (block.timestamp > m.joinDeadline) revert JoinWindowClosed();
        if (msg.sender == m.playerA) revert NotAllowed();
        if (m.playerB != address(0) && m.playerB != msg.sender) revert NotAllowed();

        m.playerB = msg.sender;
        m.status = Status.Locked;
        m.settleDeadline = uint64(block.timestamp) + settleWindow;

        _pullExact(msg.sender, m.stake);
        emit MatchJoined(matchId, msg.sender, m.settleDeadline);
    }

    /// @notice Cancel a match nobody joined and refund the creator. The creator can do this any time.
    ///         Anyone can do it once the join window has closed.
    function cancelOpenMatch(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.status != Status.Open) revert InvalidStatus();
        if (msg.sender != m.playerA && block.timestamp <= m.joinDeadline) revert NotAllowed();

        m.status = Status.Refunded;
        token.safeTransfer(m.playerA, m.stake);
        emit MatchCancelled(matchId);
    }

    /// @notice Submit the server-signed result. Anyone can call this (usually the server's relayer or the
    ///         winner). Tokens only ever go to the players or the fee recipient, never to the caller.
    function settle(uint256 matchId, Outcome outcome, bytes calldata signature) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.status != Status.Locked) revert InvalidStatus();
        if (outcome == Outcome.None) revert InvalidOutcome();

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(RESULT_TYPEHASH, matchId, uint8(outcome))));
        if (ECDSA.recover(digest, signature) != resultSigner) revert InvalidSignature();

        if (outcome == Outcome.Void) {
            _refundBoth(m);
            emit MatchRefunded(matchId, Outcome.Void);
            return;
        }

        address winner = outcome == Outcome.PlayerAWins ? m.playerA : m.playerB;
        uint256 pot = uint256(m.stake) * 2;
        uint256 fee = (pot * m.feeBps) / BPS;
        uint256 payout = pot - fee;

        m.status = Status.Settled;
        accruedFees += fee;
        token.safeTransfer(winner, payout);

        emit MatchSettled(matchId, winner, payout, fee);
    }

    /// @notice If the match was never settled before the settle window closed, anyone can refund
    ///         both players in full. No fee is taken.
    function refundExpired(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.status != Status.Locked) revert InvalidStatus();
        if (block.timestamp <= m.settleDeadline) revert SettleWindowOpen();

        _refundBoth(m);
        emit MatchRefunded(matchId, Outcome.None);
    }

    // ---------------------------------------------------------------- views

    /// @notice Numbers to show players before they confirm: total pot, fee and winner payout.
    function quote(uint128 stake) external view returns (uint256 pot, uint256 fee, uint256 winnerPayout) {
        pot = uint256(stake) * 2;
        fee = (pot * feeBps) / BPS;
        winnerPayout = pot - fee;
    }

    function getMatch(uint256 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    /// @notice EIP-712 digest the server signs for a result. Useful for checking off-chain signers.
    function resultDigest(uint256 matchId, Outcome outcome) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(RESULT_TYPEHASH, matchId, uint8(outcome))));
    }

    // ---------------------------------------------------------------- admin
    // Fee changes only apply to matches created afterwards, and can never go above MAX_FEE_BPS.

    function setFee(uint16 feeBps_) external onlyOwner {
        _setFee(feeBps_);
    }

    /// @notice Withdraw earned fees from the treasury. This can never exceed `accruedFees`, so players'
    ///         escrowed stakes stay untouchable.
    function withdrawFees(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0) || amount == 0 || amount > accruedFees) revert InvalidConfig();
        accruedFees -= amount;
        token.safeTransfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    /// @notice Withdraw every fee earned so far.
    function withdrawAllFees(address to) external onlyOwner nonReentrant {
        uint256 amount = accruedFees;
        if (to == address(0) || amount == 0) revert InvalidConfig();
        accruedFees = 0;
        token.safeTransfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    function setResultSigner(address resultSigner_) external onlyOwner {
        _setResultSigner(resultSigner_);
    }

    function setStakeLimits(uint128 minStake_, uint128 maxStake_) external onlyOwner {
        _setStakeLimits(minStake_, maxStake_);
    }

    function setWindows(uint64 joinWindow_, uint64 settleWindow_) external onlyOwner {
        _setWindows(joinWindow_, settleWindow_);
    }

    /// @notice Stops new matches only. Cancels, settlements and refunds keep working.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ------------------------------------------------------------- internal

    function _pullExact(address from, uint256 amount) internal {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        // Reject fee-on-transfer behaviour so the escrow always holds exactly what it owes.
        if (token.balanceOf(address(this)) - before != amount) revert UnexpectedTransferAmount();
    }

    function _refundBoth(Match storage m) internal {
        m.status = Status.Refunded;
        token.safeTransfer(m.playerA, m.stake);
        token.safeTransfer(m.playerB, m.stake);
    }

    function _setFee(uint16 feeBps_) internal {
        if (feeBps_ > MAX_FEE_BPS) revert InvalidConfig();
        feeBps = feeBps_;
        emit FeeUpdated(feeBps_);
    }

    function _setResultSigner(address resultSigner_) internal {
        if (resultSigner_ == address(0)) revert InvalidConfig();
        resultSigner = resultSigner_;
        emit ResultSignerUpdated(resultSigner_);
    }

    function _setStakeLimits(uint128 minStake_, uint128 maxStake_) internal {
        if (minStake_ == 0 || maxStake_ < minStake_) revert InvalidConfig();
        minStake = minStake_;
        maxStake = maxStake_;
        emit StakeLimitsUpdated(minStake_, maxStake_);
    }

    function _setWindows(uint64 joinWindow_, uint64 settleWindow_) internal {
        // Settle window must cover the 90-second game plus server verification time.
        if (joinWindow_ < 1 minutes || settleWindow_ < 10 minutes || settleWindow_ > 7 days) revert InvalidConfig();
        joinWindow = joinWindow_;
        settleWindow = settleWindow_;
        emit WindowsUpdated(joinWindow_, settleWindow_);
    }
}
