// Mochi Duel: the 90-second collect-and-dodge run.
//
// The same code runs in the browser (to draw the game) and on the server (to work out the real
// score). The browser only sends which way the player pushed on each tick. The server replays
// those moves against the match seed, so a score can't be faked. Moving faster than allowed or
// passing through walls simply isn't possible.
//
// Everything here must stay deterministic: integer RNG, fixed ticks, and only + - * / and sqrt
// (no Math.sin/cos, which can differ between JS engines).

export const TPS = 30; // ticks per second
export const SECONDS = 90;
export const TICKS = TPS * SECONDS; // 2700
export const W = 800;
export const H = 480;

export const PLAYER_R = 16;
const SPEED = 5.5; // px per tick
const ITEM_R = 12;

export const POINTS = { item: 10, rare: 25, hit: -15 };
const STUN_TICKS = TPS; // 1 second
const SAFE_TICKS = TPS * 2; // can't be hit again for 2 seconds

const ITEM_EVERY = 14; // a new item every 14 ticks
const ITEM_LIFE = 180; // normal items last 6 seconds
const RARE_LIFE = 105; // rare items last 3.5 seconds
const RARE_CHANCE = 0.1;

const D = Math.SQRT1_2;
// Input codes: 0 none, 1 up, then clockwise: 2 up-right, 3 right ... 8 up-left
export const DIRS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -1],
  [D, -D],
  [1, 0],
  [D, D],
  [0, 1],
  [-D, D],
  [-1, 0],
  [-D, -D],
];

export type Item = { x: number; y: number; rare: boolean; born: number; die: number };
export type Rock = { x: number; y: number; vx: number; vy: number; r: number; from: number };

export type Sim = {
  tick: number;
  x: number;
  y: number;
  score: number;
  collected: number;
  rares: number;
  hits: number;
  stun: number; // ticks left stunned
  safe: number; // ticks left unhittable
  items: Item[]; // on the field now
  rocks: Rock[]; // obstacles active now
  // the fixed schedule, identical for both players
  plan: { items: Item[]; rocks: Rock[]; nextItem: number; nextRock: number };
};

export type Summary = { score: number; collected: number; rares: number; hits: number; ticks: number };

// mulberry32: small, fast, integer-only seeded RNG
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

function plan(seed: number) {
  const r = rng(seed);
  const items: Item[] = [];
  for (let t = 10; t < TICKS; t += ITEM_EVERY) {
    const rare = r() < RARE_CHANCE;
    items.push({ x: 30 + r() * (W - 60), y: 30 + r() * (H - 60), rare, born: t, die: t + (rare ? RARE_LIFE : ITEM_LIFE) });
  }
  // Obstacles: 4 at the start, one more every 15 seconds, up to 9. They enter from an edge and bounce.
  const rocks: Rock[] = [];
  const starts = [0, 0, 0, 0, 15, 30, 45, 60, 75].map((s) => s * TPS);
  for (const from of starts) {
    const edge = Math.floor(r() * 4);
    const along = r();
    const speed = 2 + r() * 1.6 + from / TICKS; // later ones are a little faster
    const sx = edge === 3 ? W - 30 : edge === 1 ? 30 : 30 + along * (W - 60);
    const sy = edge === 0 ? 30 : edge === 2 ? H - 30 : 30 + along * (H - 60);
    // a diagonal heading into the arena, skewed a little so no two paths match (no trig needed)
    const vx = (sx < W / 2 ? D : -D) * speed * (0.7 + r() * 0.6);
    const vy = (sy < H / 2 ? D : -D) * speed * (0.7 + r() * 0.6);
    rocks.push({ x: sx, y: sy, vx, vy, r: 18 + r() * 10, from });
  }
  return { items, rocks, nextItem: 0, nextRock: 0 };
}

export function createSim(seed: number): Sim {
  return {
    tick: 0,
    x: W / 2,
    y: H / 2,
    score: 0,
    collected: 0,
    rares: 0,
    hits: 0,
    stun: 0,
    safe: 0,
    items: [],
    rocks: [],
    plan: plan(seed),
  };
}

const near = (ax: number, ay: number, bx: number, by: number, d: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < d * d;
};

/** Advance one tick with the player's input (0–8). Does nothing once the run is over. */
export function step(s: Sim, dir: number) {
  if (s.tick >= TICKS) return;
  const t = s.tick;
  const p = s.plan;

  // spawn what's due this tick
  while (p.nextItem < p.items.length && p.items[p.nextItem].born <= t) s.items.push({ ...p.items[p.nextItem++] });
  while (p.nextRock < p.rocks.length && p.rocks[p.nextRock].from <= t) s.rocks.push({ ...p.rocks[p.nextRock++] });
  s.items = s.items.filter((i) => i.die > t);

  // move the player
  if (s.stun > 0) s.stun--;
  else {
    const [dx, dy] = DIRS[dir] ?? DIRS[0];
    s.x = Math.min(W - PLAYER_R, Math.max(PLAYER_R, s.x + dx * SPEED));
    s.y = Math.min(H - PLAYER_R, Math.max(PLAYER_R, s.y + dy * SPEED));
  }
  if (s.safe > 0) s.safe--;

  // move obstacles, bouncing off the walls
  for (const k of s.rocks) {
    k.x += k.vx;
    k.y += k.vy;
    if (k.x < k.r) {
      k.x = k.r;
      k.vx = Math.abs(k.vx);
    }
    if (k.x > W - k.r) {
      k.x = W - k.r;
      k.vx = -Math.abs(k.vx);
    }
    if (k.y < k.r) {
      k.y = k.r;
      k.vy = Math.abs(k.vy);
    }
    if (k.y > H - k.r) {
      k.y = H - k.r;
      k.vy = -Math.abs(k.vy);
    }
  }

  // collect
  s.items = s.items.filter((i) => {
    if (!near(s.x, s.y, i.x, i.y, PLAYER_R + ITEM_R)) return true;
    s.score += i.rare ? POINTS.rare : POINTS.item;
    s.collected++;
    if (i.rare) s.rares++;
    return false;
  });

  // get hit
  if (s.safe === 0 && s.rocks.some((k) => near(s.x, s.y, k.x, k.y, PLAYER_R + k.r - 4))) {
    s.score = Math.max(0, s.score + POINTS.hit);
    s.hits++;
    s.stun = STUN_TICKS;
    s.safe = SAFE_TICKS;
  }

  s.tick++;
}

export const validInputs = (inputs: string) => inputs.length <= TICKS && /^[0-8]*$/.test(inputs);

export const summary = (s: Sim): Summary => ({ score: s.score, collected: s.collected, rares: s.rares, hits: s.hits, ticks: s.tick });

/** Replay a run from its inputs. This is how the server scores every player. */
export function replay(seed: number, inputs: string): Summary {
  const s = createSim(seed);
  for (let i = 0; i < inputs.length && i < TICKS; i++) step(s, inputs.charCodeAt(i) - 48);
  return summary(s);
}
