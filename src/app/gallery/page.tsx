import type { Metadata } from "next";
import { Gallery } from "@/components/Gallery";
import { Shell } from "@/components/Shell";
import { AIRDROP_VOTES } from "@/lib/mochi";

const description = `Vote for your favourite Mochis. Reach ${AIRDROP_VOTES} votes on yours and you secure a free $MOCHI airdrop. Free mint, powered by $MOCHI.`;

export const metadata: Metadata = {
  title: "Gallery",
  description,
  alternates: { canonical: "/gallery" },
  openGraph: { url: "/gallery", title: "Gallery · Mochi", description },
  twitter: { title: "Gallery · Mochi", description },
};

export default function GalleryPage() {
  return (
    <Shell>
      <section data-bg="#ccffb2" className="min-h-[70svh] pt-32 pb-24">
        <Gallery />
      </section>
    </Shell>
  );
}
