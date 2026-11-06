import { connection, type NextRequest } from "next/server";
import { authed, bad } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { hasDatabase } from "@/lib/store";
import { galleryPage, putOnDisplay } from "@/lib/wall";

// GET ?sort=top|new&page=0   one page of the gallery
export async function GET(req: NextRequest) {
  await connection();
  if (!hasDatabase) return Response.json({ on: false, items: [], total: 0, more: false });
  const q = req.nextUrl.searchParams;
  const sort = q.get("sort") === "new" ? "new" : "top";
  const page = Math.max(0, Math.min(1000, Math.floor(Number(q.get("page")) || 0)));
  try {
    const s = await getSession();
    return Response.json({ on: true, ...(await galleryPage(sort, page, s?.h)) });
  } catch (e) {
    console.error("gallery failed", e);
    return bad("Something went wrong. Please try again.", 500);
  }
}

// POST { name, look }   puts the visitor's Mochi on display
export async function POST(req: Request) {
  if (!hasDatabase) return bad("The gallery opens soon.", 503);
  try {
    const a = await authed(req);
    if ("error" in a) return a.error;
    if (!a.entry.done.wallet) return bad("Add your wallet first, so an airdrop has somewhere to go.");
    const r = await putOnDisplay(a.entry, a.body.name, a.body.look);
    return r.error ? bad(r.error) : Response.json(r);
  } catch (e) {
    console.error("display failed", e);
    return bad("Something went wrong. Please try again.", 500);
  }
}
