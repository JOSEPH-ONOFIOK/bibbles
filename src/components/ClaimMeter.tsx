"use client";

import { useEffect, useState } from "react";
import { COLLECTIONS, ML_CAP, type MlStats } from "@/lib/mochilist";

// How many MochiList spots are gone, with every community sitting on the line.
// The fill lights up each logo it reaches; yours gets a ring.

const fmt = (n: number) => n.toLocaleString("en-US");

// Counts up from where it was to the new number
function useCountUp(target: number) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const from = shown;
    if (from === target) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setShown(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from the current value only when the target moves
  }, [target]);
  return shown;
}

export function ClaimMeter({ stats, mine }: { stats: MlStats | null; mine?: string }) {
  const cap = stats?.cap ?? ML_CAP;
  const claimed = Math.min(stats?.claimed ?? 0, cap);
  const shown = useCountUp(claimed);
  const pct = (claimed / cap) * 100;
  const full = claimed >= cap;

  // Start the fill empty, then grow it once mounted
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    if (!stats) return;
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, [stats]);

  return (
    <div className="chunk mx-auto max-w-6xl px-4 pt-4 pb-20 sm:px-7 sm:pt-6 sm:pb-20">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold tracking-[0.2em] text-ink/50 uppercase">MochiList spots</p>
          <p className="font-display text-4xl leading-none tabular-nums sm:text-5xl">
            {fmt(shown)}
            <span className="text-2xl text-ink/35 sm:text-3xl"> / {fmt(cap)}</span>
          </p>
        </div>
        <span
          className={`rounded-full border-[3px] border-ink px-3 py-1 font-display text-lg shadow-[3px_3px_0_#161616] ${
            full ? "bg-ink text-white" : "bg-[#fff1a8]"
          }`}
        >
          {!stats ? "…" : full ? "All taken" : `${fmt(cap - claimed)} left`}
        </span>
      </div>

      <div className="relative mt-6 h-12 sm:h-16">
        {/* the track */}
        <div className="absolute inset-x-0 top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-full border-4 border-ink bg-white sm:h-6">
          <div
            className="meter-fill h-full rounded-full transition-[width] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: grown ? `${Math.max(pct, claimed ? 2 : 0)}%` : "0%" }}
          />
        </div>
        {/* every community, evenly along the line */}
        <ul className="absolute inset-0 flex items-center justify-between">
          {COLLECTIONS.map((c, i) => {
            const at = (i / (COLLECTIONS.length - 1)) * 100;
            const lit = grown && pct > 0 && at <= pct + 0.01;
            const you = mine === c.name;
            const n = Math.min(stats?.by[c.name] ?? 0, c.limit);
            const share = c.limit ? n / c.limit : 0;
            const done = !!stats && n >= c.limit;
            return (
              <li key={c.name} className="group relative" title={`${c.name}: ${fmt(n)} of ${fmt(c.limit)} claimed`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.logo}
                  alt={c.name}
                  width={64}
                  height={64}
                  className={`h-6 w-6 rounded-full border-[3px] bg-white object-cover transition duration-500 group-hover:-translate-y-1 group-hover:scale-125 sm:h-12 sm:w-12 ${
                    done
                      ? "border-[#1f9d55] shadow-[0_0_0_3px_#b6f5c9,2px_2px_0_3px_#161616]"
                      : you
                        ? "scale-110 border-ink shadow-[0_0_0_3px_#fff1a8,0_0_0_6px_#161616]"
                        : lit
                          ? "border-ink shadow-[2px_2px_0_#161616]"
                          : "border-ink opacity-80 grayscale-[0.6] shadow-[2px_2px_0_#161616]"
                  }`}
                  style={{ transitionDelay: grown ? `${i * 70}ms` : undefined }}
                />
                {done && (
                  <span className="pop-in absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full border-2 border-ink bg-[#3ecf6e] text-[8px] font-black text-white sm:h-5 sm:w-5 sm:text-[10px]">
                    ✓
                  </span>
                )}
                {/* this community's own line: how much of its share is gone, solid green when full */}
                <div className="absolute top-[calc(100%+6px)] left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5 sm:top-[calc(100%+8px)] sm:gap-1">
                  <div className="h-1.5 w-7 overflow-hidden rounded-full border-[1.5px] border-ink bg-white sm:h-2.5 sm:w-16 sm:border-2">
                    <div
                      className={`h-full rounded-full transition-[width] duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${done ? "bg-[#3ecf6e]" : "bg-gradient-to-r from-pink to-[#ffbe60]"}`}
                      style={{ width: grown ? `${share * 100}%` : "0%" }}
                    />
                  </div>
                  {done ? (
                    <span className="hidden rounded-full border-2 border-ink bg-[#3ecf6e] px-1.5 font-display text-[11px] leading-tight text-white sm:block">
                      FULL
                    </span>
                  ) : (
                    <span className="hidden font-display text-[11px] leading-tight whitespace-nowrap tabular-nums sm:block">
                      {fmt(n)}
                      <span className="text-ink/45">/{fmt(c.limit)}</span>
                    </span>
                  )}
                </div>
                {/* the name: tilted on phones, where ten don't fit side by side */}
                <span
                  className={`absolute top-[calc(100%+18px)] left-1/2 origin-top-right -translate-x-full -rotate-45 font-display text-[10px] leading-none whitespace-nowrap transition duration-500 sm:top-[calc(100%+44px)] sm:w-[5.5rem] sm:origin-top sm:-translate-x-1/2 sm:rotate-0 sm:text-center sm:text-xs sm:leading-tight sm:whitespace-normal ${
                    you ? "rounded-full bg-ink px-1.5 py-0.5 text-[#fff1a8]" : done ? "text-[#1f9d55]" : lit ? "" : "text-ink/55"
                  }`}
                >
                  {c.name}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
