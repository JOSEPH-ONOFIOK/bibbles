// Server only: which eligible collections a wallet holds, read live from each chain.

import { CHAIN_NAMES, COLLECTIONS, type Chain } from "./mochilist";
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

// One MochiList wallet per X account
export async function mlWalletOwner(wallet: string) {
  return hasDatabase ? redis<string | null>("GET", `mlw:${wallet.toLowerCase()}`) : null;
}

export async function mlClaimWallet(wallet: string, handle: string, previous?: string) {
  if (!hasDatabase) return;
  if (previous) await redis("DEL", `mlw:${previous.toLowerCase()}`);
  await redis("SET", `mlw:${wallet.toLowerCase()}`, handle.toLowerCase());
}

export async function mlConfirm(handle: string) {
  if (hasDatabase) await redis("SADD", "mochilist", handle.toLowerCase());
}
