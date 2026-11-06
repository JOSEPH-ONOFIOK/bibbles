"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "./Session";
import { FEATURED, X_HANDLE, X_URL } from "@/lib/mochi";
import { burstFrom } from "@/lib/burst";
import { PINNED_ID, PINNED_POST, TASK_ORDER, WALLET, isComplete, type TaskId } from "@/lib/entry";
import { downloadMyMochi, readInvite, useMyMochi } from "@/lib/myMochi";
import { InviteLink } from "./Referrals";
import { useWall } from "./WallContext";

const US = X_HANDLE.replace("@", "");

const openX = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
const intent = (path: string, params: Record<string, string>) => `https://x.com/intent/${path}?${new URLSearchParams(params)}`;

function XLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// One numbered task card
function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const was = useRef(done);
  useEffect(() => {
    if (done && !was.current && ref.current) burstFrom(ref.current.querySelector("[data-badge]")!, "stars", 8);
    was.current = done;
  }, [done]);

  return (
    <div
      ref={ref}
      className={`rounded-3xl border-4 border-ink p-4 transition sm:p-5 ${done ? "bg-[#ccffb2]" : "bg-white shadow-[4px_4px_0_#161616]"}`}
    >
      <div className="flex items-center gap-3">
        <span
          data-badge
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-4 border-ink font-display text-xl ${
            done ? "pop-in bg-ink text-[#ccffb2]" : "bg-pink text-white"
          }`}
        >
          {done ? <Check /> : n}
        </span>
        <h3 className="font-display text-2xl leading-tight">{title}</h3>
      </div>
      <div className="mt-3 pl-0 sm:pl-[52px]">{children}</div>
    </div>
  );
}

// Link input + verify button, shared by the two post tasks
function LinkProof({
  task,
  placeholder,
  disabled,
}: {
  task: TaskId;
  placeholder: string;
  disabled?: boolean;
}) {
  const { task: run } = useSession();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await run({ task, link });
    setBusy(false);
    if (r.error) setError(r.error);
  };

  return (
    <form onSubmit={verify} className="mt-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-2xl border-4 border-ink bg-white px-3 py-2 text-sm outline-none focus:shadow-[3px_3px_0_#cf4f9c] disabled:opacity-50"
        />
        <button type="submit" disabled={busy || disabled || !link.trim()} className="btn btn-pink px-4! py-2! text-base!">
          {busy ? "Checking…" : "Verify"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm font-bold text-[#c2185b]">{error}</p>}
    </form>
  );
}

function DevConnect() {
  const { devConnect } = useSession();
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await devConnect(handle);
        setError(r.error ?? null);
      }}
      className="mt-5 rounded-2xl border-4 border-dashed border-ink/40 p-3"
    >
      <p className="text-xs font-bold text-ink/60">Local testing only (X keys not set): type a handle.</p>
      <div className="mt-2 flex gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@yourhandle"
          className="min-w-0 flex-1 rounded-xl border-4 border-ink px-3 py-1.5 text-sm outline-none"
        />
        <button className="btn px-4! py-1.5! text-base!">Go</button>
      </div>
      {error && <p className="mt-1 text-sm font-bold text-[#c2185b]">{error}</p>}
    </form>
  );
}

// Five Mochis that wake up as tasks get done
function Progress({ count }: { count: number }) {
  return (
    <div className="flex items-end justify-center gap-1 sm:gap-2" aria-label={`${count} of 5 tasks done`}>
      {FEATURED.map((b, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={b.id}
          src={b.img}
          alt=""
          className={`w-12 transition duration-500 sm:w-16 ${
            i < count ? "pop-in" : "translate-y-2 opacity-40 grayscale"
          }`}
        />
      ))}
    </div>
  );
}

export function Join() {
  const { ready, auth, entry, notice, connect, disconnect, task } = useSession();
  const { name, touched } = useMyMochi();
  const { on, refresh } = useWall();
  // null until they type, so the saved wallet shows by default
  const [walletDraft, setWallet] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [savingWallet, setSavingWallet] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const allDone = useRef<HTMLDivElement>(null);

  const wallet = walletDraft ?? entry?.wallet ?? "";
  const done = (t: TaskId) => !!entry?.done[t];
  const count = entry ? TASK_ORDER.filter((t) => entry.done[t]).length : 0;
  const complete = !!entry && isComplete(entry);

  useEffect(() => {
    if (complete && allDone.current) burstFrom(allDone.current, "hearts", 16);
  }, [complete]);

  const saveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!WALLET.test(wallet.trim())) {
      setWalletError("That isn't a valid EVM address. It starts with 0x followed by 40 characters.");
      return;
    }
    setSavingWallet(true);
    const r = await task({ task: "wallet", wallet: wallet.trim(), ref: readInvite() });
    setSavingWallet(false);
    setWalletError(r.error ?? null);
    if (!r.error) refresh();
  };

  const postText = `Meet ${name}, my Mochi 🩷\n\n${X_HANDLE}\n\n${entry?.wallet ?? ""}`;

  return (
    <div className="mx-auto max-w-3xl px-4">
      <div className="text-center">
        <h2 className="font-display text-6xl text-white" style={{ textShadow: "4px 4px 0 #161616" }}>
          Join the Mochis
        </h2>
        <p className="mt-2 font-bold text-ink/80">Connect your X, do five quick tasks, and you&apos;re in the running.</p>
      </div>

      <div className="chunk mt-8 p-5 sm:p-8">
        <Progress count={count} />

        {notice && <p className="pop-in mt-5 rounded-2xl border-4 border-ink bg-[#fff1a8] px-4 py-2 text-center font-bold">{notice}</p>}

        {!ready ? (
          <p className="mt-8 text-center font-display text-2xl text-ink/50">Loading…</p>
        ) : !entry ? (
          <div className="mt-6 text-center">
            {auth === "off" ? (
              <p className="font-display text-2xl">Sign ups open soon. Follow {X_HANDLE} to hear first.</p>
            ) : (
              <>
                <button onClick={connect} disabled={auth !== "x"} className="btn bg-ink! px-7! text-white! text-2xl!">
                  <XLogo className="h-5 w-5" /> Connect X
                </button>
                <p className="mt-3 text-sm font-semibold text-ink/60">We only read your public handle. We never post for you.</p>
                {auth === "dev" && <DevConnect />}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-4 border-ink bg-[#e2d4ff] px-4 py-2">
              <p className="font-bold">
                Connected as <span className="font-display text-xl">@{entry.handle}</span>
              </p>
              <button onClick={disconnect} className="text-sm font-bold underline decoration-2 underline-offset-2">
                Disconnect
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              <Step n={1} title={`Follow ${X_HANDLE}`} done={done("follow")}>
                <button
                  onClick={() => {
                    openX(intent("follow", { screen_name: US }));
                    task({ task: "follow" });
                  }}
                  className="btn px-4! py-2! text-base!"
                >
                  <XLogo /> {done("follow") ? "Followed" : "Follow on X"}
                </button>
              </Step>

              <Step n={2} title="Like and repost the pinned post" done={done("engage")}>
                {PINNED_ID ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        openX(intent("like", { tweet_id: PINNED_ID }));
                        task({ task: "engage", action: "like" });
                      }}
                      className={`btn px-4! py-2! text-base! ${entry.liked ? "bg-[#ffc6d6]!" : ""}`}
                    >
                      ♥ {entry.liked ? "Liked" : "Like"}
                    </button>
                    <button
                      onClick={() => {
                        openX(intent("retweet", { tweet_id: PINNED_ID }));
                        task({ task: "engage", action: "repost" });
                      }}
                      className={`btn px-4! py-2! text-base! ${entry.reposted ? "bg-[#ccffb2]!" : ""}`}
                    >
                      ⟲ {entry.reposted ? "Reposted" : "Repost"}
                    </button>
                    <a href={PINNED_POST} target="_blank" rel="noreferrer" className="self-center text-sm font-bold underline">
                      View post
                    </a>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-ink/60">The pinned post goes up soon.</p>
                )}
              </Step>

              <Step n={3} title="Tag a friend" done={done("tag")}>
                {PINNED_ID ? (
                  done("tag") ? (
                    <a href={entry.tagLink} target="_blank" rel="noreferrer" className="text-sm font-bold underline">
                      See your reply
                    </a>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-ink/70">Reply under the pinned post and tag at least one friend, then paste your reply&apos;s link.</p>
                      <button
                        onClick={() => openX(intent("post", { in_reply_to: PINNED_ID, text: "Getting my Mochi 🩷 come with me " }))}
                        className="btn mt-3 px-4! py-2! text-base!"
                      >
                        <XLogo /> Reply on X
                      </button>
                      <LinkProof task="tag" placeholder="https://x.com/you/status/…" />
                    </>
                  )
                ) : (
                  <p className="text-sm font-bold text-ink/60">The pinned post goes up soon.</p>
                )}
              </Step>

              <Step n={4} title="Add your EVM wallet" done={done("wallet")}>
                <form onSubmit={saveWallet}>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={wallet}
                      onChange={(e) => setWallet(e.target.value)}
                      placeholder="0x…"
                      spellCheck={false}
                      autoComplete="off"
                      disabled={done("mochi")}
                      className="min-w-0 flex-1 rounded-2xl border-4 border-ink bg-white px-3 py-2 font-mono text-sm outline-none focus:shadow-[3px_3px_0_#cf4f9c] disabled:opacity-60"
                    />
                    {!done("mochi") && (
                      <button
                        type="submit"
                        disabled={savingWallet || wallet.trim() === entry.wallet}
                        className="btn btn-pink px-4! py-2! text-base!"
                      >
                        {savingWallet ? "Saving…" : entry.wallet ? "Update" : "Save"}
                      </button>
                    )}
                  </div>
                  {walletError && <p className="mt-2 text-sm font-bold text-[#c2185b]">{walletError}</p>}
                </form>
                {on && done("wallet") && (
                  <div className="mt-3">
                    <InviteLink handle={entry.handle} />
                  </div>
                )}
              </Step>

              <Step n={5} title="Post your Mochi" done={done("mochi")}>
                {done("mochi") ? (
                  <a href={entry.mochiLink} target="_blank" rel="noreferrer" className="text-sm font-bold underline">
                    See your post
                  </a>
                ) : !entry.wallet ? (
                  <p className="text-sm font-bold text-ink/60">Add your wallet in step 4 first. It goes in your post.</p>
                ) : (
                  <>
                    <ol className="list-decimal space-y-1 pl-5 text-sm font-semibold text-ink/75">
                      <li>
                        {touched ? (
                          <>Your Mochi: <b>{name}</b>.</>
                        ) : (
                          <>Make your Mochi in the builder below.</>
                        )}{" "}
                        Download it as a PNG.
                      </li>
                      <li>Post it on X. The post must tag {X_HANDLE} and include your wallet. We fill that in for you.</li>
                      <li>Attach the PNG, post, then paste your post&apos;s link here.</li>
                    </ol>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a href="#builder" className="btn px-4! py-2! text-base!">
                        {touched ? "Edit Mochi" : "Make my Mochi"}
                      </a>
                      <button
                        onClick={async () => setDownloaded(await downloadMyMochi(name))}
                        className={`btn px-4! py-2! text-base! ${downloaded ? "bg-[#ccffb2]!" : ""}`}
                      >
                        {downloaded ? "Downloaded" : "Download PNG"}
                      </button>
                      <button onClick={() => openX(intent("post", { text: postText }))} className="btn btn-pink px-4! py-2! text-base!">
                        <XLogo /> Post on X
                      </button>
                    </div>
                    <LinkProof task="mochi" placeholder="https://x.com/you/status/…" />
                  </>
                )}
              </Step>
            </div>

            {complete && (
              <div ref={allDone} className="pop-in mt-6 rounded-3xl border-4 border-ink bg-pink p-5 text-center text-white shadow-[4px_4px_0_#161616]">
                <p className="font-display text-4xl" style={{ textShadow: "3px 3px 0 #161616" }}>
                  You&apos;re all set, @{entry.handle}!
                </p>
                <p className="mt-1 font-bold">All five tasks done. Keep an eye on {X_HANDLE} for what&apos;s next.</p>
                <a href={X_URL} target="_blank" rel="noreferrer" className="btn mt-4 text-ink! text-base!">
                  <XLogo /> {X_HANDLE}
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
