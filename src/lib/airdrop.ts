// $MOCHI airdrop application (/mochiclaim). Shared by the API and the UI.

import { TOKEN, X_HANDLE } from "./mochi";
import { SITE_URL } from "./site";

// The airdrop announcement people like, repost and quote. Hardcoded to the profile until
// the post is up: replace it with the post's status link and the steps use that post.
export const AIRDROP_POST = "https://x.com/themochieffect";
export const AIRDROP_POST_ID = /\/status(?:es)?\/(\d+)/.exec(AIRDROP_POST)?.[1] ?? "";

export const AIRDROP_SHARE = "1%";

const host = SITE_URL.replace(/^https?:\/\//, "").replace(/^www\./, "");
export const refLink = (handle: string) => `${host}/mochiclaim?ref=${handle}`;

// Filled in for their quote post
export const qrtText = (handle: string) =>
  `Applying for the ${TOKEN} airdrop 🩷\n\n${AIRDROP_SHARE} of ${TOKEN} is being bought back & airdropped to the community. Join me 👇\n\n${refLink(handle)}${AIRDROP_POST_ID ? "" : `\n\n${X_HANDLE}`}`;

export type Airdrop = {
  followed?: boolean;
  liked?: boolean;
  reposted?: boolean;
  qrtLink?: string;
  wallet?: string;
  // Who sent them, and when the application was complete
  invitedBy?: string;
  appliedAt?: number;
};
