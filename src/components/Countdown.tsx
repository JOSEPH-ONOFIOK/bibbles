"use client";

import { useEffect, useState } from "react";
import { GAME_OPEN_AT } from "@/game/data";
import { APPLY_END } from "@/lib/deadline";

// False until the moment `at` arrives, then flips to true on its own
export function useReached(at: number) {
  const [reached, setReached] = useState(false);
  useEffect(() => {
    const left = at - Date.now();
    if (left <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- already past it when the page opened
      setReached(true);
      return;
    }
    // Timers can't wait longer than about 24 days
    const t = setTimeout(() => setReached(true), Math.min(left, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [at]);
  return reached;
}

// True until the application deadline
export function useApplyOpen() {
  return !useReached(APPLY_END);
}

const pad = (n: number) => String(n).padStart(2, "0");

// "Applications close in 17 : 59 : 59", then "Applications closed" (or any other moment and labels)
export function Countdown({
  className = "",
  to = APPLY_END,
  label = "⏳ Applications close in",
  done = "Applications closed",
}: {
  className?: string;
  to?: number;
  label?: string;
  done?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock only exists in the browser
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = now === null ? null : Math.max(0, to - now);
  const closed = left === 0;
  const h = left === null ? 0 : Math.floor(left / 3_600_000);
  const m = left === null ? 0 : Math.floor((left % 3_600_000) / 60_000);
  const s = left === null ? 0 : Math.floor((left % 60_000) / 1000);
  return (
    <div className={`inline-flex flex-wrap items-center justify-center gap-2 ${className}`} role="timer" aria-live="off">
      {closed ? (
        <p className="rounded-full border-4 border-ink bg-ink px-5 py-2 font-display text-2xl text-white shadow-[4px_4px_0_#161616]">{done}</p>
      ) : (
        <>
          <p className="font-display text-xl">{label}</p>
          <div className="flex items-center gap-1 font-display tabular-nums">
            {[
              [h, "hrs"],
              [m, "min"],
              [s, "sec"],
            ].map(([v, label], i) => (
              <span key={label} className="flex items-center gap-1">
                {i > 0 && <span className="text-2xl">:</span>}
                <span className="flex min-w-[3.4rem] flex-col items-center rounded-2xl border-4 border-ink bg-white px-2 py-1 shadow-[3px_3px_0_#161616]">
                  <span className="text-3xl leading-none">{left === null ? "--" : pad(Number(v))}</span>
                  <span className="text-[10px] tracking-widest text-ink/50 uppercase">{label}</span>
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Shown in place of the sign-up once the deadline passes
export function ClosedCard({ handle }: { handle: string }) {
  return (
    <div className="mt-6 rounded-3xl border-4 border-ink bg-ink p-6 text-center text-white">
      <p className="font-display text-4xl">Applications are closed 🩷</p>
      <p className="mt-2 font-bold text-white/80">Thank you to everyone who joined. If you finished in time, your spot is saved. Follow {handle} for what&apos;s next.</p>
    </div>
  );
}

// True once the game has opened (at its launch time, or early via NEXT_PUBLIC_GAME_OPEN=1)
export function useGameOpen() {
  const reached = useReached(GAME_OPEN_AT);
  return reached || process.env.NEXT_PUBLIC_GAME_OPEN === "1";
}
