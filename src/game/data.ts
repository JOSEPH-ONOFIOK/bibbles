// Everything the game is made of. Balance changes only need editing here.

import type { Fit, Head } from "@/components/MochiArt";

export type Mat =
  | "wood"
  | "berry"
  | "fish"
  | "cotton"
  | "flower"
  | "stone"
  | "crystal"
  | "carrot"
  | "strawberry"
  | "corn"
  | "pumpkin"
  | "kale"
  | "ice"
  | "cactus"
  | "mushroom"
  | "shell"
  | "stardust";

export const MATS: Record<Mat, { name: string; icon: string; sell: number }> = {
  wood: { name: "Wood", icon: "🪵", sell: 2 },
  berry: { name: "Berries", icon: "🫐", sell: 3 },
  fish: { name: "Fish", icon: "🐟", sell: 8 },
  cotton: { name: "Cotton", icon: "☁️", sell: 3 },
  flower: { name: "Flowers", icon: "🌸", sell: 2 },
  stone: { name: "Stone", icon: "🪨", sell: 3 },
  crystal: { name: "Crystal", icon: "💎", sell: 20 },
  carrot: { name: "Carrot", icon: "🥕", sell: 12 },
  strawberry: { name: "Strawberry", icon: "🍓", sell: 22 },
  corn: { name: "Corn", icon: "🌽", sell: 28 },
  pumpkin: { name: "Pumpkin", icon: "🎃", sell: 55 },
  kale: { name: "Kale", icon: "🥬", sell: 16 },
  ice: { name: "Ice crystal", icon: "🧊", sell: 24 },
  cactus: { name: "Cactus fruit", icon: "🌵", sell: 30 },
  mushroom: { name: "Glow mushroom", icon: "🍄", sell: 36 },
  shell: { name: "Shell", icon: "🐚", sell: 44 },
  stardust: { name: "Stardust", icon: "🌟", sell: 60 },
};

// ---------- the Frontier: worlds past the Overgrown Trail, without end ----------
// Biomes repeat ("Frost Peaks II", "III"…) with richer loot and bigger paths to carve.
export type Biome = {
  id: string;
  name: string;
  mat: Mat;
  ground: [string, string];
  path: string;
  trees: string[];
  water: boolean;
  blurb: string;
};
export const BIOMES: Biome[] = [
  { id: "frost", name: "Frost Peaks", mat: "ice", ground: ["#eaf3fb", "#dfeaf6"], path: "#cfdcec", trees: ["#4f9e6a", "#3f8e5e"], water: true, blurb: "Snowy pines and frozen ponds." },
  { id: "dunes", name: "Sunset Dunes", mat: "cactus", ground: ["#f7d9a0", "#f1cd8c"], path: "#e9bd78", trees: ["#7cbf5a", "#5fa84a"], water: false, blurb: "Warm sand under a pink sky." },
  { id: "grove", name: "Mushroom Grove", mat: "mushroom", ground: ["#7a6aa8", "#70609c"], path: "#9a8bc4", trees: ["#ff8fb3", "#c77dff"], water: true, blurb: "Giant glowing mushrooms." },
  { id: "coral", name: "Coral Shore", mat: "shell", ground: ["#ffe9c4", "#fbdfb0"], path: "#f6d39c", trees: ["#3fae4a", "#4cb84f"], water: true, blurb: "Seashells and turquoise tide pools." },
  { id: "star", name: "Starfall Ridge", mat: "stardust", ground: ["#2d2a5a", "#28254f"], path: "#4a447e", trees: ["#9b8cff", "#6f62d8"], water: false, blurb: "Stars fall here every night." },
];
export const biomeFor = (n: number) => BIOMES[(n - 1) % BIOMES.length];
export const frontierName = (n: number) => {
  const b = biomeFor(n);
  const lap = Math.floor((n - 1) / BIOMES.length);
  return lap ? `${b.name} ${["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][lap - 1] ?? lap + 1}` : b.name;
};

// What it takes to carve the path into world n (n = 1 is the first world past home)
export function carveCost(n: number): { level: number; cost: Partial<Record<Mat, number>>; coins: number } {
  const cost: Partial<Record<Mat, number>> = { wood: 20 + 12 * n, stone: 6 * n };
  if (n >= 2) cost[biomeFor(n - 1).mat] = 4 + 2 * n;
  return { level: 2 + n, cost, coins: 60 * n };
}

