"use client";

import { useEffect, useRef } from "react";
import type { ContentType, WatchPlatform } from "@/lib/types";

interface Props {
  platform: WatchPlatform;
  externalId: string;
  contentType: ContentType | "live" | "video";
}

export function VideoPlayer({ platform, externalId, contentType }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";

  useEffect(() => {
    if (platform !== "hls" || !videoRef.current || !externalId) return;
    const video = videoRef.current;
    let destroy: (() => void) | undefined;

    (async () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = externalId;
        try {
          await video.play();
        } catch {
          /* autoplay blocked */
        }
        return;
      }

      const Hls = (await import("hls.js")).default;
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(externalId);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => undefined);
        });
        destroy = () => hls.destroy();
      } else {
        video.src = externalId;
      }
    })();

    return () => {
      destroy?.();
    };
  }, [platform, externalId]);

  if (platform === "hls") {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border-glow bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full"
          controls
          playsInline
          autoPlay
        />
      </div>
    );
  }

  let src = "";
  if (platform === "youtube") {
    src = `https://www.youtube.com/embed/${externalId}?autoplay=1&rel=0`;
  } else if (contentType === "live") {
    src = `https://player.twitch.tv/?channel=${externalId}&parent=${hostname}&autoplay=true`;
  } else {
    const videoId = externalId.startsWith("v") ? externalId : `v${externalId}`;
    src = `https://player.twitch.tv/?video=${videoId}&parent=${hostname}&autoplay=true`;
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border-glow bg-black">
      <iframe
        src={src}
        title="GamePlay Live player"
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
