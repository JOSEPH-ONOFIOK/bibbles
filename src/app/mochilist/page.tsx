import type { Metadata } from "next";
import { MochiList } from "@/components/MochiList";
import { Mesh } from "@/components/Mesh";
import { Shell } from "@/components/Shell";

const description = "Hold an NFT from a partner collection? Claim your MochiList spot for the free Mochi mint, powered by $MOCHI.";

export const metadata: Metadata = {
  title: "MochiList",
  description,
  alternates: { canonical: "/mochilist" },
  openGraph: { url: "/mochilist", title: "MochiList · Mochi", description },
  twitter: { title: "MochiList · Mochi", description },
};

export default function MochiListPage() {
  return (
    <Shell>
      <section data-bg="#e2d4ff" className="relative isolate min-h-[70svh] pt-32 pb-24">
        <Mesh />
        <MochiList />
      </section>
    </Shell>
  );
}