export const GATHERED: Mat[] = ["wood", "berry", "fish", "cotton", "flower", "stone", "crystal"];

// ---------- seasons: one real week each, a festival on the last day ----------
export type Season = "spring" | "summer" | "autumn" | "winter";

export const SEASONS: Record<Season, { name: string; icon: string; crops: Mat[]; festival: string; fish: string[] }> = {
  spring: { name: "Spring", icon: "🌸", crops: ["carrot", "strawberry"], festival: "Blossom Fair", fish: ["Sunny Minnow", "Petal Trout"] },
  summer: { name: "Summer", icon: "☀️", crops: ["corn", "strawberry"], festival: "Lantern Night", fish: ["Lily Koi", "Sun Perch"] },
  autumn: { name: "Autumn", icon: "🍂", crops: ["pumpkin", "carrot"], festival: "Harvest Feast", fish: ["Maple Bass", "Amber Carp"] },
  winter: { name: "Winter", icon: "❄️", crops: ["kale"], festival: "Snow Ball", fish: ["Frost Pike", "Snow Eel"] },
};
export const RARE_FISH = "Golden Mochi Fish";
export const ALL_FISH = [...Object.values(SEASONS).flatMap((s) => s.fish), RARE_FISH];

const DAY = 86_400_000;
const ORDER: Season[] = ["spring", "summer", "autumn", "winter"];
export function calendar(now = Date.now()) {
  const days = Math.floor(now / DAY);
  const week = Math.floor(days / 7);
  return { season: ORDER[week % 4], day: (days % 7) + 1, festival: days % 7 === 6, week: String(week) };
}

// ---------- crops: plant, water, harvest ----------
export const CROPS: Partial<Record<Mat, { seed: number; grow: number; xp: number }>> = {
  carrot: { seed: 5, grow: 10 * 60, xp: 3 },
  kale: { seed: 6, grow: 20 * 60, xp: 4 },
  strawberry: { seed: 9, grow: 30 * 60, xp: 5 },
  corn: { seed: 12, grow: 45 * 60, xp: 6 },
  pumpkin: { seed: 18, grow: 90 * 60, xp: 9 },
};
export const PLOTS_FREE = 4;
export const PLOTS_MAX = 8; // the rest open with $MOCHI later

// ---------- the world's zones ----------
export type Zone = { id: string; name: string; mats: Mat[]; color: string };
export const ZONES: Zone[] = [
  { id: "home", name: "Pocket Plaza", mats: [], color: "#fff1a8" },
  { id: "woods", name: "Whisper Woods", mats: ["wood", "berry"], color: "#ccffb2" },
  { id: "pond", name: "Lily Pond", mats: ["fish", "flower"], color: "#bfe3ff" },
  { id: "meadow", name: "Cotton Meadow", mats: ["cotton", "berry", "flower"], color: "#fff1a8" },
  { id: "path", name: "Pebble Path", mats: ["stone"], color: "#e2d4ff" },
  { id: "cave", name: "Glow Cave", mats: ["crystal", "stone"], color: "#ffc6d6" },
];

// ---------- things you harvest ----------
export type Node = "tree" | "rock" | "crystal" | "bush" | "cotton" | "flower" | "special";
export const NODES: Record<Node, { verb: string; gives: Partial<Record<Mat, [number, number]>>; hits: number; energy: number; xp: number; regrow: number }> = {
  tree: { verb: "Chop", gives: { wood: [2, 3] }, hits: 3, energy: 1, xp: 4, regrow: 90 },
  rock: { verb: "Mine", gives: { stone: [2, 3] }, hits: 4, energy: 2, xp: 6, regrow: 120 },
  crystal: { verb: "Mine", gives: { crystal: [1, 2], stone: [0, 1] }, hits: 5, energy: 2, xp: 10, regrow: 180 },
  bush: { verb: "Pick", gives: { berry: [2, 3] }, hits: 1, energy: 1, xp: 3, regrow: 60 },
  cotton: { verb: "Pick", gives: { cotton: [2, 3] }, hits: 1, energy: 1, xp: 3, regrow: 60 },
  flower: { verb: "Pick", gives: { flower: [1, 2] }, hits: 1, energy: 1, xp: 2, regrow: 45 },
  // A biome's own resource; what it gives is decided by the world it's in
  special: { verb: "Gather", gives: {}, hits: 2, energy: 2, xp: 12, regrow: 150 },
};
export const FISHING = { energy: 1, xp: 6 };

