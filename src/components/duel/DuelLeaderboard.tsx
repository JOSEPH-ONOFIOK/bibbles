"use client";

import { useCallback, useEffect, useState } from "react";

type Row = { rank: number; address: string; net: number; wins: number; losses: number; prize: number };
type Board = { week: number; current: number; endsAt: number; pool: number; split: number[]; minWins: number; rows: Row[]; me: Row | null };

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const n = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
const signed = (v: number) => `${v > 0 ? "+" : ""}${n(v)}`;

function left(ms: number) {
  if (ms <= 0) return "ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h ${m}m left`;
}

// Weekly Duel standings: net $MOCHI won (wins minus losses, in MOCHI), with the 1,000,000 MOCHI prize pool.
export function DuelLeaderboard({ address, symbol = "MOCHI" }: { address?: string | null; symbol?: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (week !== null) q.set("week", String(week));
      if (address) q.set("address", address);
      const r = await fetch(`/api/duel/leaderboard?${q}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setBoard(j);
      setNow(Date.now());
      setErr("");
    } catch (e) {
      setErr((e as Error).message || "Couldn't load the leaderboard.");
    }
  }, [week, address]);

  useEffect(() => {
    queueMicrotask(load);
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  const live = board && board.week === board.current;
  const top3 = board?.split.slice(0, 3).map((p) => (board.pool * p) / 100) ?? [];

  return (
    <div className="chunk p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">🏆 Weekly Duel Leaderboard</h2>
          <p className="font-semibold text-ink/70">Ranked by net {symbol} won this week: what you won minus what you lost.</p>
        </div>
        {board && (
          <div className="flex gap-2">
            <button
              className={`btn px-3! py-1! text-base! ${live ? "btn-pink" : ""}`}
              onClick={() => setWeek(null)}
            >
              This week
            </button>
            <button
              className={`btn px-3! py-1! text-base! ${!live ? "btn-pink" : ""}`}
              onClick={() => setWeek(board.current - 1)}
            >
              Last week
            </button>
          </div>
        )}
      </div>

      {board && (
        <div className="mt-4 grid gap-3 rounded-2xl border-[3px] border-ink bg-[#fff1a8] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="font-display text-3xl">
              {n(board.pool)} {symbol} <span className="text-xl">prize pool every week</span>
            </p>
            <p className="font-semibold">
              🥇 {n(top3[0])} · 🥈 {n(top3[1])} · 🥉 {n(top3[2])} · 4th–10th share the rest
            </p>
            <p className="mt-1 text-sm font-bold text-ink/70">
              To win a prize: finish in profit with at least {board.minWins} wins that week. Prizes are sent to winners&apos; wallets after the week ends.
            </p>
          </div>
          <p className="font-display text-xl">{live ? `⏳ ${left(board.endsAt - now)}` : "Final results"}</p>
        </div>
      )}

      {err && <p className="mt-3 font-bold text-red-600">{err}</p>}

      {board && (
        <div className="mt-4 overflow-x-auto">
          {board.rows.length === 0 ? (
            <p className="font-semibold text-ink/70">{live ? "No duels finished yet this week. The first win takes the top spot!" : "No duels that week."}</p>
          ) : (
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="text-xs font-extrabold uppercase tracking-wide text-ink/60">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Player</th>
                  <th className="py-1 pr-2">W–L</th>
                  <th className="py-1 pr-2 text-right">Net {symbol}</th>
                  <th className="py-1 text-right">Prize</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((r) => {
                  const mine = address && r.address === address.toLowerCase();
                  return (
                    <tr key={r.address} className={`border-t-2 border-ink/10 font-semibold ${mine ? "bg-[#ccffb2]" : ""}`}>
                      <td className="py-1.5 pr-2 font-display text-lg">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</td>
                      <td className="py-1.5 pr-2 font-mono text-sm">
                        {short(r.address)}
                        {mine && " (you)"}
                      </td>
                      <td className="py-1.5 pr-2">
                        {r.wins}–{r.losses}
                      </td>
                      <td className={`py-1.5 pr-2 text-right ${r.net > 0 ? "text-green-700" : r.net < 0 ? "text-red-600" : ""}`}>{signed(r.net)}</td>
                      <td className="py-1.5 text-right font-display">{r.prize ? n(r.prize) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {board.me && !board.rows.some((r) => r.address === board.me!.address) && (
            <p className="mt-3 rounded-2xl border-[3px] border-ink bg-[#ccffb2] px-4 py-2 font-bold">
              You: #{board.me.rank} · {board.me.wins}–{board.me.losses} · {signed(board.me.net)} {symbol}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
