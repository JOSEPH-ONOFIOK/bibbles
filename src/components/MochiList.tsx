"use client";

import { useEffect, useRef, useState } from "react";
import { burstFrom } from "@/lib/burst";
import { WALLET } from "@/lib/entry";
import { POWERED, X_HANDLE } from "@/lib/mochi";
import { ANNOUNCEMENT, ANNOUNCEMENT_ID, COLLECTIONS, ML_CAP, claimText, mlTasksDone, type MlStats } from "@/lib/mochilist";
import { ClaimMeter } from "./ClaimMeter";
import { CollectionSpiral } from "./CollectionSpiral";
import { ClosedCard, Countdown, useApplyOpen } from "./Countdown";
import { DevConnect, Step, XLogo, intent, openX } from "./Join";
import { useSession } from "./Session";

const ERROR = "mt-2 text-sm font-bold text-[#c2185b]";
const INPUT =
  "min-w-0 flex-1 rounded-2xl border-4 border-ink bg-white px-3 py-2 text-sm outline-none focus:shadow-[3px_3px_0_#cf4f9c] disabled:opacity-50";

// Link input + verify button for the comment and the post
function LinkProof({ step }: { step: "comment" }) {
  const { mochilist } = useSession();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await mochilist({ step, link });
        setBusy(false);
        if (r.error) setError(r.error);
      }}
      className="mt-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://x.com/you/status/…" spellCheck={false} className={INPUT} />
        <button type="submit" disabled={busy || !link.trim()} className="btn btn-pink px-4! py-2! text-base!">
          {busy ? "Checking…" : "Verify"}
        </button>
      </div>
      {error && <p className={ERROR}>{error}</p>}
    </form>
  );
}

function Locked({ children = "Check your wallet in step 1 first." }: { children?: React.ReactNode }) {
  return <p className="text-sm font-bold text-ink/50">🔒 {children}</p>;
}

