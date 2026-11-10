#!/usr/bin/env bash
# Changes the Mochi Duel stake limits (whole $MOCHI per player). Only the owner wallet can do this.
#
#   ./contracts/set-stake-limits.sh 100 50000      min 100, max 50,000 MOCHI
#
# Asks for the owner's private key at a hidden prompt (never shown or saved), or uses the
# Foundry keystore named in ACCOUNT=… if you have one. Duels already open keep their stake.
set -euo pipefail
cd "$(dirname "$0")"
CAST="${CAST:-$HOME/.foundry/bin/cast}"
RPC="${ROBINHOOD_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
set -a
source .env
set +a
ESC="$DUEL_CONTRACT"

[ $# -eq 2 ] || { echo "Usage: $0 <min MOCHI> <max MOCHI>"; exit 1; }
MIN=$("$CAST" to-wei "$1")
MAX=$("$CAST" to-wei "$2")

now_min=$("$CAST" call "$ESC" "minStake()(uint128)" --rpc-url "$RPC" | awk '{print $1}')
now_max=$("$CAST" call "$ESC" "maxStake()(uint128)" --rpc-url "$RPC" | awk '{print $1}')
echo "Now:   $("$CAST" from-wei "$now_min") – $("$CAST" from-wei "$now_max") MOCHI"
echo "New:   $1 – $2 MOCHI"

if [ -n "${ACCOUNT:-}" ]; then
  SIGN=(--account "$ACCOUNT")
  FROM=$("$CAST" wallet address --account "$ACCOUNT")
else
  read -r -s -p "Owner private key (hidden): " PK
  echo
  PK="${PK#0x}"
  SIGN=(--private-key "0x$PK")
  FROM=$("$CAST" wallet address --private-key "0x$PK")
  unset PK
fi
if [ "$(echo "$FROM" | tr 'A-F' 'a-f')" != "$(echo "$DUEL_OWNER" | tr 'A-F' 'a-f')" ]; then
  echo "That key is for $FROM, but the owner is $DUEL_OWNER. Stopping." >&2
  exit 1
fi
read -r -p "Type UPDATE to continue: " ok
[ "$ok" = "UPDATE" ] || { echo "Cancelled."; exit 1; }

"$CAST" send "$ESC" "setStakeLimits(uint128,uint128)" "$MIN" "$MAX" --rpc-url "$RPC" "${SIGN[@]}"
echo "Onchain now: $("$CAST" from-wei "$("$CAST" call "$ESC" "minStake()(uint128)" --rpc-url "$RPC" | awk '{print $1}')") – $("$CAST" from-wei "$("$CAST" call "$ESC" "maxStake()(uint128)" --rpc-url "$RPC" | awk '{print $1}')") MOCHI"
