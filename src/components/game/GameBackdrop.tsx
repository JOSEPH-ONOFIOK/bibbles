"use client";

import { useEffect, useRef } from "react";
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
export function GameBackdrop({ className = "", focus }: { className?: string; focus?: { wide: [number, number]; narrow: [number, number] } }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Read once, when the engine starts
  const focusAt = useRef(focus);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvas.current || !box.current) return;
    const wide = matchMedia("(min-width: 640px)").matches;
    const fo = focusAt.current;
    const f = fo ? (wide ? fo.wide : fo.narrow) : [0.5, 0.5];
    const e = new Engine(canvas.current, demoHost(), { demo: true, focus: { x: f[0], y: f[1] } });
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
    let running = false;
    const start = () => {
      if (running) return;
      running = true;
      e.start();
    };
    const stop = () => {
      if (!running) return;
      running = false;
      e.stop();
    };
    if (still) {
      // One frame, no motion
      start();
      const t = setTimeout(stop, 400);
      return () => {
        clearTimeout(t);
        stop();
        if (url) URL.revokeObjectURL(url);
      };
    }
    const io = new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop()), { rootMargin: "100px" });
    io.observe(box.current);
    return () => {
      io.disconnect();
      stop();
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <div ref={box} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <canvas ref={canvas} className="h-full w-full" />
      <div className="hidden">
        <MochiArt look={DEMO_LOOK} svgId="demo-mochi" viewBox="160 280 680 760" />
      </div>
    </div>
  );
}
