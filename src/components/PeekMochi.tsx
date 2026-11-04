"use client";

import { useEffect, useRef, useState } from "react";
import { burstFrom, type BurstKind } from "@/lib/burst";

// A Mochi that rises from the bottom edge of its container, ducks when the
// cursor gets close, and boings with a little burst when clicked.
export function PeekMochi({
  src,
  alt,
  delay = 0,
  rest = "18%",
  burst = "hearts",
  className = "",
}: {
  src: string;
  alt: string;
  delay?: number;
  rest?: string;
  burst?: BurstKind;
  className?: string;
}) {
  const wrap = useRef<HTMLButtonElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  const [ducking, setDucking] = useState(false);

  // Rise once the container scrolls into view.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          t = setTimeout(() => setVisible(true), delay);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, [delay]);

  // Duck when the pointer comes near the top of the head, pop back after.
  useEffect(() => {
    if (!visible || !window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0;
    let back: ReturnType<typeof setTimeout>;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Measure the wrapper, not the image, so ducking doesn't move the target.
        const r = wrap.current?.getBoundingClientRect();
        if (!r) return;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.45;
        const near = Math.hypot(e.clientX - cx, e.clientY - cy) < r.width * 0.45;
        if (near) {
          clearTimeout(back);
          setDucking(true);
        } else {
          back = setTimeout(() => setDucking(false), 350);
        }
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      clearTimeout(back);
    };
  }, [visible]);

  const boing = () => {
    const el = img.current;
    if (!el) return;
    setDucking(false);
    el.classList.remove("peek-boing");
    void el.getBoundingClientRect();
    el.classList.add("peek-boing");
    burstFrom(el, burst);
  };

  const state = !visible ? "peek-hidden" : ducking ? "peek-duck" : "peek-up";

  return (
    <button
      ref={wrap}
      type="button"
      onClick={boing}
      aria-label={`Boop ${alt}`}
      className={`relative block cursor-pointer overflow-visible ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={src}
        alt={alt}
        draggable={false}
        onAnimationEnd={(e) => e.currentTarget.classList.remove("peek-boing")}
        style={{ ["--peek-rest" as string]: rest }}
        className={`peek ${state} block w-full origin-bottom select-none`}
      />
    </button>
  );
}
