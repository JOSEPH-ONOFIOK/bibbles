// One sign-up and its tasks. Shared by the API routes and the UI.

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
};

export const TASK_ORDER: TaskId[] = ["follow", "engage", "tag", "wallet", "mochi"];

export const isComplete = (e: Pick<Entry, "done">) => TASK_ORDER.every((t) => e.done[t]);

// One sign-up as a flat row, used by the CSV export and the Google Sheet
export function signupRow(e: Entry) {
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
  };
}
export type SignupRow = ReturnType<typeof signupRow>;

export type PublicEntry = Omit<Entry, "xid">;

export function toPublic(e: Entry): PublicEntry {
  const copy = { ...e };
  delete copy.xid;
  return copy;
}

export const WALLET = /^0x[0-9a-fA-F]{40}$/;
export const HANDLE = /^\w{1,15}$/;

// The pinned post people like, repost and reply to. Any x.com or twitter.com status link.
export const PINNED_POST = process.env.NEXT_PUBLIC_PINNED_POST ?? "";
export const PINNED_ID = /\/status(?:es)?\/(\d+)/.exec(PINNED_POST)?.[1] ?? "";
