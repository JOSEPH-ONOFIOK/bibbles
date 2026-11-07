import { NextResponse } from "next/server";
import { OAUTH_COOKIE, authMode, authorizeUrl, clientIp, cookieBase, newOAuth, returnPage, returnUrl, sign, siteOrigin } from "@/lib/auth";
import { store } from "@/lib/store";

// GET /api/auth/x/start?to=/mochilist → redirects to X's consent screen
export async function GET(req: Request) {
  const origin = siteOrigin(req);
  const to = returnPage(new URL(req.url).searchParams.get("to"));
  const fail = (code: string) => NextResponse.redirect(returnUrl(origin, to, `auth_error=${code}`));
  if (authMode !== "x") return fail("unavailable");
  if (!(await store.limit(`start:${clientIp(req)}`, 20, 600))) return fail("rate_limited");

  const o = newOAuth(to);
  const res = NextResponse.redirect(authorizeUrl(o, `${origin}/api/auth/x/callback`));
  res.cookies.set({ name: OAUTH_COOKIE, value: sign(o), ...cookieBase, path: "/api/auth", maxAge: 600 });
  return res;
}
