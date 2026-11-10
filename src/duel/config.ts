// Mochi Duel settings shared by the page and the server.
import { defineChain, parseAbi, type Address } from "viem";

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com"] } },
  ...(process.env.NEXT_PUBLIC_ROBINHOOD_EXPLORER
    ? { blockExplorers: { default: { name: "Explorer", url: process.env.NEXT_PUBLIC_ROBINHOOD_EXPLORER } } }
    : {}),
});

const addr = (v: string | undefined) => (v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined);

export const DUEL_CONTRACT = addr(process.env.NEXT_PUBLIC_DUEL_CONTRACT);
export const MOCHI_TOKEN = addr(process.env.NEXT_PUBLIC_MOCHI_TOKEN);
// The verified $MOCHI page on Pons
export const PONS_URL = process.env.NEXT_PUBLIC_PONS_URL || "";
export const duelConfigured = Boolean(DUEL_CONTRACT && MOCHI_TOKEN);

export const escrowAbi = parseAbi([
  "function createMatch(uint128 stake, address invited) returns (uint256)",
  "function joinMatch(uint256 matchId)",
  "function cancelOpenMatch(uint256 matchId)",
  "function settle(uint256 matchId, uint8 outcome, bytes signature)",
  "function refundExpired(uint256 matchId)",
  "function getMatch(uint256 matchId) view returns ((address playerA, address playerB, uint128 stake, uint16 feeBps, uint8 status, uint64 joinDeadline, uint64 settleDeadline))",
  "function nextMatchId() view returns (uint256)",
  "function feeBps() view returns (uint16)",
  "function minStake() view returns (uint128)",
  "function maxStake() view returns (uint128)",
  "event MatchCreated(uint256 indexed matchId, address indexed playerA, address indexed invited, uint256 stake, uint16 feeBps, uint64 joinDeadline)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

// Matches the contract's enums
export const Status = { None: 0, Open: 1, Locked: 2, Settled: 3, Refunded: 4 } as const;
export const Outcome = { None: 0, PlayerAWins: 1, PlayerBWins: 2, Void: 3 } as const;

export const START_WINDOW_S = 60; // the second player must start within this long of the first
export const COUNTDOWN_S = 3;
export const UPLOAD_GRACE_S = 15; // after 90 seconds, time allowed for the last moves to arrive

export const startMessage = (id: string | number, address: string) =>
  `Mochi Duel\nStart match #${id}\nWallet: ${address.toLowerCase()}`;

// Shown on the confirm screen, and the server follows exactly these.
export const RULES = [
  "Both players stake the same amount of $MOCHI. It's held by the escrow contract, not by us.",
  "You both play the same 90-second map: the same items and the same obstacles at the same times.",
  "+10 for each item, +25 for each rare ✨ item, −15 and a 1-second stun for each obstacle hit.",
  "The server replays your moves and works out the score. The higher score wins.",
  "Equal scores: fewer hits wins. Still equal: a tie, and both players get their full stake back.",
  "Nobody joins: cancel any time and get your stake back. Anyone can cancel it once the join window ends.",
  "If your opponent doesn't start within 60 seconds of you, you win.",
  "Disconnect mid-run: your score counts as it stood when you dropped. If both players drop, it's a full refund.",
  "A run that fails the server check loses. If both fail, or the only player who started fails, it's a full refund.",
  "If no result is posted in time, either player can take a full refund from the contract.",
  "The winner receives 75% of both stakes, the amount shown before you confirm. Ties and refunds return every stake in full.",
];

// ---------- weekly leaderboard ----------
// Weeks match the game's Trials: they start at 00:00 UTC on Thursdays.
const DAY = 24 * 60 * 60 * 1000;
export const duelWeek = (now = Date.now()) => Math.floor(Math.floor(now / DAY) / 7);
export const weekEnds = (week: number) => (week + 1) * 7 * DAY;

export const PRIZE_POOL = 1_000_000; // MOCHI each week
// Share of the pool for ranks 1–10, in percent (adds up to 100)
export const PRIZE_SPLIT = [25, 15, 10, 8, 7, 7, 7, 7, 7, 7];
// To win a prize: finish in profit, with at least this many wins that week
export const PRIZE_MIN_WINS = 3;
