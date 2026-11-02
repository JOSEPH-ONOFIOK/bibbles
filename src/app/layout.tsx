import type { Metadata } from "next";
import { Chewy, Nunito } from "next/font/google";
import "./globals.css";

const chewy = Chewy({ variable: "--font-chewy", weight: "400", subsets: ["latin"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Bibbles",
  description: "4,444 soft, silly little Bibbles. Build your own and join the Bibbles.",
  icons: { icon: "/brand/logo.jpg" },
  openGraph: {
    title: "Bibbles",
    description: "4,444 soft, silly little Bibbles.",
    images: ["/brand/banner.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bibbleshq",
    title: "Bibbles",
    description: "4,444 soft, silly little Bibbles.",
    images: ["/brand/banner.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${chewy.variable} ${nunito.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
