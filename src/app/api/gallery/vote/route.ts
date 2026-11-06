import { authed, bad } from "@/lib/api";
import { ipHash } from "@/lib/auth";
import { hasDatabase } from "@/lib/store";
import { vote } from "@/lib/wall";

// POST { handle }   one vote for a Mochi on display
export async function POST(req: Request) {
  if (!hasDatabase) return bad("The gallery opens soon.", 503);
  try {
    const a = await authed(req);
    if ("error" in a) return a.error;
    if (!a.entry.done.wallet) return bad("Add your wallet in the Join tasks to vote.");
    const r = await vote(a.entry, a.body.handle, ipHash(req));
    return r.error ? bad(r.error) : Response.json(r);
  } catch (e) {
    console.error("vote failed", e);
    return bad("Something went wrong. Please try again.", 500);
  }
}
