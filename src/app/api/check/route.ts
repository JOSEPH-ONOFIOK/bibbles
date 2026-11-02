import allowlist from "@/data/allowlist.json";

const LIST = new Set((allowlist as string[]).map((a) => a.toLowerCase()));
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  if (!ADDRESS.test(address)) return Response.json({ status: "invalid" }, { status: 400 });
  return Response.json({ status: LIST.has(address.toLowerCase()) ? "in" : "out" });
}
