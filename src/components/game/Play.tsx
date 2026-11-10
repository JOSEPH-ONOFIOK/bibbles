"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AURAS, FACES, MochiArt, SKINS, type MochiLook } from "@/components/MochiArt";
import { ENERGY_MAX, GAME_OPEN_AT, MATS, MOCHI_SOON, PLOTS_FREE, QUESTS, SEASONS, TRIAL_SECONDS, ZONES, biomeFor, calendar, frontierName, trialFor, weather, xpFor, type Mat } from "@/game/data";
import { isMuted, play, setMuted } from "@/game/sfx";
import { Engine, type Host, type Menu as WorldMenu } from "@/game/engine";
import { apply, built, load, nextEnergyIn, plotState, residents, store, upgrade, zoneOpen, type Action, type Gain, type Save } from "@/game/state";
import { TOKEN, X_HANDLE, X_URL } from "@/lib/mochi";
import { LOOK_KEY } from "@/lib/myMochi";
import { GameBackdrop } from "./GameBackdrop";
import { Countdown, useGameOpen } from "../Countdown";
import { CarveMenu, Craft, Goals, PlotMenu, Pocket, Pockets, ProjectMenu, SellMenu, SoonMochi, Toast, VillagerTalk, mmss } from "./Panels";

type Menu = WorldMenu | { type: "goals" } | { type: "pockets" } | null;

const MENU_TITLES: Record<NonNullable<Menu>["type"], string> = {
  craft: "🔨 Workbench",
  pocket: "🏡 My Pocket",
  villager: "💌 Villager",
  plot: "🌱 Garden",
  sell: "🪙 Shipping Bin",
  project: "🔨 Build",
  carve: "🗺️ The Frontier",
  goals: "🌸 Goals",
  pockets: "🏡 Visit Pockets",
};

// The look from the builder, with what they're wearing in the game
function useLook(save: Save | null) {
  const [base, setBase] = useState<{ look: Partial<MochiLook>; name: string }>({ look: {}, name: "Your Mochi" });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOOK_KEY);
      if (raw) {
        const { name, ...look } = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser after mount
        setBase({ look, name: name || "Your Mochi" });
      }
    } catch {}
  }, []);
  // Anything unknown falls back to the builder's starting look
  const pick = <T extends string>(v: unknown, ok: readonly T[], fallback: T) => (ok.includes(v as T) ? (v as T) : fallback);
  const look = {
    skin: pick(base.look.skin, Object.keys(SKINS) as (keyof typeof SKINS)[], "blush"),
    face: pick(base.look.face, FACES, "sparkle"),
    aura: pick(base.look.aura, AURAS, "none"),
    bg: "none",
    head: save?.head ?? "none",
    fit: save?.fit ?? "tee",
  } as MochiLook;
  return { look, name: base.name };
}

// A start screen first: the world plays itself behind the title, like a game's attract mode.
// Choosing sound here also unlocks audio, which browsers only allow after a tap.
export function Play() {
  const [started, setStarted] = useState(false);
  const open = useGameOpen();
  if (started && open) return <Game />;
  const go = (sound: boolean) => {
    setMuted(!sound);
    if (sound) play("level");
    setStarted(true);
  };
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#9fdc7c]">
      <GameBackdrop focus={{ wide: [0.5, 0.78], narrow: [0.5, 0.8] }} />
      <div className="relative grid h-full place-items-center p-4">
        <div className="pop-in rounded-[2rem] border-4 border-ink/80 bg-[#fffaf3]/60 px-6 py-8 text-center shadow-[6px_6px_0_rgba(22,22,22,0.6)] backdrop-blur-md sm:px-12">
          <h1 className="font-display text-7xl text-white sm:text-8xl" style={{ textShadow: "5px 5px 0 #161616" }}>
            Mochi
          </h1>
          {open ? (
            <>
              <p className="mt-2 font-display text-xl" style={{ textShadow: "0 2px 0 #fffaf3" }}>
                A cosy adventure. Best with sound on.
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button onClick={() => go(true)} className="btn btn-pink px-8! py-3! text-2xl!">
                  🔊 Play with sound
                </button>
                <button onClick={() => go(false)} className="btn px-8! py-3! text-2xl!">
                  Play without
                </button>
              </div>
              <Link href="/play/duel" className="btn mt-3 bg-[#fff1a8]! px-6! py-2! text-xl!">
                ⚔️ Mochi Duel: stake $MOCHI, 1 vs 1
              </Link>
            </>
          ) : (
            <>
              <Countdown className="mt-3" to={GAME_OPEN_AT} label="🎮 Opens in" done="Open now!" />
              <p className="mt-3 max-w-sm font-semibold">A cosy adventure: gather, farm, build your village, make friends and explore new worlds.</p>
              <a href={X_URL} target="_blank" rel="noreferrer" className="btn btn-pink mt-5 px-6! py-2! text-xl!">
                Follow {X_HANDLE} for launch
              </a>
            </>
          )}
          <Link href="/" className="mt-6 block text-sm font-bold underline" style={{ textShadow: "0 1px 0 #fffaf3" }}>
            ← Back to the site
          </Link>
        </div>
      </div>
    </div>
  );
}

