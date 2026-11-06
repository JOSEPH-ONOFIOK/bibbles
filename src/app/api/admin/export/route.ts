import { signupRow } from "@/lib/entry";
import { hasDatabase, store } from "@/lib/store";
import { allStats } from "@/lib/wall";

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
  const stats = await allStats();
  const rows = (await store.all()).sort((a, b) => a.createdAt - b.createdAt).map((e) => signupRow(e, stats(e.handle)));
  const header = Object.keys(rows[0] ?? signupRow({ handle: "", createdAt: 0, updatedAt: 0, done: {} }));
  const lines = rows.map((r) => Object.values(r).map(cell).join(","));
  return new Response([header.join(","), ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="mochi-signups.csv"' },
  });
}
