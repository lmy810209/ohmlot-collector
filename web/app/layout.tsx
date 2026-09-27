import type { Metadata } from "next";
import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { lastUpdated } from "@/lib/data";

const schibsted = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"], weight: "variable" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://ohmlot.com"),
  title: { default: "Ohmlot — The original marketplace for personal robots", template: "%s · Ohmlot" },
  description:
    "Daily list prices and FCC authorization records for personal robots: humanoids, robot dogs, and desktop robots.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const updated = lastUpdated();
  return (
    <html lang="en" className={`${schibsted.variable} ${plexMono.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-bg font-sans text-ink">
        <SiteHeader lastUpdated={updated} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">{children}</main>
        <SiteFooter lastUpdated={updated} />
        {/* Vercel Web Analytics: cookieless page views; only reports when deployed on Vercel with Web Analytics enabled. */}
        <Analytics />
      </body>
    </html>
  );
}
