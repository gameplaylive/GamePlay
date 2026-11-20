import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import { twitchFetch } from "@/lib/twitch";
import { youtubeFetch } from "@/lib/youtube";
import {
  DEFAULT_GAMES,
  YOUTUBE_LIVE_SEARCH_BATCHES,
  classifyYoutubeLiveItem,
  gameFromTwitchId,
  twitchGameIdBatch,
  youtubeLiveBatchForTick,
  type YoutubeLiveSearchBatch,
} from "@/lib/default-games";
import {
  YOUTUBE_SEARCH_LIST_COST,
  canSpendUnits,
  recordLightUnits,
  recordLiveSearchListCall,
} from "@/lib/youtube-quota";
import { detectStreamLanguage } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const cron = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return cron === `Bearer ${secret}`;
}

/**
 * Quota-safe discovery sync.
 * ?platform=youtube — rotating small search.list batches / ~20 min
 * ?platform=youtube&refill=1 — all batches once (empty-cache / admin catch-up)
 * ?platform=twitch  — per-game helix/streams / ~5 min
 * (default: both)
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") || "all";
  const forceRefill = url.searchParams.get("refill") === "1";
  const settings = await getAppSettingsFull();
  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      message: "Supabase not configured yet — sync skipped.",
    });
  }

  const summary: Record<string, unknown> = { platform };

  if (platform === "youtube" || platform === "all") {
    try {
      summary.youtube = await syncYoutubeLive(
        supabase,
        settings.youtube_api_key,
        { forceRefill }
      );
    } catch (e) {
      console.error("syncYoutubeLive failed", e);
      summary.youtube = {
        error: e instanceof Error ? e.message : "youtube sync failed",
        kept_existing: true,
      };
    }
  }
  if (platform === "twitch" || platform === "all") {
    try {
      summary.twitch = await syncTwitchLive(
        supabase,
        settings.twitch_client_id,
        settings.twitch_client_secret
      );
    } catch (e) {
      console.error("syncTwitchLive failed", e);
      summary.twitch = {
        error: e instanceof Error ? e.message : "twitch sync failed",
        kept_existing: true,
      };
    }
  }

  await supabase
    .from("app_settings")
    .update({ last_sync_time: new Date().toISOString() })
    .eq("id", 1);

  return NextResponse.json({ ok: true, ...summary });
}

async function syncYoutubeLive(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  apiKey: string,
  opts: { forceRefill?: boolean } = {}
) {
  if (!apiKey) return { skipped: true, reason: "no youtube key" };

  const { count: existingYt } = await supabase
    .from("cached_streams")
    .select("*", { count: "exact", head: true })
    .eq("platform", "youtube")
    .eq("content_type", "live");

  const cacheEmpty = !existingYt;
  const refill = Boolean(opts.forceRefill) || cacheEmpty;

  const batches: YoutubeLiveSearchBatch[] = refill
    ? [...YOUTUBE_LIVE_SEARCH_BATCHES]
    : [youtubeLiveBatchForTick()];

  const feedRows: Record<string, unknown>[] = [];
  const streamRows: Record<string, unknown>[] = [];
  const now = new Date().toISOString();
  const videoIds: string[] = [];
  const seenVideo = new Set<string>();
  const touchedSlugs = new Set<string>();
  const batchResults: {
    id: string;
    items: number;
    classified: number;
  }[] = [];
  let unclassified = 0;
  let searches = 0;

  for (const batch of batches) {
    const spend = await canSpendUnits(YOUTUBE_SEARCH_LIST_COST, "live");
    if (!spend.ok) {
      if (!searches) {
        return {
          skipped: true,
          reason: "daily_unit_budget",
          used: spend.used,
          budget: spend.budget,
          kept_existing: true,
        };
      }
      break;
    }

    const q = encodeURIComponent(batch.query);
    const liveYt = await youtubeFetch(
      `/search?part=snippet&eventType=live&type=video&videoCategoryId=20&maxResults=50&order=viewCount&q=${q}`,
      apiKey
    );
    await recordLiveSearchListCall(1);
    searches += 1;

    let batchClassified = 0;
    for (const item of liveYt.items || []) {
      const title = String(item.snippet?.title || "");
      const description = String(item.snippet?.description || "");
      const game = classifyYoutubeLiveItem(title, description);
      if (!game) {
        unclassified += 1;
        continue;
      }

      const externalId = item.id?.videoId;
      if (!externalId || seenVideo.has(externalId)) continue;
      seenVideo.add(externalId);
      videoIds.push(externalId);
      touchedSlugs.add(game.slug);
      batchClassified += 1;

      const row = {
        platform: "youtube",
        game_slug: game.slug,
        game_title: game.title,
        external_id: externalId,
        title,
        streamer_name: item.snippet?.channelTitle || "",
        channel_id: item.snippet?.channelId || "",
        thumbnail_url:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          "",
        viewer_count: 0,
        published_at: item.snippet?.publishedAt || null,
        language: detectStreamLanguage(title, description),
        raw: item,
        fetched_at: now,
      };
      feedRows.push(row);

      streamRows.push({
        game_id: game.id,
        game_slug: game.slug,
        game_title: game.title,
        content_type: "live",
        platform: "youtube",
        external_id: externalId,
        title,
        streamer_name: item.snippet?.channelTitle || "",
        thumbnail_url: row.thumbnail_url,
        viewer_count: 0,
        published_at: item.snippet?.publishedAt || null,
        language: row.language,
        updated_at: now,
      });
    }

    for (const slug of batch.slugs) touchedSlugs.add(slug);
    batchResults.push({
      id: batch.id,
      items: liveYt.items?.length || 0,
      classified: batchClassified,
    });
  }

  // Cheap concurrent viewer pass (videos.list ≈ 1 unit)
  if (videoIds.length) {
    try {
      const light = await canSpendUnits(1, "live");
      if (light.ok) {
        const ids = videoIds.slice(0, 50).join(",");
        const details = await youtubeFetch(
          `/videos?part=liveStreamingDetails,statistics&id=${encodeURIComponent(ids)}`,
          apiKey
        );
        await recordLightUnits(1);
        const viewers = new Map<string, number>();
        for (const v of details.items || []) {
          const id = String(v.id || "");
          const n = Number(
            v.liveStreamingDetails?.concurrentViewers ||
              v.statistics?.viewCount ||
              0
          );
          if (id && Number.isFinite(n)) viewers.set(id, n);
        }
        for (const row of feedRows) {
          const id = String(row.external_id || "");
          if (viewers.has(id)) row.viewer_count = viewers.get(id);
        }
        for (const row of streamRows) {
          const id = String(row.external_id || "");
          if (viewers.has(id)) row.viewer_count = viewers.get(id);
        }
      }
    } catch (e) {
      console.error("youtube viewers enrich failed", e);
    }
  }

  // Never wipe a healthy cache when this tick classified nothing.
  if (!streamRows.length) {
    return {
      items: batchResults.reduce((n, b) => n + b.items, 0),
      classified: 0,
      unclassified,
      batches: batchResults,
      refill,
      kept_existing: true,
      search_cost_units: searches * YOUTUBE_SEARCH_LIST_COST,
    };
  }

  const slugs = [...touchedSlugs];

  // Replace only the games this tick refreshed (keep other batches intact)
  await supabase
    .from("cached_streams")
    .delete()
    .eq("platform", "youtube")
    .eq("content_type", "live")
    .in("game_slug", slugs);

  await supabase
    .from("cached_live_feeds")
    .delete()
    .eq("platform", "youtube")
    .in("game_slug", slugs);

  if (feedRows.length) {
    const { error } = await supabase.from("cached_live_feeds").upsert(feedRows, {
      onConflict: "platform,external_id",
    });
    if (error) console.error("cached_live_feeds", error);
  }
  if (streamRows.length) {
    const { error } = await supabase.from("cached_streams").insert(streamRows);
    if (error) console.error("cached_streams yt", error);
  }

  return {
    items: batchResults.reduce((n, b) => n + b.items, 0),
    classified: streamRows.length,
    unclassified,
    batches: batchResults,
    refill,
    game_slugs: slugs,
    search_cost_units: searches * YOUTUBE_SEARCH_LIST_COST,
  };
}

async function syncTwitchLive(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  clientId: string,
  clientSecret: string
) {
  if (!clientId || !clientSecret) return { skipped: true, reason: "no twitch keys" };

  // Per-game Helix fetches — a single batched /streams?game_id=…&first=100 is viewer-sorted
  // across all categories, so big Western titles crowd out BGMI / Free Fire / etc.
  const gameIds = twitchGameIdBatch();
  const perGameFirst = 12;
  const now = new Date().toISOString();
  const feedRows: Record<string, unknown>[] = [];
  const streamRows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const gameId of gameIds) {
    const live = await twitchFetch(
      `/streams?game_id=${encodeURIComponent(gameId)}&first=${perGameFirst}`,
      clientId,
      clientSecret
    );
    for (const s of live.data || []) {
      const game = gameFromTwitchId(String(s.game_id));
      if (!game) continue;
      const key = `twitch:${s.user_login}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const thumb = String(s.thumbnail_url || "")
        .replace("{width}", "1280")
        .replace("{height}", "720");

      feedRows.push({
        platform: "twitch",
        game_slug: game.slug,
        game_title: game.title,
        external_id: s.user_login,
        title: s.title,
        streamer_name: s.user_name,
        channel_id: String(s.user_id || ""),
        thumbnail_url: thumb,
        viewer_count: s.viewer_count || 0,
        published_at: s.started_at || null,
        language: mapTwitchLanguage(s.language),
        raw: s,
        fetched_at: now,
      });

      streamRows.push({
        game_id: game.id,
        game_slug: game.slug,
        game_title: game.title,
        content_type: "live",
        platform: "twitch",
        external_id: s.user_login,
        title: s.title,
        streamer_name: s.user_name,
        thumbnail_url: thumb,
        viewer_count: s.viewer_count || 0,
        published_at: s.started_at || null,
        language: mapTwitchLanguage(s.language),
        updated_at: now,
      });
    }
  }

  if (!streamRows.length) {
    return { items: 0, kept_existing: true, batched_game_ids: gameIds.length };
  }

  await supabase
    .from("cached_streams")
    .delete()
    .eq("platform", "twitch")
    .eq("content_type", "live")
    .in(
      "game_slug",
      DEFAULT_GAMES.map((g) => g.slug)
    );

  await supabase.from("cached_live_feeds").delete().eq("platform", "twitch");

  if (feedRows.length) {
    const { error } = await supabase.from("cached_live_feeds").upsert(feedRows, {
      onConflict: "platform,external_id",
    });
    if (error) console.error("cached_live_feeds twitch", error);
  }
  if (streamRows.length) {
    const { error } = await supabase.from("cached_streams").insert(streamRows);
    if (error) console.error("cached_streams twitch", error);
  }

  return { items: streamRows.length, batched_game_ids: gameIds.length, games: DEFAULT_GAMES.length };
}

function mapTwitchLanguage(code: unknown): string {
  const c = String(code || "").toLowerCase();
  const map: Record<string, string> = {
    en: "English",
    hi: "Hindi",
    ta: "Tamil",
    te: "Telugu",
    kn: "Kannada",
    ml: "Malayalam",
    bn: "Bengali",
    mr: "Marathi",
    es: "Spanish",
    pt: "Portuguese",
    ko: "Korean",
    ja: "Japanese",
  };
  return map[c] || (c ? c : "English");
}

export async function POST(request: Request) {
  return GET(request);
}
