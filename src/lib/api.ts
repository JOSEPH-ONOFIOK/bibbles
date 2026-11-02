import { getSession } from "./auth";
import type { Entry } from "./entry";
import { store } from "./store";

export const bad = (error: string, status = 400) => Response.json({ error }, { status });

// Creates the entry on first sign in, or returns the existing one
export async function enroll(handle: string, xid?: string) {
  const existing = await store.get(handle);
  if (existing) {
    if (xid && existing.xid && existing.xid !== xid) throw new Error("handle_taken");
    if (xid && !existing.xid) {
      existing.xid = xid;
      await store.put(existing);
    }
    return existing;
  }
  const now = Date.now();
  const entry: Entry = { handle, xid, createdAt: now, updatedAt: now, done: {} };
  await store.put(entry);
  return entry;
}

// Reads the session and JSON body, and applies a per-account rate limit
export async function authed(req: Request) {
  const s = await getSession();
  if (!s) return { error: bad("Connect your X first.", 401) };
  const entry = await store.get(s.h);
  if (!entry) return { error: bad("Account not found. Connect your X again.", 401) };
  if (!(await store.limit(`act:${s.h.toLowerCase()}`, 30, 60))) return { error: bad("Slow down a little. Try again in a minute.", 429) };
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return { entry, body };
}
