import { isComplete } from "@/lib/entry";
import { hasDatabase, store } from "@/lib/store";

// GET /api/admin/export?key=ADMIN_KEY → CSV of every sign up
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return new Response("Not found", { status: 404 });
  if (!hasDatabase) {
    return new Response("No database connected: progress is kept in each visitor's browser, so there is no list to export.", { status: 503 });
  }

  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // quote, and stop spreadsheets from running cells as formulas
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const iso = (t?: number) => (t ? new Date(t).toISOString() : "");
  const rows = (await store.all()).sort((a, b) => a.createdAt - b.createdAt);
  const header = ["handle", "wallet", "complete", "followed", "liked_reposted", "tag_reply", "bibble_post", "joined_at", "completed_at"];
  const lines = rows.map((e) =>
    [
      e.handle,
      e.wallet,
      isComplete(e) ? "yes" : "no",
      iso(e.done.follow),
      iso(e.done.engage),
      e.tagLink,
      e.bibbleLink,
      iso(e.createdAt),
      isComplete(e) ? iso(Math.max(...Object.values(e.done).map(Number))) : "",
    ]
      .map(cell)
      .join(","),
  );
  return new Response([header.join(","), ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="bibbles-signups.csv"' },
  });
}
