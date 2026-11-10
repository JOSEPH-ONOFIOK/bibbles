import { connection } from "next/server";
import { DUEL_CONTRACT, Status, escrowAbi } from "@/duel/config";
import { AI_MAX_STAKE, chain, house, readMatch, readToken, type OnchainMatch } from "@/lib/duel";
import { duelReady, notReady, parseAddress } from "../_shared";

// GET /api/duel/lobby?address=0x…
//   → { config, open: matches waiting for an opponent, mine: the wallet's recent matches }
// Reads the latest 40 matches from the contract, cached for a few seconds.

const RECENT = 40;
let cache: { at: number; config: unknown; matches: OnchainMatch[] } | undefined;

async function load() {
  if (cache && Date.now() - cache.at < 4000) return cache;
  const [next, feeBps, minStake, maxStake, token] = await Promise.all([
    chain.readContract({ address: DUEL_CONTRACT!, abi: escrowAbi, functionName: "nextMatchId" }),
    chain.readContract({ address: DUEL_CONTRACT!, abi: escrowAbi, functionName: "feeBps" }),
    chain.readContract({ address: DUEL_CONTRACT!, abi: escrowAbi, functionName: "minStake" }),
    chain.readContract({ address: DUEL_CONTRACT!, abi: escrowAbi, functionName: "maxStake" }),
    readToken(),
  ]);
  const ids: bigint[] = [];
  for (let i = next - BigInt(1); i >= BigInt(1) && ids.length < RECENT; i--) ids.push(i);
  const matches = (await Promise.all(ids.map((id) => readMatch(id).catch(() => null)))).filter(Boolean) as OnchainMatch[];
  cache = {
    at: Date.now(),
    config: { feeBps, minStake: minStake.toString(), maxStake: maxStake.toString(), ...token, house, aiMaxStake: AI_MAX_STAKE },
    matches,
  };
  return cache;
}

export async function GET(req: Request) {
  await connection();
  if (!duelReady()) return notReady();
  const address = parseAddress(new URL(req.url).searchParams.get("address"));
  try {
    const { config, matches } = await load();
    const now = Date.now() / 1000;
    const open = matches.filter((m) => m.status === Status.Open && m.joinDeadline > now);
    const me = address?.toLowerCase();
    const mine = me ? matches.filter((m) => m.playerA.toLowerCase() === me || m.playerB.toLowerCase() === me) : [];
    return Response.json({ config, open, mine }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("duel lobby", e);
    return Response.json({ error: "Couldn't reach Robinhood Chain. Try again in a moment." }, { status: 502 });
  }
}
