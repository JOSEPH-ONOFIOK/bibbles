"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { decodeEventLog, formatUnits, parseUnits, type Address, type Hex } from "viem";
import { DUEL_CONTRACT, MOCHI_TOKEN, Outcome, PONS_URL, RULES, START_WINDOW_S, Status, duelConfigured, erc20Abi, escrowAbi, robinhood, startMessage } from "@/duel/config";
import { DuelGame } from "./DuelGame";
import { useWallet, type Wallet } from "./wallet";

// ------------------------------------------------------------------ types & helpers

type Config = { feeBps: number; minStake: string; maxStake: string; symbol: string; decimals: number };
type Match = { id: string; playerA: Address; playerB: Address; stake: string; feeBps: number; status: number; joinDeadline: number; settleDeadline: number };
type Balance = { mochi: bigint; allowance: bigint; eth: bigint };
type RunView = { started: false } | { started: true; startAt: number; deadline: number; rejected: string | null; score: number; hits: number; collected: number; ticks: number };
type Result = { outcome: number; winner: Address | null; reason: string; signature: Hex; tx?: Hex };
type State = { match: Match; a: RunView; b: RunView; result: Result | null; now: number };

const ZERO = "0x0000000000000000000000000000000000000000";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const same = (a?: string | null, b?: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const fmt = (v: bigint | string, decimals: number) =>
  Number(formatUnits(BigInt(v), decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });
const split = (stake: bigint, feeBps: number) => {
  const pot = stake * BigInt(2);
  const fee = (pot * BigInt(feeBps)) / BigInt(10_000);
  return { pot, fee, payout: pot - fee };
};
const errText = (e: unknown) => {
  const x = e as { shortMessage?: string; message?: string; code?: number };
  if (x?.code === 4001) return "You cancelled in your wallet.";
  return x?.shortMessage || x?.message?.split("\n")[0] || "Something went wrong.";
};
async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}
const explorerTx = (h: string) => (robinhood.blockExplorers ? `${robinhood.blockExplorers.default.url}/tx/${h}` : null);

function useMatchParam() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setId(new URLSearchParams(location.search).get("match"));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const go = useCallback((next: string | null) => {
    const url = new URL(location.href);
    if (next) url.searchParams.set("match", next);
    else url.searchParams.delete("match");
    history.pushState(null, "", url);
    setId(next);
  }, []);
  return [id, go] as const;
}

// ------------------------------------------------------------------ app

