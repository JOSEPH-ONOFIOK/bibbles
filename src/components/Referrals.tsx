"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X_HANDLE } from "@/lib/mochi";
import { SITE_URL } from "@/lib/site";
import { useSession } from "./Session";
import { useWall } from "./WallContext";

// Each person's own link: the site's address with their handle on the end
export function InviteLink({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${SITE_URL}/?ref=${handle.toLowerCase()}`;
  const text = encodeURIComponent(`Come make a Mochi with me 🩷 ${X_HANDLE}\n\n${link}`);

  const copy = async () => {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl border-4 border-ink bg-[#fff1a8] p-3">
      <p className="text-sm font-extrabold">Your invite link</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <code className="min-w-0 flex-1 truncate rounded-xl border-[3px] border-ink bg-white px-3 py-2 font-mono text-sm">{link}</code>
        <div className="flex gap-2">
          <button onClick={copy} className="btn flex-1 px-4! py-1.5! text-base!">
            {copied ? "Copied" : "Copy"}
          </button>
          <a href={`https://x.com/intent/post?text=${text}`} target="_blank" rel="noreferrer" className="btn btn-pink flex-1 px-4! py-1.5! text-base!">
            Share
          </a>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-ink/70">A friend counts once they connect X and add their wallet. Friends on your own connection don&apos;t count.</p>
    </div>
  );
}

// Shown once, right after someone saves their wallet for the first time
export function InvitePopup({ handle, onClose }: { handle: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
      aria-labelledby="invite-title"
      className="chunk pop-in m-auto w-[min(92vw,30rem)] p-5 text-ink backdrop:bg-ink/60 sm:p-6"
    >
      <h2 id="invite-title" className="text-center font-display text-4xl text-pink" style={{ textShadow: "2px 2px 0 #161616" }}>
        Here&apos;s your referral link
      </h2>
      <p className="mt-2 text-center font-bold">Invite friends to join the Top Recruiters and secure one of multiple GTD free mint spots.</p>
      <div className="mt-4">
        <InviteLink handle={handle} />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href="/leaderboard" onClick={() => dialog.current?.close()} className="btn btn-pink px-4! py-1.5! text-base!">
          See Top Recruiters
        </Link>
        <button onClick={() => dialog.current?.close()} className="btn px-4! py-1.5! text-base!">
          Close
        </button>
      </div>
    </dialog>
  );
}

export function Referrals() {
  const { entry } = useSession();
  const { on, ready, top, me } = useWall();

  return (
    <div className="mx-auto max-w-3xl px-4">
      <div className="text-center">
        <h1 className="font-display text-6xl text-white" style={{ textShadow: "4px 4px 0 #161616" }}>
          Top Recruiters
        </h1>
        <p className="mt-2 font-bold text-white">Bring the most friends to the Mochis and secure one of multiple GTD free mint spots.</p>
      </div>

      <div className="chunk mt-8 p-5 sm:p-8">
        {!ready ? (
          <p className="text-center font-display text-2xl text-ink/50">Loading…</p>
        ) : !on ? (
          <p className="text-center font-display text-2xl">The leaderboard opens soon.</p>
        ) : (
          <>
            {entry?.wallet ? (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl border-4 border-ink bg-[#e2d4ff] py-2">
                    <p className="font-display text-3xl">{me?.count ?? 0}</p>
                    <p className="text-sm font-bold">Friends invited</p>
                  </div>
                  <div className="rounded-2xl border-4 border-ink bg-[#bfe3ff] py-2">
                    <p className="font-display text-3xl">{me?.rank ? `#${me.rank}` : "—"}</p>
                    <p className="text-sm font-bold">Your rank</p>
                  </div>
                </div>
                <InviteLink handle={entry.handle} />
              </>
            ) : (
              <p className="rounded-2xl border-4 border-ink bg-[#fff1a8] px-4 py-3 text-center font-bold">
                Add your wallet in the{" "}
                <Link href="/#join" className="underline decoration-2 underline-offset-2">
                  Join tasks
                </Link>{" "}
                to get your invite link.
              </p>
            )}

            {top.length ? (
              <ol className="mt-5 flex flex-col gap-2">
                {top.map((r, i) => {
                  const you = r.handle.toLowerCase() === entry?.handle.toLowerCase();
                  return (
                    <li key={r.handle} className={`flex items-center gap-3 rounded-2xl border-4 border-ink px-3 py-1.5 ${you ? "bg-[#ccffb2]" : "bg-white"}`}>
                      <span className="w-9 shrink-0 text-center font-display text-xl">{i + 1}</span>
                      <a href={`https://x.com/${r.handle}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-bold hover:underline">
                        @{r.handle}
                      </a>
                      {you && <span className="text-xs font-extrabold">You</span>}
                      <span className="font-display text-xl tabular-nums">{r.count}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-5 text-center font-bold text-ink/60">Nobody here yet. Be the first to bring a friend.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
