import { Ambient } from "@/components/Ambient";
import { Builder } from "@/components/Builder";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Join } from "@/components/Join";
import { Nav } from "@/components/Nav";
import { PeekBibble } from "@/components/PeekBibble";
import { SessionProvider } from "@/components/Session";
import { Stickers } from "@/components/Stickers";
import { FEATURED } from "@/lib/bibbles";

// A Bibble peeking over the bottom edge of a section, on one side.
function EdgePeek({ index, side }: { index: number; side: "left" | "right" }) {
  const b = FEATURED[index];
  return (
    <div className={`pointer-events-none mt-16 flex ${side === "left" ? "justify-start pl-[6%]" : "justify-end pr-[6%]"}`}>
      <div className="pointer-events-auto h-28 w-40 overflow-hidden sm:h-36 sm:w-52">
        <PeekBibble src={b.img} alt={b.name} rest="2%" burst="stars" />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <Ambient />
      <Nav />
      <main>
        <Hero />

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
      </main>
      <Footer />
    </SessionProvider>
  );
}
