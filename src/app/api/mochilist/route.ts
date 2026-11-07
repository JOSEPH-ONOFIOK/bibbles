import { authed, bad } from "@/lib/api";
import { WALLET, toPublic } from "@/lib/entry";
import { checkHoldings, mlClaimWallet, mlConfirm, mlWalletOwner } from "@/lib/holdings";
import { ANNOUNCEMENT_ID, mlTasksDone } from "@/lib/mochilist";
import { store } from "@/lib/store";
import { verifyClaimComment, verifyClaimPost } from "@/lib/xpost";

// POST { step, ... } moves the signed-in account through the MochiList claim.
//   wallet   { wallet }                 checks it holds an NFT from an eligible collection
//   engage   { action: like|repost }    clicked like or repost on the announcement
//   comment  { link }                   comment on the announcement saying they claimed (verified)
//   post     { link }                   post tagging us with $MOCHI (verified)
//   claim                               retry the final check, if a chain was down
// Once every step is done, the wallet is checked again and the spot is confirmed.
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
      if (!(await store.limit(`mlcheck:${entry.handle.toLowerCase()}`, 10, 600))) return bad("Too many checks. Try again in a few minutes.", 429);

      const { held, down } = await checkHoldings(wallet);
      if (!held.length) {
        if (down.length) return bad(downMsg(down), 503);
        return bad("This wallet doesn't hold an NFT from an eligible collection.");
      }
      await mlClaimWallet(wallet, entry.handle, ml.wallet);
      ml.wallet = wallet;
      ml.collection = held[0];
      break;
    }

    case "engage":
      if (!ml.collection) return bad("Check your wallet first.");
      if (body.action === "like") ml.liked = true;
      else if (body.action === "repost") ml.reposted = true;
      else return bad("Unknown action.");
      break;

    case "comment": {
      if (!ml.collection) return bad("Check your wallet first.");
      const r = await verifyClaimComment(String(body.link ?? ""), entry.handle, ANNOUNCEMENT_ID);
      if (!r.ok) return bad(r.error);
      ml.commentLink = r.link;
      break;
    }

    case "post": {
      if (!ml.collection) return bad("Check your wallet first.");
      const r = await verifyClaimPost(String(body.link ?? ""), entry.handle, ml.commentLink);
      if (!r.ok) return bad(r.error);
      ml.postLink = r.link;
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
    if (held.length) {
      ml.collection = held.includes(ml.collection!) ? ml.collection : held[0];
      ml.claimedAt = Date.now();
      await mlConfirm(entry.handle);
    } else {
      // Keep the step they just finished, so they can retry with Confirm my spot
      entry.updatedAt = Date.now();
      await store.put(entry);
      const error = down.length ? downMsg(down) : "Your wallet no longer holds an NFT from an eligible collection. Check another wallet in step 1.";
      return Response.json({ error, entry: toPublic(entry) }, { status: down.length ? 503 : 400 });
    }
  }

  entry.updatedAt = Date.now();
  await store.put(entry);
  return Response.json({ entry: toPublic(entry) });
}
