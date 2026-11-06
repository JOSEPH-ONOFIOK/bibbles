import { type MochiLook, AURAS, BACKGROUNDS, FACES, FITS, HEADS, SKINS } from "@/components/MochiArt";
import type { Entry } from "./entry";
import { queueMirror } from "./mirror";
import { AIRDROP_VOTES } from "./mochi";
import { redis, store } from "./store";

// Referrals, the gallery and votes. Everything here needs the database.

const REFS = "refs"; // sorted set: handle → friends referred
const VOTES = "g:votes"; // sorted set: handle → votes, every Mochi on display
const NEWEST = "g:new"; // sorted set: handle → time put on display
const AIRDROP = "airdrop"; // set of handles that reached AIRDROP_VOTES
const display = (h: string) => `g:${h}`;
const voters = (h: string) => `v:${h}`; // who voted for this Mochi
const networks = (h: string) => `vip:${h}`; // which networks voted for it
const votedBy = (h: string) => `vm:${h}`; // what this person voted for

const key = (h: string) => h.toLowerCase();
export const PAGE = 24;

export type Display = { handle: string; name: string; look: MochiLook; at: number };

// ---------- referrals ----------

// Counts when a friend adds their wallet for the first time. A failure here
// must not stop them saving it.
export async function creditReferral(friend: Entry, ref: unknown) {
  const code = typeof ref === "string" ? key(ref.trim()) : "";
  if (!/^\w{1,15}$/.test(code) || code === key(friend.handle)) return;
  try {
    const inviter = await store.get(code);
    if (!inviter?.done.wallet) return;
    friend.referredBy = inviter.handle;
    if (inviter.ip && inviter.ip === friend.ip) return; // same network: recorded, not counted
    const count = Number(await redis("ZINCRBY", REFS, 1, code));
    queueMirror({ ...inviter, updatedAt: Date.now() }, { referrals: count });
  } catch (e) {
    console.error("referral failed", code, e);
  }
}

function pairs(flat: string[]) {
  const out: { handle: string; score: number }[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ handle: flat[i], score: Number(flat[i + 1]) });
  return out;
}

export async function topReferrers(limit = 20) {
  const rows = pairs(await redis<string[]>("ZREVRANGE", REFS, 0, limit - 1, "WITHSCORES"));
  if (!rows.length) return [];
  // Handles are stored lowercase: read the entries back for how people wrote theirs
  const raw = await redis<(string | null)[]>("MGET", ...rows.map((r) => `e:${r.handle}`));
  return rows.map((r, i) => ({ handle: raw[i] ? (JSON.parse(raw[i]!) as Entry).handle : r.handle, count: r.score }));
}

export async function referralStats(handle: string) {
  const [count, rank] = await Promise.all([
    redis<string | null>("ZSCORE", REFS, key(handle)),
    redis<number | null>("ZREVRANK", REFS, key(handle)),
  ]);
  return { count: Number(count ?? 0), rank: rank === null ? null : rank + 1 };
}

// ---------- gallery ----------

const oneOf = (list: readonly string[], v: unknown) => typeof v === "string" && list.includes(v);

function validLook(x: unknown): x is MochiLook {
  const l = x as Partial<Record<keyof MochiLook, unknown>> | null;
  return (
    !!l &&
    oneOf(Object.keys(SKINS), l.skin) &&
    oneOf(FACES, l.face) &&
    oneOf(HEADS, l.head) &&
    oneOf(FITS, l.fit) &&
    oneOf(AURAS, l.aura) &&
    oneOf([...Object.keys(BACKGROUNDS), "none"], l.bg)
  );
}

