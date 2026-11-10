import { bad } from "@/lib/api";
import { addMoves, checkToken, score } from "@/lib/duel";
import { store } from "@/lib/store";
import { TICKS } from "@/duel/sim";
import { duelReady, notReady, parseAddress, parseId } from "../_shared";

// POST { id, address, token, from, moves } → { length, score, rejected? }
// Sent every couple of seconds during the run. `length` is how many ticks the server has;
// the client resends from there if a request got lost.
export async function POST(req: Request) {
  if (!duelReady()) return notReady();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = parseId(body.id);
  const address = parseAddress(body.address);
  if (!id || !address || !checkToken(id.toString(), address, String(body.token ?? ""))) return bad("Not signed in for this match.", 401);
  if (!(await store.limit(`duelmv:${id}:${address.toLowerCase()}`, 10, 5))) return bad("Slow down a little.", 429);
  const from = Number(body.from);
  const moves = String(body.moves ?? "");
  if (!Number.isInteger(from) || from < 0 || moves.length > TICKS) return bad("Bad moves.");

  const r = await addMoves(id.toString(), address, from, moves);
  if ("error" in r) return bad(r.error!, 409);
  return Response.json({ length: r.run.inputs.length, score: score(id.toString(), r.run), rejected: r.run.rejected ?? null });
}
