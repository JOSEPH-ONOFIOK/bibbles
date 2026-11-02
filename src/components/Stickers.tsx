"use client";

import { useState } from "react";
import { FEATURED, SUPPLY_LABEL } from "@/lib/bibbles";
import { burstFrom } from "@/lib/burst";

const TILTS = [-6, 4, -3, 7, -5];

export function Stickers() {
  const [flipped, setFlipped] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="text-center">
        <h2 className="font-display text-6xl text-white" style={{ textShadow: "4px 4px 0 #161616" }}>
          The sticker sheet
        </h2>
        <p className="mt-2 font-bold text-ink/80">{FEATURED.length} of {SUPPLY_LABEL}. Tap a sticker to flip it and peek at its traits.</p>
      </div>

      <div className="chunk dots mt-8 grid grid-cols-2 gap-x-4 gap-y-8 px-4 py-10 sm:grid-cols-3 sm:px-10 lg:grid-cols-5">
        {FEATURED.map((b, i) => {
          const isFlipped = flipped === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={(e) => {
                setFlipped(isFlipped ? null : b.id);
                if (!isFlipped) burstFrom(e.currentTarget, "sparkles", 6);
              }}
              aria-pressed={isFlipped}
              aria-label={`${b.name}, ${isFlipped ? "hide" : "show"} traits`}
              className={`flip-card group block text-left ${isFlipped ? "flipped" : ""}`}
              style={{ ["--tilt" as string]: `${TILTS[i]}deg` }}
            >
              <div className="flip-inner transition-transform duration-300 [transform:rotate(var(--tilt))] group-hover:[transform:rotate(0deg)_translateY(-10px)_scale(1.06)]">
                <div className="flip-face flex flex-col items-center">
                  <div className="relative w-full">
                    <span
                      className="absolute inset-[6%] -z-0 rounded-[40%] border-4 border-ink"
                      style={{ background: b.bg }}
                      aria-hidden
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.img} alt={b.name} draggable={false} className="sticker-img relative w-full select-none" />
                  </div>
                  <span className="mt-2 rounded-full border-[3px] border-ink bg-white px-3 py-0.5 font-display text-lg shadow-[2px_2px_0_#161616]">
                    {b.name}
                  </span>
                </div>
                <div
                  className="flip-face flip-back flex flex-col justify-center rounded-[28px] border-4 border-ink p-3 shadow-[4px_4px_0_#161616]"
                  style={{ background: b.bg }}
                >
                  <p className="font-display text-xl leading-none">{b.name}</p>
                  <dl className="mt-2 space-y-1 text-xs">
                    {b.traits.map((t) => (
                      <div key={t.label} className="flex justify-between gap-2 rounded-lg bg-white/70 px-2 py-0.5">
                        <dt className="font-bold text-ink/60">{t.label}</dt>
                        <dd className="text-right font-extrabold">{t.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
