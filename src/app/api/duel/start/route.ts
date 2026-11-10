import { type Hex } from "viem";
import { Status, startMessage } from "@/duel/config";
import { bad } from "@/lib/api";
import { chain, checkToken, getResult, isPlayer, readMatch, seedFor, startRun, tokenFor } from "@/lib/duel";
import { store } from "@/lib/store";
import { duelReady, ip, notReady, parseAddress, parseId } from "../_shared";

// POST { id, address, signature } → { token, seed, startAt, inputs, now }
// The wallet signs a short message to prove it's theirs. After that, { id, address, token } resumes
// without signing again (after a reload). The match must be locked onchain with
// this wallet as one of the two players. Calling again resumes the same run.
export async function POST(req: Request) {
  if (!duelReady()) return notReady();
  if (!(await store.limit(`duelstart:${ip(req)}`, 20, 60))) return bad("Slow down a little.", 429);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = parseId(body.id);
  const address = parseAddress(body.address);
  const signature = typeof body.signature === "string" && /^0x[0-9a-fA-F]+$/.test(body.signature) ? (body.signature as Hex) : null;
  if (!id || !address) return bad("Missing match or wallet.");
  if (typeof body.token === "string") {
    if (!checkToken(id.toString(), address, body.token)) return bad("Sign in again.", 401);
  } else {
    if (!signature) return bad("Missing signature.");
    const ok = await chain.verifyMessage({ address, message: startMessage(id.toString(), address), signature }).catch(() => false);
    if (!ok) return bad("That signature doesn't match your wallet.", 401);
  }

  const m = await readMatch(id).catch(() => null);
  if (!m) return bad("Match not found.", 404);
  if (!isPlayer(m, address)) return bad("You're not in this match.", 403);
  if (await getResult(m.id)) return bad("This match is already decided.", 409);
  if (m.status !== Status.Locked) return bad("Both stakes need to be in before the duel can start.", 409);
  if (Date.now() / 1000 > m.settleDeadline) return bad("This match has expired. Take your refund from the contract.", 409);

  const r = await startRun(m, address);
  if ("error" in r) return bad(r.error!, 409);
  return Response.json({ token: tokenFor(m.id, address), seed: seedFor(m.id), startAt: r.run.startAt, inputs: r.run.inputs, now: Date.now() });
}
