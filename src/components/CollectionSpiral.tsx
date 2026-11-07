"use client";

import { useEffect, useState } from "react";
import { COLLECTIONS } from "@/lib/mochilist";

// The partner collections laid out on a spiral arm, smallest in the middle.
// While a wallet is checked the logos bob; when it holds one, the spiral spins
// and that collection's logo moves to the centre and grows.

const N = COLLECTIONS.length;
const SPIN_MS = 1500;

// Point on the spiral arm at step i (fractional steps draw the line), as % of the box
function at(i: number) {
  const angle = 0.6 + i * 0.95;
  const r = 14 + (27 * i) / (N - 1);
  return { x: 50 + r * Math.cos(angle), y: 50 + r * Math.sin(angle) };
}

// Position and size of logo i
const spot = (i: number) => ({ ...at(i), size: 13 + (5 * i) / (N - 1) });

// The arm itself, from a little before the first logo to a little past the last
const ARM = Array.from({ length: 121 }, (_, k) => {
  const p = at(-0.6 + (k / 120) * (N - 1 + 1.2));
  return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
}).join(" ");

export function CollectionSpiral({ found, checking, spinKey }: { found?: string; checking: boolean; spinKey: number }) {
  // A fresh successful check (new spinKey) spins first. Already eligible on load: no spin.
  const [seenKey, setSeenKey] = useState(spinKey);
  const [spinning, setSpinning] = useState(false);
  if (spinKey !== seenKey) {
    setSeenKey(spinKey);
    setSpinning(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  useEffect(() => {
    if (!spinning) return;
    const t = setTimeout(() => setSpinning(false), SPIN_MS);
    return () => clearTimeout(t);
  }, [spinning]);

  const phase = spinning ? "spin" : found ? "found" : "idle";
  const hit = phase === "found" ? found : undefined;

  return (
    <figure className="mx-auto w-full max-w-[400px]">
      <div className="relative aspect-square">
        <div className={`absolute inset-0 ${phase === "spin" ? "spiral-spin" : ""}`}>
          <svg viewBox="0 0 100 100" className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${hit ? "opacity-0" : ""}`} aria-hidden>
            <polyline points={ARM} fill="none" stroke="#161616" strokeOpacity={0.25} strokeWidth={0.9} strokeDasharray="2 2.2" strokeLinecap="round" />
          </svg>
          {COLLECTIONS.map((c, i) => {
            const s = spot(i);
            const me = hit === c.name;
            const dim = !!hit && !me;
            return (
              <div
                key={c.name}
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                  left: `${me ? 50 : s.x}%`,
                  top: `${me ? 50 : s.y}%`,
                  width: `${me ? 44 : s.size}%`,
                  zIndex: me ? 10 : 1,
                  opacity: dim ? 0.35 : 1,
                  filter: dim ? "grayscale(1)" : undefined,
                }}
              >
                <div
                  className={phase === "spin" ? "spiral-unspin" : checking ? "spiral-bob" : ""}
                  style={{ animationDelay: checking && phase !== "spin" ? `${i * 90}ms` : undefined }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.logo}
                    alt={c.name}
                    title={c.name}
                    width={256}
                    height={256}
                    className={`aspect-square w-full rounded-full border-ink bg-white object-cover ${
                      me ? "border-[5px] shadow-[0_0_0_6px_#fff1a8,6px_6px_0_6px_#161616]" : "border-[3px] shadow-[3px_3px_0_#161616]"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="mt-3 text-center font-display text-2xl" aria-live="polite">
        {hit ? (
          <span className="pop-in inline-block">You hold {hit} 🩷</span>
        ) : checking ? (
          "Looking through your wallet…"
        ) : (
          <span className="text-ink/70">Hold one of these {N} collections</span>
        )}
      </figcaption>
    </figure>
  );
}
