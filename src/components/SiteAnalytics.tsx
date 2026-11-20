"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isAndroidNativeApp } from "@/lib/go-live";

const ANON_KEY = "gpl_anon_id";

function getAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `a_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(ANON_KEY, id);
    return id;
  } catch {
    return `a_${Date.now()}`;
  }
}

/** Fires a lightweight page-view beacon for admin traffic analytics. */
export function SiteAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastKey = useRef("");

  useEffect(() => {
    const qs = searchParams?.toString();
    const path = qs ? `${pathname}?${qs}` : pathname || "/";
    const key = path;
    if (lastKey.current === key) return;
    lastKey.current = key;

    const client = isAndroidNativeApp() ? "android" : "web";
    const payload = {
      path,
      client,
      anon_id: getAnonId(),
      referrer: typeof document !== "undefined" ? document.referrer || "" : "",
    };

    const body = JSON.stringify(payload);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/analytics/beacon", blob);
        return;
      }
    } catch {
      /* fall through */
    }

    void fetch("/api/analytics/beacon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname, searchParams]);

  return null;
}
