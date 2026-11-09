"use client";

import { useSyncExternalStore } from "react";

// The Mochi the visitor is building, shared between the builder and the tasks.
let state = { name: "Lil Mochi", touched: false };
const listeners = new Set<() => void>();

const INVITE = "mochi_ref";

// The look last made in the builder, read by the game
export const LOOK_KEY = "mochi_look";

// A friend's invite from ?ref=handle, kept until this visitor adds their wallet
export function rememberInvite() {
  try {
    const q = new URLSearchParams(location.search);
    const ref = q.get("ref")?.toLowerCase();
    if (ref && /^\w{1,15}$/.test(ref)) localStorage.setItem(INVITE, ref);
    if (q.has("ref")) history.replaceState(null, "", `${location.pathname}${location.hash}`);
  } catch {}
}

export function readInvite() {
  try {
    return localStorage.getItem(INVITE);
  } catch {
    return null;
  }
}

export function setMyMochiName(name: string, touched = true) {
  state = { name, touched: state.touched || touched };
  listeners.forEach((l) => l());
}

export function useMyMochi() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

// Renders the builder's SVG to a 1000×1000 PNG and downloads it
export async function downloadMyMochi(name: string) {
  const svg = document.getElementById("builder-mochi");
  if (!svg) return false;
  const data = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([data], { type: "image/svg+xml" }));
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1000;
  canvas.getContext("2d")!.drawImage(img, 0, 0, 1000, 1000);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return false;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "my-mochi"}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}
