// The save file and every way it can change. Pure functions, so the UI just
// dispatches actions. Saved in the browser, and to the server when signed in.

import type { Fit, Head } from "@/components/MochiArt";
import {
  ALL_FISH,
  CRAFT_SLOTS,
  CROPS,
  ENERGY_EVERY_MS,
  ENERGY_MAX,
  HEART,
  HEARTS_MAX,
  MATS,
  PLOTS_FREE,
  PROJECTS,
  RECIPES,
  SEASONS,
  STARTERS,
  TRIAL_BADGES,
  VILLAGERS,
  ZONES,
  QUESTS,
  calendar,
  carveCost,
  weather,
  frontierName,
  trialFor,
  xpFor,
  type Cost,
  type Mat,
  type Recipe,
} from "./data";

export type Request = { id: string; villager: number; want: Cost; xp: number; reward: Cost; coins: number; done?: boolean };
export type Job = { recipe: string; endsAt: number };
export type Plot = { crop?: Mat; plantedAt?: number; watered?: boolean };

export type Save = {
  v: 2;
  savedAt: number;
  level: number;
  xp: number;
  coins: number;
  energy: number;
  energyAt: number;
  mats: Partial<Record<Mat, number>>;
  items: Record<string, number>;
  outfits: string[];
  head: Head;
  fit: Fit;
  pocket: Record<string, string>;
  jobs: (Job | null)[];
  plots: Plot[];
  // Materials and coins paid into each project so far
  projects: Record<string, { paid: Cost; coins: number; done?: boolean }>;
  // Friendship points per villager, and the last day you talked or gave a gift
  friends: number[];
  talked: Record<number, string>;
  gifted: Record<number, string>;
  day: string;
  requests: Request[];
  caveBest: number;
  // The Frontier: worlds carved open so far, progress on the next path, and the furthest visited
  carved: number;
  carving: { paid: Cost; coins: number };
  frontierBest: number;
  // Starter quests: how many are done
  quest: number;
  log: { fish: string[]; crops: string[] };
  trial: { week: string; best: number; badges: string[] };
  stats: { runs: number; crafted: number; requests: number; sold: number };
};

const KEY = "mochi_game_v1";
const today = () => new Date().toISOString().slice(0, 10);

export function fresh(now = Date.now()): Save {
  return withDay({
    v: 2,
    savedAt: now,
    level: 1,
    xp: 0,
    coins: 20,
    energy: ENERGY_MAX,
    energyAt: now,
    mats: { wood: 2 },
    items: { stool: 1 },
    outfits: [],
    head: "none",
    fit: "tee",
    pocket: {},
    jobs: Array.from({ length: CRAFT_SLOTS }, () => null),
    plots: Array.from({ length: PLOTS_FREE }, () => ({})),
    projects: {},
    friends: VILLAGERS.map(() => 0),
    talked: {},
    gifted: {},
    day: "",
    requests: [],
    caveBest: 0,
    carved: 0,
    carving: { paid: {}, coins: 0 },
    frontierBest: 0,
    quest: 0,
    log: { fish: [], crops: [] },
    trial: { week: "", best: 0, badges: [] },
    stats: { runs: 0, crafted: 0, requests: 0, sold: 0 },
  });
}

// Older saves keep everything they had and gain the new parts
export function upgrade(raw: unknown): Save | null {
  const s = raw as Partial<Omit<Save, "v">> & { v?: number };
  if (!s || (s.v !== 1 && s.v !== 2)) return null;
  const base = fresh();
  return withDay(
    regen({
      ...base,
      ...s,
      v: 2,
      savedAt: s.savedAt ?? 0,
      stats: { ...base.stats, ...s.stats },
      log: { ...base.log, ...s.log },
      trial: { ...base.trial, ...s.trial },
      carved: s.carved ?? 0,
      carving: s.carving ?? base.carving,
      frontierBest: s.frontierBest ?? 0,
      // Players from before the quests skip the ones they've clearly done
      quest: s.quest ?? (s.projects?.bakery?.done ? QUESTS.length : 0),
      friends: s.friends ?? base.friends,
      plots: s.plots ?? base.plots,
      requests: s.v === 1 ? [] : (s.requests ?? []),
      day: s.v === 1 ? "" : (s.day ?? ""),
    } as Save),
  );
}

