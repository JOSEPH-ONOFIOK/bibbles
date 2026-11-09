// The 2D world: movement, collisions, harvesting, fishing, villagers and drawing.
// React owns the save and the menus; this only asks it through `Host`.

import { FISHING, MATS, NODES, PROJECTS, RARE_FISH, SEASONS, VILLAGERS, ZONES, frontierName, projectFor, weather, type Cost, type Mat, type Node, type Season } from "./data";
import { play } from "./sfx";
import { T, TILE, buildRegion, buildWorld, tileAt, zoneAt, type Thing, type World } from "./world";

export type Menu =
  | { type: "pocket" }
  | { type: "craft" }
  | { type: "villager"; v: number }
  | { type: "plot"; i: number }
  | { type: "sell" }
  | { type: "project"; id: string }
  | { type: "carve"; to: number };

export type PlotView = { stage: "empty" | "dry" | "sprout" | "growing" | "ready" | "locked"; crop?: Mat; left: number };

export type Host = {
  energy(): number;
  // Returns false when they don't have the energy
  harvest(gain: Cost, xp: number, energy: number, fish?: string): boolean;
  open(what: Menu): void;
  hasRequest(v: number): boolean;
  resident(v: number): boolean;
  zoneOpen(zone: string): boolean;
  built(project: string): boolean;
  plot(i: number): PlotView;
  // Water or harvest a plot; returns text to float, or null if nothing happened
  plotAction(i: number, kind: "water" | "reap"): string | null;
  caveFloor(n: number): void;
  // The furthest Frontier world whose path has been carved, and where you are now
  carved(): number;
  region(n: number): void;
  season(): Season;
  prompt(label: string | null): void;
  zone(id: string): void;
};

const INK = "#161616";
const SPEED = 200;
const REACH = 34;
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

type Target =
  | { kind: "node"; t: Extract<Thing, { kind: "node" }> }
  | { kind: "villager"; t: Extract<Thing, { kind: "villager" }> }
  | { kind: "bench"; t: Thing }
  | { kind: "door"; t: Thing }
  | { kind: "gate"; t: Extract<Thing, { kind: "gate" }> }
  | { kind: "site"; t: Extract<Thing, { kind: "site" }> }
  | { kind: "plot"; t: Extract<Thing, { kind: "plot" }> }
  | { kind: "bin"; t: Thing }
  | { kind: "ladder"; t: Thing }
  | { kind: "trail"; t: Extract<Thing, { kind: "trail" }> }
  | { kind: "critter"; t: Extract<Thing, { kind: "critter" }> }
  | { kind: "water"; x: number; y: number };

