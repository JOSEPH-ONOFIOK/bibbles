// MochiList: a spot for holders of partner collections. Shared by the API and the UI.

import { X_HANDLE } from "./mochi";

export type Chain = "ethereum" | "robinhood" | "arc";

export const CHAIN_NAMES: Record<Chain, string> = { ethereum: "Ethereum", robinhood: "Robinhood Chain", arc: "Arc" };

// contract "" = not checked yet (add the address to switch it on)
export type Collection = { name: string; chain: Chain; contract: string };

export const COLLECTIONS: Collection[] = [
  { name: "Funkari", chain: "ethereum", contract: "0x1fafd33d882e1c275c61066019a23c1999b5006e" },
  { name: "Normies", chain: "ethereum", contract: "0x9eb6e2025b64f340691e424b7fe7022ffde12438" },
  { name: "WIF Outlaws", chain: "robinhood", contract: "0x12a4c7659a4b7c4a2870b5167c4f8b014c7fa690" },
  { name: "Clay Stonks", chain: "robinhood", contract: "0x358bb3a3e746ab5bdff39b2dbd301168bbe10880" },
  { name: "CCFF00", chain: "robinhood", contract: "0x505a22ffed8d37ebe580ffd98d2cdb0021189146" },
  { name: "Soul Club", chain: "robinhood", contract: "0xd6889961584a42dc5d8196bd82a4c6d0f2b684c5" }, // Digital humans by Souls.club
  { name: "Argonauts", chain: "ethereum", contract: "0x387c41b0b2f1128de44db1bcf8baad085f26392c" },
  { name: "Vaultings", chain: "arc", contract: "0xdccdc73ba593736992d9d6cca097c50d33ea90ad" },
  { name: "CannaCatMeme", chain: "robinhood", contract: "0x53a034d5bdd6fbfed20c07e65fb47548e336e558" },
  { name: "Rekt TRADOOR", chain: "robinhood", contract: "0x7b3ecfa33657de415ff269dc97dfa82954cee706" },
];

// The MochiList announcement people like, repost and comment on. Hardcoded to the profile
// until the post is up: replace it with the post's status link and the steps use that post.
export const ANNOUNCEMENT = "https://x.com/themochieffect";
export const ANNOUNCEMENT_ID = /\/status(?:es)?\/(\d+)/.exec(ANNOUNCEMENT)?.[1] ?? "";

export const COMMENT_TEXT = "Just claimed my MochiList spot 🩷";
export const claimPostText = (collection: string) =>
  `Just claimed my MochiList spot through ${collection}.\n\nSee you at mint, ${X_HANDLE} 👀 $MOCHI`;

export type MochiList = {
  wallet?: string;
  // The eligible collection found in the wallet
  collection?: string;
  liked?: boolean;
  reposted?: boolean;
  commentLink?: string;
  postLink?: string;
  claimedAt?: number;
};

export const mlTasksDone = (m?: MochiList) => !!(m?.collection && m.liked && m.reposted && m.commentLink && m.postLink);
