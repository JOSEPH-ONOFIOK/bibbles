import { connection } from "next/server";
import { authMode, getSession } from "@/lib/auth";
import { toPublic } from "@/lib/entry";
import { store } from "@/lib/store";

export async function GET() {
  // Answer at request time: sign in mode and storage come from runtime settings
  await connection();
  const s = await getSession();
  const entry = s ? await store.get(s.h).catch(() => null) : null;
  return Response.json({ entry: entry ? toPublic(entry) : null, auth: authMode });
}
