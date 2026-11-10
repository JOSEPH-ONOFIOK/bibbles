// The Phaser view: draws the world the Engine simulates. The Engine keeps the rules,
// movement and gathering; Phaser does the drawing, camera, tweens, particles and effects.
import * as Phaser from "phaser";
import type { Engine, Fx } from "../engine";
import { T, TILE } from "../world";
import type { Thing, World } from "../world";

type Look = { key: string; img: Phaser.GameObjects.Image };

const hexColor = (c: string) => {
  if (c.startsWith("#")) return Phaser.Display.Color.HexStringToColor(c).color;
  const m = c.match(/\d+(\.\d+)?/g);
  return m ? Phaser.Display.Color.GetColor(+m[0], +m[1], +m[2]) : 0xffffff;
};

class WorldScene extends Phaser.Scene {
  private eng!: Engine;
  private world: World | null = null;
  private groundSrc: HTMLCanvasElement | null = null;
  private ground!: Phaser.GameObjects.Image;
  private looks = new Map<number, Look>();
  private player!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private tool!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private water!: Phaser.GameObjects.Graphics;
  private line!: Phaser.GameObjects.Graphics;
  private bits!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sky!: Phaser.GameObjects.Particles.ParticleEmitter;
  private skyKind = "";
  private dark!: Phaser.GameObjects.Graphics;
  private light!: Phaser.GameObjects.Image;
  private playerSrc: HTMLImageElement | null = null;
  private dpr = 1;

  constructor(private engine: Engine) {
    super("world");
  }

  create() {
    this.eng = this.engine;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    // Small white textures to tint: particles, the soft light
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff).fillRect(0, 0, 8, 8).generateTexture("px", 8, 8);
    g.clear().fillStyle(0xffffff).fillCircle(4, 4, 4).generateTexture("dot", 8, 8);
    g.destroy();
    this.makeLightTexture();

    this.ground = this.add.image(0, 0, "__DEFAULT").setOrigin(0).setDepth(-100000);
    this.water = this.add.graphics().setDepth(-99999);
    this.shadow = this.add.ellipse(0, 0, 36, 12, 0x161616, 0.18);
    this.player = this.add.image(0, 0, "__DEFAULT").setOrigin(0.5, 1);
    this.tool = this.add.text(0, 0, "", { fontSize: "24px", resolution: this.dpr }).setOrigin(0.5).setVisible(false);
    this.line = this.add.graphics();
    this.promptText = this.add.text(12, 0, "", { fontFamily: "system-ui, sans-serif", fontStyle: "bold", fontSize: "13px", color: "#161616", resolution: this.dpr }).setOrigin(0, 0.5);
    const keyCap = this.add.text(-2, 0, "E", { fontFamily: "system-ui, sans-serif", fontStyle: "bold", fontSize: "11px", color: "#ffffff", backgroundColor: "#161616", padding: { x: 5, y: 2 }, resolution: this.dpr }).setOrigin(1, 0.5);
    const bubble = this.add.graphics();
    this.prompt = this.add.container(0, 0, [bubble, keyCap, this.promptText]).setDepth(900000).setVisible(false);
    this.prompt.setData("bubble", bubble);

