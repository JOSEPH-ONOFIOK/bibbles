// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MochiDuelEscrow} from "../src/MochiDuelEscrow.sol";

/// Deploys the escrow on Robinhood Chain. Settings come from the environment (see contracts/README.md).
contract Deploy is Script {
    function run() external returns (MochiDuelEscrow escrow) {
        IERC20 token = IERC20(vm.envAddress("MOCHI_TOKEN"));
        address owner = vm.envAddress("DUEL_OWNER");
        address signer = vm.envAddress("DUEL_SIGNER");
        uint16 feeBps = uint16(vm.envOr("DUEL_FEE_BPS", uint256(2_500)));
        uint128 minStake = uint128(vm.envUint("DUEL_MIN_STAKE"));
        uint128 maxStake = uint128(vm.envUint("DUEL_MAX_STAKE"));
        uint64 joinWindow = uint64(vm.envOr("DUEL_JOIN_WINDOW", uint256(30 minutes)));
        uint64 settleWindow = uint64(vm.envOr("DUEL_SETTLE_WINDOW", uint256(1 hours)));

        vm.startBroadcast();
        escrow = new MochiDuelEscrow(token, owner, signer, feeBps, minStake, maxStake, joinWindow, settleWindow);
        vm.stopBroadcast();

        console.log("MochiDuelEscrow deployed at", address(escrow));
    }
}
