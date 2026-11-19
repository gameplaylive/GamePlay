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
  /** Thin strip (default) vs larger sidebar unit */
  variant?: "strip" | "feed" | "sidebar";
  className?: string;
  label?: string;
}

const STRIP_PX = 44;

/** AdSense often sets height:auto !important on parents — force the thin strip back. */
function useLockStripHeight(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const lock = () => {
      el.style.setProperty("height", `${STRIP_PX}px`, "important");
      el.style.setProperty("max-height", `${STRIP_PX}px`, "important");
      el.style.setProperty("min-height", `${STRIP_PX}px`, "important");
      el.style.setProperty("overflow", "hidden", "important");
    };

    lock();
    const obs = new MutationObserver(lock);
    obs.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
    const tick = window.setInterval(lock, 500);
    return () => {
      obs.disconnect();
      window.clearInterval(tick);
    };
  }, [enabled]);

  return ref;
}

/**
 * Web AdSense banner. Strip = thin horizontal bar only (never tall rectangle).
 */
export function AdBanner({ variant = "strip", className, label = "Sponsored" }: AdBannerProps) {
  const { settings, loading } = useApp();
  const pathname = usePathname();
  const pushed = useRef(false);
  const uid = useId();
  // Always false on first paint so SSR HTML matches client hydrate
  const [nativeApp, setNativeApp] = useState(false);

  const blockedPath = isAdBlockedPath(pathname);
  const adsEnabled = settings.adsense_enabled !== false;
  const isStrip = variant === "strip" || variant === "feed";

  const showRealAd =
    !nativeApp &&
    !blockedPath &&
    adsEnabled &&
    Boolean(settings.adsense_publisher_id?.trim() && settings.adsense_slot_id?.trim());

  const lockRef = useLockStripHeight(isStrip);

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

  if (nativeApp) return null;
  if (blockedPath) return null;
  if (!loading && !adsEnabled) return null;

  if (!showRealAd) {
    return (
      <div
        ref={isStrip ? lockRef : undefined}
        className={cn(
          "ad-strip flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl border border-cyan/25 px-3 text-left",
          isStrip ? "h-11" : "min-h-[250px] flex-col justify-center gap-4",
          className
        )}
      >
        <div className={cn("min-w-0", !isStrip && "text-center")}>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan/80">{label}</p>
          <p className="truncate text-[11px] font-semibold leading-tight text-white">Advertisement</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-muted">
          Banner
        </span>
      </div>
    );
  }

  if (!isStrip) {
    return (
      <div
        className={cn(
          "ad-strip-tall w-full overflow-hidden rounded-xl border border-border-glow/80 px-2 py-3",
          className
        )}
        aria-label={label}
      >
        <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.22em] text-muted">{label}</p>
        <ins
          key={uid}
          className="adsbygoogle"
          style={{ display: "block", minHeight: 240 }}
          data-ad-client={settings.adsense_publisher_id}
          data-ad-slot={settings.adsense_slot_id}
          data-ad-format="rectangle"
          data-full-width-responsive="false"
        />
      </div>
    );
  }

  return (
    <div
      ref={lockRef}
      className={cn("ad-strip w-full overflow-hidden rounded-xl border border-border-glow/80", className)}
      aria-label={label}
    >
      <div className="flex h-11 max-h-11 items-center gap-2 overflow-hidden px-2">
        <p className="shrink-0 text-[8px] font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
        <div className="ad-strip-slot relative h-8 min-w-0 flex-1 overflow-hidden">
          <ins
            key={uid}
            className="adsbygoogle"
            style={{
              display: "inline-block",
              width: "100%",
              height: "32px",
              maxHeight: "32px",
              overflow: "hidden",
              verticalAlign: "middle",
            }}
            data-ad-client={settings.adsense_publisher_id}
            data-ad-slot={settings.adsense_slot_id}
            data-ad-format="horizontal"
            data-full-width-responsive="false"
          />
        </div>
      </div>
    </div>
  );
}
