# Mochi Duel escrow

`src/MochiDuelEscrow.sol` holds both players' $MOCHI stakes and pays the winner when the game server signs the result. Read the comments at the top of the contract for the rules it enforces.

> Draft. It has tests but no independent audit yet. Get one before real funds go in.

## Setup

```sh
cd contracts
forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0
forge test
```

## Wallets

| Wallet | Role |
|---|---|
| **Owner** | Changes settings, pauses new matches, withdraws the treasury (`withdrawFees` / `withdrawAllFees`). Use a hardware wallet or a Safe. |
| **Result signer** | Key the server signs results with (`DUEL_SIGNER_KEY`). Holds no funds. Used for nothing else. |
| Relayer (optional) | Hot wallet with a little ETH. If set (`DUEL_RELAYER_KEY`), the server pays winners itself; otherwise players press "Claim". |

The owner can never withdraw players' stakes, only fees already earned. A leaked signer key can only pick which of the two players in a match wins; swap it with `setResultSigner`.

## Deploy to Robinhood Chain (chain id 4663)

```sh
export ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com
export MOCHI_TOKEN=0x…            # the $MOCHI token
export DUEL_OWNER=0x…             # owner wallet / Safe
export DUEL_SIGNER=0x…            # address of the result signer key
export DUEL_FEE_BPS=2500          # 25%; the contract caps it at 2500
export DUEL_MIN_STAKE=100000000000000000000        # 100 MOCHI (18 decimals)
export DUEL_MAX_STAKE=100000000000000000000000     # 100,000 MOCHI
export DUEL_JOIN_WINDOW=1800      # 30 min for an opponent to join
export DUEL_SETTLE_WINDOW=3600    # 1 hour to post a result before refunds open

forge script script/Deploy.s.sol --rpc-url robinhood --broadcast --ledger   # or --private-key / --account
```

Check the token's decimals first (`cast call $MOCHI_TOKEN "decimals()(uint8)" --rpc-url robinhood`) and adjust the stake amounts.

## Website settings

Add these to the hosting environment, then redeploy:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_DUEL_CONTRACT` | deployed escrow address |
| `NEXT_PUBLIC_MOCHI_TOKEN` | $MOCHI token address |
| `NEXT_PUBLIC_PONS_URL` | the verified $MOCHI page on Pons |
| `NEXT_PUBLIC_ROBINHOOD_EXPLORER` | optional, block explorer base URL for transaction links |
| `DUEL_SIGNER_KEY` | private key of the result signer (secret) |
| `DUEL_SECRET` | random string, 32+ characters, for map seeds (secret): `openssl rand -hex 32` |
| `DUEL_RELAYER_KEY` | optional, relayer private key (secret) |
| `ROBINHOOD_RPC_URL` | optional, private RPC for the server |

Upstash Redis must be set up (it already is for the site). Until the contract and token are set, `/duel` shows "Coming soon".
