import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mochi",
    short_name: "Mochi",
    description: "4,444 soft, silly little Mochis.",
    start_url: "/",
    display: "standalone",
    background_color: "#cf4f9c",
    theme_color: "#cf4f9c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
