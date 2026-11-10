import { connection } from "next/server";
import { DUEL_CONTRACT, MOCHI_TOKEN, erc20Abi } from "@/duel/config";
import { bad } from "@/lib/api";
import { chain } from "@/lib/duel";
import { duelReady, notReady, parseAddress } from "../_shared";

// GET /api/duel/balance?address=0x… → { mochi, allowance, eth } as base-unit strings, read live onchain.
// Players don't need to import the token into their wallet for this to work.
export async function GET(req: Request) {
  await connection();
  if (!duelReady()) return notReady();
  const address = parseAddress(new URL(req.url).searchParams.get("address"));
  if (!address) return bad("Bad wallet address.");
  try {
    const [mochi, allowance, eth] = await Promise.all([
      chain.readContract({ address: MOCHI_TOKEN!, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      chain.readContract({ address: MOCHI_TOKEN!, abi: erc20Abi, functionName: "allowance", args: [address, DUEL_CONTRACT!] }),
      chain.getBalance({ address }),
    ]);
    return Response.json(
      { mochi: mochi.toString(), allowance: allowance.toString(), eth: eth.toString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("duel balance", e);
    return Response.json({ error: "Couldn't read your balance. Try again in a moment." }, { status: 502 });
  }
}
