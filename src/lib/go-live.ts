import type { CommunityGame, StreamResolution } from "@/lib/types";
import { GAME_ANDROID_PACKAGES } from "@/lib/types";

export const YOUTUBE_RTMP_BASE = "rtmps://a.rtmp.youtube.com/live2";

export const YOUTUBE_OAUTH_SCOPE = "https://www.googleapis.com/auth/youtube";

declare global {
  interface Window {
    AndroidStreamBridge?: {
      startStream: (
        rtmpFullUrl: string,
        gamePackageName: string,
        resolution: string,
        micEnabled: boolean
      ) => void;
      stopStream: () => void;
      muteMic?: () => void;
      unmuteMic?: () => void;
      isNativeApp?: () => boolean;
      /** AdMob sticky banner — free users only; Pro / ads-off → false */
      setBannerAdsEnabled?: (enabled: boolean) => void;
    };
  }
}

export function isAndroidNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  // Prefer JS bridge when present
  try {
    if (window.AndroidStreamBridge?.isNativeApp?.()) return true;
    if (window.AndroidStreamBridge?.startStream) return true;
  } catch {
    // Bridge may throw if partially injected
  }
  // Fallback: MainActivity appends "GameplayLiveAndroid/1.0" to the WebView UA
  return /GameplayLiveAndroid/i.test(navigator.userAgent || "");
}

export function buildRtmpUrl(streamKey: string): string {
  const key = streamKey.trim().replace(/^\/+/, "");
  if (key.startsWith("rtmp://") || key.startsWith("rtmps://")) return key;
  return `${YOUTUBE_RTMP_BASE}/${key}`;
}

export function gamePackageName(game: CommunityGame): string {
  return GAME_ANDROID_PACKAGES[game] || "";
}

export function resolutionLabel(r: StreamResolution): string {
  return r === "1080p30" ? "1080p 30fps" : "720p 60fps (Recommended)";
}

export function watchHrefForCommunity(stream: {
  id: string;
  youtube_video_id: string | null;
  stream_title: string;
  creator_name: string;
  game: string;
  playback_url?: string | null;
  source?: string;
}): string | null {
  const isPcHls = Boolean(stream.playback_url) && (stream.source === "pc" || !stream.youtube_video_id);
  if (!stream.youtube_video_id && !stream.playback_url) return null;

  const q = new URLSearchParams({
    platform: isPcHls ? "hls" : "youtube",
    external: isPcHls ? stream.playback_url! : stream.youtube_video_id!,
    type: "live",
    title: stream.stream_title,
    streamer: stream.creator_name,
    game: stream.game,
  });
  return `/watch/community-${stream.id}?${q.toString()}`;
}
