"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/providers/AppProviders";
import { isAdBlockedPath } from "@/lib/ad-policy";
import { isAndroidNativeApp } from "@/lib/go-live";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdBannerProps {
  /** Thin strip (default) vs larger in-feed / sidebar unit */
  variant?: "strip" | "feed" | "sidebar";
  className?: string;
  /** Optional label for placeholder / debugging */
  label?: string;
}

/**
 * Web AdSense banner. Never place inside the video player iframe.
 * Shown for free and Creator Pro — banners sit outside embeds (YT/Twitch may still
 * show their own in-player ads). Admins / Pro do not suppress platform banners.
 */
export function AdBanner({ variant = "strip", className, label = "Sponsored" }: AdBannerProps) {
  const { settings, loading } = useApp();
  const pathname = usePathname();
  const pushed = useRef(false);
  const uid = useId();
  const [nativeApp, setNativeApp] = useState(
    () => typeof window !== "undefined" && isAndroidNativeApp()
  );

  const blockedPath = isAdBlockedPath(pathname);
  const adsEnabled = settings.adsense_enabled !== false;

  const showRealAd =
    !nativeApp &&
    !blockedPath &&
    adsEnabled &&
    Boolean(settings.adsense_publisher_id?.trim() && settings.adsense_slot_id?.trim());

  useEffect(() => {
    setNativeApp(isAndroidNativeApp());
  }, []);

  useEffect(() => {
    if (!showRealAd || pushed.current) return;
    let cancelled = false;
    let tries = 0;

    const push = () => {
      if (cancelled || pushed.current) return;
      try {
        if (!window.adsbygoogle) {
          if (tries++ < 20) window.setTimeout(push, 250);
          return;
        }
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      } catch {
        if (tries++ < 10) window.setTimeout(push, 400);
      }
    };

    push();
    return () => {
      cancelled = true;
    };
  }, [showRealAd, uid]);

  // Native APK uses AdMob — do not render AdSense (or placeholders that duplicate the banner).
  if (nativeApp) return null;

  // No ads on login / legal / admin / empty utility screens (AdSense + AdMob policy)
  if (blockedPath) return null;

  if (!loading && !adsEnabled) return null;

  const sizeClass =
    variant === "strip"
      ? "min-h-[56px] py-1.5"
      : variant === "sidebar"
        ? "min-h-[250px] py-3"
        : "min-h-[72px] py-2";

  if (!showRealAd) {
    return (
      <div
        className={cn(
          "ad-strip flex w-full items-center justify-between gap-3 rounded-xl border border-cyan/25 px-3 text-left",
          variant === "strip"
            ? "min-h-[56px]"
            : variant === "sidebar"
              ? "min-h-[250px] flex-col justify-center gap-4"
              : "min-h-[72px]",
          className
        )}
      >
        <div className={cn("min-w-0", variant === "sidebar" && "text-center")}>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan/80">{label}</p>
          <p className="truncate text-xs font-semibold text-white">Advertisement</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-muted">
          Banner
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "ad-strip w-full overflow-hidden rounded-xl border border-border-glow/80 px-2",
        sizeClass,
        className
      )}
      aria-label={label}
    >
      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-muted">{label}</p>
      <ins
        key={uid}
        className="adsbygoogle"
        style={{
          display: "block",
          minHeight: variant === "strip" ? 50 : variant === "sidebar" ? 240 : 66,
        }}
        data-ad-client={settings.adsense_publisher_id}
        data-ad-slot={settings.adsense_slot_id}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  );
}
