// The world map: terrain, zones, and where everything stands. Built the same way
// every time from a fixed seed, so it's the same world for everyone.

import { biomeFor, type Biome, type Node } from "./data";

export const TILE = 48;
export const COLS = 60;
export const ROWS = 44;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;

export const T = { Grass: 0, Path: 1, Water: 2, Sand: 3, Cave: 4, Meadow: 5, Stone: 6 } as const;
type TileKind = (typeof T)[keyof typeof T];

export type Thing =
  | { id: number; kind: "node"; node: Node; x: number; y: number; r: number; hits: number; regrowAt: number; zone: string }
  | { id: number; kind: "house"; x: number; y: number; w: number; h: number }
  | { id: number; kind: "bench"; x: number; y: number; r: number }
  | { id: number; kind: "fence"; x: number; y: number; w: number; h: number; vertical: boolean }
  | { id: number; kind: "gate"; x: number; y: number; w: number; h: number; vertical: boolean; zone: string }
  | { id: number; kind: "site"; project: string; x: number; y: number; w: number; h: number }
  | { id: number; kind: "plot"; i: number; x: number; y: number }
  | { id: number; kind: "bin"; x: number; y: number; r: number }
  | { id: number; kind: "ladder"; x: number; y: number }
  // A trail to another world: forward (to the next Frontier) or back the way you came
  | { id: number; kind: "trail"; to: number; back: boolean; x: number; y: number }
  | { id: number; kind: "villager"; v: number; x: number; y: number; r: number; homeX: number; homeY: number; tx: number; ty: number; wait: number; spots: [number, number][]; spot: number }
  // Wild animals: they wander, and scurry off if you run at them
  | { id: number; kind: "critter"; icon: string; x: number; y: number; homeX: number; homeY: number; tx: number; ty: number; wait: number; flies: boolean }
  | { id: number; kind: "sign"; x: number; y: number; text: string };

// Zone rectangles in tiles: [x0, y0, x1, y1]
export const ZONE_RECTS: Record<string, [number, number, number, number]> = {
  home: [21, 15, 39, 29],
  woods: [1, 4, 20, 40],
  pond: [21, 30, 39, 43],
  meadow: [41, 14, 59, 36],
  path: [21, 1, 40, 13],
  cave: [42, 1, 59, 12],
};

