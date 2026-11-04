// A hand-drawn SVG Mochi built from swappable layers. It powers the checker's
// reactions and the builder. Swap these for the official trait layers later.
import type { ReactNode } from "react";

const INK = "#161616";
const W = 14; // outline width, matches the chunky art

export const SKINS = {
  mint: "#dcf6f0",
  blush: "#fde0e0",
  lilac: "#d7bfe6",
  latte: "#e7cdb9",
  cream: "#fdf7e0",
  sky: "#cfe6ff",
  butter: "#fff1a8",
  peach: "#ffd2b8",
} as const;

export const BACKGROUNDS = {
  peach: "#ffe5b4",
  lime: "#ccffb2",
  mango: "#ffbe60",
  bubblegum: "#fa60ff",
  coral: "#ff606c",
  mochi: "#cf4f9c",
  sky: "#bfe3ff",
  lavender: "#e2d4ff",
} as const;

export const FACES = ["sparkle", "deadpan", "dizzy", "squint", "sleepy", "happy", "shook"] as const;
export const HEADS = ["none", "halo", "beanie", "cap", "headphones", "sunflower", "crown", "party"] as const;
export const FITS = ["tee", "jersey", "suit", "puffer", "space", "hoodie"] as const;
export const AURAS = ["none", "stars", "hearts", "puffs", "sparkles", "wings"] as const;

export type Face = (typeof FACES)[number];
export type Head = (typeof HEADS)[number];
export type Fit = (typeof FITS)[number];
export type Aura = (typeof AURAS)[number];
export type Skin = keyof typeof SKINS;
export type Bg = keyof typeof BACKGROUNDS;

export type MochiLook = {
  skin: Skin;
  face: Face;
  head: Head;
  fit: Fit;
  aura: Aura;
  bg: Bg | "none";
};

const HEAD_PATH =
  "M500 528 C468 488 440 462 382 462 C304 462 268 520 272 600 C232 650 222 722 238 782 C262 880 382 922 500 922 C618 922 738 880 762 782 C778 722 768 650 728 600 C732 520 696 462 618 462 C560 462 532 488 500 528 Z";

