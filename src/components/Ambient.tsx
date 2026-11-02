"use client";

import { useEffect } from "react";
import { reducedMotion } from "@/lib/burst";

// Sparkle trail behind the cursor, plus the page background that takes on the
// color of whichever section is on screen ([data-bg] sections).
export function Ambient() {
  useEffect(() => {
    const root = document.documentElement;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-bg]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) root.style.setProperty("--page-bg", (e.target as HTMLElement).dataset.bg!);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    sections.forEach((s) => io.observe(s));

    const fine = window.matchMedia("(pointer: fine)").matches;
    let last = 0;
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - last < 45) return;
      last = now;
      const s = document.createElement("span");
      s.className = "trail-sparkle";
      s.style.left = `${e.clientX}px`;
      s.style.top = `${e.clientY}px`;
      s.style.setProperty("--rot", `${Math.random() * 90}deg`);
      document.body.appendChild(s);
      s.addEventListener("animationend", () => s.remove(), { once: true });
    };
    if (fine && !reducedMotion()) window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);
  return null;
}
