"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SHOW_MS = 2100;
const FADE_MS = 480;

/**
 * Cold-start splash: pure black, centered brand logo, soft scale/fade.
 * Plays once per browser tab session so back-navigation stays snappy.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("gpl_splash_done") === "1") {
        setVisible(false);
        return;
      }
    } catch {
      /* ignore */
    }

    const fadeTimer = window.setTimeout(() => setExiting(true), SHOW_MS);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem("gpl_splash_done", "1");
      } catch {
        /* ignore */
      }
    }, SHOW_MS + FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`splash-screen${exiting ? " splash-screen--out" : ""}`}
      role="presentation"
      aria-hidden
    >
      <div className="splash-screen__brand">
        <Image
          src="/brand/gameplay-live-logo-transparent.png"
          alt="GamePlay"
          width={220}
          height={74}
          priority
          unoptimized
          className="splash-screen__logo"
        />
      </div>
    </div>
  );
}
