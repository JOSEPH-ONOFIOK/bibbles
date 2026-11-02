import type { Metadata, Viewport } from "next";
import { Chewy, Nunito } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const chewy = Chewy({ variable: "--font-chewy", weight: "400", subsets: ["latin"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

const TITLE = "Bibbles";
const DESCRIPTION = "4,444 soft, silly little Bibbles. Build your own Bibble, connect X and join the Bibbles.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · Bibbles" },
  description: DESCRIPTION,
  applicationName: TITLE,
  keywords: ["Bibbles", "NFT", "PFP", "4444", "cute", "collection", "allowlist"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@bibbleshq",
    creator: "@bibbleshq",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#cf4f9c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${chewy.variable} ${nunito.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
