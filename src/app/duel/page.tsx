import type { Metadata } from "next";
import { Mesh } from "@/components/Mesh";
import { Shell } from "@/components/Shell";
import { DuelApp } from "@/components/duel/DuelApp";

const description = "Mochi Duel: stake $MOCHI against another player, play the same 90-second map, and the higher verified score wins the pot.";

export const metadata: Metadata = {
  title: "Mochi Duel",
  description,
  alternates: { canonical: "/duel" },
  openGraph: { url: "/duel", title: "Mochi Duel · Mochi", description },
  twitter: { title: "Mochi Duel · Mochi", description },
};

export default function DuelPage() {
  return (
    <Shell>
      <section data-bg="#e2d4ff" className="relative isolate min-h-[70svh] pt-32 pb-24">
        <Mesh />
        <div className="mx-auto mb-8 max-w-4xl px-4 text-center">
          <h1 className="font-display text-6xl text-white sm:text-7xl" style={{ textShadow: "5px 5px 0 #161616" }}>
            Mochi Duel
          </h1>
          <p className="mt-2 font-bold">Stake $MOCHI. Play the same 90 seconds. Highest verified score wins.</p>
        </div>
        <DuelApp />
      </section>
    </Shell>
  );
}
