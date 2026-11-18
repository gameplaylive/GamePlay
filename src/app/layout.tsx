import type { Metadata, Viewport } from "next";
import { Outfit, Syne } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";

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
      </head>
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <AppProviders>
          <NavBar />
          <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}
