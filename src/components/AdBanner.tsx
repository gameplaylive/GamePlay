"use client";

import { useEffect, useId, useRef } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdBannerProps {
  /** Thin strip vs larger in-feed / sidebar unit */
  variant?: "strip" | "feed" | "sidebar";
  className?: string;
  /** Optional label for placeholder / debugging */
  label?: string;
}

export function AdBanner({ variant = "feed", className, label = "Sponsored" }: AdBannerProps) {
  const { profile, settings, openProModal } = useApp();
  const pushed = useRef(false);
  const uid = useId();

  const showRealAd =
    profile?.subscription_tier !== "pro" &&
    settings.adsense_enabled &&
    Boolean(settings.adsense_publisher_id && settings.adsense_slot_id);

  useEffect(() => {
    if (!showRealAd || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense may be blocked / not loaded yet
    }
  }, [showRealAd, uid]);

  if (profile?.subscription_tier === "pro" || !settings.adsense_enabled) return null;

  const sizeClass =
    variant === "strip"
      ? "min-h-[52px] py-1"
      : variant === "sidebar"
        ? "min-h-[250px] py-2"
        : "min-h-24 py-2";

  if (!showRealAd) {
    return (
      <button
        type="button"
        onClick={() => openProModal({ highlight: "ads" })}
        className={cn(
          "ad-strip flex w-full items-center justify-between gap-3 rounded-xl border border-border-glow/80 px-3 text-left transition hover:border-cyan/30",
          variant === "strip" ? "h-[52px]" : variant === "sidebar" ? "min-h-[120px] flex-col justify-center" : "min-h-20",
          className
        )}
      >
        <div className={cn("min-w-0", variant === "sidebar" && "text-center")}>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted">{label}</p>
          <p className="truncate text-xs font-semibold text-white/90">Ad slot · remove with Pro</p>
        </div>
        <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-bold text-gold">
          Go Pro
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "ad-strip w-full overflow-hidden rounded-xl border border-border-glow/80 px-2",
        sizeClass,
        className
      )}
    >
      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-muted">{label}</p>
      <ins
        key={uid}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={settings.adsense_publisher_id}
        data-ad-slot={settings.adsense_slot_id}
        data-ad-format={variant === "strip" ? "horizontal" : "auto"}
        data-full-width-responsive="true"
      />
    </div>
  );
}
