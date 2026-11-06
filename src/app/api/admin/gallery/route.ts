import { hasDatabase } from "@/lib/store";
import { hideDisplay } from "@/lib/wall";

// POST /api/admin/gallery?key=ADMIN_KEY&hide=handle → takes a Mochi off the wall for good
export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  if (!process.env.ADMIN_KEY || q.get("key") !== process.env.ADMIN_KEY) return new Response("Not found", { status: 404 });
  const handle = q.get("hide");
  if (!hasDatabase || !handle) return Response.json({ error: "Nothing to hide." }, { status: 400 });
  await hideDisplay(handle);
  return Response.json({ ok: true, hidden: handle });
}