function Game() {
  const [save, setSave] = useState<Save | null>(null);
  const [now, setNow] = useState(0);
  const [menu, setMenu] = useState<Menu>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [zone, setZone] = useState<{ id: string; at: number } | null>(null);
  const [toast, setToast] = useState<{ gain: Gain; key: number } | null>(null);
  const [touch, setTouch] = useState(false);
  const [floor, setFloor] = useState(1);
  const [inZone, setInZone] = useState("home");
  const [region, setRegion] = useState(0);
  // The weekly Trial: when it ends, and how much of its material you've gathered since it began
  const [trialEnd, setTrialEnd] = useState(0);
  const trialScore = useRef(0);
  const trialRunning = useRef(false);
  const [trialShown, setTrialShown] = useState(0);
  const [sleepy, setSleepy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [handle, setHandle] = useState<string | undefined>();
  const [muted, setMute] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the setting lives in the browser
    setMute(isMuted());
  }, []);
  const stage = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  // The latest picture of your Mochi, handed to whichever engine is running
  const playerImg = useRef<HTMLImageElement | null>(null);
  // Your name and look, sent with the save so others can visit your Pocket
  const showRef = useRef<{ name: string; look: MochiLook } | null>(null);
  const latest = useRef<Save | null>(null);
  const { look, name } = useLook(save);

  // The save lives in the browser; timers tick every second
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state
    setSave(load());
    setNow(Date.now());
    setTouch(matchMedia("(pointer: coarse)").matches);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    latest.current = save;
    if (save) store(save);
  }, [save]);

  useEffect(() => {
    if (!save || !now) return;
    const next = apply(save, { type: "tick" }, now).save;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- only when energy actually refills
    if (next.energy !== save.energy) setSave(next);
  }, [now, save]);

  const act = useCallback((a: Action) => {
    const current = latest.current;
    if (!current) return null;
    const { save: next, gain } = apply(current, a);
    latest.current = next;
    setSave(next);
    // Big moments get a card; small pickups float in the world instead
    if (gain && (gain.levelUp || gain.item || gain.built || gain.heart !== undefined || gain.text || gain.coins || a.type === "fulfil")) setToast({ gain, key: Date.now() });
    if (gain?.levelUp) play("level");
    else if (gain?.built || gain?.text?.startsWith("Path carved")) play("build");
    else if (gain?.coins) play("coin");
    else if (gain?.item || gain?.heart !== undefined) play("pet");
    return { before: current, after: next, gain };
  }, []);

  // Start the world once the save has loaded
  const ready = !!save;
  useEffect(() => {
    if (!ready || !stage.current) return;
    const s = () => latest.current!;
    const host: Host = {
      energy: () => s()?.energy ?? 0,
      harvest: (gain, xp, energy, fish) => {
        const r = act({ type: "harvest", gain, xp, energy, fish });
        const ok = !!r && r.after.energy < r.before.energy;
        // Count toward a running Trial
        if (ok && trialRunning.current) {
          trialScore.current += gain[trialFor(calendar().week).stat] ?? 0;
          setTrialShown(trialScore.current);
        }
        if (ok && r.after.energy === 0) setSleepy(true);
        return ok;
      },
      open: (what) => setMenu(what),
      hasRequest: (v) => !!s()?.requests.some((r) => r.villager === v && !r.done),
      resident: (v) => residents(s()).includes(v),
      zoneOpen: (z) => zoneOpen(s(), z),
      built: (p) => built(s(), p),
      plot: (i) => {
        if (i >= (s().plots.length || PLOTS_FREE)) return { stage: "locked", left: 0 };
        const p = s().plots[i];
        const st = plotState(p);
        return { stage: st.stage, crop: p.crop, left: st.left };
      },
      plotAction: (i, kind) => {
        const r = act({ type: kind, plot: i });
        if (!r || r.after === r.before) return null;
        return kind === "water" ? "💧" : r.gain?.mats ? Object.entries(r.gain.mats).map(([m, n]) => `+${n} ${MATS[m as Mat].icon}`).join(" ") : null;
      },
      caveFloor: (n) => {
        setFloor(n);
        act({ type: "cave", floor: n });
      },
      season: () => calendar().season,
      carved: () => s()?.carved ?? 0,
      region: (n) => {
        setRegion(n);
        setZone({ id: n ? `frontier:${n}` : "home", at: Date.now() });
        if (n) act({ type: "visit", region: n });
      },
      prompt: setPrompt,
      zone: (id) => {
        // Frontier worlds announce themselves when you arrive
        if (id !== "frontier") setZone({ id, at: Date.now() });
        setInZone(id);
        if (id !== "cave") setFloor(1);
      },
    };
    // The engine runs the world; Phaser draws it
    const e = new Engine(document.createElement("canvas"), host, { external: true });
    engine.current = e;
    if (playerImg.current) e.setPlayerImage(playerImg.current);
    if (process.env.NODE_ENV !== "production") (window as unknown as { __mochi: Engine }).__mochi = e;
    let view: { destroy: () => void } | null = null;
    let gone = false;
    const el = stage.current;
    import("@/game/phaser/view").then(({ mountView }) => {
      if (!gone) view = mountView(el, e);
    });
    return () => {
      gone = true;
      view?.destroy();
      engine.current = null;
    };
  }, [ready, act]);

  useEffect(() => {
    engine.current?.setPaused(!!menu);
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [menu]);

  // The Trial clock
  const trialLeft = trialEnd ? Math.max(0, trialEnd - now) : 0;
  const startTrial = () => {
    trialScore.current = 0;
    trialRunning.current = true;
    setTrialShown(0);
    setTrialEnd(Date.now() + TRIAL_SECONDS * 1000);
    setMenu(null);
  };
  useEffect(() => {
    if (!trialEnd || now < trialEnd) return;
    trialRunning.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the Trial just ran out
    setTrialEnd(0);
    act({ type: "trial", score: trialScore.current });
  }, [now, trialEnd, act]);

  // Signed in with X: keep a copy of the save on the server so it follows you
  useEffect(() => {
    if (!ready) return;
    fetch("/api/game")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setSignedIn(true);
        fetch("/api/me")
          .then((r) => r.json())
          .then((m) => setHandle(m.entry?.handle))
          .catch(() => {});
        const remote = d.save && upgrade(d.save);
        if (remote && remote.savedAt > (latest.current?.savedAt ?? 0)) {
          latest.current = remote;
          setSave(remote);
        }
      })
      .catch(() => {});
  }, [ready]);
  const lastSent = useRef(0);
  useEffect(() => {
    if (!signedIn) return;
    const send = () => {
      const s = latest.current;
      if (!s || s.savedAt <= lastSent.current) return;
      lastSent.current = s.savedAt;
      // Your look and name go along so others can visit your Pocket
      const body = JSON.stringify({ save: s, show: showRef.current });
      if (document.visibilityState === "hidden" && navigator.sendBeacon) navigator.sendBeacon("/api/game", new Blob([body], { type: "application/json" }));
      else fetch("/api/game", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    };
    const t = setInterval(send, 30_000);
    const hide = () => document.visibilityState === "hidden" && send();
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [signedIn]);

  // Your Mochi, drawn by the same art as the builder, as the player sprite
  const lookKey = JSON.stringify(look);
  useEffect(() => {
    showRef.current = { name, look };
  });
  useEffect(() => {
    if (!ready) return;
    const svg = document.getElementById("game-mochi");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("width", "340");
    clone.setAttribute("height", "380");
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      playerImg.current = img;
      engine.current?.setPlayerImage(img);
      // Only free the file once it's drawn into the image
      URL.revokeObjectURL(url);
    };
    img.src = url;
    return () => {
      img.onload = null;
    };
  }, [lookKey, ready]);

  if (!save) return <div className="fixed inset-0 grid place-items-center bg-[#9fdc7c] font-display text-3xl">Loading the world…</div>;

  const need = xpFor(save.level);
  const nextIn = nextEnergyIn(save, now);
  const frontierAt = zone?.id.startsWith("frontier:") ? Number(zone.id.split(":")[1]) : 0;
  const zoneInfo = zone && (frontierAt ? { name: `${frontierAt}. ${frontierName(frontierAt)}`, color: "#e2d4ff" } : ZONES.find((z) => z.id === zone.id));
  const cal = calendar(now || undefined);
  const season = SEASONS[cal.season];
  const trial = trialFor(cal.week);
  const sky = weather(now || undefined);
  const quest = QUESTS[save.quest];
  const showZone = zone && now - zone.at < 2600;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#7cc96a] select-none">
      <div ref={stage} className="absolute inset-0 touch-none overflow-hidden" />
      <div className="hidden" aria-hidden>
        <MochiArt look={look} svgId="game-mochi" viewBox="160 280 680 760" />
      </div>

      {/* ---------- Game HUD ---------- */}
      {/* You: framed portrait, level badge, health-style bars */}
      <div className="pointer-events-none absolute top-2 left-2 flex items-start gap-2 sm:top-3 sm:left-3">
        <Link href="/" aria-label="Back to the site" className="hud-round pointer-events-auto">
          ←
        </Link>
        <div className="hud-panel pointer-events-auto flex items-center gap-2.5 py-2 pr-3 pl-2">
          <div className="relative">
            <div className="hud-portrait">
              <MochiArt look={look} className="h-full w-full" viewBox="160 280 680 720" title={name} />
            </div>
            <span className="hud-level">{save.level}</span>
          </div>
          <div className="w-32 sm:w-48">
            <p className="hud-name truncate">{name}</p>
            <div className="hud-bar mt-1" title={`Energy ${save.energy}/${ENERGY_MAX}`}>
              <div className="hud-bar-fill bg-gradient-to-r from-[#3ecf6e] to-[#b6f5c9]" style={{ width: `${(save.energy / ENERGY_MAX) * 100}%` }} />
              <span className="hud-bar-label">
                ⚡ {save.energy}/{ENERGY_MAX}
                {nextIn > 0 && <span className="opacity-70"> · {mmss(nextIn)}</span>}
              </span>
            </div>
            <div className="hud-bar hud-bar-thin mt-1" title={`XP ${save.xp}/${need}`}>
              <div className="hud-bar-fill bg-gradient-to-r from-[#cf4f9c] to-[#ffb3d1]" style={{ width: `${(save.xp / need) * 100}%` }} />
              <span className="hud-bar-label">XP {save.xp}/{need}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Coins and the day, top right; round menu buttons below */}
      <div className="pointer-events-none absolute top-2 right-2 flex flex-col items-end gap-2 sm:top-3 sm:right-3">
        <div className="hud-panel pointer-events-auto flex items-center gap-3 px-3 py-1.5">
          <span className="hud-coins">🪙 {save.coins}</span>
          <span className="hidden font-display text-sm sm:inline">
            {season.icon} Day {cal.day}
          </span>
          <span className="font-display text-base">{sky === "rain" ? "🌧️" : sky === "snow" ? "🌨️" : "☀️"}</span>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button onClick={() => setMenu({ type: "goals" })} className="hud-round hud-round-lg" aria-label="Goals" title="Goals">
            🌸
          </button>
          <button onClick={() => setMenu({ type: "pockets" })} className="hud-round hud-round-lg" aria-label="Visit Pockets" title="Visit Pockets">
            🏡
          </button>
          <Link href="/play/duel" className="hud-round hud-round-lg" aria-label="Mochi Duel" title="Mochi Duel: stake $MOCHI, 1 vs 1">
            ⚔️
          </Link>
          <button
            onClick={() => {
              setMuted(!muted);
              setMute(!muted);
            }}
            aria-label={muted ? "Sound on" : "Sound off"}
            className="hud-round"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          {signedIn ? (
            <span className="hud-chip bg-[#ccffb2]">☁️ Saved</span>
          ) : (
            // Full page trip to X; it brings you back to the game
            <a href="/api/auth/x/start?to=/play" className="hud-chip bg-ink text-white">
              𝕏 Save
            </a>
          )}
          {cal.festival && <span className="hud-chip bg-[#ffc6d6]">🎉 {season.festival} ×2</span>}
          {region > 0 && (
            <span className="hud-chip bg-[#e2d4ff]">
              🗺️ {frontierName(region)} {MATS[biomeFor(region).mat].icon}
            </span>
          )}
          {inZone === "cave" && <span className="hud-chip bg-[#e2d4ff]">⛏️ Floor {floor}</span>}
        </div>
      </div>

      {/* Quest scroll */}
      {quest && (
        <div className="pointer-events-none absolute top-[92px] left-2 max-w-[62vw] sm:top-[104px] sm:left-3 sm:max-w-xs">
          <div className="hud-scroll">
            <p className="hud-scroll-title">📜 Quest {save.quest + 1}/{QUESTS.length}</p>
            <p className="text-xs font-extrabold sm:text-sm">{quest.text}</p>
            <p className="mt-0.5 text-[11px] font-bold text-ink/60">Reward 🪙{quest.coins}</p>
          </div>
        </div>
      )}
      {sky === "rain" && region === 0 && save.plots.some((p) => p.crop) && (
        <p className="hud-chip pointer-events-none absolute top-[150px] left-1/2 -translate-x-1/2 bg-[#bfe3ff] sm:top-24">🌧️ Your crops are watered</p>
      )}

      {/* Area title card */}
      {showZone && zoneInfo && (
        <div key={`zone-${zone.at}`} className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center">
          <div className="hud-title" style={{ background: zoneInfo.color }}>
            <span className="hud-title-kicker">Now entering</span>
            {zoneInfo.name}
          </div>
        </div>
      )}

      {/* Hotbar: what you're carrying */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-2 sm:bottom-3">
        <div className={`hud-hotbar pointer-events-auto ${touch ? "mb-[132px]" : ""}`}>
          {(Object.keys(MATS) as Mat[])
            .filter((m) => (save.mats[m] ?? 0) > 0)
            .slice(0, touch ? 6 : 10)
            .map((m) => (
              <div key={m} className="hud-slot" title={MATS[m].name}>
                <span className="text-xl sm:text-2xl">{MATS[m].icon}</span>
                <span className="hud-slot-count">{save.mats[m]}</span>
              </div>
            ))}
          {(Object.keys(MATS) as Mat[]).every((m) => !(save.mats[m] ?? 0)) && <div className="px-3 py-2 font-display text-sm">🎒 Your bag is empty</div>}
        </div>
      </div>

      {/* How to play */}
      {!touch && (
        <p className="hud-chip pointer-events-none absolute bottom-20 left-3 bg-white/90">
          WASD to move · <b>E</b> to {prompt ? prompt.toLowerCase() : "interact"}
        </p>
      )}
      {touch && <TouchControls engine={engine} prompt={prompt} />}

      {/* The weekly Trial clock */}
      {trialLeft > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center sm:top-20">
          <p className="rounded-full border-4 border-ink bg-[#fff1a8] px-5 py-1 font-display text-2xl shadow-[4px_4px_0_#161616]">
            {trial.icon} {trial.name} · {Math.ceil(trialLeft / 1000)}s · {trialShown} {MATS[trial.stat].icon}
          </p>
        </div>
      )}

      {/* Out of energy: the day's done */}
      {sleepy && save.energy === 0 && !menu && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-[#1d1430]/60 p-4">
          <div className="chunk pop-in max-w-sm p-6 text-center">
            <p className="text-6xl">😴</p>
            <p className="mt-2 font-display text-3xl">{name} is sleepy</p>
            <p className="mt-2 font-semibold text-ink/70">That&apos;s a good day&apos;s work. Energy comes back over time, so check your crops and come back soon.</p>
            <p className="mt-2 font-display text-lg">⚡ +1 in {mmss(nextIn)}</p>
            <div className="mt-3">
              <SoonMochi>
                {MOCHI_SOON.energy} with {TOKEN} soon
              </SoonMochi>
            </div>
            <button onClick={() => setSleepy(false)} className="btn btn-pink mt-4 w-full py-2!">
              Keep wandering
            </button>
          </div>
        </div>
      )}

      {toast && <Toast key={`toast-${toast.key}`} gain={toast.gain} onDone={() => setToast(null)} />}

      {menu && (
        <div className="absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-[#1d1430]/55 p-3 pt-10 backdrop-blur-[3px]" onClick={() => setMenu(null)}>
          <div role="dialog" aria-modal className="hud-window pop-in relative my-auto w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {/* Title ribbon */}
            <div className="hud-ribbon">{MENU_TITLES[menu.type]}</div>
            <button onClick={() => setMenu(null)} className="hud-close" aria-label="Close">
              ✕
            </button>
            <div className="max-h-[80svh] overflow-y-auto p-4 pt-8 sm:p-6 sm:pt-9">
            {menu.type === "craft" && (
              <div className="pt-8 sm:pt-0">
                <Craft save={save} now={now} act={act} />
              </div>
            )}
            {menu.type === "pocket" && (
              <>
                <Pocket save={save} look={look} act={act} />
              </>
            )}
            {menu.type === "villager" && (
              <div className="mx-auto max-w-sm">
                <VillagerTalk save={save} v={menu.v} act={act} />
              </div>
            )}
            {menu.type === "goals" && (
              <>
                <Goals save={save} act={act} trialLeft={trialLeft} startTrial={startTrial} />
              </>
            )}
            {menu.type === "plot" && <PlotMenu save={save} i={menu.i} act={act} close={() => setMenu(null)} />}
            {menu.type === "sell" && <SellMenu save={save} act={act} />}
            {menu.type === "pockets" && <Pockets signedIn={signedIn} me={handle} />}
            </div>
            {menu.type === "carve" && (
              <div className="mx-auto max-w-md">
                <CarveMenu save={save} to={menu.to} act={act} />
              </div>
            )}
            {menu.type === "project" && (
              <div className="mx-auto max-w-md text-center">
                <ProjectMenu save={save} id={menu.id} act={act} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Joystick on the left, action button on the right
function TouchControls({ engine, prompt }: { engine: React.RefObject<Engine | null>; prompt: string | null }) {
  const pad = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);

  const move = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId || !pad.current) return;
    const r = pad.current.getBoundingClientRect();
    let x = e.clientX - (r.left + r.width / 2);
    let y = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 18;
    const d = Math.hypot(x, y);
    if (d > max) {
      x = (x / d) * max;
      y = (y / d) * max;
    }
    setKnob({ x, y });
    engine.current?.setStick(x / max, y / max);
  };
  const end = () => {
    id.current = null;
    setKnob({ x: 0, y: 0 });
    engine.current?.setStick(0, 0);
  };

  return (
    <>
      <div
        ref={pad}
        className="absolute bottom-6 left-5 h-32 w-32 touch-none rounded-full border-4 border-ink/60 bg-white/40 backdrop-blur-sm"
        onPointerDown={(e) => {
          id.current = e.pointerId;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div
          className="absolute top-1/2 left-1/2 h-14 w-14 rounded-full border-4 border-ink bg-white shadow-[3px_3px_0_#161616]"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          engine.current?.action();
        }}
        className={`absolute right-5 bottom-8 grid h-24 w-24 touch-none place-items-center rounded-full border-4 border-ink font-display text-lg leading-tight shadow-[4px_4px_0_#161616] transition ${
          prompt ? "bg-pink text-white" : "bg-white/70 text-ink/50"
        }`}
      >
        {prompt ?? "·"}
      </button>
    </>
  );
}