// Letters, numbers, spaces and apostrophes: no links, tags or handles on the wall
const NAME = /^[\p{L}\p{N} '’-]{1,24}$/u;

export async function isDisplayed(handle: string) {
  return (await redis<string | null>("GET", display(key(handle)))) !== null;
}

// One Mochi per account, and it stays as posted so votes can't be moved to a new one
export async function putOnDisplay(entry: Entry, name: unknown, look: unknown) {
  const h = key(entry.handle);
  const clean = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!NAME.test(clean)) return { error: "Names can use letters, numbers and spaces, up to 24 characters." };
  if (!validLook(look)) return { error: "That Mochi doesn't look right. Try again." };
  const d: Display = { handle: entry.handle, name: clean, look, at: Date.now() };
  const first = await redis<string | null>("SET", display(h), JSON.stringify(d), "NX");
  if (first !== "OK") return { error: "You already have a Mochi on display." };
  await redis("ZADD", VOTES, 0, h);
  await redis("ZADD", NEWEST, d.at, h);
  return { display: d };
}

export async function galleryPage(sort: "top" | "new", page: number, viewer?: string) {
  const start = page * PAGE;
  const [ids, total, mine] = await Promise.all([
    redis<string[]>("ZREVRANGE", sort === "top" ? VOTES : NEWEST, start, start + PAGE - 1),
    redis<number>("ZCARD", VOTES),
    viewer ? redis<string[]>("SMEMBERS", votedBy(key(viewer))) : Promise.resolve<string[]>([]),
  ]);
  if (!ids.length) return { items: [], total, more: false };
  const [raw, scores, won] = await Promise.all([
    redis<(string | null)[]>("MGET", ...ids.map(display)),
    redis<(string | null)[]>("ZMSCORE", VOTES, ...ids),
    redis<(0 | 1)[]>("SMISMEMBER", AIRDROP, ...ids),
  ]);
  const voted = new Set(mine);
  const items = ids.flatMap((id, i) => {
    if (!raw[i]) return [];
    const d = JSON.parse(raw[i]!) as Display;
    return [{ handle: d.handle, name: d.name, look: d.look, votes: Number(scores[i] ?? 0), secured: !!won[i], voted: voted.has(id), mine: id === (viewer && key(viewer)) }];
  });
  return { items, total, more: start + PAGE < total };
}

// One vote per person, and one per network, for each Mochi. Votes win a free
// airdrop, so a stack of accounts on one connection only counts once.
export async function vote(voter: Entry, target: unknown, ip: string) {
  const t = typeof target === "string" ? key(target) : "";
  const me = key(voter.handle);
  if (t === me) return { error: "You can't vote for your own Mochi." };
  if ((await redis<string | null>("ZSCORE", VOTES, t)) === null) return { error: "That Mochi isn't on display." };

  if (!(await redis<number>("SADD", voters(t), me))) return { error: "You already voted for this Mochi." };
  if (!(await redis<number>("SADD", networks(t), ip))) {
    await redis("SREM", voters(t), me);
    return { error: "Someone on your connection already voted for this Mochi." };
  }
  const votes = Number(await redis("ZINCRBY", VOTES, 1, t));
  await redis("SADD", votedBy(me), t);

  const secured = votes >= AIRDROP_VOTES;
  if (secured && (await redis<number>("SADD", AIRDROP, t))) {
    const winner = await store.get(t);
    if (winner) queueMirror({ ...winner, updatedAt: Date.now() }, { votes, airdrop: true });
  }
  return { votes, secured };
}

// Admin: takes a Mochi off the wall for good, and any airdrop it won.
export async function hideDisplay(handle: string) {
  const h = key(handle);
  await redis("ZREM", VOTES, h);
  await redis("ZREM", NEWEST, h);
  await redis("SREM", AIRDROP, h);
}

// Every count, for the CSV export
export async function allStats() {
  const [refs, votes, won] = await Promise.all([
    redis<string[]>("ZREVRANGE", REFS, 0, -1, "WITHSCORES"),
    redis<string[]>("ZREVRANGE", VOTES, 0, -1, "WITHSCORES"),
    redis<string[]>("SMEMBERS", AIRDROP),
  ]);
  const refMap = new Map(pairs(refs).map((p) => [p.handle, p.score]));
  const voteMap = new Map(pairs(votes).map((p) => [p.handle, p.score]));
  const wonSet = new Set(won);
  return (handle: string) => ({
    referrals: refMap.get(key(handle)) ?? 0,
    votes: voteMap.get(key(handle)) ?? 0,
    airdrop: wonSet.has(key(handle)),
  });
}
