// The five revealed Mochis. Names are placeholders until the team names them.
export type FeaturedMochi = {
  id: number;
  name: string;
  img: string;
  bg: string;
  traits: { label: string; value: string }[];
};

export const BRAND_PINK = "#cf4f9c";

export const FEATURED: FeaturedMochi[] = [
  {
    id: 1,
    name: "Sir Sunny",
    img: "/mochi/mochi-1.png",
    bg: "#ffe5b4",
    traits: [
      { label: "Skin", value: "Mint" },
      { label: "Face", value: "Deadpan" },
      { label: "Head", value: "Sunflower" },
      { label: "Fit", value: "Black Suit" },
      { label: "Aura", value: "Stars" },
    ],
  },
  {
    id: 2,
    name: "Halo Hana",
    img: "/mochi/mochi-2.png",
    bg: "#ccffb2",
    traits: [
      { label: "Skin", value: "Blush" },
      { label: "Face", value: "Dizzy" },
      { label: "Head", value: "Halo" },
      { label: "Fit", value: "Red Jersey" },
      { label: "Aura", value: "Hearts" },
    ],
  },
  {
    id: 3,
    name: "DJ Squish",
    img: "/mochi/mochi-3.png",
    bg: "#ffbe60",
    traits: [
      { label: "Skin", value: "Lilac" },
      { label: "Face", value: "Squint" },
      { label: "Head", value: "Headphones" },
      { label: "Fit", value: "Blue Tee" },
      { label: "Aura", value: "Splats" },
    ],
  },
  {
    id: 4,
    name: "Cap'n Shell",
    img: "/mochi/mochi-4.png",
    bg: "#fa60ff",
    traits: [
      { label: "Skin", value: "Latte" },
      { label: "Face", value: "Sparkle Eyes" },
      { label: "Head", value: "Starfish Cap" },
      { label: "Fit", value: "Space Suit" },
      { label: "Aura", value: "Puffs" },
    ],
  },
  {
    id: 5,
    name: "Nap Fang",
    img: "/mochi/mochi-5.png",
    bg: "#ff606c",
    traits: [
      { label: "Skin", value: "Cream" },
      { label: "Face", value: "Sleepy Fang" },
      { label: "Head", value: "Beanie" },
      { label: "Fit", value: "Lime Puffer" },
      { label: "Aura", value: "Wings" },
    ],
  },
];

export const SUPPLY = 4444;
export const SUPPLY_LABEL = SUPPLY.toLocaleString("en-US");

// Votes a Mochi in the gallery needs to secure a free airdrop
export const AIRDROP_VOTES = 100;

export const X_URL = "https://x.com/mochimochirh";
export const X_HANDLE = "@mochimochirh";
