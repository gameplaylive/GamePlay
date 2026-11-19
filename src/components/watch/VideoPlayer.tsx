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

  const twitchParents = Array.from(
    new Set([hostname, "gameplaylive.live", "www.gameplaylive.live", "localhost"])
  );
  const parentQs = twitchParents.map((p) => `parent=${encodeURIComponent(p)}`).join("&");

  let src = "";
  if (platform === "youtube") {
    // externalId may be a bare video id or a full embed URL
    const idMatch = externalId.match(/(?:embed\/|v=)?([\w-]{11})(?:[?&]|$)/);
    const videoId = idMatch?.[1] && /^[\w-]{11}$/.test(idMatch[1]) ? idMatch[1] : externalId;
    src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  } else if (contentType === "live") {
    const channel = externalId.replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "").split(/[/?#]/)[0];
    src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&${parentQs}&autoplay=true`;
  } else {
    const videoId = externalId.startsWith("v") ? externalId : `v${externalId}`;
    src = `https://player.twitch.tv/?video=${videoId}&${parentQs}&autoplay=true`;
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border-glow bg-black">
      <iframe
        key={src}
        src={src}
        title="GamePlay Live player"
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