export function MochiList() {
  const { ready, auth, entry, notice, connect, disconnect, mochilist } = useSession();
  const ml = entry?.ml;
  const open = useApplyOpen();
  const eligible = !!ml?.collection;
  const claimed = !!ml?.claimedAt;
  const tasksDone = mlTasksDone(ml);

  // null until they type, so the saved wallet shows by default
  const [draft, setDraft] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // Bumped after a successful check, so the spiral spins for it
  const [spinKey, setSpinKey] = useState(0);
  const spiral = useRef<HTMLDivElement>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const banner = useRef<HTMLDivElement>(null);
  const wallet = draft ?? ml?.wallet ?? "";

  const was = useRef(claimed);
  useEffect(() => {
    if (claimed && !was.current && banner.current) {
      const el = banner.current;
      burstFrom(el, "hearts", 18);
      setTimeout(() => burstFrom(el, "stars", 14), 450);
    }
    was.current = claimed;
  }, [claimed]);

  // The live count, loaded on arrival and again once their own spot is confirmed
  const [stats, setStats] = useState<MlStats | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/mochilist")
      .then((r) => r.json())
      .then((d: MlStats) => live && typeof d.claimed === "number" && setStats(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [claimed]);
  const full = !!stats && stats.claimed >= stats.cap;
  const fullOnes = stats ? COLLECTIONS.filter((c) => (stats.by[c.name] ?? 0) >= c.limit).map((c) => c.name) : [];
  const logo = COLLECTIONS.find((c) => c.name === ml?.collection)?.logo;

  const checkWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!WALLET.test(wallet.trim())) {
      setWalletError("That isn't a valid EVM address. It starts with 0x followed by 40 characters.");
      return;
    }
    setChecking(true);
    setWalletError(null);
    const r = await mochilist({ step: "wallet", wallet: wallet.trim() });
    setChecking(false);
    if (r.error) setWalletError(r.error);
    else {
      setDraft(null);
      setSpinKey((k) => k + 1);
      // On phones the spiral sits above the form: bring it into view to watch it spin
      if (matchMedia("(max-width: 1023px)").matches) spiral.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const confirm = async () => {
    setConfirming(true);
    const r = await mochilist({ step: "claim" });
    setConfirming(false);
    setClaimError(r.error ?? null);
  };

  const commentText = ml?.collection ? claimText(ml.collection) : "";
  const comment = () =>
    openX(intent("post", ANNOUNCEMENT_ID ? { in_reply_to: ANNOUNCEMENT_ID, text: commentText } : { text: commentText }));

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="text-center">
        <h1 className="font-display text-6xl text-white" style={{ textShadow: "4px 4px 0 #161616" }}>
          MochiList
        </h1>
        <p className="mt-2 font-bold text-ink/80">
          Hold an NFT from one of these collections? Claim one of {ML_CAP.toLocaleString("en-US")} GTD MochiList spots. {POWERED}.
        </p>
        <Countdown className="mt-4" />
      </div>

      <div className="mt-8">
        <ClaimMeter stats={stats} mine={ml?.collection} />
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div ref={spiral} className="lg:sticky lg:top-28">
          <CollectionSpiral found={ml?.collection} checking={checking} spinKey={spinKey} full={fullOnes} />
        </div>
        <div className="chunk min-w-0 p-5 sm:p-8">
          {notice && <p className="pop-in mb-5 rounded-2xl border-4 border-ink bg-[#fff1a8] px-4 py-2 text-center font-bold">{notice}</p>}

          {!ready ? (
            <p className="text-center font-display text-2xl text-ink/50">Loading…</p>
          ) : !entry ? (
            <div className="text-center">
              {!open ? (
                <ClosedCard handle={X_HANDLE} />
              ) : auth === "off" ? (
                <p className="font-display text-2xl">Claims open soon. Follow {X_HANDLE} to hear first.</p>
              ) : (
                <>
                  <button onClick={() => connect("/mochilist")} disabled={auth !== "x"} className="btn bg-ink! px-7! text-2xl! text-white!">
                    <XLogo className="h-5 w-5" /> Connect X
                  </button>
                  <p className="mt-3 text-sm font-semibold text-ink/60">We check your comment comes from your account. We never post for you.</p>
                  {auth === "dev" && <DevConnect />}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-4 border-ink bg-[#e2d4ff] px-4 py-2">
                <p className="font-bold">
                  Connected as <span className="font-display text-xl">@{entry.handle}</span>
                </p>
                <button onClick={disconnect} className="text-sm font-bold underline decoration-2 underline-offset-2">
                  Disconnect
                </button>
              </div>

              {claimed ? (
                <div ref={banner} className="gtd-card pop-in relative mt-6 overflow-hidden rounded-3xl border-4 border-ink px-5 py-8 text-center shadow-[6px_6px_0_#161616] sm:px-8">
                  {logo && (
                    <div className="relative mx-auto h-28 w-28">
                      <div className="gtd-ring absolute -inset-3 rounded-full border-4 border-dashed border-ink/40" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo} alt={ml?.collection} className="relative h-full w-full rounded-full border-[5px] border-ink bg-white object-cover shadow-[4px_4px_0_#161616]" />
                    </div>
                  )}
                  <div className="stamp-in mx-auto mt-6 inline-block rounded-2xl border-[5px] border-ink bg-white px-5 py-2 shadow-[5px_5px_0_#161616]">
                    <p className="font-display text-4xl leading-none text-pink sm:text-6xl" style={{ textShadow: "3px 3px 0 #161616" }}>
                      GTD SECURED
                    </p>
                  </div>
                  {!!ml?.spot && (
                    <p className="mt-5 font-display text-2xl">
                      Spot #{ml.spot.toLocaleString("en-US")} <span className="text-ink/50">of {ML_CAP.toLocaleString("en-US")}</span>
                    </p>
                  )}
                  <p className="mt-2 font-bold">Claimed through {ml?.collection}. Your free mint is guaranteed to this wallet:</p>
                  <p className="mx-auto mt-2 max-w-md rounded-xl border-[3px] border-ink bg-white/80 px-3 py-1.5 font-mono text-sm font-bold break-all">{ml?.wallet}</p>
                  <p className="mt-4 text-sm font-semibold text-ink/70">See you at mint. Keep an eye on {X_HANDLE} for the date.</p>
                </div>
              ) : !open ? (
                <ClosedCard handle={X_HANDLE} />
              ) : full ? (
                <div className="mt-6 rounded-3xl border-4 border-ink bg-ink p-6 text-center text-white">
                  <p className="font-display text-4xl">All spots are taken</p>
                  <p className="mt-2 font-bold text-white/80">
                    All {ML_CAP.toLocaleString("en-US")} MochiList spots are claimed. Follow {X_HANDLE} for what&apos;s next.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <Step n={1} title="Check your wallet" done={eligible}>
                    <form onSubmit={checkWallet}>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={wallet}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="0x…"
                          spellCheck={false}
                          autoComplete="off"
                          className={`${INPUT} font-mono`}
                        />
                        <button type="submit" disabled={checking || !wallet.trim() || wallet.trim() === ml?.wallet} className="btn btn-pink px-4! py-2! text-base!">
                          {checking ? "Checking…" : eligible ? "Change" : "Check"}
                        </button>
                      </div>
                      {walletError && <p className={ERROR}>{walletError}</p>}
                    </form>
                    {eligible ? (
                      <p className="mt-2 text-sm font-extrabold">Eligible: this wallet holds {ml?.collection}.</p>
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-ink/60">
                        Paste the wallet that holds your NFT. No signing, no payment, no approvals: we only look up what it holds, and only save it once your spot is confirmed.
                      </p>
                    )}
                  </Step>

                  <Step n={2} title={`Follow ${X_HANDLE}`} done={!!ml?.followed}>
                    {!eligible ? (
                      <Locked />
                    ) : (
                      <button
                        onClick={() => {
                          openX(intent("follow", { screen_name: X_HANDLE.replace("@", "") }));
                          mochilist({ step: "follow" });
                        }}
                        className={`btn px-4! py-2! text-base! ${ml?.followed ? "bg-[#ccffb2]!" : "bg-ink! text-white!"}`}
                      >
                        <XLogo /> {ml?.followed ? "Following" : `Follow ${X_HANDLE}`}
                      </button>
                    )}
                  </Step>

                  <Step n={3} title="Like and repost the announcement" done={!!(ml?.liked && ml.reposted)}>
                    {!eligible ? (
                      <Locked />
                    ) : !ml?.followed ? (
                      <Locked>Follow {X_HANDLE} in step 2 first.</Locked>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            openX(ANNOUNCEMENT_ID ? intent("like", { tweet_id: ANNOUNCEMENT_ID }) : ANNOUNCEMENT);
                            mochilist({ step: "engage", action: "like" });
                          }}
                          className={`btn px-4! py-2! text-base! ${ml?.liked ? "bg-[#ffc6d6]!" : ""}`}
                        >
                          ♥ {ml?.liked ? "Liked" : "Like"}
                        </button>
                        <button
                          onClick={() => {
                            openX(ANNOUNCEMENT_ID ? intent("retweet", { tweet_id: ANNOUNCEMENT_ID }) : ANNOUNCEMENT);
                            mochilist({ step: "engage", action: "repost" });
                          }}
                          className={`btn px-4! py-2! text-base! ${ml?.reposted ? "bg-[#ccffb2]!" : ""}`}
                        >
                          ⟲ {ml?.reposted ? "Reposted" : "Repost"}
                        </button>
                        <a href={ANNOUNCEMENT} target="_blank" rel="noreferrer" className="self-center text-sm font-bold underline">
                          View post
                        </a>
                      </div>
                    )}
                  </Step>

                  <Step n={4} title="Comment that you claimed" done={!!ml?.commentLink}>
                    {!eligible ? (
                      <Locked />
                    ) : !ml?.followed || !ml.liked || !ml.reposted ? (
                      <Locked>{!ml?.followed ? `Follow ${X_HANDLE} in step 2 first.` : "Like and repost the announcement in step 3 first."}</Locked>
                    ) : ml?.commentLink ? (
                      <a href={ml.commentLink} target="_blank" rel="noreferrer" className="text-sm font-bold underline">
                        See your comment
                      </a>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-ink/70">
                          {ANNOUNCEMENT_ID
                            ? "Comment on the announcement saying you claimed your spot, then paste your comment's link."
                            : `Post on X tagging ${X_HANDLE} saying you claimed your spot, then paste the link.`}
                        </p>
                        <p className="mt-3 whitespace-pre-line rounded-2xl border-4 border-dashed border-ink/30 bg-[#fffdf5] px-3 py-2 text-sm font-semibold">
                          {commentText}
                        </p>
                        <button onClick={comment} className="btn btn-pink mt-3 px-4! py-2! text-base!">
                          <XLogo /> {ANNOUNCEMENT_ID ? "Comment on X" : "Post on X"}
                        </button>
                        <LinkProof step="comment" />
                      </>
                    )}
                  </Step>

                  {tasksDone && (
                    <div className="rounded-3xl border-4 border-ink bg-[#fff1a8] p-4 text-center">
                      <p className="font-bold">Every step is done. We just need to check your wallet one more time.</p>
                      <button onClick={confirm} disabled={confirming} className="btn btn-pink mt-3 px-5! py-2!">
                        {confirming ? "Checking…" : "Confirm my spot"}
                      </button>
                      {claimError && <p className={ERROR}>{claimError}</p>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
