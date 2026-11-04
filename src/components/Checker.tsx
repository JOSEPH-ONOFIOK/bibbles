"use client";

import { useRef, useState } from "react";
import { MochiArt, type MochiLook } from "./MochiArt";
import { burstFrom } from "@/lib/burst";
import { X_HANDLE, X_URL } from "@/lib/mochi";

type Mood = "idle" | "typing" | "checking" | "in" | "out" | "invalid";

const LOOKS: Record<Mood, MochiLook> = {
  idle: { skin: "mint", face: "sparkle", head: "none", fit: "hoodie", aura: "sparkles", bg: "none" },
  typing: { skin: "mint", face: "deadpan", head: "none", fit: "hoodie", aura: "none", bg: "none" },
  checking: { skin: "mint", face: "dizzy", head: "none", fit: "hoodie", aura: "none", bg: "none" },
  in: { skin: "mint", face: "happy", head: "crown", fit: "hoodie", aura: "hearts", bg: "none" },
  out: { skin: "mint", face: "squint", head: "none", fit: "hoodie", aura: "puffs", bg: "none" },
  invalid: { skin: "mint", face: "shook", head: "none", fit: "hoodie", aura: "none", bg: "none" },
};

const LINES: Record<Mood, string> = {
  idle: "Paste your wallet. I'll check the list!",
  typing: "Hmm. Go on…",
  checking: "Checking the list…",
  in: "YOU'RE IN! Welcome to the Mochis.",
  out: "Not on the list yet. Stick around, more spots are coming.",
  invalid: "Huh? That doesn't look like a wallet address.",
};

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Checker() {
  const [address, setAddress] = useState("");
  const [mood, setMood] = useState<Mood>("idle");
  const [bump, setBump] = useState(0);
  const art = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  const react = (next: Mood) => {
    setMood(next);
    setBump((n) => n + 1);
  };

  const shake = () => {
    const el = card.current;
    if (!el) return;
    el.classList.remove("shake");
    void el.getBoundingClientRect();
    el.classList.add("shake");
  };

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = address.trim();
    if (!ADDRESS.test(value)) {
      react("invalid");
      shake();
      return;
    }
    react("checking");
    try {
      // Hold the dizzy face a beat so the reveal lands.
      const [res] = await Promise.all([
        fetch("/api/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address: value }),
        }),
        wait(1100),
      ]);
      const { status } = (await res.json()) as { status: "in" | "out" | "invalid" };
      react(status);
      if (status === "in" && art.current) {
        burstFrom(art.current, "hearts", 14);
        setTimeout(() => art.current && burstFrom(art.current, "stars", 10), 180);
      } else {
        if (status === "out" && art.current) burstFrom(art.current, "puffs", 7);
        shake();
      }
    } catch {
      react("idle");
    }
  };

  const shareText = encodeURIComponent(`I'm on the Mochis list 🩷 ${X_HANDLE}`);

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 md:grid-cols-[1fr_1.1fr]">
      <div className="relative mx-auto w-full max-w-sm">
        <div className="chunk relative mb-4 px-5 py-4 text-center font-display text-2xl leading-tight">
          <span key={mood + bump} className="pop-in inline-block">
            {LINES[mood]}
          </span>
          <span className="absolute -bottom-[14px] left-1/2 h-6 w-6 -translate-x-1/2 rotate-45 border-r-4 border-b-4 border-ink bg-paper" />
        </div>
        <div ref={art} className="relative aspect-[740/700]">
          <div key={bump} className="pop-in absolute inset-0">
            <MochiArt look={LOOKS[mood]} className="h-full w-full" title={`Mochi looking ${mood}`} svgId="checker-mochi" viewBox="130 300 740 700" />
          </div>
        </div>
      </div>

      <div ref={card} className="chunk p-6 sm:p-8">
        <h2 className="font-display text-5xl text-pink" style={{ textShadow: "3px 3px 0 #161616" }}>
          Am I in?
        </h2>
        <p className="mt-2 font-semibold text-ink/75">Drop the wallet you signed up with. The Mochi will tell you how it went.</p>
        <form onSubmit={check} className="mt-6 flex flex-col gap-3">
          <label htmlFor="wallet" className="sr-only">
            Wallet address
          </label>
          <input
            id="wallet"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (mood !== "checking" && mood !== "typing") react("typing");
            }}
            onBlur={() => !address && mood === "typing" && react("idle")}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-2xl border-4 border-ink bg-white px-4 py-3 font-mono text-base outline-none transition focus:-rotate-[0.5deg] focus:shadow-[4px_4px_0_#cf4f9c]"
          />
          <button type="submit" disabled={mood === "checking"} className="btn btn-pink self-start">
            {mood === "checking" ? (
              <>
                <svg viewBox="0 0 40 40" className="spin h-5 w-5" aria-hidden>
                  <path d="M20 20 m0 -3 a3 3 0 1 1 -3 3 a7 7 0 1 1 7 7 a11 11 0 1 1 -11 -11 a15 15 0 1 1 15 15" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
                Checking…
              </>
            ) : (
              "Check"
            )}
          </button>
        </form>

        {mood === "in" && (
          <div className="pop-in mt-6 rounded-2xl border-4 border-ink bg-[#ccffb2] p-4">
            <p className="font-display text-2xl">You&apos;re on the list.</p>
            <p className="text-sm font-semibold">Tell the timeline. Mochis love attention.</p>
            <a
              href={`https://x.com/intent/post?text=${shareText}&url=${encodeURIComponent(X_URL)}`}
              target="_blank"
              rel="noreferrer"
              className="btn mt-3 text-base!"
            >
              Share on X
            </a>
          </div>
        )}
        {mood === "out" && (
          <div className="pop-in mt-6 rounded-2xl border-4 border-ink bg-[#ffe5b4] p-4">
            <p className="font-display text-2xl">Not yet!</p>
            <p className="text-sm font-semibold">Follow {X_HANDLE} so you don&apos;t miss the next spots.</p>
            <a href={X_URL} target="_blank" rel="noreferrer" className="btn mt-3 text-base!">
              Follow {X_HANDLE}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