    this.bits = this.add.particles(0, 0, "px", {
      speed: { min: 60, max: 200 },
      angle: { min: 200, max: 340 },
      gravityY: 520,
      lifespan: 650,
      scale: { start: 0.7, end: 0.1 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    this.bits.setDepth(800000);

    this.sky = this.add.particles(0, 0, "px", { emitting: false }).setScrollFactor(0).setDepth(950000);

    this.dark = this.add.graphics().setScrollFactor(0).setDepth(960000);
    this.light = this.add.image(0, 0, "light").setScrollFactor(0).setDepth(960001).setVisible(false);

    this.eng.fx = (e) => this.onFx(e);
    this.scale.on("resize", () => this.fitCamera());
    this.fitCamera();
  }

  private makeLightTexture() {
    // Transparent middle fading to solid at the edge: a soft circle of light in the dark
    const size = 512;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(size / 2, size / 2, size * 0.17, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    this.textures.addCanvas("light", c);
  }

  private fitCamera() {
    const cam = this.cameras.main;
    const cssW = this.scale.width / this.dpr;
    cam.setZoom(this.eng.view().zoomFor(cssW) * this.dpr);
    const f = this.eng.view().focus;
    cam.setFollowOffset(-(f.x - 0.5) * (cam.width / cam.zoom), -(f.y - 0.5) * (cam.height / cam.zoom));
  }

  private onFx(e: Fx) {
    if (e.type === "emit") {
      this.bits.setParticleTint(hexColor(e.color));
      this.bits.setParticleSpeed(e.speed * 0.4, e.speed * 1.2);
      this.bits.setParticleScale(e.size / 8, 0.1);
      this.bits.explode(e.n, e.x, e.y);
    } else if (e.type === "float") {
      const t = this.add
        .text(e.x, e.y, e.text, { fontFamily: "system-ui, sans-serif", fontStyle: "900", fontSize: "18px", color: "#ffffff", stroke: "#161616", strokeThickness: 5, resolution: this.dpr })
        .setOrigin(0.5)
        .setDepth(850000)
        .setScale(0.4);
      this.tweens.add({ targets: t, scale: 1, duration: 220, ease: "Back.Out" });
      this.tweens.add({ targets: t, y: e.y - 40, alpha: 0, delay: 650, duration: 750, ease: "Quad.In", onComplete: () => t.destroy() });
    } else if (e.type === "shake") {
      this.cameras.main.shake(140, e.strength);
    }
  }

  // A new world (or a new season's ground): rebuild what's drawn
  private enterWorld(w: World) {
    this.world = w;
    for (const l of this.looks.values()) l.img.destroy();
    this.looks.clear();
    this.cameras.main.setBounds(0, 0, w.width, w.height);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.fitCamera();
  }

  private texture(key: string, make: () => HTMLCanvasElement) {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, make());
    return key;
  }

  update(_t: number, deltaMs: number) {
    const eng = this.eng;
    eng.tick(deltaMs / 1000);
    const v = eng.view();
    if (v.world !== this.world) this.enterWorld(v.world);
    if (v.ground !== this.groundSrc) {
      this.groundSrc = v.ground;
      const key = `ground:${Math.random()}`;
      this.textures.addCanvas(key, v.ground);
      this.ground.setTexture(key);
    }

    // Your Mochi
    if (v.img && v.img !== this.playerSrc && v.img.complete) {
      this.playerSrc = v.img;
      const key = `player:${Math.random()}`;
      this.textures.addImage(key, v.img);
      this.player.setTexture(key);
    }
    const p = v.player;
    const bob = p.moving ? Math.abs(Math.sin(p.walk * 11)) * 5 : Math.sin(v.time * 2.4) * 1.2;
    const W = 58;
    const H = W * (760 / 680);
    // Sized from the picture, flipped to face where you're going, squashed when you swing
    const sx = W / Math.max(1, this.player.frame.width);
    const sy = H / Math.max(1, this.player.frame.height);
    this.player
      .setVisible(!!this.playerSrc)
      .setPosition(p.x, p.y + 8 - bob)
      .setScale(sx * (p.dir < 0 ? -1 : 1), sy * (p.act > 0 ? 0.9 : 1))
      .setDepth(p.y);
    this.shadow.setPosition(p.x, p.y + 6).setSize(36 - bob, 12).setDepth(p.y - 1);

    // Tool swing in front of you
    if (p.act > 0) {
      const a = (1 - p.act / 0.22) * 1.6 - 0.8;
      this.tool
        .setText(eng.toolIcon())
        .setVisible(true)
        .setPosition(p.x + p.fx * 26 + p.dir * 6, p.y - 24 + p.fy * 10)
        .setRotation(a * p.dir)
        .setDepth(p.y + 1);
    } else this.tool.setVisible(false);

    this.syncThings(v.world, v.time);
    this.drawWater(v.world, v.time);
    this.drawLine(v);
    this.drawPrompt();
    this.drawSky();
    this.drawLight(p);
  }

  private syncThings(w: World, time: number) {
    const now = Date.now();
    const cam = this.cameras.main.worldView;
    const pad = 160;
    const seen = new Set<number>();
    for (const t of w.things) {
      if (t.x < cam.x - pad || t.x > cam.right + pad || t.y < cam.y - pad || t.y > cam.bottom + pad + 80) continue;
      const s = this.eng.sprite(t, now);
      if (!s.key) continue;
      seen.add(t.id);
      let look = this.looks.get(t.id);
      if (!look) {
        const img = this.add.image(t.x, t.y, this.texture(s.key, s.canvas)).setOrigin(s.ox / s.w, s.oy / s.h);
        // Crystals and Frontier treasures glow
        if (t.kind === "node" && (t.node === "crystal" || t.node === "special") && img.preFX) img.preFX.addGlow(t.node === "crystal" ? 0xff8fd0 : 0xfff1a8, 3, 0, false, 0.1, 10);
        look = { key: s.key, img };
        this.looks.set(t.id, look);
      } else if (look.key !== s.key) {
        look.img.setTexture(this.texture(s.key, s.canvas)).setOrigin(s.ox / s.w, s.oy / s.h);
        // A little pop when something changes: a hit, a regrow, a build
        this.tweens.add({ targets: look.img, scaleX: { from: 1.08, to: 1 }, scaleY: { from: 0.92, to: 1 }, duration: 220, ease: "Back.Out" });
        look.key = s.key;
      }
      // Living things move; trees shake when hit
      let x = t.x;
      let y = t.y;
      if (t.kind === "node" && this.eng.isShaking(t.id)) x += Math.sin(time * 60) * 3;
      if (t.kind === "villager") y += Math.sin(time * 4 + t.id) * 2;
      if (t.kind === "critter") {
        const moving = Math.hypot(t.tx - t.x, t.ty - t.y) > 3 && t.wait <= 0;
        y += t.flies ? Math.sin(time * 6 + t.id) * 5 - 18 : moving ? -Math.abs(Math.sin(time * 14 + t.id)) * 4 : 0;
        look.img.setFlipX(t.tx < t.x);
      }
      if (t.kind === "node" && t.node === "special") y += Math.sin(time * 2 + t.id) * 2;
      if (t.kind === "plot") y += 0;
      look.img.setPosition(x, y).setDepth(s.depth);
    }
    // Forget what's far away; it's rebuilt when you come back
    for (const [id, l] of this.looks) {
      if (!seen.has(id)) {
        l.img.destroy();
        this.looks.delete(id);
      }
    }
  }

  private drawWater(w: World, time: number) {
    const g = this.water;
    g.clear();
    const cols = w.cols;
    const cam = this.cameras.main.worldView;
    const x0 = Math.max(0, Math.floor(cam.x / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE));
    const x1 = Math.min(cols - 1, Math.ceil(cam.right / TILE));
    const y1 = Math.min(w.rows - 1, Math.ceil(cam.bottom / TILE));
    g.lineStyle(2, 0xffffff, 0.55);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (w.tiles[y * cols + x] !== T.Water) continue;
        const h = ((Math.imul(x * 53 + y * 31, 2654435761) >>> 0) % 1000) / 1000;
        if (h > 0.45) continue;
        const ox = ((time * 12 + h * 40) % 32) - 4;
        const X = x * TILE + 6 + ox;
        const Y = y * TILE + 12 + h * 24;
        g.beginPath();
        g.moveTo(X, Y);
        g.lineTo(X + 6, Y - 3);
        g.lineTo(X + 12, Y);
        g.strokePath();
      }
  }

  private drawLine(v: ReturnType<Engine["view"]>) {
    const g = this.line;
    g.clear();
    const f = v.fishing;
    if (!f) return;
    const p = v.player;
    const dip = f.phase === "bite" ? 5 + Math.sin(v.time * 30) * 2 : Math.sin(v.time * 3) * 2;
    g.setDepth(Math.max(p.y, f.y) + 2);
    g.lineStyle(1.5, 0x161616, 0.7);
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(p.x + p.dir * 18, p.y - 40), new Phaser.Math.Vector2((p.x + f.x) / 2, Math.min(p.y, f.y) - 30), new Phaser.Math.Vector2(f.x, f.y + dip - 4));
    curve.draw(g, 20);
    g.fillStyle(0x161616).fillCircle(f.x, f.y + dip, 8);
    g.fillStyle(0xff4d6d).fillCircle(f.x, f.y + dip, 6);
    g.fillStyle(0xffffff).fillRect(f.x - 6, f.y + dip - 1, 12, 2);
    if (f.phase === "bite") {
      g.fillStyle(0x161616).fillCircle(f.x, f.y - 30, 11);
      g.fillStyle(0xfff1a8).fillCircle(f.x, f.y - 30, 8);
      g.fillStyle(0x161616).fillRect(f.x - 1.5, f.y - 35, 3, 7).fillRect(f.x - 1.5, f.y - 26, 3, 3);
    }
  }