export type Cost = Partial<Record<Mat, number>>;

// ---------- villagers ----------
export const VILLAGERS = [
  { name: "Bramble", icon: "🐻", line: "My cabin's chilly. Could you spare", loves: ["pumpkin", "berry"] as Mat[], likes: ["wood", "fish"] as Mat[] },
  { name: "Pip", icon: "🐰", line: "I'm baking tonight! I need", loves: ["carrot", "strawberry"] as Mat[], likes: ["berry", "corn"] as Mat[] },
  { name: "Ollie", icon: "🦦", line: "The river was quiet today. Could I have", loves: ["fish", "crystal"] as Mat[], likes: ["stone", "kale"] as Mat[] },
  { name: "Mabel", icon: "🦔", line: "I'm sewing a quilt. Please bring", loves: ["cotton", "flower"] as Mat[], likes: ["strawberry", "berry"] as Mat[] },
  { name: "Juniper", icon: "🦊", line: "I'm building a reading nook. Got", loves: ["wood", "corn"] as Mat[], likes: ["stone", "pumpkin"] as Mat[] },
  { name: "Clove", icon: "🐿️", line: "Winter's coming. I'd love", loves: ["berry", "kale"] as Mat[], likes: ["flower", "carrot"] as Mat[] },
];
export const STARTERS = [0, 5]; // Bramble and Clove live here from day one
export const HEART = 10; // friendship points per heart
export const HEARTS_MAX = 5;

// ---------- village projects: build them and the village grows ----------
export type Project = {
  id: string;
  name: string;
  icon: string;
  level: number;
  cost: Cost;
  coins: number;
  villager?: number;
  opens?: string; // a zone
  perk: string;
};
export const PROJECTS: Project[] = [
  { id: "bakery", name: "Bakery", icon: "🥐", level: 1, cost: { wood: 15, berry: 6 }, coins: 30, villager: 1, perk: "Pip moves in and bakes" },
  { id: "meadow_gate", name: "Meadow Gate", icon: "🌼", level: 2, cost: { wood: 20 }, coins: 40, opens: "meadow", perk: "Opens Cotton Meadow" },
  { id: "dock", name: "Fishing Dock", icon: "⚓", level: 2, cost: { wood: 25, fish: 4 }, coins: 60, villager: 2, perk: "Ollie moves in. Easier perfect catches" },
  { id: "path_steps", name: "Pebble Steps", icon: "🪜", level: 3, cost: { wood: 20, cotton: 8 }, coins: 70, opens: "path", perk: "Opens Pebble Path" },
  { id: "tailor", name: "Tailor", icon: "🧵", level: 3, cost: { cotton: 20, flower: 10 }, coins: 120, villager: 3, perk: "Mabel moves in. Unlocks outfits" },
  { id: "carpenter", name: "Carpenter", icon: "🪚", level: 4, cost: { wood: 35, stone: 15 }, coins: 160, villager: 4, perk: "Juniper moves in. Unlocks big furniture" },
  { id: "cave_door", name: "Cave Door", icon: "🚪", level: 5, cost: { stone: 30, wood: 10 }, coins: 150, opens: "cave", perk: "Opens Glow Cave" },
];
export const projectFor = (zone: string) => PROJECTS.find((p) => p.opens === zone);

// ---------- crafting ----------
export type Recipe = {
  id: string;
  name: string;
  icon: string;
  level: number;
  cost: Cost;
  time: number; // seconds; 0 = instant
  xp: number;
  needs?: string; // a project that must be built first
  hearts?: { v: number; n: number }; // or a friendship
} & ({ kind: "furniture" } | { kind: "head"; head: Head } | { kind: "fit"; fit: Fit });

