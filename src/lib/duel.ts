// Server only: Mochi Duel runs, scoring and signed results.
//
// Redis keys (per match id):
//   duel:{id}:p:{address}  the player's run: { startAt, inputs, rejected? }
//   duel:{id}:first        startAt of whoever started first
//   duel:{id}:result       the decided result and its signature (set once)
//   duel:{id}:relay        lock so the result is only sent onchain once
//
// The house AI: a project wallet (DUEL_HOUSE_KEY) that joins a waiting duel when its creator asks,
// with the same stake. Its moves come from the match seed (see duel/ai.ts), so they're fixed per map.

import { createHmac, timingSafeEqual } from "node:crypto";
import { createPublicClient, createWalletClient, formatUnits, getAddress, http, maxUint256, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  COUNTDOWN_S,
  DUEL_CONTRACT,
  MOCHI_TOKEN,
  Outcome,
  START_WINDOW_S,
  Status,
  UPLOAD_GRACE_S,
  duelWeek,
  erc20Abi,
  escrowAbi,
  robinhood,
} from "@/duel/config";
import { aiMoves } from "@/duel/ai";
import { SECONDS, TICKS, TPS, replay, validInputs, type Summary } from "@/duel/sim";
import { hasDatabase, redis } from "./store";

const SIGNER_KEY = process.env.DUEL_SIGNER_KEY as Hex | undefined;
const RELAYER_KEY = process.env.DUEL_RELAYER_KEY as Hex | undefined;
const SECRET = process.env.DUEL_SECRET || "";
const HOUSE_KEY = process.env.DUEL_HOUSE_KEY as Hex | undefined;

/** The house AI's wallet address, when the AI opponent is switched on. */
export const house: Address | null = HOUSE_KEY ? privateKeyToAccount(HOUSE_KEY).address : null;
export const isHouse = (a: string) => Boolean(house && a.toLowerCase() === house.toLowerCase());
const houseIn = (m: OnchainMatch) => isHouse(m.playerA) || isHouse(m.playerB);
// Largest stake the AI will accept, in whole MOCHI
export const AI_MAX_STAKE = Number(process.env.DUEL_AI_MAX_STAKE || 5000);

export const duelReady = () => Boolean(DUEL_CONTRACT && MOCHI_TOKEN && SIGNER_KEY && SECRET.length >= 32 && hasDatabase);

const rpc = process.env.ROBINHOOD_RPC_URL || robinhood.rpcUrls.default.http[0];
export const chain = createPublicClient({ chain: robinhood, transport: http(rpc, { timeout: 8000, retryCount: 1 }) });

// ------------------------------------------------------------------ chain reads

export type OnchainMatch = {
  id: string;
  playerA: Address;
  playerB: Address;
  stake: string;
  feeBps: number;
  status: number;
  joinDeadline: number;
  settleDeadline: number;
};

export async function readMatch(id: bigint): Promise<OnchainMatch | null> {
  const m = await chain.readContract({ address: DUEL_CONTRACT!, abi: escrowAbi, functionName: "getMatch", args: [id] });
  if (m.status === Status.None) return null;
  return {
    id: id.toString(),
    playerA: m.playerA,
    playerB: m.playerB,
    stake: m.stake.toString(),
    feeBps: m.feeBps,
    status: m.status,
    joinDeadline: Number(m.joinDeadline),
    settleDeadline: Number(m.settleDeadline),
  };
}

let tokenInfo: { symbol: string; decimals: number } | undefined;
export async function readToken() {
  if (!tokenInfo) {
    const [symbol, decimals] = await Promise.all([
      chain.readContract({ address: MOCHI_TOKEN!, abi: erc20Abi, functionName: "symbol" }),
      chain.readContract({ address: MOCHI_TOKEN!, abi: erc20Abi, functionName: "decimals" }),
    ]);
    tokenInfo = { symbol, decimals };
  }
  return tokenInfo;
}

// ------------------------------------------------------------------ secrets

const hmac = (msg: string) => createHmac("sha256", SECRET).update(msg).digest();

/** The map seed. Both players get the same one, and nobody can work it out ahead of time. */
export const seedFor = (id: string) => hmac(`seed:${id}`).readUInt32BE(0);

/** Proves the caller signed in with this wallet for this match. */
export const tokenFor = (id: string, address: string) => hmac(`play:${id}:${address.toLowerCase()}`).toString("hex");
export const checkToken = (id: string, address: string, token: string) => {
  const want = Buffer.from(tokenFor(id, address), "hex");
  const got = Buffer.from(String(token), "hex");
  return got.length === want.length && timingSafeEqual(got, want);
};

