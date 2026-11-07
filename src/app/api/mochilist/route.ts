import { authed, bad } from "@/lib/api";
import { WALLET, toPublic } from "@/lib/entry";
import { connection } from "next/server";
import { checkHoldings, mlClaimedCount, mlCommunityCounts, mlConfirm, mlStats, mlWalletOwner } from "@/lib/holdings";
import { X_HANDLE } from "@/lib/mochi";
import { ANNOUNCEMENT_ID, ML_CAP, limitOf, mlTasksDone } from "@/lib/mochilist";
import { store } from "@/lib/store";
import { verifyClaimComment } from "@/lib/xpost";

// GET → { claimed, cap, by } for the progress bar
export async function GET() {
  await connection();
  try {
    return Response.json(await mlStats(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("mochilist stats failed", e);
    return bad("Couldn't load the count.", 500);
  }
}

const FULL = `All ${ML_CAP.toLocaleString("en-US")} MochiList spots are taken.`;
const fullMsg = (names: string[]) => `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} fully claimed.`;

// The collections they hold that still have room, in the order given
async function withRoom(names: string[]) {
  const counts = await mlCommunityCounts(names);
  return names.filter((n, i) => counts[i] < limitOf(n));
}

// POST { step, ... } moves the signed-in account through the MochiList claim.
//   wallet   { wallet }                 checks it holds an NFT from an eligible collection
//   follow                              clicked follow on our X account
//   engage   { action: like|repost }    clicked like or repost on the announcement
//   comment  { link }                   comment on the announcement saying they claimed (verified)
//   claim                               retry the final check, if a chain was down
// Once every step is done, the wallet is checked again and the spot is confirmed.
// Only then is the wallet reserved and sent to the sheet.
export async function POST(req: Request) {
  try {
    return await run(req);
  } catch (e) {
    console.error("mochilist failed", e);
    return bad("Something went wrong. Please try again.", 500);
  }
}

const downMsg = (down: string[]) => `We couldn't reach ${down.join(" and ")} just now. Try again in a minute.`;

async function run(req: Request) {
  const a = await authed(req);
  if ("error" in a) return a.error;
  const { entry, body } = a;
  const ml = (entry.ml ??= {});

  if (ml.claimedAt) return Response.json({ entry: toPublic(entry) });

  switch (body.step) {
    case "wallet": {
      const wallet = String(body.wallet ?? "").trim();
      if (!WALLET.test(wallet)) return bad("That isn't a valid EVM address. It starts with 0x followed by 40 characters.");
      const owner = await mlWalletOwner(wallet);
      if (owner && owner !== entry.handle.toLowerCase()) return bad("That wallet is already used for MochiList by another account.");
      if ((await mlClaimedCount()) >= ML_CAP) return bad(FULL);
      if (!(await store.limit(`mlcheck:${entry.handle.toLowerCase()}`, 10, 600))) return bad("Too many checks. Try again in a few minutes.", 429);

      const { held, down } = await checkHoldings(wallet);
      if (!held.length) {
        if (down.length) return bad(downMsg(down), 503);
        return bad("This wallet doesn't hold an NFT from an eligible collection.");
      }
      ml.wallet = wallet;
      const open = await withRoom(held);
      if (!open.length) return bad(fullMsg(held));
      ml.collection = open[0];
      break;
    }

    case "follow":
      if (!ml.collection) return bad("Check your wallet first.");
      ml.followed = true;
      break;

    case "engage":
      if (!ml.collection) return bad("Check your wallet first.");
      if (!ml.followed) return bad(`Follow ${X_HANDLE} first.`);
      if (body.action === "like") ml.liked = true;
      else if (body.action === "repost") ml.reposted = true;
      else return bad("Unknown action.");
      break;

    case "comment": {
      if (!ml.collection) return bad("Check your wallet first.");
      if (!ml.followed) return bad(`Follow ${X_HANDLE} first.`);
      if (!ml.liked || !ml.reposted) return bad("Like and repost the announcement first.");
      const r = await verifyClaimComment(String(body.link ?? ""), entry.handle, ANNOUNCEMENT_ID);
      if (!r.ok) return bad(r.error);
      ml.commentLink = r.link;
      break;
    }

    case "claim":
      if (!mlTasksDone(ml)) return bad("Finish every step first.");
      break;

    default:
      return bad("Unknown step.");
  }

  // Everything done: make sure they still hold before confirming
  if (mlTasksDone(ml) && ml.wallet) {
    const { held, down } = await checkHoldings(ml.wallet);
    let error = "";
    let status = 400;
    if (held.length) {
      // Their checked collection first, then anything else they hold
      const candidates = [...held.filter((h) => h === ml.collection), ...held.filter((h) => h !== ml.collection)];
      const r = await mlConfirm(entry.handle, ml.wallet, candidates);
      if (r.ok) {
        ml.collection = r.collection;
        ml.claimedAt = Date.now();
        if (r.spot) ml.spot = r.spot;
      } else
        error =
          r.reason === "full"
            ? FULL
            : r.reason === "community"
              ? fullMsg(held)
              : "That wallet was just used by another account. Check another wallet in step 1.";
    } else {
      error = down.length ? downMsg(down) : "Your wallet no longer holds an NFT from an eligible collection. Check another wallet in step 1.";
      if (down.length) status = 503;
    }
    if (error) {
      // Keep the step they just finished, so they can retry with Confirm my spot
      entry.updatedAt = Date.now();
      await store.put(entry);
      return Response.json({ error, entry: toPublic(entry) }, { status });
    }
  }

  entry.updatedAt = Date.now();
  await store.put(entry);
  return Response.json({ entry: toPublic(entry) });
}
