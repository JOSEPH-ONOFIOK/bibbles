// Little particle bursts (hearts, stars, puffs, sparkles) at a screen point.
export type BurstKind = "hearts" | "stars" | "puffs" | "sparkles";

const SHAPES: Record<BurstKind, string> = {
  hearts:
    '<path d="M0 26 C-40 0 -30 -30 -10 -28 C0 -27 0 -18 0 -14 C0 -18 0 -27 10 -28 C30 -30 40 0 0 26 Z" fill="#ffc6d6" stroke="#161616" stroke-width="7" stroke-linejoin="round"/>',
  stars:
    '<path d="M0 -34 L10 -10 L34 0 L10 10 L0 34 L-10 10 L-34 0 L-10 -10 Z" fill="#fff6b0" stroke="#161616" stroke-width="7" stroke-linejoin="round"/>',
  puffs:
    '<path d="M-30 10 C-44 -6 -26 -26 -10 -18 C-6 -34 18 -32 20 -16 C38 -16 40 8 22 14 C14 30 -14 28 -30 10 Z" fill="#f4ece6" stroke="#161616" stroke-width="6" stroke-linejoin="round"/>',
  sparkles:
    '<path d="M0 -30 L0 30 M-30 0 L30 0" stroke="#161616" stroke-width="8" stroke-linecap="round"/>',
};

export function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function burst(x: number, y: number, kind: BurstKind = "hearts", count = 9) {
  if (typeof document === "undefined" || reducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    const size = 18 + Math.random() * 18;
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 60 + Math.random() * 70;
    el.className = "burst-particle";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    el.style.setProperty("--dy", `${Math.sin(angle) * dist - 30}px`);
    el.style.setProperty("--rot", `${(Math.random() - 0.5) * 200}deg`);
    el.innerHTML = `<svg viewBox="-40 -40 80 80" width="100%" height="100%">${SHAPES[kind]}</svg>`;
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }
}

export function burstFrom(el: Element, kind: BurstKind, count?: number) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, kind, count);
}