export function zoneAt(px: number, py: number) {
  const tx = px / TILE;
  const ty = py / TILE;
  for (const [id, [x0, y0, x1, y1]] of Object.entries(ZONE_RECTS)) if (tx >= x0 && tx < x1 && ty >= y0 && ty < y1) return id;
  return "home";
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export type World = {
  tiles: Uint8Array;
  things: Thing[];
  spawn: { x: number; y: number };
  cols: number;
  rows: number;
  width: number;
  height: number;
  // 0 = home; 1, 2, 3… = Frontier worlds
  region: number;
  biome?: Biome;
};

export function buildWorld(): World {
  const tiles = new Uint8Array(COLS * ROWS);
  const set = (x: number, y: number, t: TileKind) => {
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS) tiles[y * COLS + x] = t;
  };
  const get = (x: number, y: number) => tiles[y * COLS + x];
  const fill = ([x0, y0, x1, y1]: [number, number, number, number], t: TileKind) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, t);
  };

  fill(ZONE_RECTS.meadow, T.Meadow);
  fill(ZONE_RECTS.path, T.Stone);
  fill(ZONE_RECTS.cave, T.Cave);

  // The pond, with a sandy shore
  const [pcx, pcy] = [30.5, 37.5];
  for (let y = 30; y < ROWS; y++)
    for (let x = 21; x < 40; x++) {
      const d = Math.hypot((x - pcx) / 8, (y - pcy) / 4.6);
      if (d < 1) set(x, y, T.Water);
      else if (d < 1.22) set(x, y, T.Sand);
    }

  // Paths from the plaza to every zone
  const path = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let w = 0; w < 2; w++) if (get(x, y0 + w) !== T.Water) set(x, y0 + w, T.Path);
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let w = 0; w < 2; w++) if (get(x1 + w, y) !== T.Water) set(x1 + w, y, T.Path);
  };
  path(24, 21, 36, 21); // plaza main street
  path(1, 21, 24, 21); // west through the woods to the Overgrown Trail
  path(36, 21, 50, 21); // east to the meadow
  path(30, 7, 30, 21); // north to the pebble path
  path(30, 21, 30, 31); // south to the pond
  path(31, 7, 48, 7); // pebble path on to the cave
  fill([25, 18, 36, 25], T.Path); // the plaza square

  const things: Thing[] = [];
  let id = 1;
  const r = rng(20261109);
  const px = (t: number) => t * TILE;

  // Your Pocket house and the workbench
  things.push({ id: id++, kind: "house", x: px(30.5), y: px(17), w: 150, h: 120 });
  things.push({ id: id++, kind: "bench", x: px(34.5), y: px(19.6), r: 22 });
  things.push({ id: id++, kind: "bin", x: px(27.6), y: px(18.6), r: 18 });
  things.push({ id: id++, kind: "sign", x: px(25.6), y: px(22.8), text: "Pocket Plaza" });

  // Garden plots beside the house (4 to start, more later)
  for (let i = 0; i < 8; i++) things.push({ id: id++, kind: "plot", i, x: px(22.4 + (i % 4) * 1.15), y: px(16 + Math.floor(i / 4) * 1.2) });

  // Building sites: each project goes up here and a villager moves in
  const site = (project: string, tx: number, ty: number) => things.push({ id: id++, kind: "site", project, x: px(tx), y: px(ty), w: 104, h: 84 });
  site("bakery", 37, 16.6);
  site("tailor", 37.2, 27.2);
  site("carpenter", 23.4, 27.2);
  site("dock", 35.2, 31.4);

  // Fences with level gates in front of the locked zones
  const fenceLine = (vertical: boolean, at: number, from: number, to: number, gateAt: number, zone: string) => {
    for (let k = from; k < to; k++) {
      const isGate = k === gateAt || k === gateAt + 1;
      const x = vertical ? px(at) : px(k);
      const y = vertical ? px(k) : px(at);
      if (isGate) {
        if (k === gateAt)
          things.push({ id: id++, kind: "gate", x, y, w: vertical ? 12 : TILE * 2, h: vertical ? TILE * 2 : 12, vertical, zone });
      } else things.push({ id: id++, kind: "fence", x, y, w: vertical ? 12 : TILE, h: vertical ? TILE : 12, vertical });
    }
  };
  fenceLine(true, 41, 14, 36, 21, "meadow");
  fenceLine(false, 13.6, 21, 40, 30, "path");
  fenceLine(true, 41.7, 1, 12, 7, "cave");
  // Plain fence round the rest of each locked area, so every side is closed
  const plain = (vertical: boolean, at: number, from: number, to: number) => {
    for (let k = from; k < to; k++)
      things.push({ id: id++, kind: "fence", x: vertical ? px(at) : px(k), y: vertical ? px(k) : px(at), w: vertical ? 12 : TILE, h: vertical ? TILE : 12, vertical });
  };
  plain(false, 14, 41, 60); // meadow, north side
  plain(false, 36, 41, 60); // meadow, south side
  plain(true, 21, 1, 14); // pebble path, woods side
  plain(false, 12, 42, 60); // glow cave, south side

  // Scatter harvestable things inside a zone, away from paths, water and each other
  const occupied: { x: number; y: number; r: number }[] = things.map((t) => ({ x: t.x, y: t.y, r: 70 }));
  // Keep the ground in front of every building, door, bench and bin clear, so nothing grows where you walk up
  for (const t of things) {
    if (t.kind === "site" || t.kind === "house") occupied.push({ x: t.x, y: t.y + t.h / 2 + 60, r: 90 });
    if (t.kind === "bench" || t.kind === "bin") occupied.push({ x: t.x, y: t.y + 60, r: 60 });
  }
  const scatter = (zone: string, node: Node, count: number, radius: number, gap: number) => {
    const [x0, y0, x1, y1] = ZONE_RECTS[zone];
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 40; tries++) {
      const tx = x0 + 1 + r() * (x1 - x0 - 2);
      const ty = y0 + 1 + r() * (y1 - y0 - 2);
      const t = get(Math.floor(tx), Math.floor(ty));
      if (t === T.Path || t === T.Water || t === T.Sand) continue;
      const x = px(tx);
      const y = px(ty);
      if (occupied.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + gap)) continue;
      occupied.push({ x, y, r: radius });
      things.push({ id: id++, kind: "node", node, x, y, r: radius, hits: 0, regrowAt: 0, zone });
      placed++;
    }
  };
  scatter("woods", "tree", 55, 26, 22);
  scatter("woods", "bush", 10, 18, 18);
  scatter("woods", "flower", 8, 10, 14);
  scatter("pond", "flower", 10, 10, 14);
  scatter("pond", "tree", 6, 26, 26);
  scatter("home", "flower", 8, 10, 22);
  scatter("home", "tree", 6, 26, 40);
  scatter("meadow", "cotton", 18, 14, 18);
  scatter("meadow", "bush", 10, 18, 18);
  scatter("meadow", "flower", 14, 10, 14);
  scatter("meadow", "tree", 8, 26, 26);
  scatter("path", "rock", 22, 22, 20);
  scatter("path", "tree", 6, 26, 26);
  scatter("cave", "crystal", 12, 18, 22);
  scatter("cave", "rock", 10, 22, 22);

  // Villagers spend the day moving between favourite spots around the world
  const hangouts: [number, number][][] = [
    [[26.5, 20.5], [14, 20.5], [8, 25]], // Bramble: plaza and the woods
    [[37, 19.4], [46, 24], [31, 23.5]], // Pip: bakery, meadow, plaza
    [[33.5, 29.6], [25.5, 31.4], [38.5, 33.5]], // Ollie: dock and the pond
    [[36, 24.8], [50, 18], [52, 29]], // Mabel: tailor and the meadow
    [[25, 24.8], [12, 12], [6, 33]], // Juniper: carpenter and deep woods
    [[34.5, 23.5], [16, 28], [30, 9]], // Clove: plaza, woods, pebble path
  ];
  hangouts.forEach((sp, v) => {
    const spots = sp.map(([x, y]) => [px(x), px(y)] as [number, number]);
    const [x, y] = spots[0];
    things.push({ id: id++, kind: "villager", v, x, y, r: 16, homeX: x, homeY: y, tx: x, ty: y, wait: 0, spots, spot: 0 });
  });

  // Wild animals around home
  critters(things, () => id++, r, tiles, COLS, [
    { icon: "🐦", zone: ZONE_RECTS.home, n: 4, flies: true },
    { icon: "🐇", zone: ZONE_RECTS.woods, n: 5, flies: false },
    { icon: "🦋", zone: ZONE_RECTS.meadow, n: 5, flies: true },
    { icon: "🐦", zone: ZONE_RECTS.woods, n: 3, flies: true },
    { icon: "🦆", zone: ZONE_RECTS.pond, n: 3, flies: false, water: true },
    { icon: "🐌", zone: ZONE_RECTS.path, n: 3, flies: false },
    { icon: "🦇", zone: ZONE_RECTS.cave, n: 3, flies: true },
  ]);

  // The Overgrown Trail at the far west edge: carve it to reach the Frontier
  things.push({ id: id++, kind: "trail", to: 1, back: false, x: px(1.2), y: px(21.9) });

  return { tiles, things, spawn: { x: px(30.5), y: px(21.6) }, cols: COLS, rows: ROWS, width: WORLD_W, height: WORLD_H, region: 0 };
}

