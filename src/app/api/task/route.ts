import { authed, bad } from "@/lib/api";
import { PINNED_ID, TASK_ORDER, WALLET, toPublic, type TaskId } from "@/lib/entry";
import { store } from "@/lib/store";
import { verifyMochiPost, verifyTagReply } from "@/lib/xpost";

// POST { task, ... } completes one task for the signed-in account.
//   follow                       clicked the follow button
//   engage  { action: like|repost }  clicked like or repost; done when both are
//   tag     { link }             reply under the pinned post tagging a friend (verified)
//   wallet  { wallet }           EVM address, one per account
//   mochi  { link }             post with their Mochi, tagging us, with their wallet (verified)
export async function POST(req: Request) {
  try {
    return await complete(req);
  } catch (e) {
    console.error("task failed", e);
    return bad("Something went wrong. Please try again.", 500);
  }
}

async function complete(req: Request) {
  const a = await authed(req);
  if ("error" in a) return a.error;
  const { entry, body } = a;
  const task = body.task as TaskId;
  if (!TASK_ORDER.includes(task)) return bad("Unknown task.");
  const now = Date.now();

  switch (task) {
    case "follow":
      entry.done.follow ??= now;
      break;

    case "engage": {
      if (!PINNED_ID) return bad("The pinned post isn't set yet.", 503);
      if (body.action === "like") entry.liked = true;
      else if (body.action === "repost") entry.reposted = true;
      else return bad("Unknown action.");
      if (entry.liked && entry.reposted) entry.done.engage ??= now;
      break;
    }

    case "tag": {
      if (!PINNED_ID) return bad("The pinned post isn't set yet.", 503);
      const r = await verifyTagReply(String(body.link ?? ""), entry.handle, PINNED_ID);
      if (!r.ok) return bad(r.error);
      entry.tagLink = r.link;
      entry.done.tag ??= now;
      break;
    }

    case "wallet": {
      const wallet = String(body.wallet ?? "").trim();
      if (!WALLET.test(wallet)) return bad("That isn't a valid EVM address. It starts with 0x followed by 40 characters.");
      if (entry.done.mochi && wallet.toLowerCase() !== entry.wallet?.toLowerCase()) {
        return bad("Your Mochi post already uses your current wallet, so it can't be changed now.");
      }
      const owner = await store.walletOwner(wallet);
      if (owner && owner !== entry.handle.toLowerCase()) return bad("That wallet is already used by another account.");
      await store.claimWallet(wallet, entry.handle, entry.wallet);
      entry.wallet = wallet;
      entry.done.wallet ??= now;
      break;
    }

    case "mochi": {
      if (!entry.wallet) return bad("Add your wallet in step 4 first.");
      const r = await verifyMochiPost(String(body.link ?? ""), entry.handle, entry.wallet);
      if (!r.ok) return bad(r.error);
      entry.mochiLink = r.link;
      entry.done.mochi ??= now;
      break;
    }
  }

  entry.updatedAt = now;
  await store.put(entry);
  return Response.json({ entry: toPublic(entry) });
}
