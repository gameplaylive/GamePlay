"use client";

import { useEffect, useRef } from "react";
import type { CachedStream } from "@/lib/types";

const INTERVAL_MS = 30_000;

/** Sends watch heartbeats so admin analytics can aggregate durations. */
export function WatchTelemetry({ stream }: { stream: CachedStream }) {
  const sessionId = useRef<string | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    sessionId.current = null;

    async function beat(ended = false) {
      if (stopped.current && !ended) return;
      try {
        const res = await fetch("/api/watch/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId.current,
            stream_id: stream.id,
            stream_title: stream.title,
            streamer_name: stream.streamer_name,
            game_slug: stream.game_slug,
            game_title: stream.game_title,
            content_type: stream.content_type,
            platform: stream.platform,
            ended,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { session_id?: string; skipped?: boolean };
        if (data.session_id) sessionId.current = data.session_id;
      } catch {
        /* offline / table missing — ignore */
      }
    }

    void beat(false);
    const timer = window.setInterval(() => void beat(false), INTERVAL_MS);

    const onHide = () => {
      if (document.visibilityState === "hidden") void beat(true);
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      stopped.current = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      void beat(true);
    };
  }, [
    stream.id,
    stream.title,
    stream.streamer_name,
    stream.game_slug,
    stream.game_title,
    stream.content_type,
    stream.platform,
  ]);

  return null;
}
