import type { Metadata } from "next";
import { Referrals } from "@/components/Referrals";
import { Shell } from "@/components/Shell";
import { BRAND_PINK } from "@/lib/mochi";

const description = "Bring the most friends to the Mochis and secure one of multiple GTD free mint spots. Free mint, powered by $MOCHI.";

export const metadata: Metadata = {
  title: "Leaderboard",
  description,
  alternates: { canonical: "/leaderboard" },
  openGraph: { url: "/leaderboard", title: "Leaderboard · Mochi", description },
  twitter: { title: "Leaderboard · Mochi", description },
};

export default function LeaderboardPage() {
  return (
    <Shell>
      <section data-bg={BRAND_PINK} className="min-h-[70svh] bg-pink pt-32 pb-24">
        <Referrals />
      </section>
    </Shell>
  );
}
