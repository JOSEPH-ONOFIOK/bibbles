import type { Metadata } from "next";
import Link from "next/link";
import { DuelApp } from "@/components/duel/DuelApp";
import { GameBackdrop } from "@/components/game/GameBackdrop";

const description = "Mochi Duel: stake $MOCHI against another player, play the same 90-second map, and the higher verified score wins the pot.";

export const metadata: Metadata = {
  title: "Mochi Duel",
  description,
  alternates: { canonical: "/play/duel" },
  openGraph: { url: "/play/duel", title: "Mochi Duel · Mochi Play", description },
  twitter: { title: "Mochi Duel · Mochi Play", description },
};

// Mochi Duel lives inside Mochi Play: the village plays itself behind it, like the game's start screen.
export default function DuelPage() {
  return (
    <div className="relative min-h-svh bg-[#9fdc7c]">
      <div className="fixed inset-0">
        <GameBackdrop focus={{ wide: [0.5, 0.78], narrow: [0.5, 0.8] }} />
      </div>
      <div className="pointer-events-none fixed inset-0 bg-[#1d1430]/30 backdrop-blur-[2px]" />

      <div className="relative pb-16">
        <header className="flex items-center justify-between gap-3 px-3 pt-3 sm:px-5 sm:pt-4">
          <Link href="/play" className="btn px-4! py-1.5! text-lg!">
            ← Mochi Play
          </Link>
          <Link href="/" className="text-sm font-bold text-white underline" style={{ textShadow: "0 1px 0 #161616" }}>
            Back to the site
          </Link>
        </header>

        <div className="mx-auto mt-6 mb-8 max-w-4xl px-4 text-center">
          <p className="font-display text-xl text-white" style={{ textShadow: "0 2px 0 #161616" }}>
            Mochi Play
          </p>
          <h1 className="font-display text-6xl text-white sm:text-7xl" style={{ textShadow: "5px 5px 0 #161616" }}>
            ⚔️ Mochi Duel
          </h1>
          <p className="mx-auto mt-2 inline-block rounded-full border-[3px] border-ink bg-[#fffaf3] px-4 py-1 font-bold">
            Stake $MOCHI. Play the same 90 seconds. Highest verified score wins.
          </p>
        </div>
        <DuelApp />
      </div>
    </div>
  );
}
