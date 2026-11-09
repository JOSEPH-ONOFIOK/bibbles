// Server only: which eligible collections a wallet holds, read live from each chain.

import { CHAIN_NAMES, COLLECTIONS, ML_CAP, limitOf, type Chain, type MlStats } from "./mochilist";
import { hasDatabase, redis } from "./store";

const RPC: Record<Chain, string> = {
  ethereum: process.env.ETHEREUM_RPC_URL || "https://ethereum-rpc.publicnode.com",
  robinhood: process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
  arc: process.env.ARC_RPC_URL || "https://rpc.mainnet.arc.io",
};

// ERC-721 balanceOf(address)
async function balanceOf(chain: Chain, contract: string, wallet: string) {
  const data = "0x70a08231" + wallet.slice(2).toLowerCase().padStart(64, "0");
  const res = await fetch(RPC[chain], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: contract, data }, "latest"] }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const j = await res.json();
  if (j.error || typeof j.result !== "string") throw new Error(j.error?.message ?? `rpc ${res.status}`);
  return BigInt(j.result === "0x" ? 0 : j.result);
}

const once = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch {
    return fn(); // one retry: public RPCs drop the odd request
  }
};

// held: collections with at least one NFT. down: chains we couldn't read.
export async function checkHoldings(wallet: string) {
  const live = COLLECTIONS.filter((c) => c.contract);
  const results = await Promise.allSettled(live.map((c) => once(() => balanceOf(c.chain, c.contract, wallet))));
  const held: string[] = [];
  const down = new Set<string>();
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (r.value > BigInt(0)) held.push(live[i].name);
    } else down.add(CHAIN_NAMES[live[i].chain]);
  });
  return { held, down: [...down] };
}

// One MochiList wallet per X account. A wallet is only reserved once its spot is confirmed.
export async function mlWalletOwner(wallet: string) {
  return hasDatabase ? redis<string | null>("GET", `mlw:${wallet.toLowerCase()}`) : null;
}

const byKey = (collection: string) => `mlc:${collection}`;

export async function mlClaimedCount() {
  return hasDatabase ? redis<number>("SCARD", "mochilist") : 0;
}

type Confirm = { ok: true; spot: number; collection: string } | { ok: false; reason: "full" | "wallet" | "community" };

// Takes a spot in the first of `candidates` (collections they hold, best first) that
// still has room, and reserves the wallet. Never goes past ML_CAP or a community's
// limit, even when several people confirm at the same moment.
export async function mlConfirm(handle: string, wallet: string, candidates: string[]): Promise<Confirm> {
  if (!hasDatabase) return { ok: true, spot: 0, collection: candidates[0] };
  const h = handle.toLowerCase();
  const w = `mlw:${wallet.toLowerCase()}`;
  const took = (await redis<string | null>("SET", w, h, "NX")) === "OK";
  if (!took && (await redis<string | null>("GET", w)) !== h) return { ok: false, reason: "wallet" };
  const release = async () => {
    if (took) await redis("DEL", w);
  };

  // Community first, then the total: the per-community counts are never behind the
  // total, so the stats never mistake an in-progress claim for a missing one.
  let collection = "";
  for (const c of candidates) {
    await redis("SADD", byKey(c), h);
    if ((await redis<number>("SCARD", byKey(c))) <= limitOf(c)) {
      collection = c;
      break;
    }
    await redis("SREM", byKey(c), h);
  }
  if (!collection) {
    await release();
    return { ok: false, reason: "community" };
  }
  await redis("SADD", "mochilist", h);
  const spot = await redis<number>("SCARD", "mochilist");
  if (spot > ML_CAP) {
    await redis("SREM", "mochilist", h);
    await redis("SREM", byKey(collection), h);
    await release();
    return { ok: false, reason: "full" };
  }
  return { ok: true, spot, collection };
}

// Spots claimed per community, for the collections given
export async function mlCommunityCounts(names: string[]) {
  if (!hasDatabase) return names.map(() => 0);
  return Promise.all(names.map((n) => redis<number>("SCARD", byKey(n))));
}

// Claimed spots in total and per collection
export async function mlStats(): Promise<MlStats> {
  if (!hasDatabase) return { claimed: 0, cap: ML_CAP, by: {} };
  const [claimed, counts] = await Promise.all([mlClaimedCount(), Promise.all(COLLECTIONS.map((c) => redis<number>("SCARD", byKey(c.name))))]);
  // Every confirmed claim records its community, so the counts are read as they are.
  // (Claims through a community that's since been removed count in the total only.)
  return { claimed, cap: ML_CAP, by: Object.fromEntries(COLLECTIONS.map((c, i) => [c.name, counts[i]])) };
}
