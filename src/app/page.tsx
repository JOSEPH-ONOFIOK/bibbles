import { Builder } from "@/components/Builder";
import { Facts } from "@/components/Facts";
import { GameTeaser } from "@/components/GameTeaser";
import { Hero } from "@/components/Hero";
import { Join } from "@/components/Join";
import { PeekMochi } from "@/components/PeekMochi";
import { Shell } from "@/components/Shell";
import { Stickers } from "@/components/Stickers";
import { FEATURED } from "@/lib/mochi";

// A Mochi peeking over the bottom edge of a section, on one side.
function EdgePeek({ index, side }: { index: number; side: "left" | "right" }) {
  const b = FEATURED[index];
  return (
    <div className={`pointer-events-none mt-16 flex ${side === "left" ? "justify-start pl-[6%]" : "justify-end pr-[6%]"}`}>
      <div className="pointer-events-auto h-28 w-40 overflow-hidden sm:h-36 sm:w-52">
        <PeekMochi src={b.img} alt={b.name} rest="2%" burst="stars" />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Shell>
      <Hero />
      <Facts />
      <GameTeaser />

      <section id="join" data-bg="#e2d4ff" className="scroll-mt-20 pt-24">
        <Join />
        <EdgePeek index={0} side="right" />
      </section>

      <section id="builder" data-bg="#bfe3ff" className="scroll-mt-20 border-t-4 border-ink pt-24">
        <Builder />
        <EdgePeek index={2} side="left" />
      </section>

      <section id="stickers" data-bg="#ffbe60" className="scroll-mt-20 border-t-4 border-ink pt-24 pb-24">
        <Stickers />
      </section>
    </Shell>
  );
}
