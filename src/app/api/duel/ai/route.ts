import { type Hex } from "viem";
import { aiJoinMessage } from "@/duel/config";
import { bad } from "@/lib/api";
import { aiJoin, chain, readMatch } from "@/lib/duel";
import { store } from "@/lib/store";
import { duelReady, notReady, parseAddress, parseId } from "../_shared";

// POST { id, address, signature } → { tx }
// The duel's creator asks the house AI to take their open duel. They sign a short message so
// nobody else can pull the AI into their duel.
export async function POST(req: Request) {
  if (!duelReady()) return notReady();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = parseId(body.id);
  const address = parseAddress(body.address);
  const signature = typeof body.signature === "string" && /^0x[0-9a-fA-F]+$/.test(body.signature) ? (body.signature as Hex) : null;
  if (!id || !address || !signature) return bad("Missing duel, wallet or signature.");
  if (!(await store.limit(`duelai:${address.toLowerCase()}`, 20, 60 * 60))) return bad("That's a lot of AI duels. Try again in a while.", 429);

  const ok = await chain.verifyMessage({ address, message: aiJoinMessage(id.toString(), address), signature }).catch(() => false);
  if (!ok) return bad("That signature doesn't match your wallet.", 401);
  const m = await readMatch(id).catch(() => null);
  if (!m) return bad("Duel not found.", 404);

  const r = await aiJoin(m, address);
  if ("error" in r) return bad(r.error, 409);
  return Response.json(r);
}
