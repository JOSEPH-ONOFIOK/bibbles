import { cookies } from "next/headers";
import { cookieBase, sign, unsign } from "./auth";
import type { Entry } from "./entry";
import { queueMirror } from "./mirror";

// Storage:
//   Upstash Redis   when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
//                   Referrals, the gallery and votes need it.
//   Browser cookie  otherwise: each visitor's progress is kept in a signed cookie

interface Store {
  get(handle: string): Promise<Entry | null>;
  put(entry: Entry): Promise<void>;
  all(): Promise<Entry[]>;
  // Which handle already uses this wallet, if any
  walletOwner(wallet: string): Promise<string | null>;
  claimWallet(wallet: string, handle: string, previous?: string): Promise<void>;
  // Fixed-window rate limit. Returns true when the call is allowed.
  limit(key: string, max: number, windowSec: number): Promise<boolean>;
}

const key = (h: string) => h.toLowerCase();

// ---------- Upstash ----------
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result as T;
}

const upstash: Store = {
  async get(handle) {
    const v = await redis<string | null>("GET", `e:${key(handle)}`);
    return v ? (JSON.parse(v) as Entry) : null;
  },
  async put(entry) {
    await redis("SET", `e:${key(entry.handle)}`, JSON.stringify(entry));
    await redis("SADD", "entries", key(entry.handle));
  },
  async all() {
    const handles = await redis<string[]>("SMEMBERS", "entries");
    if (!handles.length) return [];
    const vals = await redis<(string | null)[]>("MGET", ...handles.map((h) => `e:${h}`));
    return vals.filter(Boolean).map((v) => JSON.parse(v!) as Entry);
  },
  walletOwner: (wallet) => redis<string | null>("GET", `w:${wallet.toLowerCase()}`),
  async claimWallet(wallet, handle, previous) {
    if (previous) await redis("DEL", `w:${previous.toLowerCase()}`);
    await redis("SET", `w:${wallet.toLowerCase()}`, key(handle));
  },
  async limit(k, max, windowSec) {
    const n = await redis<number>("INCR", `rl:${k}`);
    if (n === 1) await redis("EXPIRE", `rl:${k}`, windowSec);
    return n <= max;
  },
};

// ---------- Browser cookie ----------
// No database: each visitor's entry lives in a signed cookie in their own
// browser. Signing means it can't be edited to fake tasks. There is no shared
// list, so the export is empty and wallets can't be checked across accounts.
const ENTRY_COOKIE = "mochi_entry";
const windows = new Map<string, { n: number; reset: number }>();

const cookie: Store = {
  async get(handle) {
    const e = unsign<Entry>((await cookies()).get(ENTRY_COOKIE)?.value);
    return e && key(e.handle) === key(handle) ? e : null;
  },
  async put(entry) {
    (await cookies()).set({ name: ENTRY_COOKIE, value: sign(entry), ...cookieBase, maxAge: 180 * 86400 });
  },
  async all() {
    return [];
  },
  async walletOwner() {
    return null;
  },
  async claimWallet() {},
  // Per server instance only, which is the best a cookie setup can do
  async limit(k, max, windowSec) {
    const now = Date.now();
    const w = windows.get(k);
    if (!w || w.reset < now) {
      windows.set(k, { n: 1, reset: now + windowSec * 1000 });
      return true;
    }
    return ++w.n <= max;
  },
};

export const hasDatabase = !!(URL_ && TOKEN);
const base = hasDatabase ? upstash : cookie;

// Someone who started while progress lived in their browser keeps it: the first
// time they come back, their signed cookie moves into the database.
async function importCookieEntry(handle: string) {
  const old = await cookie.get(handle);
  if (!old) return null;
  if (old.wallet) {
    const owner = await upstash.walletOwner(old.wallet);
    if (owner && owner !== key(old.handle)) {
      // Another account claimed this wallet first
      delete old.wallet;
      delete old.done.wallet;
      delete old.done.mochi;
      delete old.mochiLink;
    } else await upstash.claimWallet(old.wallet, old.handle);
  }
  await upstash.put(old);
  return old;
}

export const store: Store = {
  ...base,
  async get(handle) {
    const entry = await base.get(handle);
    return entry ?? (hasDatabase ? importCookieEntry(handle) : null);
  },
  async put(entry) {
    await base.put(entry);
    queueMirror(entry);
  },
};
