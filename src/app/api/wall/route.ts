import { connection } from "next/server";
import { getSession } from "@/lib/auth";
import { cached } from "@/lib/cache";
import { hasDatabase } from "@/lib/store";
import { isDisplayed, referralStats, topReferrers } from "@/lib/wall";

// The referral leaderboard, plus the signed-in visitor's own numbers
export async function GET() {
  await connection();
  if (!hasDatabase) return Response.json({ on: false, top: [], me: null });
  try {
    const s = await getSession();
    const [top, me] = await Promise.all([
      // The leaderboard is the same for everyone
      cached("topReferrers", 30_000, () => topReferrers()),
      s ? Promise.all([referralStats(s.h), isDisplayed(s.h)]).then(([r, displayed]) => ({ ...r, displayed })) : null,
    ]);
    return Response.json({ on: true, top, me });
  } catch (e) {
    console.error("wall failed", e);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
