"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MochiArt, type MochiLook } from "@/components/MochiArt";
import { TOKEN } from "@/lib/mochi";
import { BIOMES, BLOOM, CROPS, GATHERED, biomeFor, carveCost, frontierName, HEART, HEARTS_MAX, MATS, MOCHI_SOON, POCKET, PROJECTS, RECIPES, SEASONS, TRIAL_BADGES, TRIAL_SECONDS, VILLAGERS, ALL_FISH, calendar, trialFor, type Mat } from "@/game/data";
import { built, canCraft, costText, has, hearts, residents, seasonCrops, zoneOpen, type Action, type Gain, type Save } from "@/game/state";

export const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function Bag({ mats }: { mats: Save["mats"] }) {
  return (
    <div className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:max-w-[280px] sm:justify-end">
      {(Object.keys(MATS) as Mat[]).map((m) => (
        <span key={m} title={MATS[m].name} className="rounded-full border-[3px] border-ink bg-white px-2 py-0.5 font-display text-base tabular-nums">
          {MATS[m].icon} {mats[m] ?? 0}
        </span>
      ))}
    </div>
  );
}

export function Toast({ gain, onDone }: { gain: Gain; onDone: () => void }) {
  // The parent re-renders every second, so keep the timer from restarting
  const done = useRef(onDone);
  const big = gain.levelUp || gain.built || gain.heart !== undefined;
  useEffect(() => {
    const t = setTimeout(() => done.current(), big ? 2800 : 1800);
    return () => clearTimeout(t);
  }, [big]);
  const item = gain.item ? RECIPES.find((r) => r.id === gain.item) : null;
  const project = gain.built ? PROJECTS.find((p) => p.id === gain.built) : null;
  const got = gain.mats ? costText(gain.mats) : "";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-[70] flex justify-center px-4">
      <div className="chunk pop-in px-5 py-3 text-center">
        {gain.levelUp && <p className="font-display text-3xl text-pink">Level {gain.levelUp}! 🎉</p>}
        {project && (
          <p className="font-display text-2xl">
            {project.icon} {project.name} built! {project.villager !== undefined && `${VILLAGERS[project.villager].icon} ${VILLAGERS[project.villager].name} moved in!`}
          </p>
        )}
        {gain.heart !== undefined && (
          <p className="font-display text-2xl">
            ❤️ {VILLAGERS[gain.heart].name}: new heart!
          </p>
        )}
        {item && (
          <p className="font-display text-2xl">
            {item.icon} {item.name} made!
          </p>
        )}
        {gain.text && <p className="font-display text-xl">{gain.text}</p>}
        {(got || gain.coins || gain.xp) && (
          <p className="font-display text-xl">
            {got && `+ ${got} `}
            {gain.coins ? `+🪙${gain.coins} ` : ""}
            {gain.xp ? <span className="text-ink/60">+{gain.xp} XP</span> : null}
          </p>
        )}
      </div>
    </div>
  );
}

export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-3xl border-4 border-ink bg-white p-4 shadow-[4px_4px_0_#161616] ${className}`}>{children}</div>
);

export const SoonMochi = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border-2 border-dashed border-ink/40 px-2 py-0.5 text-xs font-bold text-ink/60">{children}</span>
);

