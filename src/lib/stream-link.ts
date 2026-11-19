/** Parse creator-pasted YouTube / Twitch links into embed-ready IDs (zero bandwidth for us). */

export type LinkedPlatform = "youtube" | "twitch";

export type ParsedStreamLink =
  | { ok: true; platform: "youtube"; videoId: string; embedUrl: string }
  | { ok: true; platform: "twitch"; channel: string; embedUrl: string }
  | { ok: false; error: string };

const YT_ID = /^[\w-]{11}$/;
const TWITCH_CHANNEL = /^[a-zA-Z0-9_]{3,25}$/;

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
}

export function twitchEmbedUrl(channel: string, parents?: string[]): string {
  const list = parents?.length
    ? parents
    : ["gameplaylive.live", "www.gameplaylive.live", "localhost"];
  const parentQs = list.map((p) => `parent=${encodeURIComponent(p)}`).join("&");
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&${parentQs}&autoplay=true`;
}

function extractYouTubeId(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;
  if (YT_ID.test(input)) return input;

  try {
    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(withProto);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0]?.split("?")[0] || "";
      return YT_ID.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = url.searchParams.get("v");
      if (v && YT_ID.test(v)) return v;

      const parts = url.pathname.split("/").filter(Boolean);
      // /live/VIDEOID, /embed/VIDEOID, /shorts/VIDEOID, /v/VIDEOID
      const markers = ["live", "embed", "shorts", "v"];
      for (let i = 0; i < parts.length - 1; i++) {
        if (markers.includes(parts[i].toLowerCase()) && YT_ID.test(parts[i + 1])) {
          return parts[i + 1];
        }
      }
    }
  } catch {
    /* fall through */
  }

  const loose = input.match(/(?:v=|youtu\.be\/|\/live\/|\/embed\/)([\w-]{11})/);
  return loose?.[1] && YT_ID.test(loose[1]) ? loose[1] : null;
}

function extractTwitchChannel(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;

  if (TWITCH_CHANNEL.test(input)) return input.toLowerCase();

  try {
    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(withProto);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "twitch.tv" && host !== "m.twitch.tv") return null;
    const channel = url.pathname.split("/").filter(Boolean)[0] || "";
    if (!TWITCH_CHANNEL.test(channel)) return null;
    // Skip reserved paths
    if (["directory", "videos", "settings", "inventory", "subscriptions", "wallet"].includes(channel.toLowerCase())) {
      return null;
    }
    return channel.toLowerCase();
  } catch {
    return null;
  }
}

export function parseStreamLink(platform: LinkedPlatform, raw: string): ParsedStreamLink {
  if (platform === "youtube") {
    const videoId = extractYouTubeId(raw);
    if (!videoId) {
      return {
        ok: false,
        error: "Paste a valid YouTube Live link (youtube.com/watch?v=…, youtu.be/…, or youtube.com/live/…).",
      };
    }
    return { ok: true, platform: "youtube", videoId, embedUrl: youtubeEmbedUrl(videoId) };
  }

  const channel = extractTwitchChannel(raw);
  if (!channel) {
    return {
      ok: false,
      error: "Paste your Twitch channel URL (twitch.tv/username) or just your username.",
    };
  }
  return { ok: true, platform: "twitch", channel, embedUrl: twitchEmbedUrl(channel) };
}
