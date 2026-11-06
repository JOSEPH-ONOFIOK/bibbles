"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { rememberInvite } from "@/lib/myMochi";
import { useSession } from "./Session";

export type Wall = {
  on: boolean;
  top: { handle: string; count: number }[];
  me: { count: number; rank: number | null; displayed: boolean } | null;
};

type WallValue = Wall & {
  ready: boolean;
  refresh: () => void;
  // Goes up when someone adds to the gallery, so it reloads
  galleryTick: number;
  galleryChanged: () => void;
};

const Ctx = createContext<WallValue | null>(null);

export const useWall = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWall outside WallProvider");
  return v;
};

export function WallProvider({ children }: { children: React.ReactNode }) {
  const { entry } = useSession();
  const handle = entry?.handle;
  const [wall, setWall] = useState<Wall>({ on: false, top: [], me: null });
  const [ready, setReady] = useState(false);
  const [galleryTick, setTick] = useState(0);

  useEffect(rememberInvite, []);

  const refresh = useCallback(() => {
    fetch("/api/wall")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setWall(d);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Again whenever the visitor signs in or out
  useEffect(refresh, [refresh, handle]);

  const galleryChanged = useCallback(() => setTick((n) => n + 1), []);

  return <Ctx.Provider value={{ ...wall, ready, refresh, galleryTick, galleryChanged }}>{children}</Ctx.Provider>;
}
