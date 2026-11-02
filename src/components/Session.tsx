"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { PublicEntry } from "@/lib/entry";

type Auth = "x" | "dev" | "off";
type Result = { error?: string };

type SessionValue = {
  ready: boolean;
  auth: Auth;
  entry: PublicEntry | null;
  notice: string | null;
  connect: () => void;
  devConnect: (handle: string) => Promise<Result>;
  disconnect: () => Promise<void>;
  task: (body: Record<string, unknown>) => Promise<Result>;
};

const Ctx = createContext<SessionValue | null>(null);

export const useSession = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
};

const AUTH_ERRORS: Record<string, string> = {
  cancelled: "You cancelled Connect X. Try again whenever you're ready.",
  expired: "That took too long. Please connect again.",
  handle_taken: "That handle is linked to a different X account.",
  rate_limited: "Too many tries. Wait a few minutes and try again.",
  unavailable: "Connect X isn't switched on yet.",
  no_db: "Sign ups aren't open yet: the database isn't connected.",
  x_failed: "X didn't respond properly. Please try again.",
};

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return (await res.json().catch(() => ({ error: "Something went wrong. Please try again." }))) as {
    entry?: PublicEntry;
    error?: string;
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<Auth>("off");
  const [entry, setEntry] = useState<PublicEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // Messages from the X redirect, then tidy the address bar
    const q = new URLSearchParams(location.search);
    const err = q.get("auth_error");
    let msg: string | null = null;
    if (err) msg = AUTH_ERRORS[err] ?? AUTH_ERRORS.x_failed;
    if (q.has("auth_error") || q.has("connected")) history.replaceState(null, "", `${location.pathname}${location.hash}`);

    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setAuth(d.auth);
        setEntry(d.entry);
        if (q.has("connected") && d.entry) msg = `Connected as @${d.entry.handle}!`;
      })
      .catch(() => {})
      .finally(() => {
        setNotice(msg);
        setReady(true);
      });
  }, []);

  const connect = useCallback(() => {
    // Full page navigation: the route redirects to X's consent screen
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.href = "/api/auth/x/start";
  }, []);

  const devConnect = useCallback(async (handle: string) => {
    const d = await post("/api/auth/dev", { handle });
    if (d.entry) setEntry(d.entry);
    return { error: d.error };
  }, []);

  const disconnect = useCallback(async () => {
    await post("/api/auth/logout");
    setEntry(null);
  }, []);

  const task = useCallback(async (body: Record<string, unknown>) => {
    const d = await post("/api/task", body);
    if (d.entry) setEntry(d.entry);
    return { error: d.error };
  }, []);

  return (
    <Ctx.Provider value={{ ready, auth, entry, notice, connect, devConnect, disconnect, task }}>{children}</Ctx.Provider>
  );
}
