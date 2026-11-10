#!/usr/bin/env bash
# Deploys MochiDuelEscrow to Robinhood Chain from your own terminal.
#
# Run:  ./contracts/deploy.sh
# It uses the Foundry keystore "mochi-deployer" if you made one (cast wallet import mochi-deployer --interactive);
# otherwise it asks for the deployer's private key at a hidden prompt. The key is never shown or saved.
set -euo pipefail
cd "$(dirname "$0")"
FORGE="${FORGE:-$HOME/.foundry/bin/forge}"
CAST="${CAST:-$HOME/.foundry/bin/cast}"
RPC="${ROBINHOOD_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
ACCOUNT="${ACCOUNT:-mochi-deployer}"
EXPECTED_DEPLOYER=0xa03B9Ee489fc14308384b57A13ED34Cb78771d8C

set -a
source .env
set +a

if "$CAST" wallet list 2>/dev/null | grep -q "^$ACCOUNT "; then
  SIGN=(--account "$ACCOUNT")
  FROM=$("$CAST" wallet address --account "$ACCOUNT")
else
  read -r -s -p "Deployer private key (hidden): " PK
  echo
  PK="${PK#0x}"
  SIGN=(--private-key "0x$PK")
  FROM=$("$CAST" wallet address --private-key "0x$PK")
  unset PK
fi
if [ "$(echo "$FROM" | tr 'A-F' 'a-f')" != "$(echo "$EXPECTED_DEPLOYER" | tr 'A-F' 'a-f')" ]; then
  echo "That key is for $FROM, expected $EXPECTED_DEPLOYER. Stopping." >&2
  exit 1
fi

echo "Deploying MochiDuelEscrow on chain $("$CAST" chain-id --rpc-url "$RPC") from $FROM"
echo "  token   $MOCHI_TOKEN"
echo "  owner   $DUEL_OWNER"
echo "  signer  $DUEL_SIGNER"
echo "  fee     $DUEL_FEE_BPS bps, stakes $DUEL_MIN_STAKE..$DUEL_MAX_STAKE, windows ${DUEL_JOIN_WINDOW}s / ${DUEL_SETTLE_WINDOW}s"
read -r -p "Type DEPLOY to continue: " ok
[ "$ok" = "DEPLOY" ] || { echo "Cancelled."; exit 1; }

"$FORGE" create src/MochiDuelEscrow.sol:MochiDuelEscrow \
  --rpc-url "$RPC" "${SIGN[@]}" --broadcast \
  --constructor-args "$MOCHI_TOKEN" "$DUEL_OWNER" "$DUEL_SIGNER" "$DUEL_FEE_BPS" "$DUEL_MIN_STAKE" "$DUEL_MAX_STAKE" "$DUEL_JOIN_WINDOW" "$DUEL_SETTLE_WINDOW"
