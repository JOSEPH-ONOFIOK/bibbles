// When applications close. The whitelist and MochiList share APPLY_END; the $MOCHI airdrop has its own.
// To extend, change the date (or set NEXT_PUBLIC_APPLY_END / NEXT_PUBLIC_AIRDROP_END to an ISO time) and redeploy.
const fromEnv = Date.parse(process.env.NEXT_PUBLIC_APPLY_END ?? "");
export const APPLY_END = Number.isFinite(fromEnv) ? fromEnv : Date.parse("2026-11-12T19:35:00Z");

const airdropFromEnv = Date.parse(process.env.NEXT_PUBLIC_AIRDROP_END ?? "");
export const AIRDROP_END = Number.isFinite(airdropFromEnv) ? airdropFromEnv : Date.parse("2026-11-10T19:35:00Z");

export const applyOpen = (now = Date.now()) => now < APPLY_END;
export const airdropOpen = (now = Date.now()) => now < AIRDROP_END;

export const CLOSED_MSG = "Applications are closed.";
