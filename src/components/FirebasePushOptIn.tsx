"use client";

import { useEffect, useRef } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { firebaseConfigured, getFirebaseMessaging } from "@/lib/firebase-client";
import { useApp } from "@/components/providers/AppProviders";

/**
 * Registers FCM web token after login (or anonymously) and refreshes timezone.
 */
export function FirebasePushOptIn() {
  const { profile, loading } = useApp();
  const registered = useRef(false);

  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    if (!firebaseConfigured()) return;
    if (registered.current) return;

    let cancelled = false;

    (async () => {
      try {
        if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
        const permission =
          Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission();
        if (permission !== "granted" || cancelled) return;

        const messaging = await getFirebaseMessaging();
        if (!messaging || cancelled) return;

        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
        if (!vapidKey) return;

        const reg = await navigator.serviceWorker.register("/api/push/firebase-sw", {
          scope: "/",
        });
        await navigator.serviceWorker.ready;

        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: reg,
        });
        if (!token || cancelled) return;

        registered.current = true;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        await fetch("/api/push/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            platform: "web",
            timezone,
            country: null,
          }),
        });

        onMessage(messaging, (payload) => {
          const title = payload.notification?.title || payload.data?.title || "GamePlay Live";
          const body = payload.notification?.body || payload.data?.body || "";
          if (Notification.permission === "granted") {
            new Notification(title, {
              body,
              icon: "/icons/icon-192.png",
              data: { url: payload.data?.url || "/" },
            });
          }
        });
      } catch {
        // Permission denied or Firebase not fully configured yet
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, profile?.id]);

  return null;
}
