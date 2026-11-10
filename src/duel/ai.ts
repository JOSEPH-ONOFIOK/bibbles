// Mochi Duel AI: plays a whole run from the match seed.
//
// It's deterministic: the same seed always gives the same AI run, so its play can't be tuned per
// player or per match. It sees only what a player sees at each moment (no peeking ahead), reacts
// every few ticks rather than instantly, sometimes hesitates, and dodges less carefully than it could.

import { DIRS, TICKS, createSim, step, type Sim } from "./sim";

export const AI_LEVEL = "Normal";
// Measured over 300 seeds: average 676, usually 555–790 (10th–90th percentile)
export const AI_TYPICAL = { avg: 680, low: 550, high: 790 };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REACT_EVERY = 10; // decides every 10 ticks (a third of a second)
const WANDER = 0.25; // chance of a wasted move for one decision
const DODGE_MARGIN = 26; // px of space it tries to leave around rocks

function decide(s: Sim, r: () => number) {
  if (r() < WANDER) return 1 + Math.floor(r() * 8);
  let tx = s.x;
  let ty = s.y;
  let best = Infinity;
  for (const i of s.items) {
    const d = (i.x - s.x) ** 2 + (i.y - s.y) ** 2 - (i.rare ? 12000 : 0);
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
    for (const k2 of s.rocks) if ((nx - k2.x) ** 2 + (ny - k2.y) ** 2 < (k2.r + DODGE_MARGIN) ** 2) v -= 1e9;
    if (v > value) {
      value = v;
      pick = k;
    }
  }
  return pick;
}

/** The AI's full list of moves for this match (one input code per tick). */
export function aiMoves(seed: number) {
  const s = createSim(seed);
  const r = rng(seed ^ 0x5eed);
  let code = 0;
  let out = "";
  for (let t = 0; t < TICKS; t++) {
    if (t % REACT_EVERY === 0) code = decide(s, r);
    out += code;
    step(s, code);
  }
  return out;
}