export function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return upgrade(JSON.parse(raw)) ?? fresh();
  } catch {}
  return fresh();
}

export function store(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

// ---------- who lives here, what's built ----------
export const built = (s: Save, id: string) => !!s.projects[id]?.done;
export const residents = (s: Save) => [...STARTERS, ...PROJECTS.filter((p) => p.villager !== undefined && built(s, p.id)).map((p) => p.villager!)];
export const zoneOpen = (s: Save, zone: string) => {
  const p = PROJECTS.find((x) => x.opens === zone);
  return !p || built(s, p.id);
};
export const hearts = (s: Save, v: number) => Math.min(HEARTS_MAX, Math.floor((s.friends[v] ?? 0) / HEART));

export function canCraft(s: Save, r: Recipe) {
  if (r.level > s.level) return `Level ${r.level}`;
  if (r.needs && !built(s, r.needs)) return `Build the ${PROJECTS.find((p) => p.id === r.needs)?.name}`;
  if (r.hearts && hearts(s, r.hearts.v) < r.hearts.n) return `${r.hearts.n}♥ ${VILLAGERS[r.hearts.v].name}`;
  return null;
}

// ---------- energy ----------
export function regen(s: Save, now = Date.now()): Save {
  if (s.energy >= ENERGY_MAX) return { ...s, energyAt: now };
  const gained = Math.floor((now - s.energyAt) / ENERGY_EVERY_MS);
  if (gained <= 0) return s;
  const energy = Math.min(ENERGY_MAX, s.energy + gained);
  return { ...s, energy, energyAt: energy >= ENERGY_MAX ? now : s.energyAt + gained * ENERGY_EVERY_MS };
}

export const nextEnergyIn = (s: Save, now = Date.now()) => (s.energy >= ENERGY_MAX ? 0 : Math.max(0, ENERGY_EVERY_MS - (now - s.energyAt)));

// ---------- crops ----------
export function plotState(p: Plot, now = Date.now()) {
  if (!p.crop) return { stage: "empty" as const, left: 0 };
  if (!p.watered || !p.plantedAt) return { stage: "dry" as const, left: 0 };
  const grow = (CROPS[p.crop]?.grow ?? 600) * 1000;
  const left = p.plantedAt + grow - now;
  if (left <= 0) return { stage: "ready" as const, left: 0 };
  return { stage: left > grow / 2 ? ("sprout" as const) : ("growing" as const), left };
}

// ---------- daily villager requests ----------
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function makeRequests(s: Save, day: string): Request[] {
  const rnd = seeded(day);
  const open = ZONES.filter((z) => zoneOpen(s, z.id)).flatMap((z) => z.mats);
  const mats = [...new Set<Mat>(open)];
  const who = residents(s).sort(() => rnd() - 0.5);
  return who.slice(0, 3).map((villager, i) => {
    const want: Cost = {};
    const kinds = 1 + (s.level >= 3 && rnd() > 0.5 ? 1 : 0);
    for (let k = 0; k < kinds; k++) {
      const m = mats[Math.floor(rnd() * mats.length)];
      want[m] = (want[m] ?? 0) + 2 + Math.floor(rnd() * (3 + s.level));
    }
    const amount = Object.values(want).reduce((a, b) => a + (b ?? 0), 0);
    const bonus = mats[Math.floor(rnd() * mats.length)];
    return { id: `${day}-${i}`, villager, want, xp: 6 + amount * 2, reward: { [bonus]: 2 + Math.floor(s.level / 2) }, coins: 10 + amount * 3 };
  });
}

function withDay(s: Save): Save {
  const d = today();
  return s.day === d ? s : { ...s, day: d, requests: makeRequests(s, d) };
}

// ---------- helpers ----------
export const has = (s: Save, cost: Cost) => (Object.entries(cost) as [Mat, number][]).every(([m, n]) => (s.mats[m] ?? 0) >= n);
const spend = (mats: Save["mats"], cost: Cost) => {
  const out = { ...mats };
  for (const [m, n] of Object.entries(cost) as [Mat, number][]) out[m] = (out[m] ?? 0) - n;
  return out;
};
const add = (mats: Save["mats"], gain: Cost) => {
  const out = { ...mats };
  for (const [m, n] of Object.entries(gain) as [Mat, number][]) out[m] = (out[m] ?? 0) + n;
  return out;
};
function gainXp(s: Save, xp: number): { save: Save; levelUp?: number } {
  let { level, xp: cur } = s;
  cur += xp;
  while (cur >= xpFor(level)) {
    cur -= xpFor(level);
    level++;
  }
  return { save: { ...s, level, xp: cur }, levelUp: level > s.level ? level : undefined };
}
const befriend = (s: Save, v: number, pts: number): Save => ({ ...s, friends: s.friends.map((f, i) => (i === v ? f + pts : f)) });

export const costText = (c: Cost) =>
  (Object.entries(c) as [Mat, number][])
    .filter(([, n]) => n > 0)
    .map(([m, n]) => `${n} ${MATS[m].icon}`)
    .join("  ");

export const seasonCrops = (now = Date.now()) => SEASONS[calendar(now).season].crops;

// ---------- actions ----------
export type Action =
  | { type: "tick" }
  | { type: "harvest"; gain: Cost; xp: number; energy: number; fish?: string }
  | { type: "craft"; recipe: string }
  | { type: "collect"; slot: number }
  | { type: "place"; recipe: string; at: string }
  | { type: "pickup"; at: string }
  | { type: "wear"; recipe: string }
  | { type: "unwear"; part: "head" | "fit" }
  | { type: "fulfil"; request: string }
  | { type: "plant"; plot: number; crop: Mat }
  | { type: "water"; plot: number }
  | { type: "reap"; plot: number }
  | { type: "sell"; mat: Mat; n: number }
  | { type: "fund"; project: string }
  | { type: "talk"; v: number }
  | { type: "gift"; v: number; mat: Mat }
  | { type: "cave"; floor: number }
  | { type: "carve" }
  | { type: "visit"; region: number }
  | { type: "trial"; score: number }
  | { type: "reset" };

// What changed, for the pop-ups
export type Gain = { mats?: Cost; xp?: number; coins?: number; levelUp?: number; item?: string; built?: string; heart?: number; text?: string };

// Is the current starter quest done?
export function questDone(s: Save, i = s.quest): boolean {
  const q = QUESTS[i];
  if (!q) return false;
  switch (q.id) {
    case "wood":
      return (s.mats.wood ?? 0) >= 5;
    case "craft":
      return s.stats.crafted >= 1;
    case "place":
      return Object.keys(s.pocket).length >= 1;
    case "plant":
      return s.plots.some((p) => p.crop);
    case "water":
      return s.plots.some((p) => p.watered) || s.log.crops.length > 0;
    case "fish":
      return s.log.fish.length >= 1;
    case "sell":
      return s.stats.sold >= 1;
    case "help":
      return s.stats.requests >= 1;
    case "bakery":
      return built(s, "bakery");
  }
  return false;
}

// Rain waters every planted crop for you
function rainfall(s: Save, now: number): Save {
  if (weather(now) !== "rain" || !s.plots.some((p) => p.crop && !p.watered)) return s;
  return { ...s, plots: s.plots.map((p) => (p.crop && !p.watered ? { ...p, watered: true, plantedAt: now } : p)) };
}

export function apply(s0: Save, a: Action, now = Date.now()): { save: Save; gain?: Gain } {
  const r = step(s0, a, now);
  // Finish any starter quests this action completed, paying their reward
  let { save } = r;
  let gain = r.gain;
  while (questDone(save)) {
    const q = QUESTS[save.quest];
    const g = gainXp({ ...save, quest: save.quest + 1, coins: save.coins + q.coins }, q.xp);
    save = { ...g.save, savedAt: now };
    gain = { ...gain, text: `Quest done! ${q.text.replace(/ [^ ]*$/, "")}`, coins: (gain?.coins ?? 0) + q.coins, levelUp: g.levelUp ?? gain?.levelUp };
  }
  return { save, gain };
}

function step(s0: Save, a: Action, now: number): { save: Save; gain?: Gain } {
  let s = rainfall(withDay(regen(s0, now)), now);
  const out = (save: Save, gain?: Gain) => ({ save: { ...save, savedAt: now }, gain });
  switch (a.type) {
    case "tick":
      return { save: s };

    case "harvest": {
      if (s.energy < a.energy) return { save: s };
      s = { ...s, energy: s.energy - a.energy, mats: add(s.mats, a.gain), stats: { ...s.stats, runs: s.stats.runs + 1 } };
      if (s0.energy >= ENERGY_MAX) s.energyAt = now;
      if (a.fish && ALL_FISH.includes(a.fish) && !s.log.fish.includes(a.fish)) s = { ...s, log: { ...s.log, fish: [...s.log.fish, a.fish] } };
      const r = gainXp(s, a.xp);
      return out(r.save, { mats: a.gain, xp: a.xp, levelUp: r.levelUp });
    }

    case "craft": {
      const r = RECIPES.find((x) => x.id === a.recipe);
      if (!r || canCraft(s, r) || !has(s, r.cost)) return { save: s };
      if (r.kind !== "furniture" && s.outfits.includes(r.id)) return { save: s };
      if (r.time > 0) {
        const slot = s.jobs.findIndex((j) => !j);
        if (slot < 0) return { save: s };
        const jobs = [...s.jobs];
        jobs[slot] = { recipe: r.id, endsAt: now + r.time * 1000 };
        return out({ ...s, mats: spend(s.mats, r.cost), jobs });
      }
      return finish({ ...s, mats: spend(s.mats, r.cost) }, r.id, now);
    }

    case "collect": {
      const job = s.jobs[a.slot];
      if (!job || job.endsAt > now) return { save: s };
      const jobs = [...s.jobs];
      jobs[a.slot] = null;
      return finish({ ...s, jobs }, job.recipe, now);
    }

    case "place":
      if (!s.items[a.recipe] || s.pocket[a.at]) return { save: s };
      return out({ ...s, items: { ...s.items, [a.recipe]: s.items[a.recipe] - 1 }, pocket: { ...s.pocket, [a.at]: a.recipe } });

    case "pickup": {
      const id = s.pocket[a.at];
      if (!id) return { save: s };
      const pocket = { ...s.pocket };
      delete pocket[a.at];
      return out({ ...s, pocket, items: { ...s.items, [id]: (s.items[id] ?? 0) + 1 } });
    }

    case "wear": {
      const r = RECIPES.find((x) => x.id === a.recipe);
      if (!r || !s.outfits.includes(r.id)) return { save: s };
      if (r.kind === "head") return out({ ...s, head: r.head });
      if (r.kind === "fit") return out({ ...s, fit: r.fit });
      return { save: s };
    }

    case "unwear":
      return out(a.part === "head" ? { ...s, head: "none" } : { ...s, fit: "tee" });

    case "fulfil": {
      const req = s.requests.find((r) => r.id === a.request);
      if (!req || req.done || !has(s, req.want)) return { save: s };
      const x = calendar(now).festival ? 2 : 1;
      s = {
        ...s,
        mats: add(spend(s.mats, req.want), req.reward),
        coins: s.coins + req.coins * x,
        requests: s.requests.map((r) => (r.id === req.id ? { ...r, done: true } : r)),
        stats: { ...s.stats, requests: s.stats.requests + 1 },
      };
      const before = hearts(s, req.villager);
      s = befriend(s, req.villager, 5 * x);
      const r = gainXp(s, req.xp);
      return out(r.save, { mats: req.reward, coins: req.coins * x, xp: req.xp, levelUp: r.levelUp, heart: hearts(r.save, req.villager) > before ? req.villager : undefined });
    }

    case "plant": {
      const p = s.plots[a.plot];
      const crop = CROPS[a.crop];
      if (!p || p.crop || !crop || s.coins < crop.seed || !seasonCrops(now).includes(a.crop)) return { save: s };
      return out({ ...s, coins: s.coins - crop.seed, plots: s.plots.map((x, i) => (i === a.plot ? { crop: a.crop } : x)) }, { text: "Planted 🌱 Now water it" });
    }

    case "water": {
      const p = s.plots[a.plot];
      if (!p?.crop || p.watered) return { save: s };
      return out({ ...s, plots: s.plots.map((x, i) => (i === a.plot ? { ...x, watered: true, plantedAt: now } : x)) }, { text: "Watered 💧" });
    }

    case "reap": {
      const p = s.plots[a.plot];
      if (!p?.crop || plotState(p, now).stage !== "ready") return { save: s };
      const crop = p.crop;
      const n = 1 + (Math.random() < 0.3 ? 1 : 0);
      s = { ...s, mats: add(s.mats, { [crop]: n }), plots: s.plots.map((x, i) => (i === a.plot ? {} : x)) };
      if (!s.log.crops.includes(crop)) s = { ...s, log: { ...s.log, crops: [...s.log.crops, crop] } };
      const r = gainXp(s, CROPS[crop]?.xp ?? 3);
      return out(r.save, { mats: { [crop]: n }, xp: CROPS[crop]?.xp, levelUp: r.levelUp });
    }

    case "sell": {
      const have = s.mats[a.mat] ?? 0;
      const n = Math.min(have, Math.max(0, Math.floor(a.n)));
      if (!n) return { save: s };
      const coins = n * MATS[a.mat].sell;
      return out({ ...s, mats: { ...s.mats, [a.mat]: have - n }, coins: s.coins + coins, stats: { ...s.stats, sold: s.stats.sold + n } }, { coins });
    }

    case "fund": {
      const p = PROJECTS.find((x) => x.id === a.project);
      if (!p || built(s, p.id) || s.level < p.level) return { save: s };
      const cur = s.projects[p.id] ?? { paid: {}, coins: 0 };
      // Put in everything you can toward what's still needed
      const paid: Cost = { ...cur.paid };
      const take: Cost = {};
      for (const [m, need] of Object.entries(p.cost) as [Mat, number][]) {
        const k = Math.min(need - (paid[m] ?? 0), s.mats[m] ?? 0);
        if (k > 0) {
          take[m] = k;
          paid[m] = (paid[m] ?? 0) + k;
        }
      }
      const coinsIn = Math.min(p.coins - cur.coins, s.coins);
      if (!Object.keys(take).length && coinsIn <= 0) return { save: s };
      const done = (Object.entries(p.cost) as [Mat, number][]).every(([m, n]) => (paid[m] ?? 0) >= n) && cur.coins + coinsIn >= p.coins;
      s = { ...s, mats: spend(s.mats, take), coins: s.coins - coinsIn, projects: { ...s.projects, [p.id]: { paid, coins: cur.coins + coinsIn, done } } };
      if (!done) return out(s, { text: "Added to the project 🔨" });
      const r = gainXp(s, 25);
      return out(r.save, { built: p.id, xp: 25, levelUp: r.levelUp });
    }

    case "talk": {
      if (s.talked[a.v] === s.day) return { save: s };
      const before = hearts(s, a.v);
      s = befriend({ ...s, talked: { ...s.talked, [a.v]: s.day } }, a.v, 1);
      return out(s, hearts(s, a.v) > before ? { heart: a.v } : undefined);
    }

    case "gift": {
      if (s.gifted[a.v] === s.day || !(s.mats[a.mat] ?? 0)) return { save: s };
      const v = VILLAGERS[a.v];
      const pts = (v.loves.includes(a.mat) ? 8 : v.likes.includes(a.mat) ? 4 : 1) * (calendar(now).festival ? 2 : 1);
      const before = hearts(s, a.v);
      s = befriend({ ...s, mats: spend(s.mats, { [a.mat]: 1 }), gifted: { ...s.gifted, [a.v]: s.day } }, a.v, pts);
      const text = pts >= 8 ? `${v.name} loves it! 💖` : pts >= 4 ? `${v.name} likes it 😊` : `${v.name} says thanks`;
      return out(s, { text, heart: hearts(s, a.v) > before ? a.v : undefined });
    }

    case "carve": {
      // Put what you have into carving the path to the next world
      const to = s.carved + 1;
      const c = carveCost(to);
      if (s.level < c.level) return { save: s };
      const paid: Cost = { ...s.carving.paid };
      const take: Cost = {};
      for (const [m, need] of Object.entries(c.cost) as [Mat, number][]) {
        const k = Math.min(need - (paid[m] ?? 0), s.mats[m] ?? 0);
        if (k > 0) {
          take[m] = k;
          paid[m] = (paid[m] ?? 0) + k;
        }
      }
      const coinsIn = Math.min(c.coins - s.carving.coins, s.coins);
      if (!Object.keys(take).length && coinsIn <= 0) return { save: s };
      const done = (Object.entries(c.cost) as [Mat, number][]).every(([m, n]) => (paid[m] ?? 0) >= n) && s.carving.coins + coinsIn >= c.coins;
      s = { ...s, mats: spend(s.mats, take), coins: s.coins - coinsIn, carving: done ? { paid: {}, coins: 0 } : { paid, coins: s.carving.coins + coinsIn } };
      if (!done) return out(s, { text: "Path carving… 🔨" });
      const r = gainXp({ ...s, carved: to }, 30 + 10 * to);
      return out(r.save, { text: `Path carved to ${frontierName(to)}! 🗺️`, xp: 30 + 10 * to, levelUp: r.levelUp });
    }

    case "visit":
      return a.region > s.frontierBest ? out({ ...s, frontierBest: a.region }, { text: `New world: ${frontierName(a.region)}!` }) : { save: s };

    case "cave":
      return a.floor > s.caveBest ? out({ ...s, caveBest: a.floor }, { text: `New deepest floor: ${a.floor}!` }) : { save: s };

    case "trial": {
      const week = calendar(now).week;
      const best = s.trial.week === week ? Math.max(s.trial.best, a.score) : a.score;
      const trial = trialFor(week);
      const badges = [...s.trial.badges];
      for (const b of TRIAL_BADGES) {
        const id = `${week}:${trial.id}:${b.name}`;
        if (a.score >= b.at && !badges.includes(id)) badges.push(id);
      }
      return out({ ...s, trial: { week, best, badges } }, { text: `Trial over! Score: ${a.score}` });
    }

    case "reset":
      return { save: fresh(now) };
  }
}

function finish(s: Save, id: string, now: number): { save: Save; gain: Gain } {
  const r = RECIPES.find((x) => x.id === id)!;
  let next: Save =
    r.kind === "furniture"
      ? { ...s, items: { ...s.items, [r.id]: (s.items[r.id] ?? 0) + 1 } }
      : { ...s, outfits: [...s.outfits, r.id], ...(r.kind === "head" ? { head: r.head } : { fit: r.fit }) };
  next = { ...next, stats: { ...next.stats, crafted: next.stats.crafted + 1 }, savedAt: now };
  const g = gainXp(next, r.xp);
  return { save: g.save, gain: { item: r.id, xp: r.xp, levelUp: g.levelUp } };
}
