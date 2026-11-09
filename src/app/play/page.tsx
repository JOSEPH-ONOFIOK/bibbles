import type { Metadata, Viewport } from "next";
import { Play } from "@/components/game/Play";

const description = "Play as your Mochi: explore, gather, craft and build your cosy Pocket.";

export const metadata: Metadata = {
  title: "Play",
  description,
  alternates: { canonical: "/play" },
  openGraph: { url: "/play", title: "Play · Mochi", description },
  twitter: { title: "Play · Mochi", description },
};

// A game screen: no pinch zoom, no page scroll
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function PlayPage() {
  return <Play />;
}
