"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  AURAS,
  BACKGROUNDS,
  MochiArt,
  FACES,
  FITS,
  HEADS,
  SKINS,
  type MochiLook,
} from "./MochiArt";
import { burst, burstFrom } from "@/lib/burst";
import { X_HANDLE } from "@/lib/mochi";
import { AIRDROP_VOTES } from "@/lib/mochi";
import { downloadMyMochi, setMyMochiName, useMyMochi } from "@/lib/myMochi";
import { useSession } from "./Session";
import { useWall } from "./WallContext";

type Tab = keyof MochiLook;

const TABS: { key: Tab; label: string; options: readonly string[] }[] = [
  { key: "face", label: "Face", options: FACES },
  { key: "head", label: "Head", options: HEADS },
  { key: "fit", label: "Fit", options: FITS },
  { key: "aura", label: "Aura", options: AURAS },
  { key: "skin", label: "Skin", options: Object.keys(SKINS) },
  { key: "bg", label: "Backdrop", options: Object.keys(BACKGROUNDS) },
];

const SWATCH: Partial<Record<Tab, Record<string, string>>> = { skin: SKINS, bg: BACKGROUNDS };

const FIRST = ["Lil", "Big", "Sir", "Baby", "DJ", "Cap'n", "Mx", "Tiny", "Lord", "Auntie"];
const LAST = ["Squish", "Mochi", "Bloop", "Noodle", "Puff", "Bean", "Dumpling", "Wobble", "Pudding", "Bun"];

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const randomName = () => `${pick(FIRST)} ${pick(LAST)}`;
const pretty = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const START: MochiLook = { skin: "blush", face: "sparkle", head: "halo", fit: "jersey", aura: "hearts", bg: "lime" };

// Puts the Mochi on the gallery wall. Shows what's missing until it can.
function DisplayButton({ look, name, from }: { look: MochiLook; name: string; from: React.RefObject<HTMLDivElement | null> }) {
  const { entry } = useSession();
  const { on, me, refresh } = useWall();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!on) return null;

  const show = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/gallery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, look }),
    });
    const d = await res.json().catch(() => ({ error: "Something went wrong. Please try again." }));
    setBusy(false);
    if (d.error) return setError(d.error);
    if (from.current) burstFrom(from.current, "hearts", 12);
    refresh();
  };

  return (
    <div className="mt-4 rounded-2xl border-4 border-ink bg-[#ccffb2] p-3">
      <p className="text-sm font-bold">
        Put your Mochi in the gallery. {AIRDROP_VOTES} votes secures a free airdrop.
      </p>
      <div className="mt-2">
        {me?.displayed ? (
          <Link href="/gallery" className="btn px-4! py-1.5! text-base!">
            See it in the gallery
          </Link>
        ) : !entry ? (
          <a href="#join" className="btn px-4! py-1.5! text-base!">
            Connect X first
          </a>
        ) : !entry.wallet ? (
          <a href="#join" className="btn px-4! py-1.5! text-base!">
            Add your wallet first
          </a>
        ) : (
          <button onClick={show} disabled={busy} className="btn btn-pink px-4! py-1.5! text-base!">
            {busy ? "Hanging it up…" : "Put it in the gallery"}
          </button>
        )}
      </div>
      {!me?.displayed && entry?.wallet && <p className="mt-2 text-xs font-semibold text-ink/70">You get one spot, and it can&apos;t be changed after, so make it count.</p>}
      {error && <p className="mt-2 text-sm font-bold text-[#c2185b]">{error}</p>}
    </div>
  );
}

export function Builder() {
  const [look, setLook] = useState<MochiLook>(START);
  const [tab, setTab] = useState<Tab>("face");
  const { name } = useMyMochi();
  const setName = (n: string) => setMyMochiName(n);
  const [bump, setBump] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  const set = (key: Tab, value: string, from?: HTMLElement) => {
    setLook((l) => ({ ...l, [key]: value }));
    setMyMochiName(name);
    setBump((n) => n + 1);
    if (from) burstFrom(from, "sparkles", 5);
  };

  const shuffle = () => {
    setLook({
      skin: pick(Object.keys(SKINS)) as MochiLook["skin"],
      face: pick(FACES),
      head: pick(HEADS),
      fit: pick(FITS),
      aura: pick(AURAS),
      bg: pick(Object.keys(BACKGROUNDS)) as MochiLook["bg"],
    });
    setName(randomName());
    setBump((n) => n + 1);
    if (stage.current) burstFrom(stage.current, "stars", 10);
  };

  const download = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const { clientX, clientY } = e;
    if (await downloadMyMochi(name)) burst(clientX, clientY, "hearts", 8);
  };

  const current = TABS.find((t) => t.key === tab)!;
  const shareText = encodeURIComponent(`Meet ${name || "my Mochi"}, the Mochi I made 🩷 ${X_HANDLE}`);

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 md:grid-cols-[1fr_1fr]">
      <div className="flex flex-col items-center gap-3">
        <div ref={stage} className="chunk relative aspect-square w-full max-w-[240px] overflow-hidden p-0! md:max-w-md">
          <div key={bump} className="pop-in h-full w-full">
            <MochiArt look={look} className="h-full w-full" title={name} svgId="builder-mochi" />
          </div>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          aria-label="Name your Mochi"
          className="chunk w-full max-w-[240px] rounded-full! px-5 py-1 text-center font-display text-2xl md:max-w-md md:py-2 md:text-3xl outline-none focus:-rotate-1"
        />
      </div>

      <div className="chunk flex flex-col p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-5xl text-pink" style={{ textShadow: "3px 3px 0 #161616" }}>
              Make a Mochi
            </h2>
            <p className="mt-1 font-semibold text-ink/75">Mix and match, name it, take it home as a PFP.</p>
          </div>
          {/* Live mini preview on phones, where the big one scrolls out of view */}
          <div key={bump} className="pop-in h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-ink md:hidden">
            <MochiArt look={look} className="h-full w-full" title={name} svgId="builder-mini" viewBox="130 300 740 700" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full border-4 border-ink px-4 py-1 font-display text-lg transition active:scale-90 ${
                tab === t.key ? "bg-ink text-white" : "bg-white hover:-rotate-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div key={tab} className="pop-in mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {current.options.map((opt) => {
            const active = look[tab] === opt;
            const swatch = SWATCH[tab]?.[opt];
            return (
              <button
                key={opt}
                onClick={(e) => set(tab, opt, e.currentTarget)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1 rounded-2xl border-4 px-2 py-2 text-sm font-extrabold transition active:scale-90 ${
                  active ? "border-ink bg-pink text-white shadow-[3px_3px_0_#161616]" : "border-ink/20 bg-white hover:border-ink"
                }`}
              >
                {swatch && <span className="h-7 w-7 rounded-full border-[3px] border-ink" style={{ background: swatch }} />}
                {pretty(opt)}
              </button>
            );
          })}
        </div>

        <div className="mt-auto flex flex-wrap gap-2.5 pt-6">
          <button onClick={shuffle} className="btn px-4! text-lg!">
            🎲 Shuffle
          </button>
          <button onClick={download} className="btn btn-pink px-4! text-lg!">
            Download PNG
          </button>
          <a
            href={`https://x.com/intent/post?text=${shareText}`}
            target="_blank"
            rel="noreferrer"
            className="btn px-4! text-lg!"
          >
            Post it
          </a>
        </div>
        <DisplayButton look={look} name={name} from={stage} />
        <p className="mt-3 text-xs font-semibold text-ink/60">Fan-made preview traits. Real collection traits may differ.</p>
      </div>
    </div>
  );
}
