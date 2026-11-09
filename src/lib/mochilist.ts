// MochiList: a spot for holders of partner collections. Shared by the API and the UI.

import { X_HANDLE } from "./mochi";

export type Chain = "ethereum" | "robinhood" | "arc";

export const CHAIN_NAMES: Record<Chain, string> = { ethereum: "Ethereum", robinhood: "Robinhood Chain", arc: "Arc" };

// contract "" = not checked yet (add the address to switch it on)
// limit: how many MochiList spots that community gets
export type Collection = { name: string; chain: Chain; contract: string; limit: number; logo: string };

// Logos are copies of each collection's OpenSea logo, in public/collections
export const COLLECTIONS: Collection[] = [
  { name: "Funkari", chain: "ethereum", contract: "0x1fafd33d882e1c275c61066019a23c1999b5006e", limit: 50, logo: "/collections/funkari.jpg" },
  { name: "Normies", chain: "ethereum", contract: "0x9eb6e2025b64f340691e424b7fe7022ffde12438", limit: 120, logo: "/collections/normies.jpg" },
  { name: "WIF Outlaws", chain: "robinhood", contract: "0x12a4c7659a4b7c4a2870b5167c4f8b014c7fa690", limit: 200, logo: "/collections/wif-outlaws.jpg" },
  { name: "Clay StonKz", chain: "robinhood", contract: "0xde0acefc89d4cf5f4ce45a4fb8a51aa355091b44", limit: 70, logo: "/collections/clay-stonks.jpg" },
  { name: "CCFF00", chain: "robinhood", contract: "0x505a22ffed8d37ebe580ffd98d2cdb0021189146", limit: 310, logo: "/collections/ccff00.svg" },
  { name: "Soul Club", chain: "robinhood", contract: "0xd6889961584a42dc5d8196bd82a4c6d0f2b684c5", limit: 160, logo: "/collections/soul-club.jpg" }, // Digital humans by Souls.club
  { name: "Argonauts", chain: "ethereum", contract: "0x387c41b0b2f1128de44db1bcf8baad085f26392c", limit: 30, logo: "/collections/argonauts.jpg" },
  { name: "Vaultlings", chain: "robinhood", contract: "0x23708e501cbeaa92f45183197c673fdabf993484", limit: 70, logo: "/collections/vaultlings.jpg" },
  { name: "CannaCats", chain: "robinhood", contract: "0x53716c211179a342e37734f4fb46b276c975359a", limit: 40, logo: "/collections/cannacat.jpg" }, // CannaCats V2, @CannaCatMeme
  { name: "Rekt TRADOOR", chain: "robinhood", contract: "0x7b3ecfa33657de415ff269dc97dfa82954cee706", limit: 30, logo: "/collections/rekt-tradooor.jpg" },
  { name: "Goat Ranch Club", chain: "robinhood", contract: "0x95a85681e28988b4ef503369470b4da7681c4bc8", limit: 120, logo: "/collections/goat-ranch-club.jpg" },
  { name: "Blokyz", chain: "ethereum", contract: "0x86ffb7988913e85a5a07d459a5165ab1273cfe62", limit: 50, logo: "/collections/blokyz.jpg" }, // Original Blokyz
  { name: "TMO", chain: "robinhood", contract: "0x0d58589536f442da1c192c89232448c23d8b41bb", limit: 50, logo: "/collections/tmo.jpg" }, // TMO: Initiates
  { name: "Freedz", chain: "ethereum", contract: "0x993873f58f0ce4728bbd68dd5fabcb75ef48e7c4", limit: 80, logo: "/collections/freedz.jpg" }, // FREEDZ, @freedznft
  { name: "Cash Grab", chain: "robinhood", contract: "0x66de4a428a3b890abee81968bcfdb385fe80d22d", limit: 60, logo: "/collections/cash-grab.jpg" }, // @RealCashpig
  { name: "Vamps", chain: "robinhood", contract: "0x93a3ecadfe057b695fe3a98bbd4fd3e4557ca55d", limit: 40, logo: "/collections/vamps.jpg" }, // VAMPS, @vampsonchain
  { name: "Chimpers", chain: "ethereum", contract: "0x307af7d28afee82092aa95d35644898311ca5360", limit: 30, logo: "/collections/chimpers.jpg" }, // @ChimpersHQ
];

// How many MochiList spots there are in total: every community's limit added up.
export const ML_CAP = COLLECTIONS.reduce((n, c) => n + c.limit, 0);

export const limitOf = (name: string) => COLLECTIONS.find((c) => c.name === name)?.limit ?? 0;

// Public numbers for the progress bar
export type MlStats = { claimed: number; cap: number; by: Record<string, number> };

// The MochiList announcement people like, repost and comment on. Hardcoded to the profile
// until the post is up: replace it with the post's status link and the steps use that post.
export const ANNOUNCEMENT = "https://x.com/themochieffect/status/2119809934791524722";
export const ANNOUNCEMENT_ID = /\/status(?:es)?\/(\d+)/.exec(ANNOUNCEMENT)?.[1] ?? "";

// Filled in for their comment on the announcement
export const claimText = (collection: string) =>
  `Just claimed my MochiList spot through ${collection}.\n\nSee you at mint, ${X_HANDLE} 👀 $MOCHI`;

export type MochiList = {
  wallet?: string;
  // The eligible collection found in the wallet
  collection?: string;
  followed?: boolean;
  liked?: boolean;
  reposted?: boolean;
  commentLink?: string;
  claimedAt?: number;
  // Their place in the queue, 1 to ML_CAP
  spot?: number;
};

// In order: wallet, follow, like and repost, comment
export const mlTasksDone = (m?: MochiList) => !!(m?.collection && m.followed && m.liked && m.reposted && m.commentLink);
