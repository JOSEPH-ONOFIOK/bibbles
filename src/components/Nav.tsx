"use client";

import { useRef } from "react";
import { useSession } from "./Session";

const LINKS = [
  { href: "#join", label: "Join" },
  { href: "#builder", label: "Builder" },
  { href: "#stickers", label: "Stickers" },
];

// The logo silhouette with eyes. It blinks whenever you hover a link.
function Mascot({ blinkRef }: { blinkRef: React.RefObject<SVGSVGElement | null> }) {
  return (
    <svg ref={blinkRef} viewBox="220 440 560 500" className="h-11 w-11" aria-hidden>
      <path
        d="M500 528 C468 488 440 462 382 462 C304 462 268 520 272 600 C232 650 222 722 238 782 C262 880 382 922 500 922 C618 922 738 880 762 782 C778 722 768 650 728 600 C732 520 696 462 618 462 C560 462 532 488 500 528 Z"
        fill="#fff"
        stroke="#161616"
        strokeWidth={22}
      />
      <g className="blink-eyes">
        <circle cx={410} cy={700} r={34} fill="#161616" />
        <circle cx={590} cy={700} r={34} fill="#161616" />
        <circle cx={422} cy={688} r={11} fill="#fff" />
        <circle cx={602} cy={688} r={11} fill="#fff" />
      </g>
    </svg>
  );
}

export function Nav() {
  const mascot = useRef<SVGSVGElement>(null);
  const { entry } = useSession();
  const blink = () => {
    const el = mascot.current;
    if (!el) return;
    el.classList.remove("blinking");
    void el.getBoundingClientRect();
    el.classList.add("blinking");
  };

  return (
    <header className="fixed inset-x-0 top-3 z-50 flex justify-center px-3">
      <nav className="chunk flex w-full max-w-5xl items-center gap-2 rounded-full! py-1.5 pr-2 pl-3 sm:gap-4">
        <a href="#top" onMouseEnter={blink} className="flex items-center gap-2">
          <Mascot blinkRef={mascot} />
          <span className="font-display text-2xl text-pink" style={{ textShadow: "2px 2px 0 #161616" }}>
            Bibbles
          </span>
        </a>
        <div className="ml-auto hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onMouseEnter={blink}
              className="rounded-full px-4 py-1.5 font-display text-lg transition hover:-rotate-2 hover:bg-pink hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>
        <a href="#join" onMouseEnter={blink} className="btn ml-auto bg-ink! py-1.5! text-base! text-white! sm:ml-0">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          {entry ? `@${entry.handle}` : "Connect X"}
        </a>
      </nav>
    </header>
  );
}
