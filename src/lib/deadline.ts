// When applications close: the whitelist, MochiList and the $MOCHI airdrop.
// To extend, change APPLY_END (or set NEXT_PUBLIC_APPLY_END to an ISO time) and redeploy.
const fromEnv = Date.parse(process.env.NEXT_PUBLIC_APPLY_END ?? "");
export const APPLY_END = Number.isFinite(fromEnv) ? fromEnv : Date.parse("2026-11-12T10:41:00Z");

export const applyOpen = (now = Date.now()) => now < APPLY_END;

export const CLOSED_MSG = "Applications are closed.";
