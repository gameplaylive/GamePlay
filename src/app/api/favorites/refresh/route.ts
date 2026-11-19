import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import {
  isCreatorCacheStale,
  refreshTwitchCreator,
  refreshYoutubeCreator,
} from "@/lib/tracked-creators-refresh";
import type { CreatorRecentVideo, FavoriteGamerStatus, Platform } from "@/lib/types";

/**
 * Refresh one favorite creator's live + recent videos if cache is empty/stale (~20m).
 * Used when opening /gamer/[id] so users see real YouTube/Twitch uploads.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    platform?: Platform;
    channel_id_or_username?: string;
    force?: boolean;
  };

  const platform = body.platform;
  const channelKey = (body.channel_id_or_username || "").trim();
  if (!platform || !channelKey) {
    return NextResponse.json({ error: "platform and channel_id_or_username required" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient() || supabase;

  let query = service.from("tracked_creators").select("*").eq("platform", platform);
  if (platform === "youtube") {
    query = query.eq("channel_id", channelKey);
  } else {
    query = query.or(
      `channel_login.eq.${channelKey.toLowerCase()},channel_id.eq.${channelKey}`
    );
  }

  const { data: creator } = await query.maybeSingle();
  if (!creator) {
    return NextResponse.json({ error: "Creator not tracked yet — add them as a favorite first." }, { status: 404 });
  }

  const recent = (Array.isArray(creator.recent_videos) ? creator.recent_videos : []) as CreatorRecentVideo[];
  const needsRefresh =
    body.force ||
    isCreatorCacheStale(creator.last_checked_at) ||
    (!creator.latest_video_id && recent.length === 0);

  const settings = await getAppSettingsFull();

  if (needsRefresh) {
    if (platform === "youtube") {
      await refreshYoutubeCreator(service, creator, settings.youtube_api_key);
    } else {
      await refreshTwitchCreator(
        service,
        creator,
        settings.twitch_client_id,
        settings.twitch_client_secret
      );
    }
  }

  const { data: updated } = await service
    .from("tracked_creators")
    .select("*")
    .eq("id", creator.id)
    .maybeSingle();

  const row = updated || creator;
  const recentOut = (Array.isArray(row.recent_videos) ? row.recent_videos : []) as CreatorRecentVideo[];

  const status: Partial<FavoriteGamerStatus> = {
    is_live: Boolean(row.is_live),
    live_title: row.live_title || undefined,
    live_viewer_count: Number(row.live_viewer_count || 0),
    live_external_id:
      (row.live_video_id as string) ||
      (platform === "twitch" ? channelKey : undefined),
    live_thumbnail: row.live_thumbnail || undefined,
    latest_video_id: row.latest_video_id || undefined,
    latest_video_title: row.latest_video_title || undefined,
    latest_video_thumbnail: row.latest_video_thumbnail || undefined,
    recent_videos: recentOut,
    last_checked_at: row.last_checked_at || null,
  };

  return NextResponse.json({
    ok: true,
    refreshed: needsRefresh,
    status,
  });
}