// ------------------------------------------------------------------ runs

export type Run = { startAt: number; inputs: string; rejected?: string; ai?: boolean };
export type Result = {
  outcome: number;
  winner: Address | null;
  reason: string;
  signature: Hex;
  a: Summary | null;
  b: Summary | null;
  decidedAt: number;
  tx?: Hex;
};

const k = (id: string, rest: string) => `duel:${id}:${rest}`;
const runKey = (id: string, address: string) => k(id, `p:${address.toLowerCase()}`);
const TTL = 60 * 60 * 24 * 14;

export async function getRun(id: string, address: string) {
  const raw = await redis<string | null>("GET", runKey(id, address));
  return raw ? (JSON.parse(raw) as Run) : null;
}
const putRun = (id: string, address: string, run: Run) => redis("SET", runKey(id, address), JSON.stringify(run), "EX", TTL);

export async function getResult(id: string) {
  const raw = await redis<string | null>("GET", k(id, "result"));
  return raw ? (JSON.parse(raw) as Result) : null;
}

export const runDeadline = (run: Run) => run.startAt + (SECONDS + UPLOAD_GRACE_S) * 1000;
const runDone = (run: Run, now: number) => Boolean(run.rejected) || run.inputs.length >= TICKS || now > runDeadline(run);

/** Begin (or resume) a player's run. */
export async function startRun(m: OnchainMatch, address: Address, now = Date.now()) {
  const existing = await getRun(m.id, address);
  if (existing) return { run: existing };
  const first = await redis<string | null>("GET", k(m.id, "first"));
  if (first && now > Number(first) + START_WINDOW_S * 1000) return { error: "Too late: you didn't start within 60 seconds of your opponent." };
  const run: Run = { startAt: now + COUNTDOWN_S * 1000, inputs: "" };
  await redis("SET", k(m.id, "first"), String(run.startAt), "NX", "EX", TTL);
  // NX: if two requests race, the first one wins and both get the same run
  const set = await redis<string | null>("SET", runKey(m.id, address), JSON.stringify(run), "NX", "EX", TTL);
  const mine = set ? run : (await getRun(m.id, address))!;
  // Against the house, the AI starts at the same moment, on the same map
  const other = getAddress(address) === getAddress(m.playerA) ? m.playerB : m.playerA;
  if (isHouse(other)) {
    const ai: Run = { startAt: mine.startAt, inputs: aiMoves(seedFor(m.id)), ai: true };
    await redis("SET", runKey(m.id, other), JSON.stringify(ai), "NX", "EX", TTL);
  }
  return { run: mine };
}

// Moves can't arrive faster than real time (plus a little slack for clocks and the network).
const SLACK_TICKS = TPS * 2;

/** Add a chunk of moves to a run. Append only; `from` must match what we already have. */
export async function addMoves(id: string, address: string, from: number, chunk: string, now = Date.now()) {
  const run = await getRun(id, address);
  if (!run) return { error: "Run not started." };
  if (run.rejected || run.inputs.length >= TICKS || now > runDeadline(run)) return { run };
  if (from !== run.inputs.length) return { run }; // out of step: the client resends from run.inputs.length
  if (!validInputs(run.inputs + chunk)) {
    run.rejected = "Invalid moves";
  } else {
    const allowed = Math.floor(((now - run.startAt) / 1000) * TPS) + SLACK_TICKS;
    if (run.inputs.length + chunk.length > allowed) run.rejected = "Moves arrived faster than real time";
    else run.inputs += chunk;
  }
  await putRun(id, address, run);
  return { run };
}

export const score = (id: string, run: Run | null) => (run ? replay(seedFor(id), run.inputs) : null);

/** The score so far. The AI's run is computed up front, so only the part played by now is shown. */
export function liveScore(id: string, run: Run | null, now = Date.now()) {
  if (!run) return null;
  if (!run.ai) return score(id, run);
  const ticks = Math.min(TICKS, Math.max(0, Math.floor(((now - run.startAt) / 1000) * TPS)));
  return replay(seedFor(id), run.inputs.slice(0, ticks));
}

// ------------------------------------------------------------------ deciding

type Decision = { outcome: number; reason: string };

