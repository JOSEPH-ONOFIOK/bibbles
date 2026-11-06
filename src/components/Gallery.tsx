"use client";

import { useEffect, useState } from "react";
import { burstFrom } from "@/lib/burst";
import { AIRDROP_VOTES } from "@/lib/mochi";
import { MochiArt, type MochiLook } from "./MochiArt";
import { useSession } from "./Session";
import { useWall } from "./WallContext";

type Item = { handle: string; name: string; look: MochiLook; votes: number; secured: boolean; voted: boolean; mine: boolean };
type Sort = "top" | "new";

const load = async (sort: Sort, page: number) => {
  const res = await fetch(`/api/gallery?sort=${sort}&page=${page}`);
  return (await res.json()) as { items?: Item[]; total?: number; more?: boolean };
};

function Card({ item, canVote, onVoted }: { item: Item; canVote: boolean; onVoted: (handle: string, votes: number, secured: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const percent = Math.min(100, (item.votes / AIRDROP_VOTES) * 100);

  const vote = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/gallery/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: item.handle }),
    });
    const d = await res.json().catch(() => ({ error: "Something went wrong. Please try again." }));
    setBusy(false);
    if (d.error) return setError(d.error);
    burstFrom(button, "hearts", 8);
    onVoted(item.handle, d.votes, d.secured);
  };

  return (
    <article className="chunk flex flex-col overflow-hidden p-0!">
      <div className="relative aspect-square border-b-4 border-ink">
        <MochiArt look={item.look} className="h-full w-full" title={item.name} svgId={`wall-${item.handle}`} />
        {item.secured && (
          <span className="absolute top-2 left-2 -rotate-3 rounded-full border-[3px] border-ink bg-[#fff1a8] px-2 py-0.5 font-display text-sm">Airdrop secured</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="truncate font-display text-xl leading-tight">{item.name}</h3>
        <a href={`https://x.com/${item.handle}`} target="_blank" rel="noreferrer" className="truncate text-xs font-bold text-ink/60 hover:underline">
          @{item.handle}
        </a>
        <div className="mt-auto pt-1">
          <div className="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-white" role="img" aria-label={`${item.votes} of ${AIRDROP_VOTES} votes`}>
            <div className="h-full bg-pink" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-xs font-extrabold tabular-nums">
            {item.votes} / {AIRDROP_VOTES} votes
          </p>
        </div>
        {item.mine ? (
          <p className="rounded-full border-[3px] border-ink bg-[#e2d4ff] py-1 text-center text-sm font-extrabold">Your Mochi</p>
        ) : item.voted ? (
          <p className="rounded-full border-[3px] border-ink bg-[#ccffb2] py-1 text-center text-sm font-extrabold">Voted</p>
        ) : canVote ? (
          <button onClick={vote} disabled={busy} className="btn btn-pink py-1! text-base!">
            Vote
          </button>
        ) : (
          <a href="#join" className="btn py-1! text-base!">
            Vote
          </a>
        )}
        {error && <p className="text-xs font-bold text-[#c2185b]">{error}</p>}
      </div>
    </article>
  );
}

export function Gallery() {
  const { entry } = useSession();
  const { on, ready, galleryTick } = useWall();
  const [sort, setSort] = useState<Sort>("top");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const handle = entry?.handle;

  useEffect(() => {
    if (!on) return;
    let live = true;
    load(sort, 0)
      .then((d) => {
        if (!live) return;
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
        setMore(!!d.more);
        setPage(0);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [on, sort, galleryTick, handle]);

  const loadMore = async () => {
    const next = page + 1;
    const d = await load(sort, next).catch(() => null);
    if (!d) return;
    // A vote can move a Mochi between pages, so never show one twice
    setItems((old) => [...old, ...(d.items ?? []).filter((n) => !old.some((o) => o.handle === n.handle))]);
    setMore(!!d.more);
    setPage(next);
  };

  const onVoted = (h: string, votes: number, secured: boolean) =>
    setItems((list) => list.map((i) => (i.handle === h ? { ...i, votes, secured, voted: true } : i)));

  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="text-center">
        <h2 className="font-display text-6xl text-white" style={{ textShadow: "4px 4px 0 #161616" }}>
          The Gallery
        </h2>
        <p className="mx-auto mt-2 max-w-xl font-bold text-ink/80">
          Hang your Mochi on the wall and vote for your favourites. Reach {AIRDROP_VOTES} votes and you secure a free airdrop.
        </p>
      </div>

      {!ready || (on && loading) ? (
        <p className="mt-8 text-center font-display text-2xl text-ink/50">Loading…</p>
      ) : !on ? (
        <p className="chunk mt-8 p-6 text-center font-display text-2xl">The gallery opens soon.</p>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <p className="font-bold">
              {total} {total === 1 ? "Mochi" : "Mochis"} on display
            </p>
            <div className="flex gap-2">
              {(["top", "new"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  aria-pressed={sort === s}
                  className={`rounded-full border-4 border-ink px-4 py-0.5 font-display text-lg transition active:scale-90 ${sort === s ? "bg-ink text-white" : "bg-white"}`}
                >
                  {s === "top" ? "Most votes" : "Newest"}
                </button>
              ))}
            </div>
          </div>

          {items.length ? (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <Card key={item.handle} item={item} canVote={!!entry?.wallet} onVoted={onVoted} />
              ))}
            </div>
          ) : (
            <div className="chunk mt-4 p-6 text-center">
              <p className="font-display text-2xl">The wall is empty.</p>
              <a href="#builder" className="btn btn-pink mt-3 text-lg!">
                Be the first
              </a>
            </div>
          )}

          {more && (
            <div className="mt-6 text-center">
              <button onClick={loadMore} className="btn text-lg!">
                Show more
              </button>
            </div>
          )}

          {!entry?.wallet && items.length > 0 && <p className="mt-4 text-center text-sm font-bold text-ink/70">Connect X and add your wallet in the Join tasks to vote.</p>}
        </>
      )}
    </div>
  );
}
