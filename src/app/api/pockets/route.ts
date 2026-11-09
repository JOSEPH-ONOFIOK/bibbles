import { connection } from "next/server";
import { bad } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { cached } from "@/lib/cache";
import { GAME_OPEN, calendar } from "@/game/data";
import { hasDatabase, redis } from "@/lib/store";

// Pocket visits and Pocket of the week.
//   GET            → { week, top: [{ handle, votes }], recent: [handle], voted }
//   GET ?h=handle  → { pocket } one player's public Pocket

export type ShowPocket = { handle: string; name: string; look: Record<string, string>; pocket: Record<string, string>; level: number; at: number };

const pairs = (flat: string[]) => {
  const out: { handle: string; votes: number }[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ handle: flat[i], votes: Number(flat[i + 1]) });
  return out;
};

export async function GET(req: Request) {
  await connection();
  if (!GAME_OPEN) return bad("The game isn't open yet.", 404);
  if (!hasDatabase) return Response.json({ week: calendar().week, top: [], recent: [], voted: null });
  const h = new URL(req.url).searchParams.get("h")?.toLowerCase();
  if (h) {
    if (!/^\w{1,15}$/.test(h)) return bad("Unknown Pocket.", 404);
    const raw = await redis<string | null>("GET", `pocketshow:${h}`);
    if (!raw) return bad("That Pocket isn't open to visitors yet.", 404);
    const votes = await redis<string | null>("ZSCORE", `pvotes:${calendar().week}`, h);
    return Response.json({ pocket: JSON.parse(raw) as ShowPocket, votes: Number(votes ?? 0) });
  }
  const week = calendar().week;
  // Same list for everyone: cached for 30 seconds
  const lists = await cached(`pockets:${week}`, 30_000, async () => {
    const [top, recent] = await Promise.all([
      redis<string[]>("ZRANGE", `pvotes:${week}`, 0, 9, "REV", "WITHSCORES"),
      redis<string[]>("ZRANGE", "pockets", 0, 11, "REV"),
    ]);
    return { top: pairs(top), recent };
  });
  const s = await getSession();
  const voted = s ? await redis<string | null>("GET", `pvoted:${week}:${s.h.toLowerCase()}`) : null;
  return Response.json({ week, ...lists, voted });
}
