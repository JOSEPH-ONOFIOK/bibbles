"use client";

import { useEffect, useId, useRef } from "react";
import { STARTERS, calendar } from "@/game/data";
import { Engine, type Host } from "@/game/engine";
import { MochiArt, type MochiLook } from "@/components/MochiArt";

// The game playing itself, for backgrounds. Nothing is saved and it makes no sound.
// It pauses while off screen, and stays still for people who prefer less motion.

const DEMO_LOOK: MochiLook = { skin: "blush", face: "sparkle", head: "none", fit: "tee", aura: "hearts", bg: "none" };

const demoHost = (): Host => ({
  energy: () => 30,
  harvest: () => true,
  open: () => {},
  hasRequest: (v) => v % 2 === 0,
  resident: (v) => STARTERS.includes(v) || v === 1 || v === 2,
  zoneOpen: () => true,
  built: (p) => p === "bakery" || p === "dock",
  // A little garden, some of it ready to pick
  plot: (i) => (i < 4 ? { stage: i % 2 ? "ready" : "growing", crop: i % 2 ? "carrot" : "pumpkin", left: 600000 } : { stage: "locked", left: 0 }),
  plotAction: () => null,
  caveFloor: () => {},
  carved: () => 0,
  region: () => {},
  season: () => calendar().season,
  prompt: () => {},
  zone: () => {},
});

// focus: where to keep the Mochi on screen, so it isn't hidden behind whatever sits on top
// at: a starting spot in tiles; region: a Frontier world to show instead of home
export function GameBackdrop({
  className = "",
  focus,
  at,
  region,
}: {
  className?: string;
  focus?: { wide: [number, number]; narrow: [number, number] };
  at?: [number, number];
  region?: number;
}) {
  const svgId = `demo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const where = useRef({ at, region });
  const stage = useRef<HTMLDivElement>(null);
  // Read once, when the engine starts
  const focusAt = useRef(focus);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stage.current || !box.current) return;
    const wide = matchMedia("(min-width: 640px)").matches;
    const fo = focusAt.current;
    const f = fo ? (wide ? fo.wide : fo.narrow) : [0.5, 0.5];
    const e = new Engine(document.createElement("canvas"), demoHost(), { demo: true, external: true, focus: { x: f[0], y: f[1] }, ...where.current });
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The demo Mochi, drawn from the same art as everywhere else
    const svg = box.current.querySelector("svg");
    let url = "";
    if (svg) {
      const clone = svg.cloneNode(true) as SVGElement;
      clone.setAttribute("width", "340");
      clone.setAttribute("height", "380");
      url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
      const img = new Image();
      img.onload = () => e.setPlayerImage(img);
      img.src = url;
    }
    let view: { pause: () => void; resume: () => void; destroy: () => void } | null = null;
    let gone = false;
    let visible = true;
    const el = stage.current;
    import("@/game/phaser/view").then(({ mountView }) => {
      if (gone) return;
      view = mountView(el, e);
      // Still for people who prefer less motion: a moment to draw, then hold
      if (still) setTimeout(() => view?.pause(), 600);
      else if (!visible) view.pause();
    });
    // Only run while on screen
    const io = new IntersectionObserver(
      ([en]) => {
        visible = en.isIntersecting;
        if (!view || still) return;
        if (visible) view.resume();
        else view.pause();
      },
      { rootMargin: "100px" },
    );
    io.observe(box.current);
    return () => {
      gone = true;
      io.disconnect();
      view?.destroy();
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <div ref={box} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div ref={stage} className="h-full w-full" />
      <div className="hidden">
        <MochiArt look={DEMO_LOOK} svgId={svgId} viewBox="160 280 680 760" />
      </div>
    </div>
  );
}
