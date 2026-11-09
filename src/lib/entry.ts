// One sign-up and its tasks. Shared by the API routes and the UI.

import type { Airdrop } from "./airdrop";
import type { MochiList } from "./mochilist";

export type TaskId = "follow" | "engage" | "tag" | "wallet" | "mochi";

export type Entry = {
  handle: string;
  xid?: string;
  createdAt: number;
  updatedAt: number;
  // When each task was completed
  done: Partial<Record<TaskId, number>>;
  wallet?: string;
  // Verified post links
  tagLink?: string;
  mochiLink?: string;
  // Like and repost are tracked separately; "engage" completes when both are clicked
  liked?: boolean;
  reposted?: boolean;
  // Who invited them, and a hash of the network they added their wallet from
  referredBy?: string;
  ip?: string;
  // MochiList claim for partner collection holders, separate from the tasks above
  ml?: MochiList;
  // $MOCHI airdrop application (/mochiclaim)
  ad?: Airdrop;
};

export const TASK_ORDER: TaskId[] = ["follow", "engage", "tag", "wallet", "mochi"];

export const isComplete = (e: Pick<Entry, "done">) => TASK_ORDER.every((t) => e.done[t]);

export type RowStats = { referrals?: number; votes?: number; airdrop?: boolean };

// One sign-up as a flat row, used by the CSV export and the Google Sheet.
// Stats live outside the entry, so a row sent without them leaves those cells as they are.
export function signupRow(e: Entry, stats: RowStats = {}) {
  const iso = (t?: number) => (t ? new Date(t).toISOString() : "");
  const complete = isComplete(e);
  return {
    handle: e.handle,
    wallet: e.wallet ?? "",
    complete: complete ? "yes" : "no",
    followed: iso(e.done.follow),
    liked_reposted: iso(e.done.engage),
    tag_reply: e.tagLink ?? "",
    mochi_post: e.mochiLink ?? "",
    joined_at: iso(e.createdAt),
    completed_at: complete ? iso(Math.max(...Object.values(e.done).map(Number))) : "",
    updated_at: iso(e.updatedAt),
    referred_by: e.referredBy ?? "",
    referrals: stats.referrals === undefined ? "" : String(stats.referrals),
    votes: stats.votes === undefined ? "" : String(stats.votes),
    airdrop: stats.airdrop ? "yes" : "",
    mochilist: e.ml?.claimedAt ? "yes" : "",
    // Only once the spot is confirmed
    mochilist_wallet: e.ml?.claimedAt ? (e.ml.wallet ?? "") : "",
    mochilist_collection: e.ml?.claimedAt ? (e.ml.collection ?? "") : "",
    mochilist_comment: e.ml?.commentLink ?? "",
    mochilist_at: iso(e.ml?.claimedAt),
    // Only once the application is complete
    mochi_airdrop_wallet: e.ad?.appliedAt ? (e.ad.wallet ?? "") : "",
    mochi_airdrop_qrt: e.ad?.qrtLink ?? "",
    mochi_airdrop_invited_by: e.ad?.appliedAt ? (e.ad.invitedBy ?? "") : "",
    mochi_airdrop_at: iso(e.ad?.appliedAt),
  };
}
export type SignupRow = ReturnType<typeof signupRow>;

export type PublicEntry = Omit<Entry, "xid" | "ip">;

export function toPublic(e: Entry): PublicEntry {
  const copy = { ...e };
  delete copy.xid;
  delete copy.ip;
  return copy;
}

export const WALLET = /^0x[0-9a-fA-F]{40}$/;
export const HANDLE = /^\w{1,15}$/;

// The pinned post people like, repost and reply to. Hardcoded to the profile until the post is up:
// replace it with the post's status link and steps 2 and 3 switch to that post on their own.
export const PINNED_POST = "https://x.com/themochieffect/status/2119809934791524722";
export const PINNED_ID = /\/status(?:es)?\/(\d+)/.exec(PINNED_POST)?.[1] ?? "";