  private drawPrompt() {
    const at = this.eng.promptAt();
    if (!at) {
      this.prompt.setVisible(false);
      return;
    }
    if (this.promptText.text !== at.label) {
      this.promptText.setText(at.label);
      const bubble = this.prompt.getData("bubble") as Phaser.GameObjects.Graphics;
      const w = this.promptText.width + 40;
      bubble.clear();
      bubble.fillStyle(0x161616).fillRoundedRect(-22 - 2, -15, w + 4, 30, 15);
      bubble.fillStyle(0xffffff).fillRoundedRect(-22, -13, w, 26, 13);
      this.prompt.setScale(0.6);
      this.tweens.add({ targets: this.prompt, scale: 1, duration: 200, ease: "Back.Out" });
    }
    this.prompt.setVisible(true).setPosition(at.x - this.promptText.width / 2, at.y + Math.sin(this.eng.view().time * 4) * 2);
  }

  private drawSky() {
    const kind = this.eng.weatherNow();
    if (kind === this.skyKind) return;
    this.skyKind = kind;
    this.sky.stop();
    if (kind === "sun") return;
    const w = this.scale.width;
    const h = this.scale.height;
    const rain = kind === "rain";
    this.sky.setConfig({
      x: { min: -50, max: w + 50 },
      y: -20,
      lifespan: rain ? 900 : 6000,
      speedY: rain ? { min: 700 * this.dpr, max: 900 * this.dpr } : { min: 30 * this.dpr, max: 70 * this.dpr },
      speedX: rain ? { min: -160, max: -120 } : { min: -20, max: 20 },
      scaleX: rain ? 0.2 * this.dpr : { min: 0.4 * this.dpr, max: 0.8 * this.dpr },
      scaleY: rain ? 2 * this.dpr : { min: 0.4 * this.dpr, max: 0.8 * this.dpr },
      alpha: rain ? 0.55 : 0.9,
      tint: rain ? 0xdcebff : 0xffffff,
      frequency: rain ? 8 : 60,
      quantity: rain ? 2 : 1,
      maxAliveParticles: rain ? 220 : 160,
    } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig);
    this.sky.start();
    void h;
  }

