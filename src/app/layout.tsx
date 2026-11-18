import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Outfit, Syne } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { PageBackBar } from "@/components/BackButton";

const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() || "ca-pub-5165582915599822";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: {
    default: "GamePlay Live — Gaming Streams Hub",
    template: "%s · GamePlay Live",
  },
  description:
    "Creator-first gaming hub — watch live gameplay, go live to YouTube from mobile or OBS, and run tournament ops. Creator Pro unlocks the studio for ₹99/mo.",
  applicationName: "GamePlay Live",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GamePlay Live",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  other: {
    "google-adsense-account": "ca-pub-5165582915599822",
  },
};

export const viewport: Viewport = {
  themeColor: "#07090F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${syne.variable} h-full antialiased`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        {/* Plain script in head so AdSense crawlers see ca-pub without waiting on hydration. */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`}
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <AppProviders>
          <NavBar />
          <Suspense fallback={null}>
            <PageBackBar />
          </Suspense>
          <main className="min-w-0 max-w-[100vw] flex-1 overflow-x-hidden">{children}</main>
          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}