// ---------- Craft ----------
export function Craft({ save, now, act }: { save: Save; now: number; act: (a: Action) => void }) {
  const freeSlot = save.jobs.some((j) => !j);
  return (
    <div>
      <Card className="bg-[#fff1a8]!">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-xl">Crafting slots</p>
          <SoonMochi>More crafting slots with {TOKEN} soon</SoonMochi>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {save.jobs.map((j, i) => {
            const r = j && RECIPES.find((x) => x.id === j.recipe);
            const left = j ? j.endsAt - now : 0;
            return (
              <div key={i} className="flex items-center gap-3 rounded-2xl border-[3px] border-ink bg-white p-3">
                <span className="text-3xl">{r ? r.icon : "🪚"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg">{r ? r.name : "Empty slot"}</p>
                  {r && (left > 0 ? <p className="text-sm font-bold text-ink/60">Ready in {mmss(left)}</p> : <p className="text-sm font-bold text-[#1f9d55]">Ready!</p>)}
                </div>
                {r && left <= 0 && (
                  <button onClick={() => act({ type: "collect", slot: i })} className="btn btn-pink px-3! py-1.5! text-base!">
                    Collect
                  </button>
                )}
                {r && left > 0 && <SoonMochi>Speed up</SoonMochi>}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RECIPES.map((r) => {
          const why = canCraft(save, r);
          const locked = !!why;
          const owned = r.kind !== "furniture" && save.outfits.includes(r.id);
          const can = !locked && !owned && has(save, r.cost) && (r.time === 0 || freeSlot);
          return (
            <div key={r.id} className={`rounded-3xl border-4 border-ink bg-white p-3 shadow-[3px_3px_0_#161616] ${locked ? "opacity-55" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{locked ? "🔒" : r.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl leading-tight">{r.name}</p>
                  <p className="text-xs font-bold text-ink/60">
                    {r.kind === "furniture" ? "Furniture" : "Outfit"} · {r.time ? mmss(r.time * 1000) : "instant"}
                  </p>
                </div>
              </div>
              <p className="mt-2 font-display text-lg">{costText(r.cost)}</p>
              <button onClick={() => act({ type: "craft", recipe: r.id })} disabled={!can} className="btn mt-2 w-full py-1.5! text-base!">
                {locked ? `🔒 ${why}` : owned ? "Owned" : !has(save, r.cost) ? "Need materials" : r.time && !freeSlot ? "Workbench busy" : "Craft"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Pocket ----------
export function Pocket({ save, look, act }: { save: Save; look: MochiLook; act: (a: Action) => void }) {
  const [holding, setHolding] = useState<string | null>(null);
  const bag = Object.entries(save.items).filter(([, n]) => n > 0);
  const wardrobe = RECIPES.filter((r) => r.kind !== "furniture" && save.outfits.includes(r.id));
  const held = holding && (save.items[holding] ?? 0) > 0 ? holding : null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      <div className="chunk mx-auto w-full max-w-[560px] overflow-hidden p-0">
        {/* wall */}
        <div className="relative h-16 border-b-4 border-ink bg-[repeating-linear-gradient(90deg,#ffe5b4_0_28px,#ffd9a0_28px_56px)] sm:h-20">
          <span className="absolute top-3 left-4 text-3xl">🪟</span>
          <span className="absolute top-3 right-4 text-3xl">🖼️</span>
          <p className="absolute inset-x-0 bottom-1 text-center font-display text-lg">My Pocket</p>
        </div>
        {/* floor */}
        <div
          className="relative grid bg-[repeating-linear-gradient(0deg,#e8c39e_0_2px,#f3d6b3_2px_44px)] p-2 sm:p-3"
          style={{ gridTemplateColumns: `repeat(${POCKET.cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: POCKET.cols * POCKET.rows }, (_, i) => {
            const at = `${i % POCKET.cols},${Math.floor(i / POCKET.cols)}`;
            const id = save.pocket[at];
            const r = id && RECIPES.find((x) => x.id === id);
            return (
              <button
                key={at}
                onClick={() => (r ? act({ type: "pickup", at }) : held && act({ type: "place", recipe: held, at }))}
                className={`grid aspect-square place-items-center rounded-xl text-3xl transition sm:text-5xl ${
                  r ? "hover:-translate-y-1" : held ? "border-2 border-dashed border-ink/40 hover:bg-white/50" : ""
                }`}
                aria-label={r ? `Pick up ${r.name}` : held ? "Place here" : "Empty floor"}
                title={r ? `${r.name} (tap to pick up)` : undefined}
              >
                {r ? <span className="drop-shadow-[2px_3px_0_rgba(22,22,22,0.25)]">{r.icon}</span> : null}
              </button>
            );
          })}
          <div className="pointer-events-none absolute right-2 bottom-1 w-[22%] sm:right-4">
            <MochiArt look={look} className="spiral-float w-full drop-shadow-[3px_4px_0_rgba(22,22,22,0.25)]" viewBox="160 280 680 760" />
          </div>
        </div>
        <div className="flex items-center justify-between border-t-4 border-ink bg-white px-4 py-2">
          <p className="text-sm font-bold text-ink/60">{held ? "Tap a spot on the floor to place it" : "Tap furniture to pick it up"}</p>
          <SoonMochi>Expand with {TOKEN} soon</SoonMochi>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <p className="font-display text-2xl">🎒 Furniture</p>
          {bag.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-ink/60">Craft furniture to decorate your Pocket.</p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {bag.map(([id, n]) => {
                const r = RECIPES.find((x) => x.id === id)!;
                return (
                  <button
                    key={id}
                    onClick={() => setHolding(held === id ? null : id)}
                    className={`relative grid aspect-square place-items-center rounded-2xl border-[3px] border-ink text-4xl ${held === id ? "bg-[#ccffb2] shadow-[0_0_0_3px_#fff1a8]" : "bg-white"}`}
                    title={r.name}
                  >
                    {r.icon}
                    <span className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-white font-display text-xs">{n}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
        <Card>
          <p className="font-display text-2xl">👕 Wardrobe</p>
          {wardrobe.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-ink/60">Craft outfits to dress up your Mochi.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {wardrobe.map((r) => {
                const on = (r.kind === "head" && save.head === r.head) || (r.kind === "fit" && save.fit === r.fit);
                return (
                  <button
                    key={r.id}
                    onClick={() => act(on ? { type: "unwear", part: r.kind === "head" ? "head" : "fit" } : { type: "wear", recipe: r.id })}
                    className={`rounded-full border-[3px] border-ink px-3 py-1 font-display ${on ? "bg-ink text-white" : "bg-white"}`}
                  >
                    {r.icon} {r.name}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------- Villagers ----------
export function Villagers({ save, act }: { save: Save; act: (a: Action) => void }) {
  return (
    <div>
      <p className="mb-3 font-bold text-ink/70">New requests every day. Help out for XP and supplies.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {save.requests.map((r) => {
          const v = VILLAGERS[r.villager];
          const ok = has(save, r.want);
          return (
            <Card key={r.id} className={r.done ? "bg-[#ccffb2]!" : ""}>
              <p className="text-5xl">{v.icon}</p>
              <p className="mt-1 font-display text-2xl">{v.name}</p>
              <p className="text-sm font-semibold text-ink/70">
                “{v.line} {costText(r.want)}?”
              </p>
              <p className="mt-2 font-display text-lg">
                Reward: {costText(r.reward)} <span className="text-ink/50">+{r.xp} XP</span>
              </p>
              <button onClick={() => act({ type: "fulfil", request: r.id })} disabled={r.done || !ok} className="btn btn-pink mt-3 w-full py-1.5! text-base!">
                {r.done ? "Thank you! 💕" : ok ? "Give" : "Need materials"}
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Walking up to one villager: chat, hearts, gifts and their request
const CHAT = ["Lovely day for a wander!", "Have you tried fishing at the pond?", "The woods are full of good wood.", "I hear the cave glows at night…", "The festival is my favourite day!"];

export function Hearts({ n }: { n: number }) {
  return (
    <span className="tracking-wider" aria-label={`${n} of ${HEARTS_MAX} hearts`}>
      {Array.from({ length: HEARTS_MAX }, (_, i) => (i < n ? "❤️" : "🤍")).join("")}
    </span>
  );
}

export function VillagerTalk({ save, v, act }: { save: Save; v: number; act: (a: Action) => void }) {
  const who = VILLAGERS[v];
  const req = save.requests.find((r) => r.villager === v);
  const h = hearts(save, v);
  const giftedToday = save.gifted[v] === save.day;
  const [gift, setGift] = useState<Mat | null>(null);
  const owned = (Object.keys(MATS) as Mat[]).filter((m) => (save.mats[m] ?? 0) > 0);
  // Saying hello counts once a day
  useEffect(() => {
    act({ type: "talk", v });
  }, [act, v]);

  return (
    <div className="text-center">
      <p className="text-6xl">{who.icon}</p>
      <p className="mt-1 font-display text-3xl">{who.name}</p>
      <p className="text-lg">
        <Hearts n={h} />
      </p>
      <p className="text-xs font-bold text-ink/50">
        {(save.friends[v] ?? 0) % HEART}/{HEART} to the next heart
      </p>

      {!req ? (
        <p className="mt-3 font-semibold text-ink/70">“{CHAT[(v + save.day.length) % CHAT.length]}”</p>
      ) : req.done ? (
        <p className="mt-3 font-semibold text-ink/70">“Thank you so much! Come back tomorrow 💕”</p>
      ) : (
        <Card className="mt-3 bg-[#fff1a8]! text-left">
          <p className="font-semibold">“{who.line} {costText(req.want)}?”</p>
          <p className="mt-1 font-display text-lg">
            Reward: 🪙{req.coins} {costText(req.reward)} <span className="text-ink/50">+{req.xp} XP</span>
          </p>
          <button onClick={() => act({ type: "fulfil", request: req.id })} disabled={!has(save, req.want)} className="btn btn-pink mt-2 w-full py-1.5! text-base!">
            {has(save, req.want) ? "Give" : "Not enough yet"}
          </button>
        </Card>
      )}

      <div className="mt-4 text-left">
        <p className="font-display text-xl">🎁 Give a gift {giftedToday && <span className="text-sm text-ink/50">(one a day, done today)</span>}</p>
        {h >= 1 && <p className="text-xs font-bold text-ink/60">Loves {who.loves.map((m) => MATS[m].icon).join(" ")} · likes {who.likes.map((m) => MATS[m].icon).join(" ")}</p>}
        {owned.length === 0 ? (
          <p className="mt-1 text-sm font-semibold text-ink/60">Nothing to give yet.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {owned.map((m) => (
              <button key={m} disabled={giftedToday} onClick={() => setGift(m)} className={`rounded-full border-[3px] border-ink px-2 py-0.5 font-display ${gift === m ? "bg-[#ccffb2]" : "bg-white"} disabled:opacity-50`}>
                {MATS[m].icon} {save.mats[m]}
              </button>
            ))}
          </div>
        )}
        {gift && !giftedToday && (
          <button onClick={() => act({ type: "gift", v, mat: gift })} className="btn mt-2 w-full py-1.5! text-base!">
            Give {MATS[gift].icon} {MATS[gift].name}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- planting ----------
export function PlotMenu({ save, i, act, close }: { save: Save; i: number; act: (a: Action) => void; close: () => void }) {
  const { season } = calendar();
  const crops = seasonCrops();
  return (
    <div>
      <p className="font-display text-3xl">🌱 Plant a seed</p>
      <p className="text-sm font-bold text-ink/60">
        {SEASONS[season].icon} {SEASONS[season].name} seeds. Water after planting, then come back when it&apos;s grown.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {crops.map((c) => {
          const info = CROPS[c]!;
          const ok = save.coins >= info.seed;
          return (
            <button
              key={c}
              disabled={!ok}
              onClick={() => {
                act({ type: "plant", plot: i, crop: c });
                close();
              }}
              className="flex items-center gap-3 rounded-2xl border-4 border-ink bg-white p-3 text-left shadow-[3px_3px_0_#161616] disabled:opacity-50"
            >
              <span className="text-4xl">{MATS[c].icon}</span>
              <span className="flex-1">
                <span className="block font-display text-xl">{MATS[c].name}</span>
                <span className="text-sm font-bold text-ink/60">
                  🪙{info.seed} seed · grows in {Math.round(info.grow / 60)} min · sells 🪙{MATS[c].sell}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <SoonMochi>{MOCHI_SOON.rare} with {TOKEN} soon</SoonMochi>
        <SoonMochi>{MOCHI_SOON.plots} with {TOKEN} soon</SoonMochi>
      </div>
    </div>
  );
}

// ---------- the shipping bin ----------
export function SellMenu({ save, act }: { save: Save; act: (a: Action) => void }) {
  const { season, festival } = calendar();
  const owned = (Object.keys(MATS) as Mat[]).filter((m) => (save.mats[m] ?? 0) > 0);
  return (
    <div>
      <p className="font-display text-3xl">🪙 Shipping bin</p>
      <p className="text-sm font-bold text-ink/60">Sell what you gather and grow for coins. Coins buy seeds and build the village.</p>
      {owned.length === 0 ? (
        <p className="mt-4 font-semibold text-ink/60">Your bag is empty.</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {owned.map((m) => (
            <div key={m} className="flex items-center gap-3 rounded-2xl border-[3px] border-ink bg-white p-2">
              <span className="text-3xl">{MATS[m].icon}</span>
              <span className="flex-1">
                <span className="block font-display text-lg leading-tight">
                  {MATS[m].name} × {save.mats[m]}
                </span>
                <span className="text-xs font-bold text-ink/60">🪙{MATS[m].sell} each</span>
              </span>
              <button onClick={() => act({ type: "sell", mat: m, n: 1 })} className="btn px-3! py-1! text-sm!">
                Sell 1
              </button>
              <button onClick={() => act({ type: "sell", mat: m, n: save.mats[m] ?? 0 })} className="btn btn-pink px-3! py-1! text-sm!">
                All
              </button>
            </div>
          ))}
        </div>
      )}
      <Card className="mt-4 bg-[#e2d4ff]!">
        <p className="font-display text-xl">
          {SEASONS[season].icon} {festival ? `${SEASONS[season].festival} shop` : "Seasonal shop"}
        </p>
        <p className="text-sm font-semibold text-ink/70">Rare outfits, furniture and seeds for this season.</p>
        <div className="mt-2">
          <SoonMochi>Opens with {TOKEN} soon</SoonMochi>
        </div>
      </Card>
    </div>
  );
}

// ---------- building the village ----------
export function ProjectMenu({ save, id, act }: { save: Save; id: string; act: (a: Action) => void }) {
  const p = PROJECTS.find((x) => x.id === id)!;
  const cur = save.projects[id] ?? { paid: {}, coins: 0 };
  const done = built(save, id);
  const parts = Object.entries(p.cost) as [Mat, number][];
  const canAdd = !done && save.level >= p.level && (parts.some(([m, n]) => (cur.paid[m] ?? 0) < n && (save.mats[m] ?? 0) > 0) || (cur.coins < p.coins && save.coins > 0));
  return (
    <div>
      <p className="text-5xl">{p.icon}</p>
      <p className="mt-1 font-display text-3xl">{p.name}</p>
      <p className="font-semibold text-ink/70">{p.perk}.</p>
      {done ? (
        <p className="mt-4 rounded-2xl border-4 border-ink bg-[#ccffb2] p-3 font-display text-2xl">Built! ✨</p>
      ) : (
        <>
          {save.level < p.level && <p className="mt-3 font-display text-lg text-[#c2185b]">Reach level {p.level} to start building.</p>}
          {parts.map(([m, n]) => (
            <Progress key={m} label={`${MATS[m].icon} ${MATS[m].name}: ${Math.min(cur.paid[m] ?? 0, n)}/${n} (you have ${save.mats[m] ?? 0})`} value={Math.min(1, (cur.paid[m] ?? 0) / n)} />
          ))}
          <Progress label={`🪙 Coins: ${cur.coins}/${p.coins} (you have ${save.coins})`} value={Math.min(1, cur.coins / p.coins)} />
          <button onClick={() => act({ type: "fund", project: id })} disabled={!canAdd} className="btn btn-pink mt-4 w-full py-2! text-lg!">
            Put in what I have
          </button>
          <div className="mt-2 text-center">
            <SoonMochi>
              {MOCHI_SOON.finishNow} with {TOKEN} soon
            </SoonMochi>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- visiting Pockets and Pocket of the week ----------
type ShowPocket = { handle: string; name: string; look: Record<string, string>; pocket: Record<string, string>; level: number };
type PocketList = { week: string; top: { handle: string; votes: number }[]; recent: string[]; voted: string | null };

export function PocketView({ show }: { show: ShowPocket }) {
  const look = { skin: "blush", face: "sparkle", aura: "none", head: "none", fit: "tee", ...show.look, bg: "none" } as MochiLook;
  return (
    <div className="chunk mx-auto w-full max-w-[460px] overflow-hidden p-0">
      <div className="relative h-12 border-b-4 border-ink bg-[repeating-linear-gradient(90deg,#ffe5b4_0_28px,#ffd9a0_28px_56px)]">
        <p className="absolute inset-x-0 bottom-1 text-center font-display text-lg">
          {show.name}&apos;s Pocket <span className="text-ink/50">· Lv {show.level}</span>
        </p>
      </div>
      <div className="relative grid bg-[repeating-linear-gradient(0deg,#e8c39e_0_2px,#f3d6b3_2px_44px)] p-2" style={{ gridTemplateColumns: `repeat(${POCKET.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: POCKET.cols * POCKET.rows }, (_, i) => {
          const at = `${i % POCKET.cols},${Math.floor(i / POCKET.cols)}`;
          const r = show.pocket[at] && RECIPES.find((x) => x.id === show.pocket[at]);
          return (
            <div key={at} className="grid aspect-square place-items-center text-3xl sm:text-4xl">
              {r ? r.icon : null}
            </div>
          );
        })}
        <div className="pointer-events-none absolute right-2 bottom-1 w-[22%]">
          <MochiArt look={look} className="w-full" viewBox="160 280 680 760" />
        </div>
      </div>
    </div>
  );
}

export function Pockets({ signedIn, me }: { signedIn: boolean; me?: string }) {
  const [list, setList] = useState<PocketList | null>(null);
  const [open, setOpen] = useState<{ show: ShowPocket; votes: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = () =>
    fetch("/api/pockets")
      .then((r) => r.json())
      .then((d: PocketList) => setList(d))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);
  const visit = async (h: string) => {
    setMsg(null);
    const d = await fetch(`/api/pockets?h=${encodeURIComponent(h)}`).then((r) => r.json());
    if (d.pocket) setOpen({ show: d.pocket, votes: d.votes ?? 0 });
    else setMsg(d.error ?? "Couldn't open that Pocket.");
  };
  const vote = async (h: string) => {
    const d = await fetch("/api/pockets/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ h }) }).then((r) => r.json());
    if (d.ok) {
      setMsg("Vote counted! 💖");
      setOpen((o) => (o ? { ...o, votes: d.votes } : o));
      load();
    } else setMsg(d.error ?? "Couldn't vote.");
  };

  if (open)
    return (
      <div className="text-center">
        <button onClick={() => setOpen(null)} className="mb-3 text-sm font-bold underline">
          ← All Pockets
        </button>
        <PocketView show={open.show} />
        <p className="mt-3 font-display text-xl">💖 {open.votes} {open.votes === 1 ? "vote" : "votes"} this week</p>
        {open.show.handle.toLowerCase() !== me?.toLowerCase() && (
          <button onClick={() => vote(open.show.handle)} disabled={!signedIn || !!list?.voted} className="btn btn-pink mt-2 w-full max-w-[460px] py-2! text-lg!">
            {!signedIn ? "Connect X to vote" : list?.voted ? "You've voted this week" : "Vote for Pocket of the week"}
          </button>
        )}
        {msg && <p className="mt-2 font-bold">{msg}</p>}
      </div>
    );

  const winner = list?.top[0];
  return (
    <div>
      <p className="font-display text-3xl">🏡 Visit Pockets</p>
      <p className="text-sm font-bold text-ink/60">Peek inside other players&apos; Pockets and vote for Pocket of the week. One vote a week.</p>
      {!signedIn && <p className="mt-2 rounded-2xl border-[3px] border-ink bg-[#fff1a8] px-3 py-2 text-sm font-bold">Connect your X to show your own Pocket and vote.</p>}
      {msg && <p className="mt-2 font-bold">{msg}</p>}
      {!list ? (
        <p className="mt-4 font-display text-xl text-ink/50">Loading…</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Card className="gtd-card!">
            <p className="font-display text-2xl">👑 Pocket of the week</p>
            {winner ? (
              <button onClick={() => visit(winner.handle)} className="mt-2 w-full rounded-2xl border-[3px] border-ink bg-white p-3 text-left font-display text-xl">
                @{winner.handle} <span className="text-ink/50">· 💖 {winner.votes}</span>
              </button>
            ) : (
              <p className="mt-2 font-semibold">No votes yet this week. Be the first!</p>
            )}
            <div className="mt-3 space-y-1">
              {list.top.slice(1).map((t, i) => (
                <button key={t.handle} onClick={() => visit(t.handle)} className="flex w-full justify-between rounded-xl bg-white/80 px-3 py-1 font-bold">
                  <span>
                    {i + 2}. @{t.handle}
                  </span>
                  <span>💖 {t.votes}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <p className="font-display text-2xl">✨ Recently decorated</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {list.recent.length === 0 && <p className="font-semibold text-ink/60">Nobody yet.</p>}
              {list.recent.map((h) => (
                <button key={h} onClick={() => visit(h)} className="rounded-full border-[3px] border-ink bg-white px-3 py-1 font-display">
                  @{h}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------- carving a path into the next Frontier world ----------
export function CarveMenu({ save, to, act }: { save: Save; to: number; act: (a: Action) => void }) {
  const ready = to === save.carved + 1;
  const c = carveCost(to);
  const b = biomeFor(to);
  const parts = Object.entries(c.cost) as [Mat, number][];
  const paid = save.carving.paid;
  const canAdd = ready && save.level >= c.level && (parts.some(([m, n]) => (paid[m] ?? 0) < n && (save.mats[m] ?? 0) > 0) || (save.carving.coins < c.coins && save.coins > 0));
  return (
    <div className="text-center">
      <p className="text-5xl">{MATS[b.mat].icon}</p>
      <p className="mt-1 font-display text-3xl">The path to {frontierName(to)}</p>
      <p className="font-semibold text-ink/70">
        {b.blurb} Home of {MATS[b.mat].icon} {MATS[b.mat].name}. Gather what it takes to carve the way through.
      </p>
      {!ready ? (
        <p className="mt-4 font-display text-lg">Carve the path to {frontierName(save.carved + 1)} first.</p>
      ) : (
        <div className="text-left">
          {save.level < c.level && <p className="mt-3 text-center font-display text-lg text-[#c2185b]">Reach level {c.level} to start carving.</p>}
          {parts.map(([m, n]) => (
            <Progress key={m} label={`${MATS[m].icon} ${MATS[m].name}: ${Math.min(paid[m] ?? 0, n)}/${n} (you have ${save.mats[m] ?? 0})`} value={Math.min(1, (paid[m] ?? 0) / n)} />
          ))}
          <Progress label={`🪙 Coins: ${save.carving.coins}/${c.coins} (you have ${save.coins})`} value={Math.min(1, save.carving.coins / c.coins)} />
          <button onClick={() => act({ type: "carve" })} disabled={!canAdd} className="btn btn-pink mt-4 w-full py-2! text-lg!">
            🔨 Put in what I have
          </button>
          <div className="mt-2 text-center">
            <SoonMochi>
              {MOCHI_SOON.finishNow} with {TOKEN} soon
            </SoonMochi>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Goals: Bloom, Trials, Collection, Village ----------
type GoalTab = "bloom" | "trials" | "log" | "village";

export function Goals({ save, act, trialLeft, startTrial }: { save: Save; act: (a: Action) => void; trialLeft: number; startTrial: () => void }) {
  const [tab, setTab] = useState<GoalTab>("village");
  const cal = calendar();
  const trial = trialFor(cal.week);
  const best = save.trial.week === cal.week ? save.trial.best : 0;
  const tabs: [GoalTab, string][] = [
    ["village", "🏘️ Village"],
    ["bloom", "🌸 Bloom"],
    ["trials", "🏆 Trials"],
    ["log", "📖 Collection"],
  ];
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-full border-[3px] border-ink px-3 py-1 font-display ${tab === id ? "bg-ink text-white" : "bg-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "village" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {PROJECTS.map((p) => {
            const done = built(save, p.id);
            return (
              <div key={p.id} className={`rounded-2xl border-[3px] border-ink p-3 ${done ? "bg-[#ccffb2]" : "bg-white"}`}>
                <p className="font-display text-xl">
                  {p.icon} {p.name} {done ? "✓" : save.level < p.level ? `· Lv ${p.level}` : ""}
                </p>
                <p className="text-sm font-semibold text-ink/70">{p.perk}</p>
              </div>
            );
          })}
          <div className="rounded-2xl border-[3px] border-ink bg-white p-3 sm:col-span-2">
            <p className="font-display text-xl">Villagers</p>
            <div className="mt-1 flex flex-wrap gap-3">
              {VILLAGERS.map((v, i) => (
                <span key={v.name} className={`text-sm font-bold ${residents(save).includes(i) ? "" : "opacity-40"}`}>
                  {v.icon} {v.name} <Hearts n={hearts(save, i)} />
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "bloom" && (
        <Card className="gtd-card!">
          <p className="font-display text-3xl">🌸 Bloom</p>
          <p className="text-sm font-semibold">Reach level {BLOOM.level} and gather the right materials to unlock your Mochi&apos;s new form.</p>
          <Progress label={`Level ${save.level} / ${BLOOM.level}`} value={Math.min(1, save.level / BLOOM.level)} />
          {(Object.entries(BLOOM.cost) as [Mat, number][]).map(([m, n]) => (
            <Progress key={m} label={`${MATS[m].icon} ${Math.min(save.mats[m] ?? 0, n)} / ${n}`} value={Math.min(1, (save.mats[m] ?? 0) / n)} />
          ))}
          <button disabled className="btn mt-3 w-full py-2! text-lg!">
            {MOCHI_SOON.bloom} opens with {TOKEN} soon
          </button>
        </Card>
      )}

      {tab === "trials" && (
        <Card>
          <p className="font-display text-3xl">
            {trial.icon} {trial.name}
          </p>
          <p className="text-sm font-semibold text-ink/70">
            This week&apos;s Trial: {trial.blurb} You have {TRIAL_SECONDS} seconds. Skill only.
          </p>
          <p className="mt-2 font-display text-2xl">Your best this week: {best}</p>
          <div className="mt-2 flex gap-2">
            {TRIAL_BADGES.map((b) => {
              const got = save.trial.badges.includes(`${cal.week}:${trial.id}:${b.name}`);
              return (
                <span key={b.name} className={`rounded-full border-[3px] border-ink bg-white px-2 py-0.5 font-display ${got ? "" : "opacity-40"}`}>
                  {b.icon} {b.at}+
                </span>
              );
            })}
          </div>
          <button onClick={startTrial} disabled={trialLeft > 0} className="btn btn-pink mt-4 w-full py-2! text-lg!">
            {trialLeft > 0 ? `Trial running: ${Math.ceil(trialLeft / 1000)}s` : "Start the Trial"}
          </button>
          <div className="mt-2 text-center">
            <SoonMochi>
              {MOCHI_SOON.trials} with {TOKEN} soon
            </SoonMochi>
          </div>
        </Card>
      )}

      {tab === "log" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="font-display text-xl">
              🐟 Fish {save.log.fish.length}/{ALL_FISH.length}
            </p>
            <ul className="mt-1 text-sm font-bold">
              {ALL_FISH.map((f) => (
                <li key={f} className={save.log.fish.includes(f) ? "" : "text-ink/30"}>
                  {save.log.fish.includes(f) ? "✓" : "?"} {save.log.fish.includes(f) ? f : "???"}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <p className="font-display text-xl">
              🌱 Crops {save.log.crops.length}/{Object.keys(CROPS).length}
            </p>
            <p className="mt-1 text-2xl">{(Object.keys(CROPS) as Mat[]).map((c) => (save.log.crops.includes(c) ? MATS[c].icon : "❔")).join(" ")}</p>
            <p className="mt-3 font-display text-xl">⛏️ Deepest cave floor: {save.caveBest || "—"}</p>
            <p className="mt-1 font-display text-xl">🗺️ Furthest world: {save.frontierBest ? `${save.frontierBest}. ${frontierName(save.frontierBest)}` : "—"}</p>
            <p className="text-2xl">{BIOMES.map((b, i) => (save.frontierBest > i ? MATS[b.mat].icon : "❔")).join(" ")}</p>
            <p className="mt-3 text-sm font-bold text-ink/60">
              Gathered: {GATHERED.map((m) => MATS[m].icon).join(" ")} · {save.stats.runs} runs · {save.stats.crafted} crafted · {save.stats.requests} requests
            </p>
            <Link href="/#builder" className="btn mt-3 w-full py-1.5! text-base!">
              Change my Mochi&apos;s look
            </Link>
            <button onClick={() => confirm("Start over? Your village and progress will be wiped.") && act({ type: "reset" })} className="mt-2 w-full text-sm font-bold text-ink/50 underline">
              Start over
            </button>
          </Card>
        </div>
      )}
      {!zoneOpen(save, "meadow") && tab === "village" && <p className="mt-3 text-sm font-bold text-ink/60">Tip: build the Meadow Gate to reach Cotton Meadow.</p>}
    </div>
  );
}

export function Progress({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-3">
      <p className="font-display text-base">{label}</p>
      <div className="mt-1 h-3 overflow-hidden rounded-full border-[3px] border-ink bg-white">
        <div className={`h-full ${value >= 1 ? "bg-[#3ecf6e]" : "meter-fill"}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