type Fishing = { phase: "wait" | "bite"; t: number; x: number; y: number; biteAt: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Float = { x: number; y: number; text: string; life: number };

const hash = (n: number) => {
  n = Math.imul(n ^ (n >>> 16), 2246822507);
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
};

export class Engine {
  // Home is kept so its regrowth and villagers carry on while you explore
  private home: World = buildWorld();
  private world: World = this.home;
  private ctx: CanvasRenderingContext2D;
  private ground: HTMLCanvasElement;
  private player = { x: 0, y: 0, fx: 0, fy: 1, dir: 1, walk: 0, moving: false, act: 0 };
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 };
  private cam = { x: 0, y: 0 };
  private zoom = 1;
  private dpr = 1;
  private img: HTMLImageElement | null = null;
  private particles: Particle[] = [];
  private floats: Float[] = [];
  private shake = new Map<number, number>();
  private fishing: Fishing | null = null;
  private target: Target | null = null;
  private lastPrompt: string | null = "";
  private lastZone = "";
  private raf = 0;
  private last = 0;
  private time = 0;
  private floor = 1;
  private season: Season = "spring";
  private nextId = 100000;
  // Frontier worlds you've visited this session keep their state
  private regions = new Map<number, World>();
  private stepAt = 0;
  private drops: { x: number; y: number; v: number }[] = [];

  // Demo mode: the Mochi plays by itself (site backgrounds, the start screen). Silent, saves nothing.
  private demo = false;
  // Where on screen the camera keeps your Mochi (0.5, 0.5 = the middle)
  focus = { x: 0.5, y: 0.5 };
  private auto = { target: null as Thing | null, until: 0, swingAt: 0, lastX: 0, lastY: 0, still: 0 };

  private sfx(name: Parameters<typeof play>[0]) {
    if (!this.demo) play(name);
  }

  constructor(
    private canvas: HTMLCanvasElement,
    private host: Host,
    opts: { demo?: boolean; focus?: { x: number; y: number } } = {},
  ) {
    this.demo = !!opts.demo;
    if (opts.focus) this.focus = opts.focus;
    this.ctx = canvas.getContext("2d")!;
    this.player.x = this.world.spawn.x;
    this.player.y = this.world.spawn.y;
    this.season = host.season();
    this.ground = this.paintGround();
  }

  // ---------- lifecycle ----------
  start() {
    addEventListener("keydown", this.onKey);
    addEventListener("keyup", this.onKey);
    addEventListener("resize", this.resize);
    addEventListener("blur", this.onBlur);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    removeEventListener("keydown", this.onKey);
    removeEventListener("keyup", this.onKey);
    removeEventListener("resize", this.resize);
    removeEventListener("blur", this.onBlur);
  }

  // For automated play-tests in development only
  debug() {
    return { player: this.player, things: this.world.things, target: () => this.target, tiles: this.world.tiles };
  }

  setPlayerImage(img: HTMLImageElement) {
    this.img = img;
  }

  setStick(x: number, y: number) {
    this.stick = { x, y };
  }

  // While a menu is open the world ignores input
  private paused = false;
  setPaused(on: boolean) {
    this.paused = on;
    if (on) this.release();
  }

  // Stop walking so a held key doesn't carry on
  release() {
    this.keys.clear();
    this.stick = { x: 0, y: 0 };
  }

  private onBlur = () => this.release();

  private resize = () => {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    // About 15 tiles across on wide screens, 8 on phones
    this.zoom = Math.max(1.05, Math.min(1.8, r.width / (TILE * 15)));
  };

  private onKey = (e: KeyboardEvent) => {
    if (this.demo || this.paused || (e.target as HTMLElement)?.closest?.("input,textarea,[role=dialog]")) return;
    const k = e.key.toLowerCase();
    const move = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"];
    if (move.includes(k)) {
      e.preventDefault();
      if (e.type === "keydown") this.keys.add(k);
      else this.keys.delete(k);
    } else if (e.type === "keydown" && !e.repeat && ["e", " ", "enter", "j"].includes(k)) {
      e.preventDefault();
      this.action();
    }
  };

  // ---------- the loop ----------
  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.update(dt, Date.now());
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number, now: number) {
    const p = this.player;
    if (this.demo) this.autopilot(now);
    let ix = 0;
    let iy = 0;
    const k = this.keys;
    if (k.has("arrowleft") || k.has("a")) ix -= 1;
    if (k.has("arrowright") || k.has("d")) ix += 1;
    if (k.has("arrowup") || k.has("w")) iy -= 1;
    if (k.has("arrowdown") || k.has("s")) iy += 1;
    ix += this.stick.x;
    iy += this.stick.y;
    const len = Math.hypot(ix, iy);
    p.moving = len > 0.15;
    if (p.moving) {
      ix /= Math.max(1, len);
      iy /= Math.max(1, len);
      this.fishing = null;
      const step = SPEED * dt * Math.min(1, len);
      const nx = p.x + ix * step;
      if (!this.blocked(nx, p.y)) p.x = nx;
      const ny = p.y + iy * step;
      if (!this.blocked(p.x, ny)) p.y = ny;
      const l = Math.hypot(ix, iy);
      p.fx = ix / l;
      p.fy = iy / l;
      if (Math.abs(ix) > 0.2) p.dir = ix > 0 ? 1 : -1;
      p.walk += dt;
      // A puff of dust and a soft step every few strides
      if (this.time > this.stepAt) {
        this.stepAt = this.time + 0.28;
        this.particles.push({ x: p.x - ix * 10, y: p.y + 6, vx: -ix * 20, vy: -40, life: 0.35, max: 0.35, color: "rgba(160,130,90,0.6)", size: 5 });
        this.sfx("step");
      }
    }
    p.act = Math.max(0, p.act - dt);

    // Regrow, wander, fish
    for (const t of this.world.things) {
      if (t.kind === "node" && t.regrowAt && t.regrowAt <= now) t.regrowAt = 0;
      if (t.kind === "villager") this.wander(t, dt);
      else if (t.kind === "critter") this.roam(t, dt);
    }
    if (this.fishing) {
      const f = this.fishing;
      f.t -= dt;
      if (f.phase === "wait" && f.t <= 0) {
        f.phase = "bite";
        this.sfx("pick");
        f.t = this.host.built("dock") ? 1.05 : 0.8;
        f.biteAt = performance.now();
        this.splash(f.x, f.y, 6);
      } else if (f.phase === "bite" && f.t <= 0) {
        this.float(f.x, f.y - 20, "It got away…");
        this.fishing = null;
      }
    }

    this.particles = this.particles.filter((q) => {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 380 * dt;
      return q.life > 0;
    });
    this.floats = this.floats.filter((f) => {
      f.life -= dt;
      f.y -= 32 * dt;
      return f.life > 0;
    });

    // Camera follows, kept inside the world
    const vw = this.canvas.width / this.dpr / this.zoom;
    const vh = this.canvas.height / this.dpr / this.zoom;
    const tx = Math.max(0, Math.min(this.world.width - vw, p.x - vw * this.focus.x));
    const ty = Math.max(0, Math.min(this.world.height - vh, p.y - vh * this.focus.y));
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 8);

    this.target = this.findTarget(now);
    const label = this.labelFor(this.target);
    if (label !== this.lastPrompt) {
      this.lastPrompt = label;
      this.host.prompt(label);
    }
    const z = this.world.region ? "frontier" : zoneAt(p.x, p.y);
    if (z !== this.lastZone) {
      // Leaving the cave takes you back to its first floor next time
      if (this.lastZone === "cave" && this.floor > 1) this.resetCave(1);
      this.lastZone = z;
      this.host.zone(z);
    }
    if (Math.floor(this.time) % 5 === 0 && this.host.season() !== this.season) {
      this.season = this.host.season();
      this.ground = this.paintGround();
    }
  }

  private wander(v: Extract<Thing, { kind: "villager" }>, dt: number) {
    const near = Math.hypot(v.x - this.player.x, v.y - this.player.y) < 70;
    if (near) return; // stop and listen when you walk up
    if (v.wait > 0) {
      v.wait -= dt;
      return;
    }
    const dx = v.tx - v.x;
    const dy = v.ty - v.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) {
      const r = hash(v.id * 13 + Math.floor(this.time));
      if (r < 0.25) {
        // Head off to another favourite spot, if that part of the world is open
        const next = (v.spot + 1 + Math.floor(r * 8)) % v.spots.length;
        const [sx, sy] = v.spots[next];
        if (this.host.zoneOpen(zoneAt(sx, sy))) {
          v.spot = next;
          v.homeX = sx;
          v.homeY = sy;
        }
      }
      v.wait = 1.5 + hash(v.id + Math.floor(this.time)) * 3;
      const a = hash(v.id * 7 + Math.floor(this.time * 3)) * Math.PI * 2;
      v.tx = v.homeX + Math.cos(a) * 60;
      v.ty = v.homeY + Math.sin(a) * 40;
      return;
    }
    const speed = Math.hypot(v.homeX - v.x, v.homeY - v.y) > 200 ? 75 : 40;
    v.x += (dx / d) * speed * dt;
    v.y += (dy / d) * speed * dt;
  }

  // Demo mode: wander to something nearby, face it and gather it, then pick the next thing
  private autopilot(now: number) {
    const p = this.player;
    const a = this.auto;
    const valid = (t: Thing | null) => !!t && (t.kind !== "node" || !(t.regrowAt > now));
    if (!valid(a.target) || this.time > a.until) {
      const near = this.world.things
        .filter((t) => (t.kind === "node" && !(t.regrowAt > now) && t.zone !== "cave" && this.host.zoneOpen(t.zone)) || (t.kind === "critter" && Math.random() < 0.3))
        .map((t) => ({ t, d: Math.hypot(t.x - p.x, t.y - p.y) }))
        .filter((x) => x.d > 40 && x.d < 520)
        .sort((x, y) => x.d - y.d)
        .slice(0, 6);
      a.target = near.length ? near[Math.floor(Math.random() * near.length)].t : null;
      a.until = this.time + 10;
      a.still = 0;
      if (!a.target) {
        // Nothing close: drift back toward the plaza
        this.stick = { x: Math.sign(this.world.spawn.x - p.x) * 0.6, y: Math.sign(this.world.spawn.y - p.y) * 0.6 };
        return;
      }
    }
    const t = a.target!;
    const side = p.x < t.x ? -1 : 1;
    const gap = t.kind === "node" ? t.r + 18 : 30;
    const gx = t.x + side * gap;
    const gy = t.y;
    const dx = gx - p.x;
    const dy = gy - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      this.stick = { x: (dx / d) * 0.75, y: (dy / d) * 0.75 };
      // Give up on things it can't reach
      a.still = Math.hypot(p.x - a.lastX, p.y - a.lastY) < 0.5 ? a.still + 1 : 0;
      a.lastX = p.x;
      a.lastY = p.y;
      if (a.still > 70) a.target = null;
      return;
    }
    this.stick = { x: 0, y: 0 };
    p.fx = -side;
    p.fy = 0;
    p.dir = -side;
    if (this.time > a.swingAt) {
      a.swingAt = this.time + 0.4;
      const before = t.kind === "node" ? t.regrowAt : 0;
      this.action();
      if (t.kind === "critter" || (t.kind === "node" && t.regrowAt !== before)) {
        a.target = null;
        a.until = this.time + 1.2; // a little pause before the next thing
      }
    }
  }

  // Wild animals mill about, and dash away from someone running at them
  private roam(c: Extract<Thing, { kind: "critter" }>, dt: number) {
    const p = this.player;
    const dist = Math.hypot(c.x - p.x, c.y - p.y);
    if (dist < 90 && p.moving) {
      const a = Math.atan2(c.y - p.y, c.x - p.x);
      c.tx = c.x + Math.cos(a) * 140;
      c.ty = c.y + Math.sin(a) * 140;
      c.wait = 0;
    }
    if (c.wait > 0) {
      c.wait -= dt;
      return;
    }
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) {
      c.wait = 1 + hash(c.id + Math.floor(this.time * 2)) * 4;
      const a = hash(c.id * 11 + Math.floor(this.time * 5)) * Math.PI * 2;
      const range = c.flies ? 140 : 80;
      c.tx = Math.max(20, Math.min(this.world.width - 20, c.homeX + Math.cos(a) * range));
      c.ty = Math.max(20, Math.min(this.world.height - 20, c.homeY + Math.sin(a) * range));
      return;
    }
    const speed = dist < 90 ? 170 : c.flies ? 70 : 45;
    c.x += (dx / d) * Math.min(d, speed * dt);
    c.y += (dy / d) * Math.min(d, speed * dt);
  }

  // ---------- collisions ----------
  private blocked(x: number, y: number) {
    const R = 13;
    if (x < R || y < R || x > this.world.width - R || y > this.world.height - R) return true;
    // A locked area can't be entered from any side until its project is built
    if (!this.world.region) {
      const z = zoneAt(x, y);
      if (z !== "home" && !this.host.zoneOpen(z)) return true;
    }
    for (const [ox, oy] of [
      [-R, 0],
      [R, 0],
      [0, -R * 0.4],
      [0, R * 0.6],
    ])
      if (tileAt(this.world, x + ox, y + oy) === T.Water) return true;
    for (const t of this.world.things) {
      switch (t.kind) {
        case "node": {
          if (t.node !== "tree" && t.node !== "rock" && t.node !== "crystal") break;
          const r = t.node === "tree" ? (t.regrowAt ? 10 : 14) : t.regrowAt ? 0 : t.r * 0.8;
          if (r && Math.hypot(t.x - x, t.y - y) < r + R * 0.7) return true;
          break;
        }
        case "house":
          if (x > t.x - t.w / 2 - R * 0.5 && x < t.x + t.w / 2 + R * 0.5 && y > t.y - t.h / 2 && y < t.y + t.h / 2 + 4) return true;
          break;
        case "villager":
          if (!this.host.resident(t.v)) break;
          if (Math.hypot(t.x - x, t.y - y) < t.r + R * 0.7) return true;
          break;
        case "bench":
        case "bin":
          if (Math.hypot(t.x - x, t.y - y) < t.r + R * 0.7) return true;
          break;
        case "site": {
          const done = this.host.built(t.project);
          const w = done ? t.w : t.w * 0.7;
          if (x > t.x - w / 2 && x < t.x + w / 2 && y > t.y - t.h / 2 && y < t.y + t.h / 2 + 2) return true;
          break;
        }
        case "fence":
        case "gate": {
          if (t.kind === "gate" && this.host.zoneOpen(t.zone)) break;
          const [rx, ry, rw, rh] = t.vertical ? [t.x - t.w / 2, t.y, t.w, t.h] : [t.x, t.y - t.h / 2, t.w, t.h];
          if (x + R > rx && x - R < rx + rw && y + R * 0.6 > ry && y - R * 0.4 < ry + rh) return true;
          break;
        }
      }
    }
    return false;
  }

  // ---------- what you're facing ----------
  private findTarget(now: number): Target | null {
    if (this.fishing) return { kind: "water", x: this.fishing.x, y: this.fishing.y };
    const p = this.player;
    const ax = p.x + p.fx * 18;
    const ay = p.y + p.fy * 18;
    let best: Target | null = null;
    let bestD = Infinity;
    const consider = (t: Target, d: number) => {
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    };
    for (const t of this.world.things) {
      if (t.kind === "node") {
        if (t.regrowAt && t.regrowAt > now) continue;
        const d = Math.hypot(t.x - ax, t.y - ay) - t.r;
        if (d < REACH) consider({ kind: "node", t }, d);
      } else if (t.kind === "villager") {
        if (!this.host.resident(t.v)) continue;
        const d = Math.hypot(t.x - ax, t.y - ay) - t.r;
        if (d < REACH) consider({ kind: "villager", t }, d);
      } else if (t.kind === "site") {
        if (this.host.built(t.project)) continue;
        const d = Math.hypot(t.x - ax, t.y + t.h / 2 - ay) - 20;
        if (d < REACH) consider({ kind: "site", t }, d);
      } else if (t.kind === "plot") {
        const d = Math.hypot(t.x - ax, t.y - ay) - 18;
        if (d < REACH - 12) consider({ kind: "plot", t }, d);
      } else if (t.kind === "bin") {
        const d = Math.hypot(t.x - ax, t.y - ay) - t.r;
        if (d < REACH) consider({ kind: "bin", t }, d);
      } else if (t.kind === "critter") {
        const d = Math.hypot(t.x - ax, t.y - ay) - 12;
        if (d < REACH - 8) consider({ kind: "critter", t }, d + 6);
      } else if (t.kind === "trail") {
        const d = Math.hypot(t.x - ax, t.y - ay) - 20;
        if (d < REACH + 6) consider({ kind: "trail", t }, d);
      } else if (t.kind === "ladder") {
        const d = Math.hypot(t.x - ax, t.y - ay) - 16;
        if (d < REACH) consider({ kind: "ladder", t }, d);
      } else if (t.kind === "bench") {
        const d = Math.hypot(t.x - ax, t.y - ay) - t.r;
        if (d < REACH) consider({ kind: "bench", t }, d);
      } else if (t.kind === "house") {
        const d = Math.hypot(t.x - ax, t.y + t.h / 2 + 8 - ay);
        if (d < 46) consider({ kind: "door", t }, d - 10);
      } else if (t.kind === "gate" && !this.host.zoneOpen(t.zone)) {
        const cx = t.vertical ? t.x : t.x + t.w / 2;
        const cy = t.vertical ? t.y + t.h / 2 : t.y;
        const d = Math.hypot(cx - ax, cy - ay) - 30;
        if (d < REACH) consider({ kind: "gate", t }, d);
      }
    }
    if (best) return best;
    // Water a step ahead: cast a line
    const wx = p.x + p.fx * 44;
    const wy = p.y + p.fy * 44;
    if (tileAt(this.world, wx, wy) === T.Water) return { kind: "water", x: p.x + p.fx * 70, y: p.y + p.fy * 70 };
    return null;
  }

  private labelFor(t: Target | null) {
    if (!t) return null;
    switch (t.kind) {
      case "node":
        return NODES[t.t.node].verb;
      case "villager":
        return "Talk";
      case "bench":
        return "Craft";
      case "door":
        return "Enter Pocket";
      case "gate":
        return `🔨 ${projectFor(t.t.zone)?.name ?? "Locked"}`;
      case "site":
        return `🔨 ${PROJECTS.find((p) => p.id === t.t.project)?.name}`;
      case "bin":
        return "Sell";
      case "ladder":
        return "Climb down";
      case "critter":
        return "Pet";
      case "trail": {
        const to = t.t.to;
        if (t.t.back) return to === 0 ? "← Home" : `← ${frontierName(to)}`;
        return to <= this.host.carved() ? `${frontierName(to)} →` : "🔨 Carve path";
      }
      case "plot": {
        const v = this.host.plot(t.t.i);
        return v.stage === "empty" ? "Plant" : v.stage === "dry" ? "Water" : v.stage === "ready" ? "Harvest" : v.stage === "locked" ? "🔒 Plot" : "Growing…";
      }
      case "water":
        return !this.fishing ? "Fish" : this.fishing.phase === "bite" ? "Reel in!" : "Wait…";
    }
  }

  // ---------- doing things ----------
  action() {
    if (this.paused) return;
    const t = this.target;
    const p = this.player;
    if (!t) return;
    switch (t.kind) {
      case "node": {
        const n = t.t;
        const spec = NODES[n.node];
        if (this.host.energy() < spec.energy) {
          this.sfx("nope");
          return this.float(p.x, p.y - 50, "Too tired 💤");
        }
        p.act = 0.22;
        n.hits++;
        this.sfx(n.node === "tree" ? "chop" : n.node === "rock" || n.node === "crystal" ? "mine" : "pick");
        this.shake.set(n.id, this.time + 0.22);
        this.chips(n);
        if (n.hits >= spec.hits) {
          const gain: Cost = {};
          for (const [m, [lo, hi]] of Object.entries(spec.gives) as [Mat, [number, number]][]) {
            const k = lo + Math.floor(Math.random() * (hi - lo + 1));
            if (k > 0) gain[m] = k;
          }
          // Deeper cave floors and further Frontier worlds give more
          if (n.zone === "cave" && gain.crystal) gain.crystal += Math.floor((this.floor - 1) / 2);
          const far = this.world.region;
          if (n.node === "special" && this.world.biome) {
            const k = 1 + Math.floor(far / 5);
            gain[this.world.biome.mat] = k + Math.floor(Math.random() * 2);
          }
          if (far && gain.crystal) gain.crystal += Math.floor(far / 3);
          if (this.host.harvest(gain, spec.xp + (n.zone === "cave" ? this.floor - 1 : 0) + far, spec.energy)) {
            n.hits = 0;
            n.regrowAt = Date.now() + spec.regrow * 1000;
            this.dropText(n.x, n.y - 40, gain);
            this.burst(n.x, n.y - 20, n.node);
            // Sometimes a broken cave rock reveals a ladder down
            if (n.zone === "cave" && !this.world.things.some((x) => x.kind === "ladder") && Math.random() < 0.25) {
              this.world.things.push({ id: this.nextId++, kind: "ladder", x: n.x, y: n.y });
              this.float(n.x, n.y - 64, "A ladder! 🪜");
            }
          } else this.float(p.x, p.y - 50, "Too tired 💤");
        }
        return;
      }
      case "villager":
        this.release();
        return this.host.open({ type: "villager", v: t.t.v });
      case "bench":
        this.release();
        return this.host.open({ type: "craft" });
      case "door":
        this.release();
        return this.host.open({ type: "pocket" });
      case "gate": {
        this.sfx("pick");
        const pr = projectFor(t.t.zone);
        if (!pr) return;
        this.release();
        return this.host.open({ type: "project", id: pr.id });
      }
      case "site":
        this.release();
        return this.host.open({ type: "project", id: t.t.project });
      case "bin":
        this.release();
        return this.host.open({ type: "sell" });
      case "ladder":
        return this.descend();
      case "critter":
        this.sfx("pet");
        t.t.wait = 2.5;
        this.float(t.t.x, t.t.y - 30, "♥");
        this.emit(t.t.x, t.t.y - 16, 6, "#ff9fb6", 90, 4);
        return;
      case "trail": {
        const to = t.t.to;
        if (t.t.back || to <= this.host.carved()) return this.travel(to, !t.t.back);
        this.release();
        return this.host.open({ type: "carve", to });
      }
      case "plot": {
        const v = this.host.plot(t.t.i);
        if (v.stage === "empty") {
          this.release();
          return this.host.open({ type: "plot", i: t.t.i });
        }
        if (v.stage === "locked") return this.float(t.t.x, t.t.y - 30, "More plots with $MOCHI soon");
        if (v.stage === "sprout" || v.stage === "growing") {
          const m = Math.ceil(v.left / 60000);
          return this.float(t.t.x, t.t.y - 30, `Ready in ${m} min`);
        }
        const text = this.host.plotAction(t.t.i, v.stage === "dry" ? "water" : "reap");
        if (text) {
          p.act = 0.22;
          this.float(t.t.x, t.t.y - 30, text);
          this.emit(t.t.x, t.t.y - 6, 8, v.stage === "dry" ? "#6cc3ee" : "#ffcf33", 120, 4);
        }
        return;
      }
      case "water": {
        const f = this.fishing;
        if (!f) {
          if (this.host.energy() < FISHING.energy) return this.float(p.x, p.y - 50, "Too tired 💤");
          this.fishing = { phase: "wait", t: 1.4 + Math.random() * 2.6, x: t.x, y: t.y, biteAt: 0 };
          p.act = 0.25;
          this.splash(t.x, t.y, 4);
          this.sfx("splash");
        } else if (f.phase === "wait") {
          this.float(f.x, f.y - 20, "Too soon!");
          this.fishing = null;
        } else {
          const quick = performance.now() - f.biteAt < (this.host.built("dock") ? 560 : 380);
          const gain = { fish: quick ? 2 : 1 };
          const kinds = SEASONS[this.host.season()].fish;
          const species = Math.random() < 0.05 ? RARE_FISH : kinds[Math.floor(Math.random() * kinds.length)];
          if (this.host.harvest(gain, FISHING.xp + (quick ? 3 : 0), FISHING.energy, species)) {
            this.dropText(f.x, f.y - 30, gain);
            this.splash(f.x, f.y, 12);
            this.sfx("catch");
            this.float(f.x, f.y - 56, quick ? `Perfect! ${species}` : species);
          } else this.float(p.x, p.y - 50, "Too tired 💤");
          this.fishing = null;
        }
        return;
      }
    }
  }

  // ---------- travelling between worlds ----------
  private travel(to: number, forward: boolean) {
    const from = this.world.region;
    if (from && !this.regions.has(from)) this.regions.set(from, this.world);
    let w: World;
    if (to === 0) w = this.home;
    else {
      w = this.regions.get(to) ?? buildRegion(to);
      this.regions.set(to, w);
    }
    this.world = w;
    // Arrive beside the trail you came in by
    const arrival = w.things.find((x) => x.kind === "trail" && x.back === forward && (forward ? true : x.to === from)) ?? w.things.find((x) => x.kind === "trail");
    const side = arrival && arrival.x < w.width / 2 ? 1 : -1;
    this.player.x = arrival ? arrival.x + side * 64 : w.spawn.x;
    this.player.y = arrival ? arrival.y : w.spawn.y;
    this.player.fx = side;
    this.player.fy = 0;
    this.player.dir = side;
    this.fishing = null;
    this.particles = [];
    this.floats = [];
    this.release();
    this.ground = this.paintGround();
    const vw = this.canvas.width / this.dpr / this.zoom;
    const vh = this.canvas.height / this.dpr / this.zoom;
    this.cam.x = Math.max(0, Math.min(w.width - vw, this.player.x - vw / 2));
    this.cam.y = Math.max(0, Math.min(w.height - vh, this.player.y - vh / 2));
    this.lastZone = "";
    this.host.region(to);
  }

  // ---------- the cave goes deeper ----------
  private resetCave(floor: number) {
    this.floor = floor;
    this.world.things = this.world.things.filter((x) => x.kind !== "ladder");
    for (const t of this.world.things)
      if (t.kind === "node" && t.zone === "cave") {
        t.regrowAt = 0;
        t.hits = 0;
      }
  }

  private descend() {
    this.resetCave(this.floor + 1);
    this.host.caveFloor(this.floor);
    this.float(this.player.x, this.player.y - 60, `Floor ${this.floor} ⬇️`);
    this.emit(this.player.x, this.player.y - 20, 18, "#f6a8ff", 200, 4);
  }

  // ---------- effects ----------
  private float(x: number, y: number, text: string) {
    this.floats.push({ x, y, text, life: 1.4 });
  }

  private dropText(x: number, y: number, gain: Cost) {
    const parts = (Object.entries(gain) as [Mat, number][]).map(([m, n]) => `+${n} ${MATS[m].icon}`);
    this.float(x, y, parts.join("  "));
  }

  private emit(x: number, y: number, n: number, color: string, speed = 160, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random());
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0.6, max: 0.6, color, size: size * (0.6 + Math.random() * 0.8) });
    }
  }

  private chips(n: Extract<Thing, { kind: "node" }>) {
    const c = { tree: "#a86b3c", rock: "#9a93ad", crystal: "#ff8fd0", bush: "#5fbf5a", cotton: "#ffffff", flower: "#ffb3d1", special: "#fff1a8" }[n.node];
    this.emit(n.x, n.y - 16, 6, c);
  }

  private burst(x: number, y: number, node: Node) {
    const c = { tree: "#5fbf5a", rock: "#d9d2e9", crystal: "#fff1a8", bush: "#ff6b8a", cotton: "#ffffff", flower: "#ffd1e6", special: "#ffffff" }[node];
    this.emit(x, y, 14, c, 220, 5);
  }

  private splash(x: number, y: number, n: number) {
    this.emit(x, y, n, "#ffffff", 120, 3);
  }

  // ---------- drawing ----------
  private paintGround() {
    const c = document.createElement("canvas");
    const { cols: COLS, rows: ROWS } = this.world;
    c.width = this.world.width;
    c.height = this.world.height;
    const g = c.getContext("2d")!;
    const tiles = this.world.tiles;
    // Grass changes with the season
    const grass: Record<Season, [string, string, string, string]> = {
      spring: ["#9fdc7c", "#8fd06d", "#c9ec8a", "#bde27b"],
      summer: ["#8fd85f", "#80cc52", "#d6ee7a", "#cbe46c"],
      autumn: ["#d9c46a", "#cfb85d", "#e8c26c", "#ddb55f"],
      winter: ["#eef4fb", "#e3ecf6", "#f4f7fb", "#e9eff7"],
    };
    const b = this.world.biome;
    const [g1, g2, m1, m2] = b ? [b.ground[0], b.ground[1], b.ground[0], b.ground[1]] : grass[this.season];
    const colors: Record<number, [string, string]> = {
      [T.Grass]: [g1, g2],
      [T.Meadow]: [m1, m2],
      [T.Path]: b ? [b.path, b.path] : ["#f3dcae", "#ecd09c"],
      [T.Sand]: ["#f6e3b4", "#efd8a2"],
      [T.Water]: ["#6cc3ee", "#62b9e6"],
      [T.Stone]: ["#d8d0e8", "#cdc4e0"],
      [T.Cave]: ["#5a4d80", "#51457a"],
    };
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const t = tiles[y * COLS + x];
        const [a, b] = colors[t];
        g.fillStyle = (x + y) % 2 ? a : b;
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        const h = hash(x * 131 + y * 977);
        // Little details so it doesn't look flat
        if ((t === T.Grass || t === T.Meadow) && h < 0.35) {
          g.strokeStyle = b
            ? "rgba(22,22,22,0.14)"
            : this.season === "winter"
              ? "#c9d6e6"
              : this.season === "autumn"
                ? "#b89a44"
                : t === T.Grass
                  ? "#6fb552"
                  : "#9cc65b";
          g.lineWidth = 2;
          const gx = x * TILE + 8 + h * 30;
          const gy = y * TILE + 14 + hash(x + y * 3) * 26;
          g.beginPath();
          g.moveTo(gx, gy);
          g.lineTo(gx - 3, gy - 7);
          g.moveTo(gx + 4, gy);
          g.lineTo(gx + 5, gy - 8);
          g.stroke();
        }
        if ((t === T.Path || t === T.Stone || t === T.Sand) && h < 0.3) {
          g.fillStyle = "rgba(22,22,22,0.12)";
          g.beginPath();
          g.ellipse(x * TILE + 10 + h * 28, y * TILE + 12 + hash(y + x * 5) * 26, 3, 2, 0, 0, Math.PI * 2);
          g.fill();
        }
        if (t === T.Cave && h < 0.25) {
          g.fillStyle = "rgba(255,180,230,0.25)";
          g.fillRect(x * TILE + h * 40, y * TILE + hash(x * 9 + y) * 40, 3, 3);
        }
      }
    // Chunky shoreline outline
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        if (tiles[y * COLS + x] !== T.Water) continue;
        const n = (dx: number, dy: number) => {
          const xx = x + dx;
          const yy = y + dy;
          return xx >= 0 && yy >= 0 && xx < COLS && yy < ROWS && tiles[yy * COLS + xx] === T.Water;
        };
        const X = x * TILE;
        const Y = y * TILE;
        if (!n(0, -1)) {
          g.moveTo(X, Y);
          g.lineTo(X + TILE, Y);
        }
        if (!n(0, 1)) {
          g.moveTo(X, Y + TILE);
          g.lineTo(X + TILE, Y + TILE);
        }
        if (!n(-1, 0)) {
          g.moveTo(X, Y);
          g.lineTo(X, Y + TILE);
        }
        if (!n(1, 0)) {
          g.moveTo(X + TILE, Y);
          g.lineTo(X + TILE, Y + TILE);
        }
      }
    g.stroke();
    return c;
  }

  private draw() {
    const g = this.ctx;
    const { width, height } = this.canvas;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#7cc96a";
    g.fillRect(0, 0, width, height);
    const s = this.dpr * this.zoom;
    g.setTransform(s, 0, 0, s, -this.cam.x * s, -this.cam.y * s);
    const vw = width / s;
    const vh = height / s;
    const cx = Math.max(0, Math.floor(this.cam.x));
    const cy = Math.max(0, Math.floor(this.cam.y));
    const sw = Math.min(this.world.width - cx, Math.ceil(vw) + 2);
    const sh = Math.min(this.world.height - cy, Math.ceil(vh) + 2);
    g.drawImage(this.ground, cx, cy, sw, sh, cx, cy, sw, sh);
    this.drawWater(cx, cy, sw, sh);

    // Everything standing, back to front
    const now = Date.now();
    const pad = 120;
    const inView = (x: number, y: number) => x > this.cam.x - pad && x < this.cam.x + vw + pad && y > this.cam.y - pad && y < this.cam.y + vh + pad;
    const list: { y: number; draw: () => void }[] = [];
    for (const t of this.world.things) {
      if (!inView(t.x, t.y)) continue;
      switch (t.kind) {
        case "node":
          list.push({ y: t.y, draw: () => this.drawNode(t, now) });
          break;
        case "house":
          list.push({ y: t.y + t.h / 2, draw: () => this.drawHouse(t) });
          break;
        case "bench":
          list.push({ y: t.y, draw: () => this.drawBench(t) });
          break;
        case "fence":
          list.push({ y: t.vertical ? t.y + t.h : t.y, draw: () => this.drawFence(t.x, t.y, t.w, t.h, t.vertical, false) });
          break;
        case "gate":
          list.push({ y: t.vertical ? t.y + t.h : t.y, draw: () => this.drawGate(t) });
          break;
        case "villager":
          list.push({ y: t.y, draw: () => this.drawVillager(t) });
          break;
        case "sign":
          list.push({ y: t.y, draw: () => this.drawSign(t.x, t.y, t.text) });
          break;
        case "site":
          list.push({ y: t.y + t.h / 2, draw: () => this.drawSite(t) });
          break;
        case "plot":
          list.push({ y: t.y - 30, draw: () => this.drawPlot(t) });
          break;
        case "bin":
          list.push({ y: t.y, draw: () => this.drawBin(t.x, t.y) });
          break;
        case "ladder":
          list.push({ y: t.y - 20, draw: () => this.drawLadder(t.x, t.y) });
          break;
        case "trail":
          list.push({ y: t.y, draw: () => this.drawTrail(t) });
          break;
        case "critter":
          list.push({ y: t.flies ? t.y + 40 : t.y, draw: () => this.drawCritter(t) });
          break;
      }
    }
    list.push({ y: this.player.y, draw: () => this.drawPlayer() });
    list.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

    if (this.fishing) this.drawLine();

    for (const q of this.particles) {
      g.globalAlpha = Math.max(0, q.life / q.max);
      g.fillStyle = q.color;
      g.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    g.globalAlpha = 1;

    this.drawPrompt();

    g.textAlign = "center";
    for (const f of this.floats) {
      g.globalAlpha = Math.min(1, f.life * 1.6);
      g.font = `700 18px ${EMOJI_FONT}`;
      g.lineWidth = 5;
      g.strokeStyle = INK;
      g.strokeText(f.text, f.x, f.y);
      g.fillStyle = "#fff";
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;

    // The cave is dark around you
    this.drawWeather(g, s, width, height);
    const night = this.world.biome?.id === "star" || this.world.biome?.id === "grove";
    if (this.lastZone !== "cave" && !night) this.drawDaylight(g, s, width, height);
    if (this.lastZone === "cave" || night) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      const px = (this.player.x - this.cam.x) * s;
      const py = (this.player.y - this.cam.y) * s;
      const grad = g.createRadialGradient(px, py, 60 * s, px, py, 260 * s);
      grad.addColorStop(0, "rgba(20,10,40,0)");
      grad.addColorStop(1, night ? "rgba(15,10,45,0.55)" : `rgba(20,10,40,${Math.min(0.9, 0.62 + this.floor * 0.04)})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, width, height);
    }
  }

  // Rain or snow, by the day's weather (Frost Peaks always snows)
  private drawWeather(g: CanvasRenderingContext2D, s: number, width: number, height: number) {
    if (this.lastZone === "cave") return;
    const b = this.world.biome;
    const w = b ? (b.id === "frost" ? "snow" : b.id === "coral" || b.id === "grove" ? weather() : "sun") : weather();
    if (w === "sun") return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const want = w === "rain" ? 140 : 90;
    while (this.drops.length < want) this.drops.push({ x: Math.random() * width, y: Math.random() * height, v: 0.6 + Math.random() * 0.8 });
    g.strokeStyle = "rgba(220,235,255,0.55)";
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 1.5 * this.dpr;
    for (const d of this.drops) {
      if (w === "rain") {
        d.y += 14 * d.v * this.dpr;
        d.x -= 3 * this.dpr;
        g.beginPath();
        g.moveTo(d.x, d.y);
        g.lineTo(d.x + 4 * this.dpr, d.y - 14 * this.dpr);
        g.stroke();
      } else {
        d.y += 1.6 * d.v * this.dpr;
        d.x += Math.sin(this.time * 2 + d.v * 10) * 0.6 * this.dpr;
        g.beginPath();
        g.arc(d.x, d.y, 2.2 * d.v * this.dpr, 0, Math.PI * 2);
        g.fill();
      }
      if (d.y > height) {
        d.y = -10;
        d.x = Math.random() * (width + 100);
      }
    }
    if (w === "rain") {
      g.fillStyle = "rgba(60,80,120,0.12)";
      g.fillRect(0, 0, width, height);
    }
  }

  // Evening glow, night with a little light around you, then dawn: by your clock
  private drawDaylight(g: CanvasRenderingContext2D, s: number, width: number, height: number) {
    const d = new Date();
    const h = d.getHours() + d.getMinutes() / 60;
    let dark = 0;
    let tint = "20,25,70";
    if (h >= 17 && h < 19) {
      dark = ((h - 17) / 2) * 0.18;
      tint = "255,140,60";
    } else if (h >= 19 && h < 21) dark = 0.18 + ((h - 19) / 2) * 0.3;
    else if (h >= 21 || h < 5) dark = 0.48;
    else if (h >= 5 && h < 7) dark = 0.48 * (1 - (h - 5) / 2);
    if (dark <= 0.01) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (tint !== "20,25,70") {
      g.fillStyle = `rgba(${tint},${dark})`;
      g.fillRect(0, 0, width, height);
      return;
    }
    const px = (this.player.x - this.cam.x) * s;
    const py = (this.player.y - this.cam.y) * s;
    const grad = g.createRadialGradient(px, py - 20 * s, 40 * s, px, py - 20 * s, 230 * s);
    grad.addColorStop(0, `rgba(${tint},${dark * 0.15})`);
    grad.addColorStop(1, `rgba(${tint},${dark})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, width, height);
  }

  private drawWater(cx: number, cy: number, sw: number, sh: number) {
    const g = this.ctx;
    g.strokeStyle = "rgba(255,255,255,0.55)";
    g.lineWidth = 2;
    g.beginPath();
    const { cols: COLS, rows: ROWS } = this.world;
    const x0 = Math.floor(cx / TILE);
    const y0 = Math.floor(cy / TILE);
    for (let y = y0; y <= Math.min(ROWS - 1, y0 + sh / TILE + 1); y++)
      for (let x = x0; x <= Math.min(COLS - 1, x0 + sw / TILE + 1); x++) {
        if (this.world.tiles[y * COLS + x] !== T.Water) continue;
        const h = hash(x * 53 + y * 31);
        if (h > 0.45) continue;
        const ox = ((this.time * 12 + h * 40) % 32) - 4;
        const X = x * TILE + 6 + ox;
        const Y = y * TILE + 12 + h * 24;
        g.moveTo(X, Y);
        g.quadraticCurveTo(X + 6, Y - 3, X + 12, Y);
      }
    g.stroke();
  }

  private shadow(x: number, y: number, rx: number, ry: number) {
    const g = this.ctx;
    g.fillStyle = "rgba(22,22,22,0.18)";
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Filled shapes with one chunky outline: stroke every part thick, then fill on top
  private blob(parts: (() => void)[], fill: string, line = 6) {
    const g = this.ctx;
    g.lineJoin = "round";
    g.strokeStyle = INK;
    g.lineWidth = line;
    for (const p of parts) {
      g.beginPath();
      p();
      g.stroke();
    }
    g.fillStyle = fill;
    for (const p of parts) {
      g.beginPath();
      p();
      g.fill();
    }
  }

  private drawNode(n: Extract<Thing, { kind: "node" }>, now: number) {
    const g = this.ctx;
    const gone = n.regrowAt > now;
    const sh = (this.shake.get(n.id) ?? 0) > this.time ? Math.sin(this.time * 60) * 3 : 0;
    const x = n.x + sh;
    const y = n.y;
    const circle = (cx: number, cy: number, r: number) => () => g.arc(cx, cy, r, 0, Math.PI * 2);
    switch (n.node) {
      case "tree": {
        if (gone) {
          this.shadow(x, y + 4, 16, 6);
          this.blob([() => g.ellipse(x, y, 13, 8, 0, 0, Math.PI * 2)], "#c08a5a", 4);
          g.strokeStyle = "#8a5a32";
          g.lineWidth = 1.5;
          g.beginPath();
          g.ellipse(x, y, 6, 3.5, 0, 0, Math.PI * 2);
          g.stroke();
          return;
        }
        const v = hash(n.id);
        const palette: Record<Season, string[]> = {
          spring: ["#5fbf5a", "#4fae55", "#6cc95f"],
          summer: ["#3fae4a", "#4cb84f", "#2f9e45"],
          autumn: ["#f08a3c", "#e0623a", "#f2b440"],
          winter: ["#4f9e6a", "#3f8e5e", "#5aa874"],
        };
        const pal = this.world.biome ? this.world.biome.trees : palette[this.season];
        const green = pal[Math.floor(v * pal.length)];
        this.shadow(x, y + 6, 26, 9);
        this.blob([() => g.roundRect(x - 7, y - 26, 14, 30, 4)], "#a86b3c", 5);
        this.blob([circle(x - 14, y - 34, 18), circle(x + 14, y - 34, 18), circle(x, y - 52, 22)], green);
        g.fillStyle = "rgba(255,255,255,0.28)";
        g.beginPath();
        g.arc(x - 8, y - 58, 8, 0, Math.PI * 2);
        g.fill();
        if (this.season === "winter" || this.world.biome?.id === "frost") {
          // Snow on top
          g.fillStyle = "#ffffff";
          g.beginPath();
          g.ellipse(x, y - 68, 18, 7, 0, 0, Math.PI * 2);
          g.ellipse(x - 15, y - 48, 10, 5, 0, 0, Math.PI * 2);
          g.ellipse(x + 15, y - 48, 10, 5, 0, 0, Math.PI * 2);
          g.fill();
        } else if (this.season === "spring" && v > 0.5) {
          // Blossoms
          g.fillStyle = "#ffc6d6";
          for (const [bx, by] of [[-16, -40], [10, -60], [16, -34], [-4, -48], [-20, -28]]) {
            g.beginPath();
            g.arc(x + bx, y + by, 3.5, 0, Math.PI * 2);
            g.fill();
          }
        }
        if (n.hits > 0) this.hitPips(x, y - 86, n.hits, NODES.tree.hits);
        return;
      }
      case "rock":
      case "crystal": {
        const isC = n.node === "crystal";
        if (gone) {
          this.blob([circle(x - 6, y, 4), circle(x + 5, y + 2, 3)], isC ? "#8b6bb8" : "#a8a2bb", 3);
          return;
        }
        this.shadow(x, y + 4, n.r + 2, 7);
        if (isC) {
          const d = (cx: number, cy: number, w: number, h: number) => () => {
            g.moveTo(cx, cy - h);
            g.lineTo(cx + w, cy - h * 0.35);
            g.lineTo(cx + w * 0.6, cy);
            g.lineTo(cx - w * 0.6, cy);
            g.lineTo(cx - w, cy - h * 0.35);
            g.closePath();
          };
          g.save();
          g.shadowColor = "#ff8fd0";
          g.shadowBlur = 14 + Math.sin(this.time * 3 + n.id) * 6;
          this.blob([d(x - 12, y + 2, 9, 26), d(x + 11, y + 4, 8, 22), d(x, y, 11, 36)], "#f6a8ff", 4);
          g.restore();
          g.fillStyle = "rgba(255,255,255,0.6)";
          g.fillRect(x - 3, y - 28, 3, 14);
        } else {
          this.blob(
            [
              () => {
                g.moveTo(x - 22, y + 2);
                g.quadraticCurveTo(x - 24, y - 18, x - 6, y - 24);
                g.quadraticCurveTo(x + 14, y - 28, x + 22, y - 8);
                g.quadraticCurveTo(x + 26, y + 6, x + 6, y + 6);
                g.closePath();
              },
            ],
            "#b9b3c9",
            5,
          );
          g.fillStyle = "rgba(255,255,255,0.45)";
          g.beginPath();
          g.ellipse(x - 6, y - 15, 7, 4, -0.4, 0, Math.PI * 2);
          g.fill();
        }
        if (n.hits > 0) this.hitPips(x, y - 50, n.hits, NODES[n.node].hits);
        return;
      }
      case "special": {
        const icon = this.world.biome ? MATS[this.world.biome.mat].icon : "✨";
        if (gone) {
          g.globalAlpha = 0.35;
          g.font = `16px ${EMOJI_FONT}`;
          g.textAlign = "center";
          g.fillStyle = "#000";
          g.fillText(icon, x, y);
          g.globalAlpha = 1;
          return;
        }
        this.shadow(x, y + 4, 18, 6);
        g.save();
        g.shadowColor = "#fff1a8";
        g.shadowBlur = 16 + Math.sin(this.time * 3 + n.id) * 8;
        g.font = `34px ${EMOJI_FONT}`;
        g.textAlign = "center";
        g.fillStyle = "#000";
        g.fillText(icon, x, y + 6 + Math.sin(this.time * 2 + n.id) * 2);
        g.restore();
        if (n.hits > 0) this.hitPips(x, y - 36, n.hits, NODES.special.hits);
        return;
      }
      case "bush": {
        this.shadow(x, y + 4, 20, 7);
        this.blob([circle(x - 9, y - 10, 12), circle(x + 9, y - 10, 12), circle(x, y - 20, 13)], gone ? "#79b86a" : "#4fae55", 5);
        if (!gone) {
          g.fillStyle = "#ff4d6d";
          for (const [bx, by] of [
            [-10, -12],
            [6, -20],
            [10, -8],
            [-2, -6],
            [-5, -24],
          ]) {
            g.beginPath();
            g.arc(x + bx, y + by, 3.5, 0, Math.PI * 2);
            g.fill();
          }
        }
        return;
      }
      case "cotton": {
        g.strokeStyle = "#3e8f3e";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y - 18);
        g.moveTo(x, y - 10);
        g.lineTo(x - 7, y - 16);
        g.moveTo(x, y - 8);
        g.lineTo(x + 8, y - 14);
        g.stroke();
        if (!gone) this.blob([circle(x, y - 22, 7), circle(x - 8, y - 17, 6), circle(x + 8, y - 15, 6)], "#ffffff", 4);
        return;
      }
      case "flower": {
        if (gone) {
          g.strokeStyle = "#3e8f3e";
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y - 7);
          g.stroke();
          return;
        }
        const petal = ["#ff9fb6", "#fff1a8", "#e2d4ff", "#ffffff", "#ffbe60"][Math.floor(hash(n.id * 3) * 5)];
        g.strokeStyle = "#3e8f3e";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y - 10);
        g.stroke();
        const parts = [0, 1, 2, 3, 4].map((i) => circle(x + Math.cos((i / 5) * Math.PI * 2) * 6, y - 14 + Math.sin((i / 5) * Math.PI * 2) * 6, 5));
        this.blob(parts, petal, 3);
        g.fillStyle = "#ffcf33";
        g.beginPath();
        g.arc(x, y - 14, 3.5, 0, Math.PI * 2);
        g.fill();
        return;
      }
    }
  }

  private hitPips(x: number, y: number, hits: number, total: number) {
    const g = this.ctx;
    for (let i = 0; i < total; i++) {
      g.fillStyle = i < hits ? "#fff1a8" : "rgba(255,255,255,0.6)";
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x + (i - (total - 1) / 2) * 11, y, 4, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  private drawHouse(t: Extract<Thing, { kind: "house" }>) {
    const g = this.ctx;
    const { x, y, w, h } = t;
    this.shadow(x, y + h / 2 + 4, w / 2 + 10, 12);
    // walls
    this.blob([() => g.roundRect(x - w / 2, y - h / 2 + 30, w, h - 30, 10)], "#fff6e8");
    // roof
    this.blob(
      [
        () => {
          g.moveTo(x - w / 2 - 16, y - h / 2 + 38);
          g.lineTo(x - w / 2 + 14, y - h / 2 - 22);
          g.lineTo(x + w / 2 - 14, y - h / 2 - 22);
          g.lineTo(x + w / 2 + 16, y - h / 2 + 38);
          g.closePath();
        },
      ],
      "#cf4f9c",
    );
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(x - w / 2 + 2 + i * 6, y - h / 2 + 22 - i * 16);
      g.lineTo(x + w / 2 - 2 - i * 6, y - h / 2 + 22 - i * 16);
      g.stroke();
    }
    // chimney with a puff
    this.blob([() => g.rect(x + w / 4, y - h / 2 - 34, 16, 26)], "#a86b3c", 5);
    g.fillStyle = "rgba(255,255,255,0.7)";
    const puff = (this.time * 0.6) % 1;
    g.beginPath();
    g.arc(x + w / 4 + 8 + puff * 10, y - h / 2 - 44 - puff * 30, 6 + puff * 6, 0, Math.PI * 2);
    g.fill();
    // door and windows
    this.blob([() => g.roundRect(x - 16, y + h / 2 - 46, 32, 46, [14, 14, 0, 0])], "#a86b3c", 5);
    g.fillStyle = "#fff1a8";
    g.beginPath();
    g.arc(x + 8, y + h / 2 - 22, 3, 0, Math.PI * 2);
    g.fill();
    for (const wx of [x - w / 2 + 26, x + w / 2 - 26]) {
      this.blob([() => g.roundRect(wx - 14, y - 4, 28, 26, 6)], "#bfe3ff", 4);
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(wx, y - 4);
      g.lineTo(wx, y + 22);
      g.moveTo(wx - 14, y + 9);
      g.lineTo(wx + 14, y + 9);
      g.stroke();
    }
    this.drawSign(x, y + h / 2 + 22, "My Pocket", true);
  }

  private drawBench(t: Thing) {
    const g = this.ctx;
    const { x, y } = t;
    this.shadow(x, y + 6, 30, 8);
    this.blob([() => g.rect(x - 22, y - 8, 6, 14), () => g.rect(x + 16, y - 8, 6, 14)], "#8a5a32", 4);
    this.blob([() => g.roundRect(x - 28, y - 20, 56, 14, 4)], "#c08a5a", 5);
    g.font = `20px ${EMOJI_FONT}`;
    g.textAlign = "center";
    g.fillStyle = "#000";
    g.fillText("🔨", x - 8, y - 22);
    g.fillText("🪚", x + 12, y - 22);
  }

  private drawFence(x: number, y: number, w: number, h: number, vertical: boolean, gate: boolean) {
    const g = this.ctx;
    const col = gate ? "#ffbe60" : "#d9a066";
    if (vertical) {
      this.blob([() => g.rect(x - 3, y, 6, h)], col, 4);
      for (let k = 0; k <= h; k += TILE) this.blob([() => g.roundRect(x - 5, y + k - 16, 10, 22, 3)], col, 4);
    } else {
      this.blob([() => g.rect(x, y - 12, w, 5), () => g.rect(x, y - 4, w, 5)], col, 4);
      for (let k = 0; k <= w; k += TILE) this.blob([() => g.roundRect(x + k - 5, y - 20, 10, 24, 3)], col, 4);
    }
  }

  private drawGate(t: Extract<Thing, { kind: "gate" }>) {
    const open = this.host.zoneOpen(t.zone);
    const g = this.ctx;
    if (open) {
      // Just the two posts, swung open
      const ends = t.vertical ? [[t.x, t.y], [t.x, t.y + t.h]] : [[t.x, t.y], [t.x + t.w, t.y]];
      for (const [ex, ey] of ends) this.blob([() => g.roundRect(ex - 6, ey - 22, 12, 26, 3)], "#ffbe60", 4);
      return;
    }
    this.drawFence(t.x, t.y, t.w, t.h, t.vertical, true);
    const cx = t.vertical ? t.x : t.x + t.w / 2;
    const cy = t.vertical ? t.y + t.h / 2 : t.y - 8;
    g.font = `800 13px system-ui, sans-serif`;
    const label = `🔨 ${projectFor(t.zone)?.icon ?? "🔒"}`;
    const w = g.measureText(label).width + 18;
    this.blob([() => g.roundRect(cx - w / 2, cy - 16, w, 26, 8)], "#fff1a8", 4);
    g.fillStyle = INK;
    g.textAlign = "center";
    g.fillText(label, cx, cy + 2);
  }

  private drawSign(x: number, y: number, text: string, small = false) {
    const g = this.ctx;
    g.font = `700 ${small ? 12 : 13}px system-ui, sans-serif`;
    const w = g.measureText(text).width + 16;
    if (!small) this.blob([() => g.rect(x - 3, y - 6, 6, 18)], "#8a5a32", 3);
    this.blob([() => g.roundRect(x - w / 2, y - 26, w, 22, 6)], "#fff6e8", 4);
    g.fillStyle = INK;
    g.textAlign = "center";
    g.fillText(text, x, y - 10);
  }

  private drawVillager(v: Extract<Thing, { kind: "villager" }>) {
    if (!this.host.resident(v.v)) return;
    const g = this.ctx;
    const bob = Math.sin(this.time * 4 + v.id) * 2;
    this.shadow(v.x, v.y + 6, 16, 6);
    g.font = `36px ${EMOJI_FONT}`;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#000"; // emoji take the fill's transparency, so reset it after the shadow
    g.fillText(VILLAGERS[v.v]?.icon ?? "🐻", v.x, v.y + 8 + bob);
    if (this.host.hasRequest(v.v)) {
      const by = v.y - 44 + Math.sin(this.time * 5) * 3;
      this.blob([() => g.arc(v.x, by, 11, 0, Math.PI * 2)], "#fff1a8", 4);
      g.fillStyle = INK;
      g.font = "900 15px system-ui, sans-serif";
      g.fillText("!", v.x, by + 5);
    }
  }

  private drawSite(t: Extract<Thing, { kind: "site" }>) {
    const g = this.ctx;
    const p = PROJECTS.find((x) => x.id === t.project)!;
    const { x, y, w, h } = t;
    if (!this.host.built(t.project)) {
      // A roped-off building site with a sign
      this.shadow(x, y + h / 2, w / 2, 8);
      g.strokeStyle = "#c08a5a";
      g.lineWidth = 4;
      g.setLineDash([10, 8]);
      g.strokeRect(x - w * 0.35, y - h * 0.15, w * 0.7, h * 0.6);
      g.setLineDash([]);
      for (const [px, py] of [[x - w * 0.35, y - h * 0.15], [x + w * 0.35, y - h * 0.15], [x - w * 0.35, y + h * 0.45], [x + w * 0.35, y + h * 0.45]])
        this.blob([() => g.roundRect(px - 4, py - 14, 8, 18, 2)], "#d9a066", 3);
      this.blob([() => g.roundRect(x - 14, y + 4, 28, 14, 3), () => g.roundRect(x - 8, y - 6, 16, 12, 3)], "#c08a5a", 3);
      this.drawSign(x, y - h * 0.18, `${p.icon} ${p.name}`);
      return;
    }
    this.shadow(x, y + h / 2 + 2, w / 2 + 6, 10);
    const wall = { bakery: "#fff1a8", tailor: "#e2d4ff", carpenter: "#ffe5b4", dock: "#bfe3ff" }[t.project] ?? "#fff6e8";
    const roof = { bakery: "#ff9fb6", tailor: "#8b6bb8", carpenter: "#c08a5a", dock: "#4f8fc0" }[t.project] ?? "#cf4f9c";
    this.blob([() => g.roundRect(x - w / 2, y - h / 2 + 22, w, h - 22, 8)], wall);
    this.blob(
      [
        () => {
          g.moveTo(x - w / 2 - 10, y - h / 2 + 28);
          g.lineTo(x, y - h / 2 - 18);
          g.lineTo(x + w / 2 + 10, y - h / 2 + 28);
          g.closePath();
        },
      ],
      roof,
    );
    this.blob([() => g.roundRect(x - 12, y + h / 2 - 32, 24, 32, [10, 10, 0, 0])], "#a86b3c", 4);
    g.font = `26px ${EMOJI_FONT}`;
    g.textAlign = "center";
    g.fillStyle = "#000";
    g.fillText(p.icon, x, y - h / 2 + 20);
  }

  private drawPlot(t: Extract<Thing, { kind: "plot" }>) {
    const g = this.ctx;
    const v = this.host.plot(t.i);
    const { x, y } = t;
    if (v.stage === "locked") {
      g.strokeStyle = "rgba(22,22,22,0.35)";
      g.setLineDash([5, 5]);
      g.lineWidth = 2;
      g.strokeRect(x - 22, y - 18, 44, 36);
      g.setLineDash([]);
      return;
    }
    const wet = v.stage !== "empty" && v.stage !== "dry";
    this.blob([() => g.roundRect(x - 23, y - 19, 46, 38, 6)], wet ? "#7a4f2c" : "#a8744a", 4);
    g.strokeStyle = "rgba(22,22,22,0.25)";
    g.lineWidth = 2;
    for (const k of [-8, 4]) {
      g.beginPath();
      g.moveTo(x - 17, y + k);
      g.lineTo(x + 17, y + k);
      g.stroke();
    }
    g.textAlign = "center";
    g.fillStyle = "#000";
    if (v.stage === "dry") {
      g.fillStyle = "#3a2414";
      for (const [dx, dy] of [[-8, -3], [6, -6], [0, 6]]) {
        g.beginPath();
        g.arc(x + dx, y + dy, 2.5, 0, Math.PI * 2);
        g.fill();
      }
    } else if (v.stage === "sprout" || v.stage === "growing") {
      const big = v.stage === "growing" ? 1.6 : 1;
      g.strokeStyle = "#3e8f3e";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y + 6);
      g.lineTo(x, y + 6 - 10 * big);
      g.stroke();
      this.blob([() => g.ellipse(x - 5 * big, y + 2 - 8 * big, 5 * big, 3 * big, -0.5, 0, Math.PI * 2), () => g.ellipse(x + 5 * big, y + 2 - 9 * big, 5 * big, 3 * big, 0.5, 0, Math.PI * 2)], "#6cc95f", 2);
    } else if (v.stage === "ready" && v.crop) {
      const bob = Math.sin(this.time * 4 + t.i) * 2;
      g.font = `28px ${EMOJI_FONT}`;
      g.fillText(MATS[v.crop].icon, x, y + 8 + bob);
      g.font = `14px ${EMOJI_FONT}`;
      g.fillText("✨", x + 16, y - 10 + bob);
    }
  }

  private drawBin(x: number, y: number) {
    const g = this.ctx;
    this.shadow(x, y + 6, 22, 7);
    this.blob([() => g.roundRect(x - 20, y - 22, 40, 28, 4)], "#c08a5a", 5);
    this.blob([() => g.roundRect(x - 23, y - 30, 46, 10, 3)], "#a86b3c", 4);
    g.font = `16px ${EMOJI_FONT}`;
    g.textAlign = "center";
    g.fillStyle = "#000";
    g.fillText("🪙", x, y - 4);
  }

  private drawLadder(x: number, y: number) {
    const g = this.ctx;
    this.blob([() => g.ellipse(x, y, 22, 12, 0, 0, Math.PI * 2)], "#1d1430", 4);
    g.strokeStyle = "#d9a066";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x - 8, y + 4);
    g.lineTo(x - 8, y - 26);
    g.moveTo(x + 8, y + 4);
    g.lineTo(x + 8, y - 26);
    for (let k = -22; k <= 0; k += 8) {
      g.moveTo(x - 8, y + k);
      g.lineTo(x + 8, y + k);
    }
    g.stroke();
  }

  private drawCritter(c: Extract<Thing, { kind: "critter" }>) {
    const g = this.ctx;
    const moving = Math.hypot(c.tx - c.x, c.ty - c.y) > 3 && c.wait <= 0;
    const hop = c.flies ? Math.sin(this.time * 6 + c.id) * 5 - 18 : moving ? -Math.abs(Math.sin(this.time * 14 + c.id)) * 4 : 0;
    if (!c.flies) this.shadow(c.x, c.y + 4, 9, 3);
    else this.shadow(c.x, c.y + 10, 6, 2);
    g.save();
    g.translate(c.x, c.y + hop);
    if (c.tx < c.x) g.scale(-1, 1);
    g.font = `22px ${EMOJI_FONT}`;
    g.textAlign = "center";
    g.fillStyle = "#000";
    g.fillText(c.icon, 0, 6);
    g.restore();
  }

  private drawTrail(t: Extract<Thing, { kind: "trail" }>) {
    const g = this.ctx;
    const open = t.back || t.to <= this.host.carved();
    const { x, y } = t;
    if (!open) {
      // Overgrown: a wall of brambles across the path
      this.blob([0, 1, 2, 3, 4].map((i) => () => g.arc(x + (i % 2 ? 8 : -8), y - 40 + i * 20, 15, 0, Math.PI * 2)), "#3f8e3e", 5);
      g.fillStyle = "#ff4d6d";
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.arc(x - 10 + (i % 3) * 10, y - 44 + Math.floor(i / 3) * 40, 3, 0, Math.PI * 2);
        g.fill();
      }
      this.drawSign(x, y - 74, "🔨 Carve path");
      return;
    }
    const label = t.back ? (t.to === 0 ? "← Home" : `← ${frontierName(t.to)}`) : `${frontierName(t.to)} →`;
    this.drawSign(x, y - 36, label);
    g.strokeStyle = "rgba(255,255,255,0.8)";
    g.lineWidth = 3;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.ellipse(x, y, 20 + Math.sin(this.time * 3) * 2, 10, 0, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }

  private drawPlayer() {
    const g = this.ctx;
    const p = this.player;
    const bob = p.moving ? Math.abs(Math.sin(p.walk * 11)) * 5 : Math.sin(this.time * 2.4) * 1.2;
    const squash = p.act > 0 ? 0.9 : 1;
    this.shadow(p.x, p.y + 6, 18 - bob * 0.6, 6);
    const W = 58;
    const H = W * (760 / 680);
    g.save();
    g.translate(p.x, p.y + 8 - bob);
    g.scale(p.dir, squash);
    if (this.img?.complete) g.drawImage(this.img, -W / 2, -H, W, H);
    else this.blob([() => g.arc(0, -26, 24, 0, Math.PI * 2)], "#ffc6d6");
    g.restore();
    // Tool swing in front of you
    if (p.act > 0) {
      const t = this.target;
      const icon = t?.kind === "node" ? (t.t.node === "tree" ? "🪓" : t.t.node === "rock" || t.t.node === "crystal" ? "⛏️" : "✋") : "🎣";
      const a = (1 - p.act / 0.22) * 1.6 - 0.8;
      g.save();
      g.translate(p.x + p.fx * 26 + p.dir * 6, p.y - 24 + p.fy * 10);
      g.rotate(a * p.dir);
      g.font = `24px ${EMOJI_FONT}`;
      g.fillStyle = "#000";
      g.textAlign = "center";
      g.fillText(icon, 0, 8);
      g.restore();
    }
  }

  private drawLine() {
    const g = this.ctx;
    const f = this.fishing!;
    const p = this.player;
    const dip = f.phase === "bite" ? 5 + Math.sin(this.time * 30) * 2 : Math.sin(this.time * 3) * 2;
    g.strokeStyle = "rgba(22,22,22,0.7)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(p.x + p.dir * 18, p.y - 40);
    g.quadraticCurveTo((p.x + f.x) / 2, Math.min(p.y, f.y) - 30, f.x, f.y + dip - 4);
    g.stroke();
    this.blob([() => g.arc(f.x, f.y + dip, 6, 0, Math.PI * 2)], "#ff4d6d", 3);
    g.fillStyle = "#fff";
    g.fillRect(f.x - 6, f.y + dip - 1, 12, 2);
    if (f.phase === "bite") {
      g.font = `900 28px system-ui, sans-serif`;
      g.textAlign = "center";
      g.lineWidth = 5;
      g.strokeStyle = INK;
      g.strokeText("!", f.x, f.y - 22);
      g.fillStyle = "#fff1a8";
      g.fillText("!", f.x, f.y - 22);
    }
  }

  private drawPrompt() {
    if (this.demo) return; // nobody to press anything
    const t = this.target;
    const label = this.lastPrompt;
    if (!t || !label) return;
    const g = this.ctx;
    let x: number;
    let y: number;
    if (t.kind === "water") [x, y] = [t.x, t.y - 34];
    else if (t.kind === "door") [x, y] = [t.t.x, t.t.y + 60 - 8];
    else if (t.kind === "gate") [x, y] = [this.player.x, this.player.y - 80];
    else {
      x = t.t.x;
      y = t.t.y - (t.kind === "node" && t.t.node === "tree" ? 100 : t.kind === "villager" ? 70 : 54);
    }
    g.font = `700 13px system-ui, sans-serif`;
    const key = "E";
    const text = `${label}`;
    const w = g.measureText(text).width + 40;
    const by = y + Math.sin(this.time * 4) * 2;
    this.blob([() => g.roundRect(x - w / 2, by - 15, w, 26, 13)], "#ffffff", 4);
    this.blob([() => g.roundRect(x - w / 2 + 5, by - 10, 18, 16, 5)], "#161616", 2);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.fillText(key, x - w / 2 + 14, by + 3);
    g.fillStyle = INK;
    g.fillText(text, x + 10, by + 3);
  }

  zoneName(id: string) {
    return ZONES.find((z) => z.id === id)?.name ?? "";
  }
}
