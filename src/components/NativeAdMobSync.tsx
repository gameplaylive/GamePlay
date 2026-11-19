"use client";

import { useEffect } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { isAndroidNativeApp } from "@/lib/go-live";

/**
 * Syncs ads settings to the Android AdMob banner.
 * Web AdSense stays off inside the WebView; native shows AdMob instead.
 * Banners sit outside the player (not inside YT/Twitch embeds).
 */
export function NativeAdMobSync() {
  const { settings, loading } = useApp();

  // Keep booleans stable so the effect dependency array length never changes across HMR / settings load.
  const adsOn =
    settings.adsense_enabled !== false && (settings.admob_enabled ?? true) !== false;

  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    if (!isAndroidNativeApp()) return;

    try {
      window.AndroidStreamBridge?.setBannerAdsEnabled?.(adsOn);
    } catch {
      // Bridge may be unavailable outside the APK
    }
  }, [loading, adsOn]);

  return null;
}