export const RECIPES: Recipe[] = [
  { id: "stool", kind: "furniture", name: "Stool", icon: "🪑", level: 1, cost: { wood: 3 }, time: 0, xp: 4 },
  { id: "plant", kind: "furniture", name: "Potted plant", icon: "🪴", level: 1, cost: { wood: 1, flower: 2 }, time: 0, xp: 4 },
  { id: "rug", kind: "furniture", name: "Cosy rug", icon: "🟫", level: 2, cost: { cotton: 4 }, time: 30, xp: 6 },
  { id: "teddy", kind: "furniture", name: "Teddy", icon: "🧸", level: 2, cost: { cotton: 3, berry: 1 }, time: 30, xp: 6 },
  { id: "sofa", kind: "furniture", name: "Little sofa", icon: "🛋️", level: 2, cost: { wood: 5, cotton: 4 }, time: 60, xp: 10 },
  { id: "lamp", kind: "furniture", name: "Lamp", icon: "💡", level: 3, cost: { wood: 2, stone: 2 }, time: 45, xp: 8 },
  { id: "books", kind: "furniture", name: "Bookshelf", icon: "📚", level: 3, cost: { wood: 8 }, time: 90, xp: 12 },
  { id: "pie", kind: "furniture", name: "Berry pie", icon: "🥧", level: 2, cost: { berry: 4, strawberry: 1 }, time: 30, xp: 8, needs: "bakery" },
  { id: "bed", kind: "furniture", name: "Snug bed", icon: "🛏️", level: 4, cost: { wood: 6, cotton: 6 }, time: 120, xp: 16, needs: "carpenter" },
  { id: "aquarium", kind: "furniture", name: "Fish tank", icon: "🐠", level: 4, cost: { stone: 3, fish: 4 }, time: 120, xp: 16, needs: "dock" },
  { id: "candle", kind: "furniture", name: "Candles", icon: "🕯️", level: 5, cost: { berry: 2, stone: 2 }, time: 60, xp: 12 },
  { id: "jackolantern", kind: "furniture", name: "Jack-o'-lantern", icon: "🎃", level: 3, cost: { pumpkin: 1 }, time: 30, xp: 10, hearts: { v: 0, n: 2 } },
  { id: "geode", kind: "furniture", name: "Glow geode", icon: "🔮", level: 6, cost: { crystal: 3, stone: 4 }, time: 180, xp: 24, needs: "carpenter" },
  { id: "beanie", kind: "head", head: "beanie", name: "Beanie", icon: "🧢", level: 2, cost: { cotton: 5 }, time: 60, xp: 10 },
  { id: "sunflower", kind: "head", head: "sunflower", name: "Sunflower clip", icon: "🌻", level: 3, cost: { flower: 6 }, time: 60, xp: 10, needs: "tailor" },
  { id: "hoodie", kind: "fit", fit: "hoodie", name: "Hoodie", icon: "🧥", level: 3, cost: { cotton: 8 }, time: 120, xp: 14, needs: "tailor" },
  { id: "headphones", kind: "head", head: "headphones", name: "Headphones", icon: "🎧", level: 4, cost: { stone: 4, cotton: 2 }, time: 120, xp: 14, hearts: { v: 2, n: 3 } },
  { id: "puffer", kind: "fit", fit: "puffer", name: "Puffer jacket", icon: "🧥", level: 5, cost: { cotton: 10, berry: 3 }, time: 180, xp: 18, needs: "tailor" },
  { id: "crown", kind: "head", head: "crown", name: "Crystal crown", icon: "👑", level: 7, cost: { crystal: 6, stone: 4 }, time: 300, xp: 30, hearts: { v: 3, n: 5 } },
  // From the Frontier
  { id: "icelamp", kind: "furniture", name: "Ice lamp", icon: "🏮", level: 3, cost: { ice: 4, wood: 2 }, time: 60, xp: 16 },
  { id: "cactuspot", kind: "furniture", name: "Cactus pot", icon: "🌵", level: 4, cost: { cactus: 3, stone: 2 }, time: 60, xp: 18 },
  { id: "shroomstool", kind: "furniture", name: "Mushroom stool", icon: "🍄", level: 5, cost: { mushroom: 4 }, time: 90, xp: 22 },
  { id: "shellchime", kind: "furniture", name: "Shell chime", icon: "🎐", level: 6, cost: { shell: 5, cotton: 2 }, time: 120, xp: 26 },
  { id: "starlantern", kind: "furniture", name: "Star lantern", icon: "🌠", level: 7, cost: { stardust: 4, crystal: 2 }, time: 180, xp: 34 },
  { id: "party", kind: "head", head: "party", name: "Party hat", icon: "🥳", level: 5, cost: { cactus: 4, flower: 4 }, time: 120, xp: 20 },
  { id: "space", kind: "fit", fit: "space", name: "Star suit", icon: "🧑‍🚀", level: 8, cost: { stardust: 8, crystal: 4 }, time: 300, xp: 40 },
];