// A Frontier world: generated from its number, so world 7 is always the same world 7
export function buildRegion(n: number): World {
  const cols = 44;
  const rows = 32;
  const biome = biomeFor(n);
  const tiles = new Uint8Array(cols * rows);
  const r = rng(9001 + n * 7919);
  const set = (x: number, y: number, t: TileKind) => {
    if (x >= 0 && y >= 0 && x < cols && y < rows) tiles[y * cols + x] = t;
  };
  const get = (x: number, y: number) => tiles[y * cols + x];
  const px = (t: number) => t * TILE;

  // A lake or two in biomes that have water
  if (biome.water) {
    const lakes = 1 + Math.floor(r() * 2);
    for (let k = 0; k < lakes; k++) {
      const cx = 10 + r() * 24;
      const cy = 6 + r() * 20;
      const rx = 3 + r() * 3;
      const ry = 2 + r() * 2;
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
          if (d < 1) set(x, y, T.Water);
          else if (d < 1.25 && get(x, y) !== T.Water) set(x, y, T.Sand);
        }
    }
  }
  // A winding path from the west trail to the east trail
  let y = 15;
  for (let x = 0; x < cols; x++) {
    if (x % 4 === 0) y = Math.max(4, Math.min(rows - 5, y + Math.round((r() - 0.5) * 3)));
    for (let w = 0; w < 2; w++) set(x, y + w, T.Path);
  }
  const endY = y;

  const things: Thing[] = [];
  let id = 1;
  things.push({ id: id++, kind: "trail", to: n - 1, back: true, x: px(1.2), y: px(15.9) });
  things.push({ id: id++, kind: "trail", to: n + 1, back: false, x: px(cols - 1.2), y: px(endY + 0.9) });
  things.push({ id: id++, kind: "sign", x: px(4), y: px(14), text: `${n}. ${biome.name}` });

  const occupied: { x: number; y: number; r: number }[] = things.map((t) => ({ x: t.x, y: t.y, r: 90 }));
  const scatter = (node: Node, count: number, radius: number, gap: number) => {
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 50; tries++) {
      const tx = 2 + r() * (cols - 4);
      const ty = 2 + r() * (rows - 4);
      const t = get(Math.floor(tx), Math.floor(ty));
      if (t === T.Path || t === T.Water || t === T.Sand) continue;
      const x = px(tx);
      const yy = px(ty);
      if (occupied.some((o) => Math.hypot(o.x - x, o.y - yy) < o.r + gap)) continue;
      occupied.push({ x, y: yy, r: radius });
      things.push({ id: id++, kind: "node", node, x, y: yy, r: radius, hits: 0, regrowAt: 0, zone: "frontier" });
      placed++;
    }
  };
  // Richer the further you go
  scatter("special", Math.min(18, 8 + n), 18, 26);
  scatter("tree", 30, 26, 24);
  scatter("rock", 10 + Math.min(10, n), 22, 22);
  if (n >= 3) scatter("crystal", Math.min(10, n), 18, 22);
  scatter("bush", 6, 18, 18);
  scatter("flower", 10, 10, 14);

  // Wild animals for this biome
  const fauna: Record<string, { icon: string; flies: boolean; water?: boolean }[]> = {
    frost: [{ icon: "🐧", flies: false }, { icon: "🦊", flies: false }],
    dunes: [{ icon: "🦎", flies: false }, { icon: "🐪", flies: false }],
    grove: [{ icon: "🐸", flies: false }, { icon: "✨", flies: true }],
    coral: [{ icon: "🦀", flies: false }, { icon: "🐢", flies: false }],
    star: [{ icon: "🦉", flies: true }, { icon: "✨", flies: true }],
  };
  critters(
    things,
    () => id++,
    r,
    tiles,
    cols,
    (fauna[biome.id] ?? []).map((f) => ({ ...f, zone: [1, 1, cols - 1, rows - 1] as [number, number, number, number], n: 5 })),
  );

  return { tiles, things, spawn: { x: px(3), y: px(16.2) }, cols, rows, width: cols * TILE, height: rows * TILE, region: n, biome };
}

function critters(
  things: Thing[],
  nextId: () => number,
  r: () => number,
  tiles: Uint8Array,
  cols: number,
  kinds: { icon: string; zone: [number, number, number, number]; n: number; flies: boolean; water?: boolean }[],
) {
  for (const k of kinds) {
    const [x0, y0, x1, y1] = k.zone;
    let placed = 0;
    for (let tries = 0; placed < k.n && tries < k.n * 40; tries++) {
      const tx = x0 + 1 + r() * (x1 - x0 - 2);
      const ty = y0 + 1 + r() * (y1 - y0 - 2);
      const onWater = tiles[Math.floor(ty) * cols + Math.floor(tx)] === T.Water;
      if (onWater !== !!k.water) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      things.push({ id: nextId(), kind: "critter", icon: k.icon, x, y, homeX: x, homeY: y, tx: x, ty: y, wait: r() * 3, flies: k.flies });
      placed++;
    }
  }
}

export const tileAt = (w: World, px: number, py: number) => {
  const x = Math.floor(px / TILE);
  const y = Math.floor(py / TILE);
  if (x < 0 || y < 0 || x >= w.cols || y >= w.rows) return -1;
  return w.tiles[y * w.cols + x];
};
