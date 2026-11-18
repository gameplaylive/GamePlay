import { WatchClient } from "@/components/watch/WatchClient";
import { MOCK_STREAMS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import type { CachedStream } from "@/lib/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ streamId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function one(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] || "";
  return v || "";
}

function shareThumb(stream: Pick<CachedStream, "thumbnail_url" | "platform" | "external_id">): string {
  const raw = stream.thumbnail_url?.trim();
  if (raw) {
    return raw.replace("{width}", "1280").replace("{height}", "720");
  }
  if (stream.platform === "youtube" && stream.external_id) {
    return `https://i.ytimg.com/vi/${stream.external_id}/hqdefault.jpg`;
  }
  if (stream.platform === "twitch" && stream.external_id) {
    const login = stream.external_id.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
    if (login) {
      return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-1280x720.jpg`;
    }
  }
  return "https://gameplaylive.live/icons/icon-512.png";
}

async function loadStreamForMeta(
  streamId: string,
  sp: Record<string, string | string[] | undefined>
): Promise<CachedStream | null> {
  if (
    streamId.startsWith("fav-") ||
    streamId.startsWith("tournament-") ||
    streamId.startsWith("community-")
  ) {
    const platform = (one(sp.platform) || "youtube") as CachedStream["platform"];
    const external = one(sp.external);
    if (!external) return null;
    return {
      id: streamId,
      game_id: null,
      game_slug: "",
      game_title: one(sp.game) || "GamePlay Live",
      content_type: (one(sp.type) as CachedStream["content_type"]) || "live",
      platform,
      external_id: external,
      title: one(sp.title) || "Watch on GamePlay Live",
      streamer_name: one(sp.streamer) || "Creator",
      thumbnail_url: "",
      viewer_count: 0,
      published_at: new Date().toISOString(),
      language: "English",
      updated_at: new Date().toISOString(),
    };
  }

  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.from("cached_streams").select("*").eq("id", streamId).maybeSingle();
    if (data) return data as CachedStream;
  }
  return MOCK_STREAMS.find((s) => s.id === streamId) || null;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { streamId } = await params;
  const sp = await searchParams;
  const stream = await loadStreamForMeta(streamId, sp);
  if (!stream) {
    return { title: "Watch · GamePlay Live" };
  }

  const image = shareThumb(stream);
  const live = stream.content_type === "live";
  const description = live
    ? `🔥 LIVE now — ${stream.game_title} with ${stream.streamer_name}. Watch now on GamePlay Live.`
    : `🎮 ${stream.game_title} with ${stream.streamer_name}. Watch now on GamePlay Live.`;
  const title = `${live ? "LIVE · " : ""}${stream.title}`;

  return {
    title,
    description,
    openGraph: {
      title: `${stream.game_title} · ${stream.title}`,
      description,
      type: "website",
      siteName: "GamePlay Live",
      images: [{ url: image, width: 1280, height: 720, alt: `${stream.game_title} — ${stream.title}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${stream.game_title} · Watch now`,
      description,
      images: [image],
    },
  };
}

export default async function WatchPage({ params, searchParams }: PageProps) {
  const { streamId } = await params;
  const sp = await searchParams;

  // Deep-link fallbacks: /watch/fav-... | tournament-... | community-...?platform&external&type&title&streamer
  if (
    streamId.startsWith("fav-") ||
    streamId.startsWith("tournament-") ||
    streamId.startsWith("community-")
  ) {
    const platform = String(
      sp.platform || (streamId.startsWith("community-") ? "youtube" : "twitch")
    ) as "youtube" | "twitch" | "hls";
    const external = String(sp.external || "");
    const type = String(sp.type || "live") as "live" | "video";
    const title = String(
      sp.title ||
        (streamId.startsWith("tournament-")
          ? "Tournament"
          : streamId.startsWith("community-")
            ? "Community creator"
            : "Favorite gamer")
    );
    const streamer = String(sp.streamer || "Creator");
    const gameTitle = String(
      sp.game ||
        (streamId.startsWith("tournament-")
          ? "Esports"
          : streamId.startsWith("community-")
            ? "Community"
            : "Favorites")
    );
    if (!external) notFound();
    const stream: CachedStream = {
      id: streamId,
      game_id: null,
      game_slug: "",
      game_title: gameTitle,
      content_type: type,
      platform,
      external_id: external,
      title,
      streamer_name: streamer,
      thumbnail_url: "",
      viewer_count: 0,
      published_at: new Date().toISOString(),
      language: "English",
      updated_at: new Date().toISOString(),
    };
    return (
      <WatchClient
        stream={stream}
        related={MOCK_STREAMS.filter((s) => s.content_type === "live").slice(0, 6)}
      />
    );
  }

  const supabase = await createClient();
  let stream: CachedStream | null = null;
  let related: CachedStream[] = [];

  if (supabase) {
    const { data } = await supabase.from("cached_streams").select("*").eq("id", streamId).maybeSingle();
    stream = (data as CachedStream) || null;
    if (stream) {
      const { data: more } = await supabase
        .from("cached_streams")
        .select("*")
        .eq("game_slug", stream.game_slug)
        .neq("id", stream.id)
        .limit(12);
      related = (more as CachedStream[]) || [];
    }
  }

  if (!stream) {
    stream = MOCK_STREAMS.find((s) => s.id === streamId) || null;
    related = MOCK_STREAMS.filter((s) => s.id !== streamId && s.game_slug === stream?.game_slug).slice(0, 8);
  }

  if (!stream) notFound();

  return <WatchClient stream={stream} related={related} />;
}
