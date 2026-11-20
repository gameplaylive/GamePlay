import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Outfit, Syne } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { SplashScreen } from "@/components/SplashScreen";
import { SiteAnalytics } from "@/components/SiteAnalytics";
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
    "Free gaming hub — watch live gameplay, go live to YouTube from mobile or OBS, find squads, and follow your favorite creators.",
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
    // suppressHydrationWarning: browser extensions + AdSense often mutate <html>/<body> attrs before hydrate
    <html lang="en" className={`${outfit.variable} ${syne.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="flex min-h-full flex-col overflow-x-hidden" suppressHydrationWarning>
        {/* next/script avoids raw <script crossOrigin> SSR/client attribute mismatches */}
        <Script
          id="google-adsense"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <SplashScreen />
        <AppProviders>
          <Suspense fallback={null}>
            <SiteAnalytics />
          </Suspense>
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
