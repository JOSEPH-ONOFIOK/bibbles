import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// ---------- config ----------
const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const SECRET = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-secret");

// "x": real Connect X (needs X_CLIENT_ID + SESSION_SECRET).
// "dev": type a handle, for local testing only. Never available in production.
export type AuthMode = "x" | "dev" | "off";
export const authMode: AuthMode =
  X_CLIENT_ID && SECRET ? "x" : process.env.NODE_ENV !== "production" ? "dev" : "off";

export const SESSION_COOKIE = "mochi_session";
export const OAUTH_COOKIE = "mochi_oauth";
const secure = process.env.NODE_ENV === "production";
export const cookieBase = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };

// ---------- signed values: base64url(json).hmac ----------
export function sign(data: object) {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const mac = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function unsign<T>(value: string | undefined): T | null {
  if (!value || !SECRET) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const want = createHmac("sha256", SECRET).update(body).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

// ---------- session ----------
type Session = { h: string; iat: number };
const SESSION_DAYS = 30;

export async function getSession() {
  const s = unsign<Session>((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s || Date.now() - s.iat > SESSION_DAYS * 864e5) return null;
  return s;
}

export function sessionCookie(handle: string) {
  return {
    name: SESSION_COOKIE,
    value: sign({ h: handle, iat: Date.now() } satisfies Session),
    ...cookieBase,
    maxAge: SESSION_DAYS * 86400,
  };
}

// ---------- X OAuth 2.0 (PKCE) ----------
// to: the page to come back to after X
export type OAuthState = { state: string; verifier: string; ts: number; to?: string };

export function newOAuth(to?: string): OAuthState {
  return { state: randomBytes(16).toString("base64url"), verifier: randomBytes(32).toString("base64url"), ts: Date.now(), to };
}

// Where Connect X may send people back to. Anything else goes to the sign-up on the home page.
const RETURN_PAGES = ["/mochilist", "/mochiclaim", "/play"];
export const returnPage = (to: string | null | undefined) => (to && RETURN_PAGES.includes(to) ? to : "/");
export const returnUrl = (origin: string, to: string | null | undefined, query: string) => {
  const page = returnPage(to);
  return `${origin}${page}?${query}${page === "/" ? "#join" : ""}`;
};

export function authorizeUrl(o: OAuthState, redirectUri: string) {
  const challenge = createHash("sha256").update(o.verifier).digest("base64url");
  const q = new URLSearchParams({
    response_type: "code",
    client_id: X_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: "users.read tweet.read",
    state: o.state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://x.com/i/oauth2/authorize?${q}`;
}

export type XUser = { id: string; username: string };

export async function exchangeAndFetchUser(code: string, verifier: string, redirectUri: string): Promise<XUser> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (X_CLIENT_SECRET) headers.Authorization = `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64")}`;
  const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers,
    body: new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: verifier, client_id: X_CLIENT_ID! }),
    cache: "no-store",
  });
  if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  const meRes = await fetch("https://api.x.com/2/users/me", {
    headers: { Authorization: `Bearer ${access_token}` },
    cache: "no-store",
  });
  if (!meRes.ok) throw new Error(`users/me ${meRes.status}`);
  return (await meRes.json()).data as XUser;
}

// ---------- request helpers ----------
export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

// A network, hashed: enough to compare two visitors without storing their IP
export function ipHash(req: Request) {
  return createHmac("sha256", SECRET || "x").update(clientIp(req)).digest("base64url").slice(0, 16);
}

export function siteOrigin(req: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
}
