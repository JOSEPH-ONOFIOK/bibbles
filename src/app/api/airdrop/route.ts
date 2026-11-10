import { connection } from "next/server";
import { authed, bad } from "@/lib/api";
import { CLOSED_MSG, airdropOpen } from "@/lib/deadline";
import { AIRDROP_POST_ID } from "@/lib/airdrop";
import { getSession } from "@/lib/auth";
import { HANDLE, WALLET, toPublic } from "@/lib/entry";
import { X_HANDLE } from "@/lib/mochi";
import { hasDatabase, redis, store } from "@/lib/store";
import { verifyAirdropQrt } from "@/lib/xpost";

// $MOCHI airdrop application. Steps must go in order:
//   follow                            clicked follow on our X account
//   engage  { action: comment|repost } clicked comment or retweet on the airdrop post
//   qrt     { link }                  quote of the airdrop post with their invite link (verified)
//   wallet  { wallet, ref? }          EVM wallet, one per X account; completes the application
// GET → { applied, invites? } (invites: friends the signed-in account brought)

export async function GET() {
  await connection();
  if (!hasDatabase) return Response.json({ applied: 0, invites: 0 });
  const s = await getSession();
  const [applied, invites] = await Promise.all([
    redis<number>("SCARD", "airdrop:applied"),
    s ? redis<string | null>("ZSCORE", "airdrop:invites", s.h.toLowerCase()) : null,
  ]);
  return Response.json({ applied, invites: Number(invites ?? 0) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    return await run(req);
  } catch (e) {
    console.error("airdrop failed", e);
    return bad("Something went wrong. Please try again.", 500);
  }
}

async function run(req: Request) {
  // Nothing new after the deadline
  if (!airdropOpen()) return bad(CLOSED_MSG, 403);
  const a = await authed(req);
  if ("error" in a) return a.error;
  const { entry, body } = a;
  const ad = (entry.ad ??= {});
  const me = entry.handle.toLowerCase();
  if (ad.appliedAt) return Response.json({ entry: toPublic(entry) });

  const needFollow = () => (!ad.followed ? bad(`Follow ${X_HANDLE} first.`) : null);
  const needEngage = () => needFollow() ?? (!ad.commented || !ad.reposted ? bad("Comment on and retweet the airdrop post first.") : null);
  const needQrt = () => needEngage() ?? (!ad.qrtLink ? bad("Quote the airdrop post with your invite link first.") : null);

  switch (body.step) {
    case "follow":
      ad.followed = true;
      break;

    case "engage": {
      const no = needFollow();
      if (no) return no;
      if (body.action === "comment") ad.commented = true;
      else if (body.action === "repost") ad.reposted = true;
      else return bad("Unknown action.");
      break;
    }

    case "qrt": {
      const no = needEngage();
      if (no) return no;
      const r = await verifyAirdropQrt(String(body.link ?? ""), entry.handle, AIRDROP_POST_ID);
      if (!r.ok) return bad(r.error);
      ad.qrtLink = r.link;
      break;
    }

    case "wallet": {
      const no = needQrt();
      if (no) return no;
      const wallet = String(body.wallet ?? "").trim();
      if (!WALLET.test(wallet)) return bad("That isn't a valid EVM address. It starts with 0x followed by 40 characters.");
      if (hasDatabase) {
        const key = `adw:${wallet.toLowerCase()}`;
        const took = (await redis<string | null>("SET", key, me, "NX")) === "OK";
        if (!took && (await redis<string | null>("GET", key)) !== me) return bad("That wallet is already used for the airdrop by another account.");
      }
      ad.wallet = wallet;
      ad.appliedAt = Date.now();
      // Credit whoever invited them, if that's a real account other than their own
      const ref = String(body.ref ?? "").replace(/^@/, "").toLowerCase();
      if (HANDLE.test(ref) && ref !== me && (await store.get(ref))) {
        ad.invitedBy = ref;
        if (hasDatabase) await redis("ZINCRBY", "airdrop:invites", 1, ref);
      }
      if (hasDatabase) await redis("SADD", "airdrop:applied", me);
      break;
    }

    default:
      return bad("Unknown step.");
  }

  entry.updatedAt = Date.now();
  await store.put(entry);
  return Response.json({ entry: toPublic(entry) });
}
