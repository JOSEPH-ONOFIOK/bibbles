import { bad } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { GAME_OPEN, calendar } from "@/game/data";
import { hasDatabase, redis, store } from "@/lib/store";

// POST { h } → one vote a week for Pocket of the week, never for your own
export async function POST(req: Request) {
  if (!GAME_OPEN) return bad("The game isn't open yet.", 404);
  const s = await getSession();
  if (!s) return bad("Connect your X to vote.", 401);
  if (!hasDatabase) return bad("Voting isn't open yet.", 503);
  const { h } = (await req.json().catch(() => ({}))) as { h?: string };
  const handle = String(h ?? "").toLowerCase();
  const me = s.h.toLowerCase();
  if (!/^\w{1,15}$/.test(handle)) return bad("Unknown Pocket.");
  if (handle === me) return bad("You can't vote for your own Pocket.");
  if (!(await store.limit(`pvote:${me}`, 5, 60))) return bad("Slow down a little.", 429);
  if (!(await redis<string | null>("GET", `pocketshow:${handle}`))) return bad("Unknown Pocket.", 404);
  const week = calendar().week;
  const took = (await redis<string | null>("SET", `pvoted:${week}:${me}`, handle, "NX", "EX", 14 * 86400)) === "OK";
  if (!took) return bad("You've already voted this week.");
  const votes = await redis<number>("ZINCRBY", `pvotes:${week}`, 1, handle);
  return Response.json({ ok: true, votes: Number(votes) });
}
