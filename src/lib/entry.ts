// One sign-up and its tasks. Shared by the API routes and the UI.

export type TaskId = "follow" | "engage" | "tag" | "wallet" | "bibble";

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
  bibbleLink?: string;
  // Like and repost are tracked separately; "engage" completes when both are clicked
  liked?: boolean;
  reposted?: boolean;
};

export const TASK_ORDER: TaskId[] = ["follow", "engage", "tag", "wallet", "bibble"];

export const isComplete = (e: Pick<Entry, "done">) => TASK_ORDER.every((t) => e.done[t]);

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
