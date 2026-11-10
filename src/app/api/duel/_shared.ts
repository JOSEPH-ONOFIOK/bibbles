import { isAddress, getAddress, type Address } from "viem";
import { bad } from "@/lib/api";
import { duelReady } from "@/lib/duel";

export const notReady = () => bad("Mochi Duel isn't live yet.", 503);

export function parseAddress(v: unknown): Address | null {
  return typeof v === "string" && isAddress(v) ? getAddress(v) : null;
}

export function parseId(v: unknown): bigint | null {
  const s = String(v ?? "");
  return /^\d{1,12}$/.test(s) && s !== "0" ? BigInt(s) : null;
}

export const ip = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

export { duelReady };