  private drawLight(p: { x: number; y: number }) {
    const l = this.eng.lighting();
    const g = this.dark;
    g.clear();
    if (l.alpha <= 0.01) {
      this.light.setVisible(false);
      return;
    }
    const W = this.scale.width;
    const H = this.scale.height;
    if (!l.spot) {
      this.light.setVisible(false);
      g.fillStyle(l.color, l.alpha).fillRect(0, 0, W, H);
      return;
    }
    // A soft circle of light around your Mochi, darkness beyond it
    const cam = this.cameras.main;
    const sx = (p.x - cam.worldView.x) * cam.zoom;
    const sy = (p.y - 20 - cam.worldView.y) * cam.zoom;
    const r = 240 * cam.zoom;
    this.light.setVisible(true).setTint(l.color).setAlpha(l.alpha).setDisplaySize(r * 2, r * 2).setPosition(sx, sy);
    g.fillStyle(l.color, l.alpha);
    g.fillRect(0, 0, W, Math.max(0, sy - r));
    g.fillRect(0, sy + r, W, Math.max(0, H - sy - r));
    g.fillRect(0, sy - r, Math.max(0, sx - r), r * 2);
    g.fillRect(sx + r, sy - r, Math.max(0, W - sx - r), r * 2);
  }
}

// Mount the view in an element. Returns a function that tears it down.
export function mountView(parent: HTMLElement, engine: Engine) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = () => ({ w: Math.max(1, parent.clientWidth), h: Math.max(1, parent.clientHeight) });
  const { w, h } = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: w * dpr,
    height: h * dpr,
    backgroundColor: "#7cc96a",
    scale: { mode: Phaser.Scale.NONE },
    render: { antialias: true, roundPixels: false },
    banner: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false },
    scene: new WorldScene(engine),
  });
  const fit = () => {
    const s = size();
    game.scale.resize(s.w * dpr, s.h * dpr);
    if (game.canvas) {
      game.canvas.style.width = `${s.w}px`;
      game.canvas.style.height = `${s.h}px`;
    }
  };
  game.events.once("ready", fit);
  const ro = new ResizeObserver(fit);
  ro.observe(parent);
  engine.start();
  return {
    pause: () => game.loop.sleep(),
    resume: () => game.loop.wake(),
    destroy: () => {
      ro.disconnect();
      engine.stop();
      engine.fx = null;
      game.destroy(true);
    },
  };
}

export type { Thing };
