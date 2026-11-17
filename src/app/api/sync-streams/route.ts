import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import { twitchFetch } from "@/lib/twitch";
import { youtubeFetch } from "@/lib/youtube";
import {
  DEFAULT_GAMES,
  YOUTUBE_LIVE_BROAD_QUERY,
  classifyYoutubeLiveItem,
  gameFromTwitchId,
  twitchGameIdBatch,
} from "@/lib/default-games";
import { recordSearchListCall } from "@/lib/youtube-quota";

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
 * ?platform=youtube — 1 broad search.list / ~20 min (classify into 10 games locally)
 * ?platform=twitch  — 1 batched helix/streams for all top-10 game_ids / ~3 min
 * (default: both)
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = new URL(request.url).searchParams.get("platform") || "all";
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
    summary.youtube = await syncYoutubeLive(supabase, settings.youtube_api_key);
  }
  if (platform === "twitch" || platform === "all") {
    summary.twitch = await syncTwitchLive(
      supabase,
      settings.twitch_client_id,
      settings.twitch_client_secret
    );
  }

  await supabase
    .from("app_settings")
    .update({ last_sync_time: new Date().toISOString() })
    .eq("id", 1);

  return NextResponse.json({ ok: true, ...summary });
}

async function syncYoutubeLive(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  apiKey: string
) {
  if (!apiKey) return { skipped: true, reason: "no youtube key" };

  const q = encodeURIComponent(YOUTUBE_LIVE_BROAD_QUERY);
  const liveYt = await youtubeFetch(
    `/search?part=snippet&eventType=live&type=video&videoCategoryId=20&maxResults=50&order=viewCount&q=${q}`,
    apiKey
  );
  await recordSearchListCall(1);

  const feedRows: Record<string, unknown>[] = [];
  const streamRows: Record<string, unknown>[] = [];
  const now = new Date().toISOString();
  let unclassified = 0;

  for (const item of liveYt.items || []) {
    const title = String(item.snippet?.title || "");
    const description = String(item.snippet?.description || "");
    const game = classifyYoutubeLiveItem(title, description);
    if (!game) {
      unclassified += 1;
      continue;
    }

    const externalId = item.id?.videoId;
    if (!externalId) continue;

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
      language: "English",
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
      language: "English",
      updated_at: now,
    });
  }

  // Replace YouTube live rows for default games only
  await supabase
    .from("cached_streams")
    .delete()
    .eq("platform", "youtube")
    .eq("content_type", "live")
    .in(
      "game_slug",
      DEFAULT_GAMES.map((g) => g.slug)
    );

  await supabase.from("cached_live_feeds").delete().eq("platform", "youtube");

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
    items: liveYt.items?.length || 0,
    classified: streamRows.length,
    unclassified,
    search_cost_units: 100,
  };
}

async function syncTwitchLive(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  clientId: string,
  clientSecret: string
) {
  if (!clientId || !clientSecret) return { skipped: true, reason: "no twitch keys" };

  // Single batched request: all top-10 Twitch category ids (COD includes Warzone + CODM extras)
  const gameIds = twitchGameIdBatch();
  const params = gameIds.map((id) => `game_id=${id}`).join("&");
  const live = await twitchFetch(`/streams?${params}&first=100`, clientId, clientSecret);

  const now = new Date().toISOString();
  const feedRows: Record<string, unknown>[] = [];
  const streamRows: Record<string, unknown>[] = [];

  for (const s of live.data || []) {
    const game = gameFromTwitchId(String(s.game_id));
    if (!game) continue;
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
      language: s.language === "en" ? "English" : s.language || "English",
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
      language: s.language === "en" ? "English" : s.language || "English",
      updated_at: now,
    });
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

export async function POST(request: Request) {
  return GET(request);
}