// ---------- Trials: a 90 second weekly challenge ----------
export const TRIALS = [
  { id: "catch", name: "Perfect Catch", icon: "🎣", stat: "fish" as Mat, blurb: "Catch as many fish as you can." },
  { id: "timber", name: "Timber Rush", icon: "🪓", stat: "wood" as Mat, blurb: "Chop as much wood as you can." },
  { id: "forage", name: "Forage Frenzy", icon: "🌼", stat: "flower" as Mat, blurb: "Pick as many flowers as you can." },
];
export const TRIAL_SECONDS = 90;
export const TRIAL_BADGES = [
  { name: "Bronze", icon: "🥉", at: 4 },
  { name: "Silver", icon: "🥈", at: 8 },
  { name: "Gold", icon: "🥇", at: 12 },
];
export const trialFor = (week: string) => TRIALS[Number(week) % TRIALS.length];

// XP needed to go from `level` to the next
export const xpFor = (level: number) => Math.round(20 * Math.pow(level, 1.4));
export const ENERGY_MAX = 30;
export const ENERGY_EVERY_MS = 5 * 60 * 1000;
export const POCKET = { cols: 6, rows: 5 };
export const CRAFT_SLOTS = 1;
export const BLOOM = { level: 10, cost: { crystal: 10, flower: 15, cotton: 15 } as Cost };

// Where $MOCHI will plug in. Shown in the game as "soon".
export const MOCHI_SOON = {
  finishNow: "Finish now",
  plots: "More garden plots",
  slots: "More workbench slots",
  pocket: "Bigger Pocket",
  energy: "Energy refill",
  rare: "Rare seeds & festival items",
  bloom: "Bloom",
  trials: "Trial entry & prizes",
};

// ---------- weather: the same for everyone on a given day ----------
export type Weather = "sun" | "rain" | "snow";
export function weather(now = Date.now()): Weather {
  // Development only: force the weather for screenshots and clips
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    const forced = (window as unknown as { __mochiWeather?: Weather }).__mochiWeather;
    if (forced) return forced;
  }
  const day = Math.floor(now / DAY);
  const roll = (Math.imul(day ^ 0x5bd1e995, 2654435761) >>> 0) / 4294967296;
  const { season } = calendar(now);
  if (season === "winter") return roll < 0.45 ? "snow" : "sun";
  return roll < (season === "spring" ? 0.3 : 0.2) ? "rain" : "sun";
}

// ---------- starter quests: teach the loop, pay a little for each ----------
export type Quest = { id: string; text: string; coins: number; xp: number };
export const QUESTS: Quest[] = [
  { id: "wood", text: "Chop trees in Whisper Woods until you have 5 🪵", coins: 10, xp: 5 },
  { id: "craft", text: "Craft a stool at the workbench 🔨", coins: 10, xp: 5 },
  { id: "place", text: "Place furniture in your Pocket 🏡", coins: 15, xp: 5 },
  { id: "plant", text: "Plant a seed in your garden 🌱", coins: 5, xp: 5 },
  { id: "water", text: "Water it 💧", coins: 5, xp: 5 },
  { id: "fish", text: "Catch a fish at Lily Pond 🎣", coins: 10, xp: 5 },
  { id: "sell", text: "Sell something at the shipping bin 🪙", coins: 10, xp: 5 },
  { id: "help", text: "Help a villager with their request 💌", coins: 20, xp: 10 },
  { id: "bakery", text: "Build the Bakery so Pip can move in 🥐", coins: 50, xp: 25 },
];

// The game opens by itself at GAME_OPEN_AT (4pm WAT, 10 Nov). NEXT_PUBLIC_GAME_OPEN=1 opens it early;
// NEXT_PUBLIC_GAME_OPEN_AT (an ISO time) moves the launch.
const openAt = Date.parse(process.env.NEXT_PUBLIC_GAME_OPEN_AT ?? "");
export const GAME_OPEN_AT = Number.isFinite(openAt) ? openAt : Date.parse("2026-11-10T15:00:00Z");
export const gameOpen = (now = Date.now()) => process.env.NEXT_PUBLIC_GAME_OPEN === "1" || now >= GAME_OPEN_AT;
