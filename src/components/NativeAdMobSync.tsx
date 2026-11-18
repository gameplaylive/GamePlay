"use client";

import { useEffect } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { isAndroidNativeApp } from "@/lib/go-live";

/**
 * Syncs Pro / ads settings to the Android AdMob banner.
 * Web AdSense stays off inside the WebView; native shows AdMob instead.
 */
export function NativeAdMobSync() {
  const { profile, settings, loading } = useApp();

  const isPro = profile?.subscription_tier === "pro";
  // Keep booleans stable so the effect dependency array length never changes across HMR / settings load.
  const adsOn =
    settings.adsense_enabled !== false && (settings.admob_enabled ?? true) !== false;

  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    if (!isAndroidNativeApp()) return;

    const showAds = !isPro && adsOn;

    try {
      window.AndroidStreamBridge?.setBannerAdsEnabled?.(showAds);
    } catch {
      // Bridge may be unavailable outside the APK
    }
  }, [loading, isPro, adsOn]);

  return null;
}
