import type { Metadata, Viewport } from "next";
import { Play } from "@/components/game/Play";
import { GamePreview } from "@/components/game/GamePreview";
import { Shell } from "@/components/Shell";
import { GAME_OPEN } from "@/game/data";

const description = "Mochi Game V1, coming soon. Play as your Mochi: explore, gather, farm, build the village, make friends and earn $MOCHI in weekly Trials.";

export const metadata: Metadata = {
  title: "Mochi Game",
  description,
  alternates: { canonical: "/play" },
  openGraph: { url: "/play", title: "Mochi Game V1 · Coming soon", description },
  twitter: { title: "Mochi Game V1 · Coming soon", description },
};

// The open game is a full-screen game: no pinch zoom. The preview is a normal page.
export const viewport: Viewport = GAME_OPEN
  ? { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false }
  : { width: "device-width", initialScale: 1 };

export default function PlayPage() {
  // Until launch: the game plays itself above the docs
  if (!GAME_OPEN)
    return (
      <Shell>
        <GamePreview />
      </Shell>
    );
  return <Play />;
}
