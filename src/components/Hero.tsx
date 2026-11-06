import { FEATURED, BRAND_PINK, POWERED, SUPPLY_LABEL } from "@/lib/mochi";
import { PeekMochi } from "./PeekMochi";
import type { BurstKind } from "@/lib/burst";

const BURSTS: BurstKind[] = ["stars", "hearts", "puffs", "puffs", "sparkles"];

// Clover-ish sparkle from the wordmark, used as floating confetti.
function Clover({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="-20 -20 40 40" className={className} style={style} aria-hidden>
      <path
        d="M0 -4 C-4 -16 8 -16 4 -4 C16 -8 16 4 4 0 C8 12 -4 12 0 0 C-12 4 -12 -8 0 -4 Z"
        fill="#fff"
        transform="scale(1.4)"
      />
    </svg>
  );
}

const CLOVERS = [
  { left: "8%", top: "22%", size: 34, delay: "0s" },
  { left: "86%", top: "18%", size: 26, delay: "1.2s" },
  { left: "15%", top: "58%", size: 22, delay: "0.6s" },
  { left: "80%", top: "52%", size: 38, delay: "2s" },
  { left: "48%", top: "12%", size: 18, delay: "1.6s" },
  { left: "63%", top: "66%", size: 20, delay: "0.3s" },
];

export function Hero() {
  return (
    <section
      id="top"
      data-bg={BRAND_PINK}
      className="relative flex min-h-[88svh] flex-col border-b-4 border-ink bg-pink items-center justify-center overflow-hidden pt-24 pb-[30vw] sm:min-h-[100svh] sm:pb-[15vw]"
    >
      {CLOVERS.map((c, i) => (
        <Clover
          key={i}
          className="float pointer-events-none absolute opacity-80"
          style={{ left: c.left, top: c.top, width: c.size, height: c.size, animationDelay: c.delay }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        <h1 className="wordmark wobble select-none leading-none text-[min(30vw,180px)]" style={{ textShadow: "5px 6px 0 #161616" }}>
          Mochi
        </h1>
        <p className="mt-4 max-w-md font-display text-2xl text-white sm:text-3xl" style={{ textShadow: "2px 3px 0 #161616" }}>
          Soft little heads. Big silly feelings.
        </p>
        <p className="mt-4 -rotate-3 rounded-full border-4 border-ink bg-[#fff1a8] px-5 py-1 font-display text-2xl shadow-[3px_4px_0_#161616]">
          Only {SUPPLY_LABEL} Mochis
        </p>
        <p className="mt-3 font-display text-xl text-white sm:text-2xl" style={{ textShadow: "2px 2px 0 #161616" }}>
          {POWERED}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href="#join" className="btn btn-pink">
            Join the Mochis
          </a>
          <a href="#builder" className="btn">
            Make a Mochi
          </a>
        </div>
        <p className="mt-5 text-sm font-bold text-white/85">psst… boop one</p>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center sm:gap-2 sm:px-2">
        {FEATURED.map((b, i) => (
          <PeekMochi
            key={b.id}
            src={b.img}
            alt={b.name}
            delay={250 + i * 140}
            rest={i % 2 ? "26%" : "14%"}
            burst={BURSTS[i]}
            className="-mx-[3.5vw] w-[29vw] shrink-0 sm:mx-0 sm:w-[19vw] sm:max-w-[260px]"
          />
        ))}
      </div>
    </section>
  );
}
