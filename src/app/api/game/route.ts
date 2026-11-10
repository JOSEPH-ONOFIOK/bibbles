import { connection } from "next/server";
import { bad } from "@/lib/api";
import { gameOpen } from "@/game/data";
import { getSession } from "@/lib/auth";
import { hasDatabase, redis, store } from "@/lib/store";

// The game save for the signed-in X account, so it follows them across devices.
//   GET  → { save } (null if none yet); 401 when not signed in
//   POST { save } → stores it. At most one save every 20 seconds per account.
// The game itself runs in the browser; before $MOCHI rewards depend on it, the
// server should check each change instead of trusting the whole save.

const MAX_BYTES = 64_000;
const key = (h: string) => `game:${h.toLowerCase()}`;

export async function GET() {
  await connection();
  if (!gameOpen()) return bad("The game isn't open yet.", 404);
  const s = await getSession();
  if (!s) return bad("Sign in with X to save your game online.", 401);
  if (!hasDatabase) return Response.json({ save: null });
  const raw = await redis<string | null>("GET", key(s.h));
  return Response.json({ save: raw ? JSON.parse(raw) : null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!gameOpen()) return bad("The game isn't open yet.", 404);
  const s = await getSession();
  if (!s) return bad("Sign in with X to save your game online.", 401);
  if (!hasDatabase) return Response.json({ ok: true });
  const text = await req.text();
  if (text.length > MAX_BYTES) return bad("Save is too large.", 413);
  type Show = { name?: string; look?: Record<string, string> };
  let save: { v?: number; savedAt?: number; level?: number; pocket?: Record<string, string> } | undefined;
  let show: Show | undefined;
  try {
    const body = JSON.parse(text) as { save?: typeof save; show?: Show };
    save = body.save;
    show = body.show;
  } catch {
    return bad("Bad save.");
  }
  if (!save || save.v !== 2 || typeof save.savedAt !== "number") return bad("Bad save.");
  if (!(await store.limit(`gamesave:${s.h.toLowerCase()}`, 1, 20))) return Response.json({ ok: true, skipped: true });
  await redis("SET", key(s.h), JSON.stringify(save));
  // A public copy of their Pocket, for visits and Pocket of the week
  const h = s.h.toLowerCase();
  const look = Object.fromEntries(Object.entries(show?.look ?? {}).filter(([k, v]) => /^(skin|face|aura|head|fit)$/.test(k) && /^[a-z]{1,16}$/.test(String(v))));
  const name = String(show?.name ?? "").replace(/[^\p{L}\p{N} '’-]/gu, "").slice(0, 24) || s.h;
  const pocket = Object.fromEntries(Object.entries(save.pocket ?? {}).filter(([k, v]) => /^\d,\d$/.test(k) && /^[a-z]{1,20}$/.test(String(v))).slice(0, 40));
  await redis("SET", `pocketshow:${h}`, JSON.stringify({ handle: s.h, name, look, pocket, level: Number(save.level) || 1, at: save.savedAt }));
  await redis("ZADD", "pockets", Date.now(), h);
  return Response.json({ ok: true });
}