const stroke = { stroke: INK, strokeWidth: W, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function spiral(cx: number, cy: number, turns = 2.6, r = 44) {
  const pts: string[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const rr = 4 + t * r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

function FaceLayer({ face }: { face: Face }) {
  switch (face) {
    case "sparkle":
      return (
        <g>
          {[395, 605].map((x) => (
            <g key={x}>
              <circle cx={x} cy={690} r={56} fill={INK} />
              <circle cx={x + 16} cy={668} r={17} fill="#fff" />
              <circle cx={x - 18} cy={712} r={8} fill="#fff" />
            </g>
          ))}
          <path d="M462 768 q19 22 38 0 q19 22 38 0" fill="none" {...stroke} strokeWidth={10} />
        </g>
      );
    case "deadpan":
      return (
        <g>
          <rect x={360} y={662} width={95} height={15} rx={4} fill={INK} />
          <rect x={545} y={662} width={95} height={15} rx={4} fill={INK} />
          <path d="M392 677 a22 22 0 0 0 44 0 Z" fill={INK} />
          <path d="M564 677 a22 22 0 0 0 44 0 Z" fill={INK} />
          <path d="M466 800 L500 738 L534 800 Z" fill="#f08a7e" {...stroke} strokeWidth={10} />
          <path d="M474 786 L526 786" stroke="#c9584d" strokeWidth={10} />
        </g>
      );
    case "dizzy":
      return (
        <g fill="none" {...stroke} strokeWidth={10}>
          <path d={spiral(398, 690)} />
          <path d={spiral(602, 690)} />
          <path d="M452 760 Q500 744 548 760 Q544 832 500 836 Q456 832 452 760 Z" fill="#8a3b2e" />
          <path d="M470 810 Q500 790 530 810 Q520 830 500 832 Q480 830 470 810 Z" fill="#e8737a" stroke="none" />
        </g>
      );
    case "squint":
      return (
        <g fill="none" {...stroke} strokeWidth={11}>
          <path d="M365 658 L440 690 L365 722" />
          <path d="M635 658 L560 690 L635 722" />
          <path d="M478 778 L500 752 L522 778" />
        </g>
      );
    case "sleepy":
      return (
        <g>
          {[400, 600].map((x, i) => (
            <g key={x}>
              <path d={`M${x - 50} 682 Q${x} 664 ${x + 50} 682`} fill="none" {...stroke} strokeWidth={9} />
              <path d={`M${x - 40} 690 Q${x} 740 ${x + 40} 690 Z`} fill={INK} />
              <circle cx={x + 12} cy={704} r={7} fill="#fff" />
              <path
                d={i === 0 ? `M${x - 52} 640 L${x - 8} 630` : `M${x + 8} 630 L${x + 52} 640`}
                {...stroke}
                strokeWidth={8}
              />
            </g>
          ))}
          <path d="M462 780 L538 780" {...stroke} strokeWidth={9} />
          <path d="M486 780 L494 802 L502 780 Z" fill="#fff" {...stroke} strokeWidth={6} />
        </g>
      );
    case "happy":
      return (
        <g fill="none" {...stroke} strokeWidth={11}>
          <path d="M360 705 Q398 650 436 705" />
          <path d="M564 705 Q602 650 640 705" />
          <path d="M448 758 L552 758 Q548 830 500 832 Q452 830 448 758 Z" fill="#8a3b2e" />
          <path d="M470 812 Q500 792 530 812 Q518 828 500 829 Q482 828 470 812 Z" fill="#e8737a" stroke="none" />
          <ellipse cx={330} cy={760} rx={34} ry={18} fill="#ff9fb6" stroke="none" opacity={0.75} />
          <ellipse cx={670} cy={760} rx={34} ry={18} fill="#ff9fb6" stroke="none" opacity={0.75} />
        </g>
      );
    case "shook":
      return (
        <g>
          {[395, 605].map((x) => (
            <g key={x}>
              <circle cx={x} cy={690} r={46} fill="#fff" {...stroke} strokeWidth={10} />
              <circle cx={x} cy={692} r={14} fill={INK} />
            </g>
          ))}
          <ellipse cx={500} cy={790} rx={26} ry={32} fill="#8a3b2e" {...stroke} strokeWidth={10} />
          <path d="M680 600 q14 30 0 44 q-14 -14 0 -44 Z" fill="#9fd8ff" {...stroke} strokeWidth={7} />
        </g>
      );
  }
}

function HeadLayer({ head }: { head: Head }) {
  switch (head) {
    case "none":
      return null;
    case "halo":
      return (
        <g>
          <ellipse cx={500} cy={398} rx={138} ry={34} fill="none" stroke={INK} strokeWidth={42} />
          <ellipse cx={500} cy={398} rx={138} ry={34} fill="none" stroke="#f3d35a" strokeWidth={22} />
          <path d="M392 384 Q440 370 500 368" fill="none" stroke="#fff6c2" strokeWidth={7} strokeLinecap="round" />
        </g>
      );
    case "beanie":
      return (
        <g>
          <path d="M258 640 C236 470 380 396 522 404 C690 414 796 520 762 640 Z" fill="#ffd93b" {...stroke} />
          <path d="M600 430 C690 470 740 540 742 610" fill="none" stroke="#b9961d" strokeWidth={30} opacity={0.5} />
          <path d="M244 600 Q500 536 774 600 L780 668 Q500 604 246 672 Z" fill="#ffd93b" {...stroke} />
          {[320, 390, 460, 530, 600, 670].map((x) => (
            <path key={x} d={`M${x} ${x < 500 ? 600 : 590} l2 30`} stroke={INK} strokeWidth={7} strokeLinecap="round" />
          ))}
        </g>
      );
    case "cap":
      return (
        <g>
          <path d="M196 560 Q220 520 320 522 L320 572 Z" fill="#5a4318" {...stroke} />
          <path d="M296 572 C290 420 710 414 724 572 Q510 540 296 572 Z" fill="#6b5320" {...stroke} />
          <path d="M500 454 L500 556" stroke={INK} strokeWidth={8} />
          <circle cx={500} cy={448} r={14} fill="#6b5320" {...stroke} strokeWidth={8} />
          <path d="M590 470 C650 490 690 520 700 560" stroke="#3b2c0d" strokeWidth={22} opacity={0.4} fill="none" />
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d="M248 690 C220 380 780 380 752 690" fill="none" stroke={INK} strokeWidth={66} strokeLinecap="round" />
          <path d="M248 690 C220 380 780 380 752 690" fill="none" stroke="#8c1538" strokeWidth={42} strokeLinecap="round" />
          <path d="M300 520 C360 440 440 420 500 418" fill="none" stroke="#c94570" strokeWidth={10} strokeLinecap="round" />
          <rect x={202} y={630} width={80} height={140} rx={34} fill="#2c2c2c" {...stroke} />
          <rect x={718} y={630} width={80} height={140} rx={34} fill="#2c2c2c" {...stroke} />
          <path d="M740 760 Q720 840 640 846" fill="none" stroke={INK} strokeWidth={8} />
          <circle cx={636} cy={846} r={16} fill={INK} />
        </g>
      );
    case "sunflower":
      return (
        <g>
          <path d="M520 530 C540 470 600 440 680 448" fill="none" {...stroke} strokeWidth={10} />
          <path d="M470 520 C450 480 440 460 452 430 C478 450 486 480 470 520 Z" fill="#5f7a3a" {...stroke} strokeWidth={8} />
          <path d="M560 490 C580 450 610 440 630 452 C610 480 590 494 560 490 Z" fill="#5f7a3a" {...stroke} strokeWidth={8} />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <ellipse
                key={i}
                cx={690 + Math.cos(a) * 62}
                cy={448 + Math.sin(a) * 62}
                rx={26}
                ry={40}
                transform={`rotate(${(a * 180) / Math.PI + 90} ${690 + Math.cos(a) * 62} ${448 + Math.sin(a) * 62})`}
                fill="#f2c12e"
                {...stroke}
                strokeWidth={9}
              />
            );
          })}
          <circle cx={690} cy={448} r={44} fill="#3f5a22" {...stroke} strokeWidth={10} />
          <circle cx={690} cy={448} r={22} fill="#7c9a45" />
        </g>
      );
    case "crown":
      return (
        <g>
          <path d="M352 520 L330 380 L420 450 L500 350 L580 450 L670 380 L648 520 Z" fill="#f6c638" {...stroke} />
          <path d="M352 520 L648 520 L644 470 L356 470 Z" fill="#e2a91f" {...stroke} strokeWidth={10} />
          <circle cx={500} cy={494} r={14} fill="#ff5f8f" {...stroke} strokeWidth={7} />
          <circle cx={420} cy={496} r={10} fill="#5fd0ff" {...stroke} strokeWidth={6} />
          <circle cx={580} cy={496} r={10} fill="#5fd0ff" {...stroke} strokeWidth={6} />
        </g>
      );
    case "party":
      return (
        <g>
          <path d="M420 500 L520 270 L610 498 Z" fill="#6fd3ff" {...stroke} />
          <path d="M470 384 L560 380 M440 450 L590 446" stroke="#ff5fa2" strokeWidth={22} />
          <path d="M420 500 L520 270 L610 498 Z" fill="none" {...stroke} />
          <circle cx={520} cy={262} r={26} fill="#ffd93b" {...stroke} strokeWidth={10} />
        </g>
      );
  }
}

