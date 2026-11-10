"use client";

import { Shell } from "../Shell";
import { useGameOpen } from "../Countdown";
import { GamePreview } from "./GamePreview";
import { Play } from "./Play";

// Before launch: the preview and docs. The moment the countdown ends: the game.
export function PlayGate() {
  const open = useGameOpen();
  if (open) return <Play />;
  return (
    <Shell>
      <GamePreview />
    </Shell>
  );
}