export function DuelApp() {
  const w = useWallet();
  const [config, setConfig] = useState<Config | null>(null);
  const [open, setOpen] = useState<Match[]>([]);
  const [mine, setMine] = useState<Match[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [matchId, goMatch] = useMatchParam();

  const loadLobby = useCallback(async () => {
    try {
      const j = await getJson<{ config: Config; open: Match[]; mine: Match[] }>(`/api/duel/lobby${w.address ? `?address=${w.address}` : ""}`);
      setConfig(j.config);
      setOpen(j.open);
      setMine(j.mine);
      setLoadErr("");
    } catch (e) {
      setLoadErr(errText(e));
    }
  }, [w.address]);

  const loadBalance = useCallback(async () => {
    if (!w.address) return setBalance(null);
    try {
      const j = await getJson<{ mochi: string; allowance: string; eth: string }>(`/api/duel/balance?address=${w.address}`);
      setBalance({ mochi: BigInt(j.mochi), allowance: BigInt(j.allowance), eth: BigInt(j.eth) });
    } catch {
      /* keep the last balance */
    }
  }, [w.address]);

  useEffect(() => {
    if (!duelConfigured) return;
    const tick = () => {
      loadLobby();
      loadBalance();
    };
    tick();
    const t = setInterval(tick, 8000);
    // Coming back from Pons (or any tab): refresh the balance straight away
    const onFocus = () => document.visibilityState === "visible" && loadBalance();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadLobby, loadBalance]);

  const refreshAll = useCallback(() => {
    loadLobby();
    loadBalance();
  }, [loadLobby, loadBalance]);

  if (!duelConfigured) {
    return (
      <Card>
        <h2 className="font-display text-3xl">Coming soon</h2>
        <p className="mt-2 font-semibold">Mochi Duel opens once the escrow contract is live on Robinhood Chain.</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4">
      <WalletBar w={w} config={config} balance={balance} onRefresh={loadBalance} />
      {loadErr && <p className="chunk bg-[#ffe0e0] p-4 font-bold">{loadErr}</p>}
      {w.address && w.onRightChain && config && w.clients ? (
        matchId ? (
          <MatchRoom key={matchId} id={matchId} w={w} config={config} onBack={() => goMatch(null)} onChange={refreshAll} />
        ) : (
          <Lobby w={w} config={config} balance={balance} open={open} mine={mine} onMatch={goMatch} onChange={refreshAll} />
        )
      ) : (
        <HowItWorks config={config} />
      )}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`chunk p-5 sm:p-7 ${className}`}>{children}</div>;
}

// ------------------------------------------------------------------ wallet

function WalletBar({ w, config, balance, onRefresh }: { w: Wallet; config: Config | null; balance: Balance | null; onRefresh: () => void }) {
  const [err, setErr] = useState("");
  if (w.provider === undefined) return <Card>Looking for your wallet…</Card>;
  if (w.provider === null)
    return (
      <Card>
        <h2 className="font-display text-2xl">Connect a wallet to duel</h2>
        <p className="mt-2 font-semibold">Open this page in a wallet browser (MetaMask, Rabby, Coinbase Wallet), or install a wallet extension.</p>
      </Card>
    );
  if (!w.address)
    return (
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">Connect your wallet</h2>
          <p className="font-semibold text-ink/70">Your address, {config?.symbol ?? "$MOCHI"} balance and network will show here.</p>
        </div>
        <button className="btn btn-pink" onClick={() => w.connect().catch((e) => setErr(errText(e)))}>
          Connect wallet
        </button>
        {err && <p className="w-full font-bold text-red-600">{err}</p>}
      </Card>
    );
  return (
    <Card className="grid gap-3 sm:grid-cols-4 sm:items-center">
      <Stat label="Wallet" value={short(w.address)} />
      <Stat
        label="Network"
        value={w.onRightChain ? robinhood.name : "Wrong network"}
        extra={
          !w.onRightChain && (
            <button className="btn btn-pink mt-1 px-3! py-1! text-base!" onClick={() => w.switchChain().catch((e) => setErr(errText(e)))}>
              Switch to {robinhood.name}
            </button>
          )
        }
      />
      <Stat label={config?.symbol ?? "MOCHI"} value={balance && config ? fmt(balance.mochi, config.decimals) : "…"} />
      <Stat
        label="ETH for gas"
        value={balance ? fmt(balance.eth, 18) : "…"}
        extra={
          <button className="mt-1 text-sm font-bold underline" onClick={onRefresh}>
            Refresh
          </button>
        }
      />
      {balance && balance.eth === BigInt(0) && w.onRightChain && (
        <p className="font-bold text-ink/70 sm:col-span-4">You need a little ETH on {robinhood.name} to pay gas for staking and claiming.</p>
      )}
      {err && <p className="font-bold text-red-600 sm:col-span-4">{err}</p>}
    </Card>
  );
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-wide text-ink/60">{label}</p>
      <p className="font-display text-2xl">{value}</p>
      {extra}
    </div>
  );
}

function BuyOnPons({ symbol }: { symbol: string }) {
  if (!PONS_URL) return <p className="font-bold">Not enough {symbol} for this stake.</p>;
  return (
    <div className="rounded-2xl border-[3px] border-ink bg-[#fff1a8] p-4">
      <p className="font-bold">Not enough {symbol} for this stake.</p>
      <a href={PONS_URL} target="_blank" rel="noreferrer" className="btn btn-pink mt-2 px-4! py-1.5! text-lg!">
        Buy {symbol} on Pons ↗
      </a>
      <p className="mt-2 text-sm font-semibold text-ink/70">Your balance updates when you come back. Buying doesn&apos;t enter a duel. You still confirm every stake here.</p>
    </div>
  );
}

// ------------------------------------------------------------------ lobby

function Lobby({
  w,
  config,
  balance,
  open,
  mine,
  onMatch,
  onChange,
}: {
  w: Wallet;
  config: Config;
  balance: Balance | null;
  open: Match[];
  mine: Match[];
  onMatch: (id: string) => void;
  onChange: () => void;
}) {
  const presets = ["100", "500", "1000", "5000"];
  const [amount, setAmount] = useState("1000");
  const [invite, setInvite] = useState("");
  const [confirm, setConfirm] = useState<{ kind: "create"; stake: bigint; invited: Address | null } | { kind: "join"; match: Match } | null>(null);

  const stake = useMemo(() => {
    try {
      return /^\d+(\.\d+)?$/.test(amount) ? parseUnits(amount, config.decimals) : null;
    } catch {
      return null;
    }
  }, [amount, config.decimals]);
  const min = BigInt(config.minStake);
  const max = BigInt(config.maxStake);
  const inRange = stake !== null && stake >= min && stake <= max;
  const short_ = balance && stake !== null && balance.mochi < stake;
  const inviteOk = invite === "" || /^0x[0-9a-fA-F]{40}$/.test(invite);
  const others = open.filter((m) => !same(m.playerA, w.address) && (m.playerB === ZERO || same(m.playerB, w.address)));

  return (
    <>
      <Card>
        <h2 className="font-display text-3xl">Start a duel</h2>
        <p className="font-semibold text-ink/70">
          Choose your stake. Your opponent puts in the same amount. Stakes between {fmt(min, config.decimals)} and {fmt(max, config.decimals)} {config.symbol}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p} className={`btn px-4! py-1.5! text-lg! ${amount === p ? "btn-pink" : ""}`} onClick={() => setAmount(p)}>
              {Number(p).toLocaleString()}
            </button>
          ))}
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            className="w-36 rounded-full border-4 border-ink bg-white px-4 py-1.5 font-display text-lg"
            aria-label="Stake"
          />
        </div>
        {stake !== null && inRange && <Split stake={stake} config={config} className="mt-4" />}
        {stake !== null && !inRange && <p className="mt-3 font-bold text-red-600">That stake is outside the allowed range.</p>}
        <details className="mt-3">
          <summary className="cursor-pointer font-bold">Invite a specific opponent (optional)</summary>
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value.trim())}
            placeholder="0x… their wallet address"
            className="mt-2 w-full rounded-2xl border-4 border-ink bg-white px-4 py-2 font-mono text-sm"
          />
          {!inviteOk && <p className="mt-1 font-bold text-red-600">That isn&apos;t a wallet address.</p>}
        </details>
        <div className="mt-4">
          {short_ ? (
            <BuyOnPons symbol={config.symbol} />
          ) : (
            <button
              className="btn btn-pink"
              disabled={!inRange || !inviteOk || !balance}
              onClick={() => stake && setConfirm({ kind: "create", stake, invited: invite ? (invite as Address) : null })}
            >
              Review duel
            </button>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-3xl">Open duels</h2>
        {others.length === 0 ? (
          <p className="mt-2 font-semibold text-ink/70">No open duels right now. Start one and share the link.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {others.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-[3px] border-ink bg-white px-4 py-2">
                <span className="font-bold">
                  #{m.id} · {fmt(m.stake, config.decimals)} {config.symbol} · by {short(m.playerA)}
                  {m.playerB !== ZERO && " · invited you"}
                </span>
                {balance && balance.mochi < BigInt(m.stake) ? (
                  <span className="text-sm font-bold text-ink/60">Not enough {config.symbol}</span>
                ) : (
                  <button className="btn px-4! py-1! text-lg!" onClick={() => setConfirm({ kind: "join", match: m })}>
                    Review & join
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {mine.length > 0 && (
        <Card>
          <h2 className="font-display text-3xl">Your duels</h2>
          <ul className="mt-3 grid gap-2">
            {mine.map((m) => (
              <li key={m.id}>
                <button className="w-full rounded-2xl border-[3px] border-ink bg-white px-4 py-2 text-left font-bold hover:bg-[#fff1a8]" onClick={() => onMatch(m.id)}>
                  #{m.id} · {fmt(m.stake, config.decimals)} {config.symbol} · {["", "Waiting for opponent", "Ready to play", "Paid out", "Refunded"][m.status]}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Rules />

      {confirm && (
        <Confirm
          w={w}
          config={config}
          balance={balance}
          stake={confirm.kind === "create" ? confirm.stake : BigInt(confirm.match.stake)}
          feeBps={confirm.kind === "create" ? config.feeBps : confirm.match.feeBps}
          title={confirm.kind === "create" ? "Confirm your duel" : `Join duel #${confirm.match.id}`}
          act={async () => {
            const c = w.clients!;
            if (confirm.kind === "create") {
              const hash = await c.wallet.writeContract({ address: DUEL_CONTRACT!, abi: escrowAbi, functionName: "createMatch", args: [confirm.stake, confirm.invited ?? ZERO] });
              const receipt = await c.public.waitForTransactionReceipt({ hash });
              for (const log of receipt.logs) {
                try {
                  const ev = decodeEventLog({ abi: escrowAbi, data: log.data, topics: log.topics });
                  if (ev.eventName === "MatchCreated") return ev.args.matchId.toString();
                } catch {
                  /* not our event */
                }
              }
              throw new Error("Duel created, but its number wasn't found. Check “Your duels”.");
            }
            const hash = await c.wallet.writeContract({ address: DUEL_CONTRACT!, abi: escrowAbi, functionName: "joinMatch", args: [BigInt(confirm.match.id)] });
            await c.public.waitForTransactionReceipt({ hash });
            return confirm.match.id;
          }}
          onClose={() => setConfirm(null)}
          onDone={(id) => {
            setConfirm(null);
            onChange();
            onMatch(id);
          }}
        />
      )}
    </>
  );
}

function Split({ stake, config, feeBps = config.feeBps, className = "" }: { stake: bigint; config: Config; feeBps?: number; className?: string }) {
  const { pot, fee, payout } = split(stake, feeBps);
  const rows: [string, bigint, string?][] = [
    ["Your stake", stake],
    ["Opponent's stake", stake],
    ["Total pot", pot],
    [`Project fee (${feeBps / 100}%)`, fee, "only when someone wins"],
    ["Winner receives", payout],
    ["Winner's net gain", payout - stake],
  ];
  return (
    <table className={`w-full max-w-md text-left ${className}`}>
      <tbody>
        {rows.map(([k, v, note], i) => (
          <tr key={k} className={i === 4 ? "font-display text-xl" : "font-semibold"}>
            <td className="py-0.5 pr-4">
              {k}
              {note && <span className="block text-xs text-ink/60">{note}</span>}
            </td>
            <td className="py-0.5 text-right">
              {fmt(v, config.decimals)} {config.symbol}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Rules() {
  return (
    <Card>
      <h2 className="font-display text-3xl">Rules</h2>
      <ul className="mt-3 grid list-disc gap-1.5 pl-5 font-semibold">
        {RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </Card>
  );
}

function HowItWorks({ config }: { config: Config | null }) {
  return (
    <>
      <Card>
        <h2 className="font-display text-3xl">How Mochi Duel works</h2>
        <ol className="mt-3 grid list-decimal gap-1.5 pl-5 font-semibold">
          <li>Connect your wallet on {robinhood.name}.</li>
          <li>Choose a stake. Both players put in the same amount of {config?.symbol ?? "$MOCHI"}.</li>
          <li>Both stakes are held by the escrow contract.</li>
          <li>Play the same 90-second map: collect items, dodge obstacles.</li>
          <li>The server checks both runs. The winner is paid by the contract.</li>
        </ol>
        {config && <Split stake={parseUnits("1000", config.decimals)} config={config} className="mt-4" />}
      </Card>
      <Rules />
    </>
  );
}

// ------------------------------------------------------------------ confirm

function Confirm({
  w,
  config,
  balance,
  stake,
  feeBps,
  title,
  act,
  onClose,
  onDone,
}: {
  w: Wallet;
  config: Config;
  balance: Balance | null;
  stake: bigint;
  feeBps: number;
  title: string;
  act: () => Promise<string>;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const go = async () => {
    setErr("");
    try {
      const c = w.clients!;
      const allowance = await c.public.readContract({ address: MOCHI_TOKEN!, abi: erc20Abi, functionName: "allowance", args: [w.address!, DUEL_CONTRACT!] });
      if (allowance < stake) {
        setBusy(`Step 1 of 2: allow the escrow to take ${fmt(stake, config.decimals)} ${config.symbol}`);
        const hash = await c.wallet.writeContract({ address: MOCHI_TOKEN!, abi: erc20Abi, functionName: "approve", args: [DUEL_CONTRACT!, stake] });
        await c.public.waitForTransactionReceipt({ hash });
      }
      setBusy(allowance < stake ? "Step 2 of 2: stake into the escrow" : "Staking into the escrow");
      onDone(await act());
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" role="dialog" aria-modal="true">
      <div className="chunk max-h-[90svh] w-full max-w-lg overflow-y-auto p-5 sm:p-7">
        <h2 className="font-display text-3xl">{title}</h2>
        <Split stake={stake} config={config} feeBps={feeBps} className="mt-3" />
        {balance && balance.mochi < stake && <BuyOnPons symbol={config.symbol} />}
        <details className="mt-4" open>
          <summary className="cursor-pointer font-display text-xl">Rules</summary>
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm font-semibold">
            {RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
        <label className="mt-4 flex items-start gap-2 font-bold">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          I understand I can lose my {fmt(stake, config.decimals)} {config.symbol} stake, and I agree to these rules.
        </label>
        {busy && <p className="mt-3 font-bold">{busy}… confirm in your wallet.</p>}
        {err && <p className="mt-3 font-bold text-red-600">{err}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn btn-pink" disabled={!agree || Boolean(busy) || (balance !== null && balance.mochi < stake)} onClick={go}>
            Stake {fmt(stake, config.decimals)} {config.symbol}
          </button>
          <button className="btn" disabled={Boolean(busy)} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ match room

type Play = { token: string; seed: number; startAt: number; offset: number; resume: string };
const PLAY_KEY = (id: string, a: string) => `duel:${id}:${a.toLowerCase()}`;

function MatchRoom({ id, w, config, onBack, onChange }: { id: string; w: Wallet; config: Config; onBack: () => void; onChange: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [play, setPlay] = useState<Play | null>(null);
  const [finished, setFinished] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await getJson<State>(`/api/duel/state?id=${id}`));
      setErr("");
    } catch (e) {
      setErr(errText(e));
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(load);
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  const m = state?.match;
  const me = m ? (same(m.playerA, w.address) ? "a" : same(m.playerB, w.address) ? "b" : null) : null;
  const myRun = me && state ? state[me] : null;
  const oppRun = me && state ? state[me === "a" ? "b" : "a"] : null;

  const start = useCallback(
    async (silent = false) => {
      if (!w.address || !w.clients) return;
      setErr("");
      try {
        // Reuse the signed-in token after a reload, so the wallet doesn't ask again
        let saved: { token: string } | null = null;
        try {
          saved = JSON.parse(sessionStorage.getItem(PLAY_KEY(id, w.address)) || "null");
        } catch {
          /* storage blocked */
        }
        let signature: Hex | undefined;
        if (!saved) {
          if (silent) return;
          setBusy("Sign in to the duel in your wallet (free, no gas)");
          signature = await w.clients.wallet.signMessage({ account: w.address, message: startMessage(id, w.address) });
        }
        setBusy("Starting");
        const body = saved ? { id, address: w.address, token: saved.token } : { id, address: w.address, signature };
        const r = await getJson<{ token: string; seed: number; startAt: number; inputs: string; now: number }>(
          "/api/duel/start",
          { method: "POST", body: JSON.stringify(body) },
        ).catch(async (e) => {
          // a stale saved token: sign in again
          if (saved && !silent) {
            try {
              sessionStorage.removeItem(PLAY_KEY(id, w.address!));
            } catch {}
            const s = await w.clients!.wallet.signMessage({ account: w.address!, message: startMessage(id, w.address!) });
            return getJson<{ token: string; seed: number; startAt: number; inputs: string; now: number }>("/api/duel/start", {
              method: "POST",
              body: JSON.stringify({ id, address: w.address, signature: s }),
            });
          }
          throw e;
        });
        try {
          sessionStorage.setItem(PLAY_KEY(id, w.address), JSON.stringify({ token: r.token }));
        } catch {}
        setPlay({ token: r.token, seed: r.seed, startAt: r.startAt, offset: r.now - Date.now(), resume: r.inputs });
        load();
      } catch (e) {
        if (!silent) setErr(errText(e));
      } finally {
        setBusy("");
      }
    },
    [id, w.address, w.clients, load],
  );

  // Back on the page mid-run (reload or lost connection): pick the run up again
  const runLive = Boolean(myRun?.started && state && "deadline" in myRun && state.now < myRun.deadline && myRun.ticks < 2700 && !myRun.rejected);
  useEffect(() => {
    if (runLive && !play && !finished) queueMicrotask(() => start(true));
  }, [runLive, play, finished, start]);

  const tx = async (label: string, fn: () => Promise<Hex>) => {
    setErr("");
    setBusy(label);
    try {
      const hash = await fn();
      await w.clients!.public.waitForTransactionReceipt({ hash });
      await load();
      onChange();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy("");
    }
  };

  const upload = useCallback(
    (from: number, moves: string) =>
      getJson<{ length: number; score: { score: number } | null; rejected: string | null }>("/api/duel/progress", {
        method: "POST",
        body: JSON.stringify({ id, address: w.address, token: play?.token, from, moves }),
      }),
    [id, w.address, play?.token],
  );

  const shareLink = typeof window !== "undefined" ? `${location.origin}/play/duel?match=${id}` : "";
  const now = (state?.now ?? 0) / 1000; // server time, from the last poll
  const r = state?.result;
  const iWon = r && w.address && same(r.winner, w.address);

  return (
    <>
      <button className="justify-self-start font-bold underline" onClick={onBack}>
        ← All duels
      </button>
      {!state ? (
        <Card>{err || "Loading duel…"}</Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-3xl">Duel #{id}</h2>
              <span className="font-bold text-ink/70">
                {fmt(m!.stake, config.decimals)} {config.symbol} each · winner gets {fmt(split(BigInt(m!.stake), m!.feeBps).payout, config.decimals)}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Player label="Player A" address={m!.playerA} me={me === "a"} run={state.a} />
              <Player label="Player B" address={m!.playerB} me={me === "b"} run={state.b} />
            </div>
          </Card>

          {play && !finished && m!.status === Status.Locked && !r ? (
            <DuelGame
              seed={play.seed}
              startAt={play.startAt}
              offset={play.offset}
              resume={play.resume}
              upload={upload}
              opponent={oppRun && oppRun.started ? { started: true, score: oppRun.score } : { started: false }}
              onFinished={() => {
                setFinished(true);
                load();
              }}
            />
          ) : (
            <Card>
              {/* Waiting for an opponent */}
              {m!.status === Status.Open && (
                <>
                  <h3 className="font-display text-2xl">Waiting for an opponent</h3>
                  {now < m!.joinDeadline ? (
                    <p className="font-semibold text-ink/70">Open until {new Date(m!.joinDeadline * 1000).toLocaleTimeString()}. Share the link:</p>
                  ) : (
                    <p className="font-semibold text-ink/70">Nobody joined in time. Cancel to get your stake back.</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      className="btn px-4! py-1.5! text-lg!"
                      onClick={() => navigator.clipboard?.writeText(shareLink).then(() => setCopied(true))}
                    >
                      {copied ? "Copied!" : "Copy invite link"}
                    </button>
                    {(me === "a" || now > m!.joinDeadline) && (
                      <button
                        className="btn px-4! py-1.5! text-lg!"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          tx("Cancelling", () =>
                            w.clients!.wallet.writeContract({ address: DUEL_CONTRACT!, abi: escrowAbi, functionName: "cancelOpenMatch", args: [BigInt(id)] }),
                          )
                        }
                      >
                        Cancel & refund
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Both staked, no result yet */}
              {m!.status === Status.Locked && !r && (
                <>
                  {now > m!.settleDeadline ? (
                    <>
                      <h3 className="font-display text-2xl">No result in time</h3>
                      <p className="font-semibold">Either player can refund both stakes in full.</p>
                      <button
                        className="btn btn-pink mt-3"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          tx("Refunding", () =>
                            w.clients!.wallet.writeContract({ address: DUEL_CONTRACT!, abi: escrowAbi, functionName: "refundExpired", args: [BigInt(id)] }),
                          )
                        }
                      >
                        Refund both players
                      </button>
                    </>
                  ) : !me ? (
                    <p className="font-semibold">This duel is being played.</p>
                  ) : !myRun?.started ? (
                    <>
                      <h3 className="font-display text-2xl">Both stakes are in. Ready?</h3>
                      {oppRun?.started && "startAt" in oppRun && (
                        <p className="font-bold text-pink">
                          Your opponent has started! Start within {Math.max(0, Math.ceil(oppRun.startAt / 1000 + START_WINDOW_S - now))} seconds or you lose.
                        </p>
                      )}
                      <p className="font-semibold text-ink/70">90 seconds. Collect items, dodge rocks. Your wallet will ask you to sign in (free).</p>
                      <button className="btn btn-pink mt-3" disabled={Boolean(busy)} onClick={() => start()}>
                        Start duel
                      </button>
                    </>
                  ) : (
                    <>
                      <h3 className="font-display text-2xl">{finished || !runLive ? "Run finished" : "Reconnecting…"}</h3>
                      <p className="font-semibold text-ink/70">
                        {oppRun?.started ? "Waiting for your opponent to finish. Scores update live." : "Waiting for your opponent to start (they have 60 seconds)."}
                      </p>
                    </>
                  )}
                </>
              )}

              {/* Decided */}
              {r && (
                <>
                  <h3 className="font-display text-3xl">
                    {r.outcome === Outcome.Void ? "No winner: full refund" : iWon ? "You won! 🎉" : me ? "You lost this one" : `Winner: ${short(r.winner!)}`}
                  </h3>
                  <p className="font-semibold text-ink/70">{r.reason}.</p>
                  {m!.status === Status.Locked ? (
                    r.tx ? (
                      <p className="mt-2 font-bold">Paying out… {explorerTx(r.tx) && <a className="underline" href={explorerTx(r.tx)!} target="_blank" rel="noreferrer">View transaction ↗</a>}</p>
                    ) : (
                      <button
                        className="btn btn-pink mt-3"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          tx("Submitting the result", () =>
                            w.clients!.wallet.writeContract({ address: DUEL_CONTRACT!, abi: escrowAbi, functionName: "settle", args: [BigInt(id), r.outcome, r.signature] }),
                          )
                        }
                      >
                        {r.outcome === Outcome.Void ? "Refund both stakes" : iWon ? "Claim winnings" : "Pay the winner"}
                      </button>
                    )
                  ) : (
                    <p className="mt-2 font-bold">{m!.status === Status.Settled ? "Paid out ✅" : "Refunded ✅"}</p>
                  )}
                </>
              )}

              {!r && m!.status === Status.Settled && <p className="font-display text-2xl">Paid out ✅</p>}
              {!r && m!.status === Status.Refunded && <p className="font-display text-2xl">Refunded ✅</p>}
            </Card>
          )}
          {busy && <p className="chunk p-4 font-bold">{busy}…</p>}
          {err && <p className="chunk bg-[#ffe0e0] p-4 font-bold">{err}</p>}
        </>
      )}
    </>
  );
}

function Player({ label, address, me, run }: { label: string; address: string; me: boolean; run: RunView }) {
  return (
    <div className={`rounded-2xl border-[3px] border-ink px-4 py-3 ${me ? "bg-[#fff1a8]" : "bg-white"}`}>
      <p className="text-xs font-extrabold uppercase tracking-wide text-ink/60">
        {label}
        {me && " · you"}
      </p>
      <p className="font-bold">{address === ZERO ? "Waiting…" : short(address)}</p>
      {run.started ? (
        <p className="font-display text-2xl">
          {run.score} <span className="text-base text-ink/60">pts · {run.hits} hits{run.rejected ? " · rejected" : ""}</span>
        </p>
      ) : (
        <p className="font-semibold text-ink/60">Not started</p>
      )}
    </div>
  );
}
