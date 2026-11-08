"use client";

import { useEffect, useRef, useState } from "react";
import { AIRDROP_POST, AIRDROP_POST_ID, AIRDROP_SHARE, qrtText, refLink } from "@/lib/airdrop";
import { burstFrom } from "@/lib/burst";
import { WALLET } from "@/lib/entry";
import { TOKEN, X_HANDLE } from "@/lib/mochi";
import { DevConnect, Step, XLogo, intent, openX } from "./Join";
import { useSession } from "./Session";

const ERROR = "mt-2 text-sm font-bold text-[#c2185b]";
const INPUT =
  "min-w-0 flex-1 rounded-2xl border-4 border-ink bg-white px-3 py-2 text-sm outline-none focus:shadow-[3px_3px_0_#cf4f9c] disabled:opacity-50";
const REF_KEY = "mochi_ad_ref";

function Locked({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-bold text-ink/50">🔒 {children}</p>;
}

// Remembers ?ref=handle from an invite link, so it survives Connect X
function useInvite() {
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("ref");
    if (!ref) return;
    try {
      localStorage.setItem(REF_KEY, ref);
    } catch {}
  }, []);
  return () => {
    try {
      return localStorage.getItem(REF_KEY) ?? "";
    } catch {
      return "";
    }
  };
}

