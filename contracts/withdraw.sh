#!/usr/bin/env bash
# Withdraws the Mochi Duel treasury (the 25% fees). Only the owner wallet can do this.
#
#   ./contracts/withdraw.sh            show the treasury balance, then withdraw all of it
#   ./contracts/withdraw.sh 500        withdraw 500 $MOCHI
#   TO=0x… ./contracts/withdraw.sh     send it somewhere other than the owner wallet
#
# Asks for the owner's private key at a hidden prompt (never shown or saved), or uses the
# Foundry keystore named in ACCOUNT=… if you have one.
set -euo pipefail
cd "$(dirname "$0")"
CAST="${CAST:-$HOME/.foundry/bin/cast}"
RPC="${ROBINHOOD_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
set -a
source .env
set +a
ESC="$DUEL_CONTRACT"
TO="${TO:-$DUEL_OWNER}"

fees=$("$CAST" call "$ESC" "accruedFees()(uint256)" --rpc-url "$RPC" | awk '{print $1}')
echo "Treasury: $("$CAST" from-wei "$fees") MOCHI"
[ "$fees" != "0" ] || { echo "Nothing to withdraw yet."; exit 0; }

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

if [ -n "${1:-}" ]; then
  amount=$("$CAST" to-wei "$1")
  echo "Withdrawing $1 MOCHI to $TO"
  read -r -p "Type WITHDRAW to continue: " ok
  [ "$ok" = "WITHDRAW" ] || { echo "Cancelled."; exit 1; }
  "$CAST" send "$ESC" "withdrawFees(address,uint256)" "$TO" "$amount" --rpc-url "$RPC" "${SIGN[@]}"
else
  echo "Withdrawing all $("$CAST" from-wei "$fees") MOCHI to $TO"
  read -r -p "Type WITHDRAW to continue: " ok
  [ "$ok" = "WITHDRAW" ] || { echo "Cancelled."; exit 1; }
  "$CAST" send "$ESC" "withdrawAllFees(address)" "$TO" --rpc-url "$RPC" "${SIGN[@]}"
fi
echo "Treasury now: $("$CAST" from-wei "$("$CAST" call "$ESC" "accruedFees()(uint256)" --rpc-url "$RPC" | awk '{print $1}')") MOCHI"