const FIT_COLORS: Record<Fit, string> = {
  tee: "#2f5be0",
  jersey: "#f21b1b",
  suit: "#1f1f1f",
  puffer: "#9cf22b",
  space: "#d9d9d9",
  hoodie: "#ff8fc8",
};

const BODY_PATH = "M300 1010 C300 930 350 878 420 876 L580 876 C650 878 700 930 700 1010 Z";

function FitLayer({ fit }: { fit: Fit }) {
  const fill = FIT_COLORS[fit];
  return (
    <g>
      <path d={BODY_PATH} fill={fill} {...stroke} />
      {fit === "jersey" && <path d="M410 878 Q500 940 590 878" fill="none" stroke="#fff" strokeWidth={14} />}
      {fit === "suit" && (
        <g>
          <path d="M440 878 L500 1010 L560 878 Z" fill="#fff" {...stroke} strokeWidth={8} />
          <path d="M488 920 L512 920 L520 1010 L480 1010 Z" fill="#e01d1d" {...stroke} strokeWidth={8} />
        </g>
      )}
      {fit === "puffer" && (
        <g>
          <path d="M500 900 L500 1010" stroke="#333" strokeWidth={8} />
          <path d="M330 960 Q500 940 670 960" fill="none" stroke="#5d9c10" strokeWidth={8} />
          <rect x={600} y={910} width={40} height={20} rx={4} fill="#ff6a2a" {...stroke} strokeWidth={5} />
        </g>
      )}
      {fit === "space" && (
        <g>
          <path d="M380 892 Q500 960 620 892" fill="none" stroke="#9a9a9a" strokeWidth={28} />
          <path d="M380 892 Q500 960 620 892" fill="none" {...stroke} strokeWidth={6} />
        </g>
      )}
      {fit === "hoodie" && (
        <g>
          <path d="M400 880 Q500 960 600 880" fill="none" {...stroke} strokeWidth={10} />
          <path d="M470 930 l-6 60 M530 930 l6 60" stroke="#fff" strokeWidth={8} strokeLinecap="round" />
        </g>
      )}
      <path d="M590 890 C640 910 670 950 676 1010" stroke="#000" strokeWidth={30} opacity={0.15} fill="none" />
    </g>
  );
}

