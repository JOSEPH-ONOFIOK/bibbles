"use client";

import { useEffect, useRef, useState } from "react";
import { DIRS, H, PLAYER_R, SECONDS, TICKS, TPS, W, createSim, step, type Sim } from "@/duel/sim";
import { KEYS, draw, toCode } from "./DuelGame";

// A duel playing itself, so people can see what they're entering before they stake anything.
// "Practice" lets them play the same thing against a bot, for free: nothing is sent or saved.

// Heads for the nearest item (rare ones count as closer); the careful bot also steers around rocks.
function bot(s: Sim, careful: boolean) {
  let tx = s.x;
  let ty = s.y;
  let best = Infinity;
  for (const i of s.items) {
    const d = (i.x - s.x) ** 2 + (i.y - s.y) ** 2 - (i.rare ? 20000 : 0);
    if (d < best) {
      best = d;
      tx = i.x;
      ty = i.y;
    }
  }
  let pick = 0;
  let value = -Infinity;
  for (let k = 1; k <= 8; k++) {
    const [dx, dy] = DIRS[k];
    const nx = s.x + dx * 30;
    const ny = s.y + dy * 30;
    let v = -((nx - tx) ** 2 + (ny - ty) ** 2);
    if (careful) for (const r of s.rocks) if ((nx - r.x) ** 2 + (ny - r.y) ** 2 < (r.r + 60) ** 2) v -= 1e9;
    if (v > value) {
      value = v;
      pick = k;
    }
  }
  return pick;
}

type Hud = { left: number; me: number; meHits: number; them: number; themHits: number; over: boolean };

export function DuelDemo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>());
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<"watch" | "practice">("watch");
  const [round, setRound] = useState(0);
  const [hud, setHud] = useState<Hud>({ left: SECONDS, me: 0, meHits: 0, them: 0, themHits: 0, over: false });

  useEffect(() => {
    const seed = Math.floor(Math.random() * 2 ** 32) >>> 0;
    const a = createSim(seed); // the one on screen
    const b = createSim(seed); // the opponent: same map, played by a bot
    const practice = mode === "practice";
    const held = keys.current;

    let onScreen = true;
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
    if (box.current) io.observe(box.current);

    const dir = () => {
      let x = 0;
      let y = 0;
      for (const k of held) {
        const v = KEYS[k];
        if (v) {
          x += v[0];
          y += v[1];
        }
      }
      if (pointer.current) {
        x = pointer.current.x - a.x;
        y = pointer.current.y - a.y;
        if (x * x + y * y < PLAYER_R * PLAYER_R) return 0;
      }
      return toCode(x, y);
    };

    let played = 0; // ms of game time, only counted while visible
    let last = performance.now();
    let lastHud = 0;
    let raf = 0;
    let restart: ReturnType<typeof setTimeout> | undefined;

    const frame = (t: number) => {
      const dt = Math.min(100, t - last);
      last = t;
      if (onScreen && document.visibilityState === "visible") played += dt;
      const target = Math.min(TICKS, Math.floor((played / 1000) * TPS));
      while (a.tick < target) {
        step(a, practice ? dir() : bot(a, true));
        step(b, bot(b, !practice)); // a little easier to beat in practice
      }
      draw(canvas.current, a);
      const over = a.tick >= TICKS;
      if (t - lastHud > 150 || over) {
        lastHud = t;
        setHud({ left: Math.max(0, Math.ceil(SECONDS - a.tick / TPS)), me: a.score, meHits: a.hits, them: b.score, themHits: b.hits, over });
      }
      if (over) {
        if (!practice) restart = setTimeout(() => setRound((r) => r + 1), 5000);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const down = (e: KeyboardEvent) => {
      if (practice && KEYS[e.key]) {
        e.preventDefault();
        held.add(e.key);
      }
    };
    const up = (e: KeyboardEvent) => held.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(restart);
      io.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      held.clear();
    };
  }, [mode, round]);

  const practice = mode === "practice";
  const meName = practice ? "You" : "Mochi A";
  const themName = practice ? "Practice bot" : "Mochi B";
  const won = hud.me > hud.them || (hud.me === hud.them && hud.meHits < hud.themHits);
  const tie = hud.me === hud.them && hud.meHits === hud.themHits;

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  return (
    <div ref={box} className="chunk overflow-hidden p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl sm:text-3xl">{practice ? "🎮 Free practice" : "📺 Watch a demo duel"}</h2>
        <div className="flex gap-2">
          <button className={`btn px-4! py-1! text-base! ${!practice ? "btn-pink" : ""}`} onClick={() => (setMode("watch"), setRound((r) => r + 1))}>
            Watch
          </button>
          <button className={`btn px-4! py-1! text-base! ${practice ? "btn-pink" : ""}`} onClick={() => (setMode("practice"), setRound((r) => r + 1))}>
            Practice free
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-display text-lg sm:text-xl">
        <span className="rounded-full border-[3px] border-ink bg-[#fff1a8] px-3 py-0.5">⏱ {hud.left}s</span>
        <span className="rounded-full border-[3px] border-ink bg-white px-3 py-0.5">
          {meName}: {hud.me} <span className="text-base text-ink/60">· {hud.meHits} hits</span>
        </span>
        <span className="rounded-full border-[3px] border-ink bg-[#e2d4ff] px-3 py-0.5">
          {themName}: {hud.them} <span className="text-base text-ink/60">· {hud.themHits} hits</span>
        </span>
      </div>

      <div className="relative">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className={`block w-full rounded-2xl border-4 border-ink bg-[#fffaf3] ${practice ? "touch-none" : ""}`}
          onPointerDown={(e) => {
            if (!practice) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            pointer.current = toWorld(e);
          }}
          onPointerMove={(e) => {
            if (pointer.current) pointer.current = toWorld(e);
          }}
          onPointerUp={() => (pointer.current = null)}
          onPointerCancel={() => (pointer.current = null)}
        />
        <span className="pointer-events-none absolute top-2 left-2 rounded-full border-[3px] border-ink bg-white/90 px-3 py-0.5 text-sm font-extrabold">
          {practice ? "PRACTICE · NO STAKE" : "DEMO"}
        </span>
        {hud.over && (
          <div className="absolute inset-0 grid place-items-center bg-ink/40 p-4">
            <div className="pop-in chunk max-w-sm p-5 text-center">
              <p className="font-display text-3xl">
                {tie ? "Tie: full refund" : practice ? (won ? "You won! 🎉" : "The bot won this one") : `${won ? meName : themName} wins!`}
              </p>
              <p className="mt-1 font-semibold">
                {hud.me} vs {hud.them}
                {!tie && hud.me === hud.them && " (fewer hits wins)"}
              </p>
              <p className="mt-2 text-sm font-bold text-ink/70">
                In a real duel, both players stake the same $MOCHI and the winner gets 75% of both stakes.
              </p>
              {practice ? (
                <button className="btn btn-pink mt-3 px-5! py-1.5! text-lg!" onClick={() => setRound((r) => r + 1)}>
                  Play again
                </button>
              ) : (
                <p className="mt-3 text-sm font-semibold text-ink/60">Next demo starting…</p>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-sm font-bold text-ink/60">
        {practice
          ? "Arrow keys / WASD, or hold and drag. Same rules as a real duel, but nothing is staked or saved."
          : "Both Mochis play the exact same map. Collect 🟡 +10 and ✨ +25, dodge rocks (−15 and a stun). Highest score after 90 seconds wins."}
      </p>
    </div>
  );
}