/** The published rules, in code. Returns null while the match is still being played. */
export function decide(m: OnchainMatch, a: Run | null, b: Run | null, now: number): Decision | null {
  const id = m.id;
  if (!a && !b) return null; // nobody started; the onchain refund covers it if nobody ever does

  if (!a || !b) {
    const started = (a ?? b)!;
    if (now <= started.startAt + START_WINDOW_S * 1000) return null;
    if (started.rejected) return { outcome: Outcome.Void, reason: "The only run failed the server check" };
    return a
      ? { outcome: Outcome.PlayerAWins, reason: "Player B didn't start within 60 seconds" }
      : { outcome: Outcome.PlayerBWins, reason: "Player A didn't start within 60 seconds" };
  }

  if (!runDone(a, now) || !runDone(b, now)) return null;

  if (a.rejected && b.rejected) return { outcome: Outcome.Void, reason: "Both runs failed the server check" };
  if (a.rejected) return { outcome: Outcome.PlayerBWins, reason: `Player A's run failed the server check (${a.rejected})` };
  if (b.rejected) return { outcome: Outcome.PlayerAWins, reason: `Player B's run failed the server check (${b.rejected})` };

  if (a.inputs.length < TICKS && b.inputs.length < TICKS) return { outcome: Outcome.Void, reason: "Both players disconnected" };

  const sa = score(id, a)!;
  const sb = score(id, b)!;
  if (sa.score !== sb.score) {
    return sa.score > sb.score
      ? { outcome: Outcome.PlayerAWins, reason: "Higher score" }
      : { outcome: Outcome.PlayerBWins, reason: "Higher score" };
  }
  if (sa.hits !== sb.hits) {
    return sa.hits < sb.hits
      ? { outcome: Outcome.PlayerAWins, reason: "Same score, fewer hits" }
      : { outcome: Outcome.PlayerBWins, reason: "Same score, fewer hits" };
  }
  return { outcome: Outcome.Void, reason: "Tie: same score and same hits" };
}

const signer = () => privateKeyToAccount(SIGNER_KEY!);

export const signResult = (id: string, outcome: number) =>
  signer().signTypedData({
    domain: { name: "MochiDuelEscrow", version: "1", chainId: robinhood.id, verifyingContract: DUEL_CONTRACT! },
    types: { Result: [{ name: "matchId", type: "uint256" }, { name: "outcome", type: "uint8" }] },
    primaryType: "Result",
    message: { matchId: BigInt(id), outcome },
  });

/** Decide the match if it's over, sign the result once, and (with a relayer key) pay it out onchain. */
export async function resolve(m: OnchainMatch, now = Date.now()): Promise<Result | null> {
  const existing = await getResult(m.id);
  if (existing) {
    if (!existing.tx && m.status === Status.Locked) await relay(m, existing); // retry an earlier failed relay
    return existing;
  }
  if (m.status !== Status.Locked) return null;
  // Past the settle deadline the contract only allows refunds, so don't sign anything.
  if (now / 1000 > m.settleDeadline) return null;

  const [a, b] = await Promise.all([getRun(m.id, m.playerA), getRun(m.id, m.playerB)]);
  const d = decide(m, a, b, now);
  if (!d) return null;

  const result: Result = {
    outcome: d.outcome,
    winner: d.outcome === Outcome.PlayerAWins ? m.playerA : d.outcome === Outcome.PlayerBWins ? m.playerB : null,
    reason: d.reason,
    signature: await signResult(m.id, d.outcome),
    a: score(m.id, a),
    b: score(m.id, b),
    decidedAt: now,
  };
  const set = await redis<string | null>("SET", k(m.id, "result"), JSON.stringify(result), "NX", "EX", TTL);
  const final = set ? result : (await getResult(m.id))!;
  if (set) {
    await record(m, final).catch((e) => console.error("duel leaderboard", m.id, e));
    await relay(m, final);
  }
  return final;
}

// ------------------------------------------------------------------ weekly leaderboard
//   dboard:{week}           sorted set: wallet → net MOCHI won that week (won minus lost)
//   dstats:{week}:{wallet}  hash: wins, losses

const BOARD_TTL = 60 * 60 * 24 * 120;
export const boardKey = (week: number) => `dboard:${week}`;
export const statsKey = (week: number, address: string) => `dstats:${week}:${address.toLowerCase()}`;

/** Adds a decided match to the week's board. Called once per match, when its result is first signed. */
async function record(m: OnchainMatch, r: Result) {
  if (!r.winner) return; // ties and voids refund everyone, so they don't move the board
  if (houseIn(m)) return; // games against the AI don't count toward the weekly prizes
  const { decimals } = await readToken();
  const stake = BigInt(m.stake);
  const pot = stake * BigInt(2);
  const payout = pot - (pot * BigInt(m.feeBps)) / BigInt(10_000);
  const loser = r.winner.toLowerCase() === m.playerA.toLowerCase() ? m.playerB : m.playerA;
  const won = Number(formatUnits(payout - stake, decimals));
  const lost = Number(formatUnits(stake, decimals));
  const week = duelWeek(r.decidedAt);
  const w = r.winner.toLowerCase();
  const l = loser.toLowerCase();
  await Promise.all([
    redis("ZINCRBY", boardKey(week), won, w),
    redis("ZINCRBY", boardKey(week), -lost, l),
    redis("HINCRBY", statsKey(week, w), "wins", 1),
    redis("HINCRBY", statsKey(week, l), "losses", 1),
  ]);
  await Promise.all([
    redis("EXPIRE", boardKey(week), BOARD_TTL),
    redis("EXPIRE", statsKey(week, w), BOARD_TTL),
    redis("EXPIRE", statsKey(week, l), BOARD_TTL),
  ]);
}

