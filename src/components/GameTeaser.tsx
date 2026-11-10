"use client";

import Link from "next/link";
import { GAME_OPEN_AT } from "@/game/data";
import { Countdown, useGameOpen } from "./Countdown";
import { X_HANDLE, X_URL } from "@/lib/mochi";
import { GameBackdrop } from "./game/GameBackdrop";

// The game playing itself behind a short pitch, on the home page
export function GameTeaser() {
  const open = useGameOpen();
  return (
    <section id="game" data-bg="#ccffb2" className="relative isolate h-[78svh] min-h-[520px] scroll-mt-20 overflow-hidden border-t-4 border-ink">
      {/* Keep the Mochi in the open: right of the card on wide screens, above it on phones */}
      <GameBackdrop focus={{ wide: [0.7, 0.5], narrow: [0.5, 0.26] }} />
      {/* Soften the edge behind the card so it stays readable */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#fffaf3]/85 via-[#fffaf3]/25 to-transparent sm:from-[#fffaf3]/80 sm:via-transparent" />
      <div className="relative mx-auto flex h-full max-w-6xl items-end px-4 pb-10 sm:items-center sm:pb-0">
        <div className="chunk pop-in w-full max-w-md p-5 sm:p-8">
          <p className="inline-flex items-center gap-2 rounded-full border-[3px] border-ink bg-[#ccffb2] px-3 py-0.5 font-display text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1f9d55] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1f9d55]" />
            </span>
            {open ? "Live from the game" : "Opens today"}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-none sm:text-6xl">Play as your Mochi</h2>
          <p className="mt-2 font-semibold text-ink/75 sm:hidden">Gather, farm, build and explore. A cosy little adventure.</p>
          <p className="mt-3 hidden font-semibold text-ink/75 sm:block">
            A cosy little adventure. Chop, fish and forage, grow a garden, build up the village, make friends, and carve paths to new worlds.
          </p>
          <div className="mt-4 hidden flex-wrap gap-1.5 text-sm font-bold sm:flex">
            {["🌲 Gather", "🥕 Farm", "🏘️ Build", "💕 Friends", "🗺️ Explore"].map((t) => (
              <span key={t} className="rounded-full border-2 border-ink bg-white px-2 py-0.5">
                {t}
              </span>
            ))}
          </div>
          {open ? (
            <>
              <Link href="/play" className="btn btn-pink mt-5 w-full py-3! text-2xl!">
                Play now
              </Link>
              <p className="mt-2 text-center text-xs font-bold text-ink/50">Free to play in your browser. No download.</p>
            </>
          ) : (
            <>
              <Countdown className="mt-5 w-full" to={GAME_OPEN_AT} label="🎮 Opens in" done="Open now!" />
              <a href={X_URL} target="_blank" rel="noreferrer" className="mt-3 block text-center text-sm font-bold underline">
                Follow {X_HANDLE} to hear when it opens
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
