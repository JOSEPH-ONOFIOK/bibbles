import { connection } from "next/server";
import { bad } from "@/lib/api";
import { getRun, isHouse, liveScore, readMatch, resolve, runDeadline } from "@/lib/duel";
import { duelReady, notReady, parseId } from "../_shared";

// GET /api/duel/state?id=1 → the match onchain, each player's live verified score, and the result once decided.
// Calling it is also what decides a finished match, so the players' pages poll it.
export async function GET(req: Request) {
  await connection();
  if (!duelReady()) return notReady();
  const id = parseId(new URL(req.url).searchParams.get("id"));
  if (!id) return bad("Bad match id.");
  try {
    const m = await readMatch(id);
    if (!m) return bad("Match not found.", 404);
    const [a, b] = await Promise.all([getRun(m.id, m.playerA), getRun(m.id, m.playerB)]);
    const view = (r: typeof a) =>
      r ? { started: true, startAt: r.startAt, deadline: runDeadline(r), rejected: r.rejected ?? null, ...liveScore(m.id, r)! } : { started: false };
    const result = await resolve(m);
    const ai = isHouse(m.playerA) ? "a" : isHouse(m.playerB) ? "b" : null;
    return Response.json({ match: m, a: view(a), b: view(b), ai, result, now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("duel state", e);
    return Response.json({ error: "Couldn't reach Robinhood Chain. Try again in a moment." }, { status: 502 });
  }
}
