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
      /** Open Google OAuth / account picker in Chrome Custom Tabs */
      openExternalUrl?: (url: string) => void;
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
  const source = stream.source || "";
  const isTwitch = source === "twitch" && Boolean(stream.playback_url);
  const isPcHls = source === "pc" && Boolean(stream.playback_url);
  const isYoutube = Boolean(stream.youtube_video_id);

  if (!isTwitch && !isPcHls && !isYoutube) return null;

  const platform = isTwitch ? "twitch" : isPcHls ? "hls" : "youtube";
  const external = isTwitch
    ? stream.playback_url!
    : isPcHls
      ? stream.playback_url!
      : stream.youtube_video_id!;

  const q = new URLSearchParams({
    platform,
    external,
    type: "live",
    title: stream.stream_title,
    streamer: stream.creator_name,
    game: stream.game,
  });
  return `/watch/community-${stream.id}?${q.toString()}`;
}
