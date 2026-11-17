import { randomBytes } from "crypto";

/** Public RTMP server URL shown in OBS (no stream key). */
export function getObsIngestServerUrl(): string {
  return (
    process.env.NEXT_PUBLIC_RTMP_INGEST_URL ||
    process.env.RTMP_INGEST_URL ||
    "rtmp://live.gameplaylive.com/app"
  ).replace(/\/$/, "");
}

/** HLS base for viewers, e.g. https://live.gameplaylive.com/hls */
export function getHlsPlaybackBase(): string {
  return (
    process.env.NEXT_PUBLIC_HLS_PLAYBACK_BASE ||
    process.env.HLS_PLAYBACK_BASE ||
    "https://live.gameplaylive.com/hls"
  ).replace(/\/$/, "");
}

export function buildHlsPlaybackUrl(streamKey: string): string {
  return `${getHlsPlaybackBase()}/${encodeURIComponent(streamKey)}/index.m3u8`;
}

export function generateStreamKey(userId: string): string {
  const prefix = userId.replace(/-/g, "").slice(0, 8);
  const secret = randomBytes(18).toString("base64url");
  return `gpl_${prefix}_${secret}`;
}

export function obsSettingsClipboard(server: string, streamKey: string): string {
  return [
    "GamePlay Live — OBS / Streamlabs settings",
    "",
    `Service: Custom`,
    `Server: ${server}`,
    `Stream Key: ${streamKey}`,
    "",
    "Paste Server + Stream Key into OBS → Settings → Stream.",
  ].join("\n");
}
