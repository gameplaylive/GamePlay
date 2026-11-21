"use client";

import { useEffect } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { isAndroidNativeApp } from "@/lib/go-live";

/**
 * Syncs ads settings to the Android AdMob banner.
 * Web AdSense stays off inside the WebView; native shows AdMob instead.
 * Banners sit outside the player (not inside YT/Twitch embeds).
 *
 * Native also enables the banner by default on launch — this keeps settings
 * (admin off-switch) in sync once the bridge is ready.
 */
export function NativeAdMobSync() {
  const { settings, loading } = useApp();

  // Prefer admob_enabled; still respect a global adsense kill-switch from admin.
  const adsOn =
    (settings.admob_enabled ?? true) !== false && settings.adsense_enabled !== false;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    let tries = 0;

    const sync = () => {
      if (cancelled) return;
      const native = isAndroidNativeApp();
      if (!native) {
        // Bridge / UA can appear after first paint in the WebView shell.
        if (tries++ < 40) window.setTimeout(sync, 250);
        return;
      }
      // While settings load, keep ads on (matches native default).
      const enabled = loading ? true : adsOn;
      try {
        window.AndroidStreamBridge?.setBannerAdsEnabled?.(enabled);
      } catch {
        // Bridge may throw if partially injected
      }
    };

    sync();
    return () => {
      cancelled = true;
    };
  }, [loading, adsOn]);

  return null;
}
