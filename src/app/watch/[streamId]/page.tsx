import { WatchClient } from "@/components/watch/WatchClient";
import { MOCK_STREAMS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import type { CachedStream } from "@/lib/types";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ streamId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
    const startMulti = String(sp.multiview || "") === "1";
    return (
      <WatchClient
        stream={stream}
        related={MOCK_STREAMS.filter((s) => s.content_type === "live").slice(0, 6)}
        startMulti={startMulti}
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
