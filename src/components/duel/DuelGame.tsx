"use client";

import { useEffect, useRef, useState } from "react";
import { H, PLAYER_R, SECONDS, TICKS, TPS, W, createSim, step, type Sim } from "@/duel/sim";

type Upload = (from: number, moves: string) => Promise<{ length: number; score: { score: number } | null; rejected: string | null }>;

type Props = {
  seed: number;
  startAt: number; // server time the run starts
  offset: number; // server time minus local time
  resume: string; // moves the server already has (after a reload)
  upload: Upload;
  opponent: { started: boolean; score?: number } | null;
  opponentName?: string;
  onFinished: () => void;
};

export const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
};

// A direction vector → input code 0–8 (0 none, 1 up, clockwise)
export function toCode(x: number, y: number) {
  if (Math.abs(x) < 0.2 && Math.abs(y) < 0.2) return 0;
  const a = Math.atan2(x, -y); // 0 = up, clockwise
  return (((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8) + 1;
}

export function DuelGame({ seed, startAt, offset, resume, upload, opponent, opponentName = "Opponent", onFinished }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim | null>(null);
  const moves = useRef("");
  const sent = useRef(0);
  const keys = useRef(new Set<string>());
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const [hud, setHud] = useState({ left: SECONDS, score: 0, hits: 0, countdown: 0, rejected: null as string | null, synced: true });
  const uploadRef = useRef(upload);
  const doneRef = useRef(onFinished);
  useEffect(() => {
    uploadRef.current = upload;
    doneRef.current = onFinished;
  });

  useEffect(() => {
    // Rebuild the run from what the server already has, then fill any time missed while away with "no move"
    const s = createSim(seed);
    for (let i = 0; i < resume.length; i++) step(s, resume.charCodeAt(i) - 48);
    sim.current = s;
    moves.current = resume;
    sent.current = resume.length;

    const now = () => Date.now() + offset;
    const dir = () => {
      let x = 0;
      let y = 0;
      for (const k of keys.current) {
        const v = KEYS[k];
        if (v) {
          x += v[0];
          y += v[1];
        }
      }
      if (pointer.current && s) {
        x = pointer.current.x - s.x;
        y = pointer.current.y - s.y;
        if (x * x + y * y < PLAYER_R * PLAYER_R) return 0;
        const len = Math.sqrt(x * x + y * y);
        x /= len;
        y /= len;
      }
      return toCode(x, y);
    };

    let raf = 0;
    let busy = false;
    let finished = false;
    let lastHud = 0;
    let rejected: string | null = null;

    const flush = async () => {
      if (busy || sent.current >= moves.current.length) return;
      busy = true;
      try {
        const r = await uploadRef.current(sent.current, moves.current.slice(sent.current));
        sent.current = Math.min(r.length, moves.current.length);
        if (r.rejected) rejected = r.rejected;
      } catch {
        // network blip: the next flush resends from the last confirmed point
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(flush, 1500);

    const frame = () => {
      const t = now();
      const target = Math.min(TICKS, Math.max(0, Math.floor(((t - startAt) / 1000) * TPS)));
      const d = dir();
      while (s.tick < target) {
        // ticks missed while the tab was away count as standing still
        const code = target - s.tick > 3 ? 0 : d;
        moves.current += String(code);
        step(s, code);
      }
      draw(canvas.current, s);
      if (t - lastHud > 150) {
        lastHud = t;
        setHud({
          left: Math.max(0, Math.ceil(SECONDS - s.tick / TPS)),
          score: s.score,
          hits: s.hits,
          countdown: t < startAt ? Math.ceil((startAt - t) / 1000) : 0,
          rejected,
          synced: sent.current >= moves.current.length - TPS * 2,
        });
      }
      if (s.tick >= TICKS && !finished) {
        finished = true;
        const finish = async () => {
          for (let i = 0; i < 20 && sent.current < TICKS && !rejected; i++) {
            await flush();
            if (sent.current < TICKS) await new Promise((r) => setTimeout(r, 700));
          }
          doneRef.current();
        };
        finish();
      }
      if (!finished) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const down = (e: KeyboardEvent) => {
      if (KEYS[e.key]) {
        e.preventDefault();
        keys.current.add(e.key);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [seed, startAt, offset, resume]);

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  return (
    <div className="chunk overflow-hidden p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-display text-lg sm:text-xl">
        <span className="rounded-full border-[3px] border-ink bg-[#fff1a8] px-3 py-0.5">⏱ {hud.left}s</span>
        <span className="rounded-full border-[3px] border-ink bg-white px-3 py-0.5">
          You: {hud.score} <span className="text-base text-ink/60">· {hud.hits} hits</span>
        </span>
        <span className="rounded-full border-[3px] border-ink bg-[#e2d4ff] px-3 py-0.5">
          {opponentName}: {opponent?.started ? (opponent.score ?? 0) : "not started"}
        </span>
      </div>
      <div className="relative">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="block w-full touch-none rounded-2xl border-4 border-ink bg-[#fffaf3]"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pointer.current = toWorld(e);
          }}
          onPointerMove={(e) => {
            if (pointer.current) pointer.current = toWorld(e);
          }}
          onPointerUp={() => (pointer.current = null)}
          onPointerCancel={() => (pointer.current = null)}
        />
        {hud.countdown > 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="pop-in font-display text-8xl text-white" style={{ textShadow: "5px 5px 0 #161616" }}>
              {hud.countdown}
            </span>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-sm font-bold text-ink/60">
        Arrow keys / WASD, or hold and drag on the screen. Collect 🟡 (+10) and ✨ (+25). Dodge the rocks (−15 and a stun).
        {!hud.synced && " · Reconnecting…"}
      </p>
      {hud.rejected && <p className="mt-2 text-center font-bold text-red-600">The server rejected this run: {hud.rejected}</p>}
    </div>
  );
}

export function draw(c: HTMLCanvasElement | null, s: Sim) {
  const g = c?.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#fffaf3";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(22,22,22,0.07)";
  for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1.5, y - 1.5, 3, 3);

  for (const i of s.items) {
    const fading = i.die - s.tick < TPS;
    g.globalAlpha = fading && Math.floor(s.tick / 4) % 2 ? 0.35 : 1;
    g.beginPath();
    g.arc(i.x, i.y, i.rare ? 13 : 11, 0, Math.PI * 2);
    g.fillStyle = i.rare ? "#cf4f9c" : "#ffcf3f";
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = "#161616";
    g.stroke();
    if (i.rare) {
      g.fillStyle = "#fff";
      g.font = "bold 14px system-ui";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("✦", i.x, i.y + 1);
    }
  }
  g.globalAlpha = 1;

  for (const k of s.rocks) {
    g.beginPath();
    g.arc(k.x, k.y, k.r, 0, Math.PI * 2);
    g.fillStyle = "#5b4b6b";
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = "#161616";
    g.stroke();
    g.beginPath();
    g.arc(k.x - k.r * 0.3, k.y - k.r * 0.3, k.r * 0.25, 0, Math.PI * 2);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fill();
  }

  // the player's Mochi
  const blink = s.safe > 0 && Math.floor(s.tick / 3) % 2 === 0;
  g.globalAlpha = blink ? 0.4 : 1;
  g.beginPath();
  g.ellipse(s.x, s.y, PLAYER_R + 2, PLAYER_R, 0, 0, Math.PI * 2);
  g.fillStyle = s.stun > 0 ? "#cfcfcf" : "#ffffff";
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = "#161616";
  g.stroke();
  g.fillStyle = "#161616";
  if (s.stun > 0) {
    g.font = "bold 12px system-ui";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("x  x", s.x, s.y + 1);
  } else {
    g.beginPath();
    g.arc(s.x - 6, s.y + 1, 3, 0, Math.PI * 2);
    g.arc(s.x + 6, s.y + 1, 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}
