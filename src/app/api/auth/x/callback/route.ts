import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { OAUTH_COOKIE, exchangeAndFetchUser, returnUrl, sessionCookie, siteOrigin, unsign, type OAuthState } from "@/lib/auth";
import { enroll } from "@/lib/api";

// X redirects here after the user approves (or cancels)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = siteOrigin(req);
  const o = unsign<OAuthState>((await cookies()).get(OAUTH_COOKIE)?.value);

  const done = (query: string) => {
    const res = NextResponse.redirect(returnUrl(origin, o?.to, query));
    res.cookies.set({ name: OAUTH_COOKIE, value: "", path: "/api/auth", maxAge: 0 });
    return res;
  };

  if (url.searchParams.get("error")) return done("auth_error=cancelled");
  const code = url.searchParams.get("code");
  if (!o || !code || url.searchParams.get("state") !== o.state || Date.now() - o.ts > 600_000) return done("auth_error=expired");

  try {
    const user = await exchangeAndFetchUser(code, o.verifier, `${origin}/api/auth/x/callback`);
    const entry = await enroll(user.username, user.id);
    const res = done("connected=1");
    res.cookies.set(sessionCookie(entry.handle));
    return res;
  } catch (e) {
    const msg = e instanceof Error && e.message === "handle_taken" ? "handle_taken" : "x_failed";
    if (msg === "x_failed") console.error("Connect X failed", e);
    return done(`auth_error=${msg}`);
  }
}