/** Pays the winner without anyone needing to click, when DUEL_RELAYER_KEY is set. Players can always claim themselves. */
async function relay(m: OnchainMatch, result: Result) {
  const id = m.id;
  // The relayer pays out every match; without one, the house still pays out its own AI matches
  const key = RELAYER_KEY ?? (houseIn(m) ? HOUSE_KEY : undefined);
  if (!key) return;
  if (!(await redis<string | null>("SET", k(id, "relay"), "1", "NX", "EX", TTL))) return;
  try {
    const wallet = createWalletClient({ account: privateKeyToAccount(key), chain: robinhood, transport: http(rpc) });
    const tx = await wallet.writeContract({
      address: DUEL_CONTRACT!,
      abi: escrowAbi,
      functionName: "settle",
      args: [BigInt(id), result.outcome, result.signature],
    });
    await redis("SET", k(id, "result"), JSON.stringify({ ...result, tx }), "EX", TTL);
  } catch (e) {
    console.error("duel relay failed", id, e);
    await redis("DEL", k(id, "relay")); // let a later call try again; players can also claim
  }
}

export const isPlayer = (m: OnchainMatch, address: string) =>
  getAddress(address) === getAddress(m.playerA) || getAddress(address) === getAddress(m.playerB);

// ------------------------------------------------------------------ the house AI joins a duel

/** Has the house AI join this open duel with the same stake. Returns an error message if it can't. */
export async function aiJoin(m: OnchainMatch, requester: Address): Promise<{ error: string } | { tx: Hex }> {
  if (!HOUSE_KEY || !house) return { error: "The AI opponent isn't available right now." };
  if (m.status !== Status.Open) return { error: "This duel already has an opponent." };
  if (getAddress(requester) !== getAddress(m.playerA)) return { error: "Only the player who made this duel can call in the AI." };
  if (m.playerB !== "0x0000000000000000000000000000000000000000") return { error: "This duel is for an invited player only." };
  if (Date.now() / 1000 > m.joinDeadline - 30) return { error: "This duel has expired. Cancel it to get your stake back." };
  const { decimals } = await readToken();
  const stake = BigInt(m.stake);
  if (stake > parseUnits(String(AI_MAX_STAKE), decimals)) return { error: `The AI plays stakes up to ${AI_MAX_STAKE.toLocaleString()} MOCHI.` };

  // One join at a time per duel
  if (!(await redis<string | null>("SET", k(m.id, "aijoin"), "1", "NX", "EX", 120))) return { error: "The AI is already joining." };
  try {
    const [balance, allowance] = await Promise.all([
      chain.readContract({ address: MOCHI_TOKEN!, abi: erc20Abi, functionName: "balanceOf", args: [house] }),
      chain.readContract({ address: MOCHI_TOKEN!, abi: erc20Abi, functionName: "allowance", args: [house, DUEL_CONTRACT!] }),
    ]);
    if (balance < stake) {
      await redis("DEL", k(m.id, "aijoin"));
      return { error: "The AI can't cover that stake right now. Try a smaller one." };
    }
    const wallet = createWalletClient({ account: privateKeyToAccount(HOUSE_KEY), chain: robinhood, transport: http(rpc) });
    if (allowance < stake) {
      const approve = await wallet.writeContract({ address: MOCHI_TOKEN!, abi: erc20Abi, functionName: "approve", args: [DUEL_CONTRACT!, maxUint256] });
      await chain.waitForTransactionReceipt({ hash: approve });
    }
    const tx = await wallet.writeContract({ address: DUEL_CONTRACT!, abi: escrowAbi, functionName: "joinMatch", args: [BigInt(m.id)] });
    await chain.waitForTransactionReceipt({ hash: tx });
    return { tx };
  } catch (e) {
    console.error("duel ai join", m.id, e);
    await redis("DEL", k(m.id, "aijoin"));
    return { error: "The AI couldn't join. Try again in a moment." };
  }
}