function AuraLayer({ aura, behind }: { aura: Aura; behind: boolean }) {
  if (aura === "wings") {
    if (!behind) return null;
    const wing = "M300 950 C230 900 160 900 120 930 C160 940 150 960 130 980 C180 990 170 1010 160 1020 L320 1010 Z";
    return (
      <g>
        <path d={wing} fill="#fffbe6" {...stroke} strokeWidth={10} />
        <path d={wing} fill="#fffbe6" {...stroke} strokeWidth={10} transform="translate(1000 0) scale(-1 1)" />
      </g>
    );
  }
  if (behind || aura === "none") return null;
  const items: ReactNode[] = [];
  const spots = [
    [175, 860, 1],
    [210, 960, 0.8],
    [820, 870, 1],
    [790, 965, 0.8],
  ];
  spots.forEach(([x, y, s], i) => {
    const t = `translate(${x} ${y}) scale(${s})`;
    if (aura === "stars")
      items.push(
        <path key={i} transform={t} d="M0 -34 L10 -10 L34 0 L10 10 L0 34 L-10 10 L-34 0 L-10 -10 Z" fill="#dff7ff" {...stroke} strokeWidth={7} />,
      );
    if (aura === "hearts")
      items.push(
        <path key={i} transform={t} d="M0 26 C-40 0 -30 -30 -10 -28 C0 -27 0 -18 0 -14 C0 -18 0 -27 10 -28 C30 -30 40 0 0 26 Z" fill="#ffc6d6" {...stroke} strokeWidth={7} />,
      );
    if (aura === "puffs")
      items.push(
        <path key={i} transform={t} d="M-30 10 C-44 -6 -26 -26 -10 -18 C-6 -34 18 -32 20 -16 C38 -16 40 8 22 14 C14 30 -14 28 -30 10 Z" fill="#e8d0bf" {...stroke} strokeWidth={6} />,
      );
    if (aura === "sparkles")
      items.push(
        <g key={i} transform={t} {...stroke} strokeWidth={7}>
          <path d="M0 -26 L0 26 M-26 0 L26 0" />
          <path d="M-12 -12 L-6 -6 M12 12 L6 6 M12 -12 L6 -6 M-12 12 L-6 6" strokeWidth={5} />
        </g>,
      );
  });
  return <g>{items}</g>;
}

export function MochiArt({
  look,
  className,
  title = "Mochi",
  svgId,
  viewBox = "0 0 1000 1000",
}: {
  look: MochiLook;
  className?: string;
  title?: string;
  svgId?: string;
  viewBox?: string;
}) {
  const skin = SKINS[look.skin];
  const clipId = `head-clip-${svgId ?? "b"}`;
  return (
    <svg
      id={svgId}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={HEAD_PATH} />
        </clipPath>
      </defs>
      {look.bg !== "none" && <rect width="1000" height="1000" fill={BACKGROUNDS[look.bg]} />}
      <AuraLayer aura={look.aura} behind />
      <FitLayer fit={look.fit} />
      <path d={HEAD_PATH} fill={skin} />
      <g clipPath={`url(#${clipId})`}>
        <path d="M640 470 C760 520 800 700 740 820 C700 900 600 930 520 930 L800 930 L800 460 Z" fill="#000" opacity={0.18} />
        <path d="M360 480 C320 500 300 540 300 580" stroke="#fff" strokeWidth={22} opacity={0.5} fill="none" strokeLinecap="round" />
      </g>
      <path d={HEAD_PATH} fill="none" {...stroke} />
      <path d="M428 548 Q500 528 572 548" fill="none" {...stroke} strokeWidth={8} />
      <path d="M470 898 Q500 914 530 898" fill="none" {...stroke} strokeWidth={8} />
      <FaceLayer face={look.face} />
      <HeadLayer head={look.head} />
      <AuraLayer aura={look.aura} behind={false} />
    </svg>
  );
}
