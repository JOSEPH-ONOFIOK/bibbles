#!/usr/bin/env bash
# Puts the house AI wallet's private key into .env.local (DUEL_HOUSE_KEY) without showing it.
# Run from the project folder:  ./scripts/set-house-key.sh
set -euo pipefail
cd "$(dirname "$0")/.."
CAST="${CAST:-$HOME/.foundry/bin/cast}"
EXPECTED=0xa03B9Ee489fc14308384b57A13ED34Cb78771d8C

read -r -s -p "House wallet private key (hidden): " PK
echo
PK="0x${PK#0x}"
FROM=$("$CAST" wallet address --private-key "$PK")
if [ "$(echo "$FROM" | tr 'A-F' 'a-f')" != "$(echo "$EXPECTED" | tr 'A-F' 'a-f')" ]; then
  echo "That key is for $FROM, expected $EXPECTED. Nothing changed." >&2
  exit 1
fi
touch .env.local
grep -v '^DUEL_HOUSE_KEY=' .env.local > .env.local.tmp || true
printf 'DUEL_HOUSE_KEY=%s\n' "$PK" >> .env.local.tmp
chmod 600 .env.local.tmp
mv .env.local.tmp .env.local
unset PK
echo "Saved DUEL_HOUSE_KEY for $FROM in .env.local. Restart the dev server to use it."
