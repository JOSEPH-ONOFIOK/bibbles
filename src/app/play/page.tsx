import type { Metadata } from "next";
import { PlayGate } from "@/components/game/PlayGate";

const description = "Mochi Game V1 opens today at 4pm WAT. Play as your Mochi: explore, gather, farm, build the village, make friends and earn $MOCHI in weekly Trials.";

export const metadata: Metadata = {
  title: "Mochi Game",
  description,
  alternates: { canonical: "/play" },
  openGraph: { url: "/play", title: "Mochi Game V1", description },
  twitter: { title: "Mochi Game V1", description },
};

// Shows the preview until launch, then the game, switching by itself when the countdown ends
export default function PlayPage() {
  return <PlayGate />;
}
