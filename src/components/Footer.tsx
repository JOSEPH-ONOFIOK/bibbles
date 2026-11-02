import { BRAND_PINK, FEATURED, X_HANDLE, X_URL } from "@/lib/bibbles";
import { PeekBibble } from "./PeekBibble";

export function Footer() {
  return (
    <footer data-bg={BRAND_PINK} className="relative overflow-hidden pt-24">
      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/wordmark.png"
          alt="Bibbles"
          className="wobble w-[min(70vw,380px)] select-none"
          style={{ filter: "drop-shadow(4px 5px 0 #161616)" }}
          draggable={false}
        />
        <p className="mt-3 font-display text-2xl text-white" style={{ textShadow: "2px 2px 0 #161616" }}>
          See you on the timeline.
        </p>
        <a href={X_URL} target="_blank" rel="noreferrer" className="btn mt-5">
          Follow {X_HANDLE}
        </a>
        <p className="mt-6 text-xs font-bold text-white/80">© 2026 Bibbles</p>
      </div>
      <div className="mt-6 flex items-end justify-center gap-2 px-4">
        {[FEATURED[4], FEATURED[1], FEATURED[3]].map((b, i) => (
          <PeekBibble key={b.id} src={b.img} alt={b.name} delay={i * 160} rest="38%" className="w-[24vw] max-w-[200px]" />
        ))}
      </div>
    </footer>
  );
}
