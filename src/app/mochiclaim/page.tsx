import type { Metadata } from "next";
import { Airdrop } from "@/components/Airdrop";
import { Mesh } from "@/components/Mesh";
import { Shell } from "@/components/Shell";

const description = "The $MOCHI airdrop application is live. 1% of $MOCHI will be bought & airdropped back to the community. Drop your wallet.";

export const metadata: Metadata = {
  title: "$MOCHI Airdrop",
  description,
  alternates: { canonical: "/mochiclaim" },
  openGraph: { url: "/mochiclaim", title: "$MOCHI Airdrop · Mochi", description },
  twitter: { title: "$MOCHI Airdrop · Mochi", description },
};

export default function MochiClaimPage() {
  return (
    <Shell>
      <section data-bg="#ccffb2" className="relative isolate min-h-[70svh] pt-32 pb-24">
        <Mesh />
        <Airdrop />
      </section>
    </Shell>
  );
}
