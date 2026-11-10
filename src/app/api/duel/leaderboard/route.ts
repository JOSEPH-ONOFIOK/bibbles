import { connection } from "next/server";
import { PRIZE_MIN_WINS, PRIZE_POOL, PRIZE_SPLIT, duelWeek, weekEnds } from "@/duel/config";
import { boardKey, statsKey } from "@/lib/duel";
import { hasDatabase, redis } from "@/lib/store";
import { parseAddress } from "../_shared";

// GET /api/duel/leaderboard?week=…&address=0x…
//   → this week's (or a past week's) duel standings by net MOCHI won, with the prize each rank is on track for.
// Prizes go to the top 10 who finish in profit with at least PRIZE_MIN_WINS wins; unclaimed shares aren't moved up.

const TOP = 50;
type Row = { rank: number; address: string; net: number; wins: number; losses: number; prize: number };

const hash = (flat: string[] | null) => {
  const o: Record<string, string> = {};
  for (let i = 0; flat && i < flat.length; i += 2) o[flat[i]] = flat[i + 1];
  return o;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: Request) {
  await connection();
  const q = new URL(req.url).searchParams;
  const current = duelWeek();
  const asked = Number(q.get("week"));
  const week = Number.isInteger(asked) && asked > 0 && asked <= current ? asked : current;
  const me = parseAddress(q.get("address"))?.toLowerCase() ?? null;
  const base = { week, current, endsAt: weekEnds(week), pool: PRIZE_POOL, split: PRIZE_SPLIT, minWins: PRIZE_MIN_WINS };
  if (!hasDatabase) return Response.json({ ...base, rows: [], me: null });

  try {
    const flat = await redis<string[]>("ZRANGE", boardKey(week), 0, TOP - 1, "REV", "WITHSCORES");
    const pairs: [string, number][] = [];
    for (let i = 0; i < flat.length; i += 2) pairs.push([flat[i], Number(flat[i + 1])]);
    const stats = await Promise.all(pairs.map(([a]) => redis<string[]>("HGETALL", statsKey(week, a)).then(hash)));

    let prizeRank = 0;
    const rows: Row[] = pairs.map(([address, net], i) => {
      const wins = Number(stats[i].wins ?? 0);
      const losses = Number(stats[i].losses ?? 0);
      const eligible = net > 0 && wins >= PRIZE_MIN_WINS && prizeRank < PRIZE_SPLIT.length;
      const prize = eligible ? (PRIZE_POOL * PRIZE_SPLIT[prizeRank++]) / 100 : 0;
      return { rank: i + 1, address, net: round2(net), wins, losses, prize };
    });

    let mine: Row | null = null;
    if (me) {
      mine = rows.find((r) => r.address === me) ?? null;
      if (!mine) {
        const [rank, score, s] = await Promise.all([
          redis<number | null>("ZREVRANK", boardKey(week), me),
          redis<string | null>("ZSCORE", boardKey(week), me),
          redis<string[]>("HGETALL", statsKey(week, me)).then(hash),
        ]);
        if (rank !== null && score !== null)
          mine = { rank: rank + 1, address: me, net: round2(Number(score)), wins: Number(s.wins ?? 0), losses: Number(s.losses ?? 0), prize: 0 };
      }
    }
    return Response.json({ ...base, rows, me: mine }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("duel leaderboard", e);
    return Response.json({ error: "Couldn't load the leaderboard. Try again in a moment." }, { status: 502 });
  }
}
