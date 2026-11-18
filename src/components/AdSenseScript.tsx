"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { isAndroidNativeApp } from "@/lib/go-live";

/**
 * Loads official AdSense JS on web browsers only.
 * Skipped inside the Android WebView (AdMob owns in-app inventory).
 * Client ID comes from Admin vault `adsense_publisher_id` (ca-pub-…).
 */
export function AdSenseScript() {
  const { settings, loading } = useApp();
  const [nativeApp, setNativeApp] = useState(
    () => typeof window !== "undefined" && isAndroidNativeApp()
  );

  useEffect(() => {
    setNativeApp(isAndroidNativeApp());
  }, []);

  const clientId =
    settings.adsense_publisher_id?.trim() ||
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() ||
    "";

  if (loading || nativeApp || !settings.adsense_enabled || !clientId) {
    return null;
  }

  return (
    <Script
      id="google-adsense"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
