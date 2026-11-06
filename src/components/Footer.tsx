import Link from "next/link";
import { BRAND_PINK, FEATURED, POWERED, X_HANDLE, X_URL } from "@/lib/mochi";
import { PeekMochi } from "./PeekMochi";

export function Footer() {
  return (
    <footer data-bg={BRAND_PINK} className="relative overflow-hidden pt-24">
      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        <p className="wordmark wobble select-none leading-none text-[min(22vw,110px)]" style={{ textShadow: "4px 5px 0 #161616" }}>
          Mochi
        </p>
        <p className="mt-3 font-display text-2xl text-white" style={{ textShadow: "2px 2px 0 #161616" }}>
          {POWERED}. See you on the timeline.
        </p>
        <a href={X_URL} target="_blank" rel="noreferrer" className="btn mt-5">
          Follow {X_HANDLE}
        </a>
        <nav className="mt-6 flex gap-5 font-display text-xl text-white" style={{ textShadow: "2px 2px 0 #161616" }}>
          <Link href="/gallery" className="hover:underline">Gallery</Link>
          <Link href="/leaderboard" className="hover:underline">Leaderboard</Link>
        </nav>
        <p className="mt-4 text-xs font-bold text-white/80">© 2026 Mochi · $MOCHI</p>
      </div>
      <div className="mt-6 flex items-end justify-center gap-2 px-4">
        {[FEATURED[4], FEATURED[1], FEATURED[3]].map((b, i) => (
          <PeekMochi key={b.id} src={b.img} alt={b.name} delay={i * 160} rest="38%" className="w-[24vw] max-w-[200px]" />
        ))}
      </div>
    </footer>
  );
}
