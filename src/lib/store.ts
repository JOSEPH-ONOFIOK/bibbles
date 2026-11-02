import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Entry } from "./entry";

// Storage, first one configured wins:
//   Upstash Redis   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (production)
//   JSON file       .data/entries.json (local development only)

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

async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
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

// ---------- Local file ----------
// Reads the file fresh on every call: each route is its own bundle, so an
// in-memory copy would go stale between routes.
const DIR = join(process.cwd(), ".data");
const FILE = join(DIR, "entries.json");
const windows = new Map<string, { n: number; reset: number }>();
let queue: Promise<unknown> = Promise.resolve();

async function db(): Promise<Record<string, Entry>> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}

function mutate(fn: (d: Record<string, Entry>) => void) {
  const run = queue.then(async () => {
    const d = await db();
    fn(d);
    await mkdir(DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(d, null, 1));
    await rename(tmp, FILE);
  });
  queue = run.catch(() => {});
  return run;
}

const file: Store = {
  async get(handle) {
    return (await db())[key(handle)] ?? null;
  },
  async put(entry) {
    await mutate((d) => {
      d[key(entry.handle)] = entry;
    });
  },
  async all() {
    return Object.values(await db());
  },
  async walletOwner(wallet) {
    const w = wallet.toLowerCase();
    return Object.values(await db()).find((e) => e.wallet?.toLowerCase() === w)?.handle.toLowerCase() ?? null;
  },
  async claimWallet() {
    // the file store finds wallets by scanning entries
  },
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

// The file store can't work on serverless hosts (read-only disk, many instances), so fail loudly there.
const serverless = !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
export class DbNotConfigured extends Error {}
export const dbConfigured = !!(URL_ && TOKEN) || !serverless;

const unconfigured = new Proxy({} as Store, {
  get() {
    return () => Promise.reject(new DbNotConfigured("Database not configured: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"));
  },
});

export const store: Store = URL_ && TOKEN ? upstash : serverless ? unconfigured : file;