export function Airdrop() {
  const { ready, auth, entry, notice, connect, disconnect, airdrop } = useSession();
  const readRef = useInvite();
  const ad = entry?.ad;
  const applied = !!ad?.appliedAt;
  const engaged = !!(ad?.commented && ad.reposted);

  const [stats, setStats] = useState<{ applied: number; invites: number } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/airdrop")
      .then((r) => r.json())
      .then((d) => live && typeof d.applied === "number" && setStats(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [applied, entry?.handle]);

  const [link, setLink] = useState("");
  const [qrtBusy, setQrtBusy] = useState(false);
  const [qrtError, setQrtError] = useState<string | null>(null);
  const [wallet, setWallet] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const banner = useRef<HTMLDivElement>(null);
  const was = useRef(applied);
  useEffect(() => {
    if (applied && !was.current && banner.current) {
      const el = banner.current;
      burstFrom(el, "hearts", 18);
      setTimeout(() => burstFrom(el, "stars", 14), 450);
    }
    was.current = applied;
  }, [applied]);

  const myLink = entry ? refLink(entry.handle) : "";
  const text = entry ? qrtText(entry.handle) : "";
  const quote = () => openX(intent("post", AIRDROP_POST_ID ? { text, url: AIRDROP_POST } : { text }));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${myLink}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="mx-auto max-w-3xl px-4">
      <div className="text-center">
        <p className="pop-in mx-auto inline-flex items-center gap-2 rounded-full border-[3px] border-ink bg-[#ccffb2] px-4 py-1 font-display text-lg shadow-[3px_3px_0_#161616]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1f9d55] opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1f9d55]" />
          </span>
          Application is live
        </p>
        <h1 className="mt-4 font-display text-6xl leading-none text-white sm:text-7xl" style={{ textShadow: "4px 4px 0 #161616" }}>
          {TOKEN} Airdrop
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-display text-2xl leading-snug sm:text-3xl">
          <span className="rounded-xl bg-ink px-2 text-[#fff1a8]">{AIRDROP_SHARE}</span> of {TOKEN} will be bought & airdropped back to the community.
        </p>
        <p className="mt-2 font-bold text-ink/70">Do four quick tasks, drop your wallet, and you&apos;re in.</p>
      </div>

      <div className="chunk mt-8 p-5 sm:p-8">
        {notice && <p className="pop-in mb-5 rounded-2xl border-4 border-ink bg-[#fff1a8] px-4 py-2 text-center font-bold">{notice}</p>}

        {!ready ? (
          <p className="text-center font-display text-2xl text-ink/50">Loading…</p>
        ) : !entry ? (
          <div className="text-center">
            {auth === "off" ? (
              <p className="font-display text-2xl">Applications open soon. Follow {X_HANDLE} to hear first.</p>
            ) : (
              <>
                <button onClick={() => connect("/mochiclaim")} disabled={auth !== "x"} className="btn bg-ink! px-7! text-2xl! text-white!">
                  <XLogo className="h-5 w-5" /> Connect X to apply
                </button>
                <p className="mt-3 text-sm font-semibold text-ink/60">We check your quote comes from your account. We never post for you.</p>
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

            {applied ? (
              <div ref={banner} className="gtd-card pop-in relative mt-6 overflow-hidden rounded-3xl border-4 border-ink px-5 py-8 text-center shadow-[6px_6px_0_#161616] sm:px-8">
                <div className="stamp-in mx-auto inline-block rounded-2xl border-[5px] border-ink bg-white px-5 py-2 shadow-[5px_5px_0_#161616]">
                  <p className="font-display text-4xl leading-none text-pink sm:text-6xl" style={{ textShadow: "3px 3px 0 #161616" }}>
                    YOU&apos;RE IN
                  </p>
                </div>
                <p className="mt-5 font-bold">Your {TOKEN} airdrop application is in. Airdrop goes to:</p>
                <p className="mx-auto mt-2 max-w-md rounded-xl border-[3px] border-ink bg-white/80 px-3 py-1.5 font-mono text-sm font-bold break-all">{ad?.wallet}</p>
                <div className="mx-auto mt-6 max-w-md rounded-2xl border-4 border-ink bg-white p-4">
                  <p className="font-display text-xl">Bring your friends</p>
                  <p className="mt-1 text-sm font-semibold text-ink/70">Your invite link:</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-xl bg-[#fff1a8] px-2 py-1.5 text-left text-sm font-bold">{myLink}</code>
                    <button onClick={copy} className="btn btn-pink px-3! py-1.5! text-sm!">
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-3 font-display text-2xl">
                    {(stats?.invites ?? 0).toLocaleString("en-US")} <span className="text-lg text-ink/60">friends applied with your link</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <Step n={1} title={`Follow ${X_HANDLE}`} done={!!ad?.followed}>
                  <button
                    onClick={() => {
                      openX(intent("follow", { screen_name: X_HANDLE.replace("@", "") }));
                      airdrop({ step: "follow" });
                    }}
                    className={`btn px-4! py-2! text-base! ${ad?.followed ? "bg-[#ccffb2]!" : "bg-ink! text-white!"}`}
                  >
                    <XLogo /> {ad?.followed ? "Following" : `Follow ${X_HANDLE}`}
                  </button>
                </Step>

                <Step n={2} title="Comment and retweet the airdrop post" done={engaged}>
                  {!ad?.followed ? (
                    <Locked>Follow {X_HANDLE} in step 1 first.</Locked>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          openX(AIRDROP_POST_ID ? intent("post", { in_reply_to: AIRDROP_POST_ID, text: `Applying for the ${TOKEN} airdrop 🩷` }) : AIRDROP_POST);
                          airdrop({ step: "engage", action: "comment" });
                        }}
                        className={`btn px-4! py-2! text-base! ${ad?.commented ? "bg-[#ffc6d6]!" : ""}`}
                      >
                        💬 {ad?.commented ? "Commented" : "Comment"}
                      </button>
                      <button
                        onClick={() => {
                          openX(AIRDROP_POST_ID ? intent("retweet", { tweet_id: AIRDROP_POST_ID }) : AIRDROP_POST);
                          airdrop({ step: "engage", action: "repost" });
                        }}
                        className={`btn px-4! py-2! text-base! ${ad?.reposted ? "bg-[#ccffb2]!" : ""}`}
                      >
                        ⟲ {ad?.reposted ? "Retweeted" : "Retweet"}
                      </button>
                      <a href={AIRDROP_POST} target="_blank" rel="noreferrer" className="self-center text-sm font-bold underline">
                        View post
                      </a>
                    </div>
                  )}
                </Step>

                <Step n={3} title="Quote it with your invite link" done={!!ad?.qrtLink}>
                  {!ad?.followed || !engaged ? (
                    <Locked>{!ad?.followed ? `Follow ${X_HANDLE} in step 1 first.` : "Comment and retweet the airdrop post in step 2 first."}</Locked>
                  ) : ad?.qrtLink ? (
                    <a href={ad.qrtLink} target="_blank" rel="noreferrer" className="text-sm font-bold underline">
                      See your quote
                    </a>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-ink/70">
                        {AIRDROP_POST_ID ? "Quote the airdrop post with this text. Your invite link must stay in it." : `Post this on X. It must tag ${X_HANDLE} and keep your invite link.`}
                      </p>
                      <p className="mt-3 rounded-2xl border-4 border-dashed border-ink/30 bg-[#fffdf5] px-3 py-2 text-sm font-semibold whitespace-pre-line">{text}</p>
                      <button onClick={quote} className="btn btn-pink mt-3 px-4! py-2! text-base!">
                        <XLogo /> {AIRDROP_POST_ID ? "Quote on X" : "Post on X"}
                      </button>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setQrtBusy(true);
                          setQrtError(null);
                          const r = await airdrop({ step: "qrt", link });
                          setQrtBusy(false);
                          if (r.error) setQrtError(r.error);
                        }}
                        className="mt-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://x.com/you/status/…" spellCheck={false} className={INPUT} />
                          <button type="submit" disabled={qrtBusy || !link.trim()} className="btn btn-pink px-4! py-2! text-base!">
                            {qrtBusy ? "Checking…" : "Verify"}
                          </button>
                        </div>
                        {qrtError && <p className={ERROR}>{qrtError}</p>}
                      </form>
                    </>
                  )}
                </Step>

                <Step n={4} title="Drop your EVM wallet" done={false}>
                  {!ad?.qrtLink ? (
                    <Locked>Finish steps 1 to 3 first.</Locked>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!WALLET.test(wallet.trim())) {
                          setWalletError("That isn't a valid EVM address. It starts with 0x followed by 40 characters.");
                          return;
                        }
                        setWalletBusy(true);
                        setWalletError(null);
                        const r = await airdrop({ step: "wallet", wallet: wallet.trim(), ref: readRef() });
                        setWalletBusy(false);
                        if (r.error) setWalletError(r.error);
                      }}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" className={`${INPUT} font-mono`} />
                        <button type="submit" disabled={walletBusy || !wallet.trim()} className="btn btn-pink px-4! py-2! text-base!">
                          {walletBusy ? "Saving…" : `Get my ${TOKEN}`}
                        </button>
                      </div>
                      {walletError && <p className={ERROR}>{walletError}</p>}
                      <p className="mt-2 text-sm font-semibold text-ink/60">Your {TOKEN} airdrop goes to this wallet. No signing, no payment.</p>
                    </form>
                  )}
                </Step>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
