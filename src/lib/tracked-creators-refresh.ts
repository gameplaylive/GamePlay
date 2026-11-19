import type { createServiceClient } from "@/lib/supabase/server";
import { YOUTUBE_PIN_REFRESH_MAX_PER_RUN } from "@/lib/default-games";
import { notifyFollowersCreatorWentLive } from "@/lib/favorite-live-notify";
import { getAppSettingsFull } from "@/lib/settings";
import { twitchFetch } from "@/lib/twitch";
import { youtubeFetch } from "@/lib/youtube";
import {
  YOUTUBE_PIN_REFRESH_COST,
  canSpendUnits,
  recordLightUnits,
} from "@/lib/youtube-quota";
import type { CreatorRecentVideo } from "@/lib/types";

type Service = NonNullable<ReturnType<typeof createServiceClient>>;

const RECENT_LIMIT = 6;
/** Align with homepage feed cadence — refresh if older than this. */
export const CREATOR_VIDEO_STALE_MS = 20 * 60 * 1000;

export function isCreatorCacheStale(lastCheckedAt: string | null | undefined): boolean {
  if (!lastCheckedAt) return true;
  const t = new Date(lastCheckedAt).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t > CREATOR_VIDEO_STALE_MS;
}

export async function refreshYoutubeCreator(
  supabase: Service,
  creator: Record<string, unknown>,
  apiKey: string
): Promise<{ ok: boolean; units: number }> {
  if (!apiKey) return { ok: false, units: 0 };

  const now = new Date().toISOString();
  let playlistId = (creator.uploads_playlist_id as string | null) || null;
  const channelId = String(creator.channel_id || "");
  let units = 0;

  if (!playlistId && channelId.startsWith("UC") && channelId.length >= 24) {
    playlistId = `UU${channelId.slice(2)}`;
    await supabase
      .from("tracked_creators")
      .update({ uploads_playlist_id: playlistId, updated_at: now })
      .eq("id", creator.id);
  }

  if (!playlistId) return { ok: false, units: 0 };

  try {
    const items = await youtubeFetch(
      `/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=${RECENT_LIMIT}`,
      apiKey
    );
    units += 1;

    const videoIds: string[] = [];
    const metaById = new Map<string, { title: string; thumb: string; published: string }>();

    for (const it of items.items || []) {
      const vid =
        it.contentDetails?.videoId || it.snippet?.resourceId?.videoId || "";
      if (!vid) continue;
      videoIds.push(vid);
      metaById.set(vid, {
        title: it.snippet?.title || "Video",
        thumb:
          it.snippet?.thumbnails?.high?.url ||
          it.snippet?.thumbnails?.medium?.url ||
          it.snippet?.thumbnails?.default?.url ||
          "",
        published: it.snippet?.publishedAt || it.contentDetails?.videoPublishedAt || "",
      });
    }

    if (!videoIds.length) {
      await supabase
        .from("tracked_creators")
        .update({ last_checked_at: now, updated_at: now })
        .eq("id", creator.id);
      return { ok: true, units };
    }

    const videos = await youtubeFetch(
      `/videos?part=snippet,liveStreamingDetails,statistics&id=${videoIds.map(encodeURIComponent).join(",")}`,
      apiKey
    );
    units += 1;

    let liveId: string | null = null;
    let liveTitle = "";
    let liveViewers = 0;
    let liveThumb = "";
    const recent: CreatorRecentVideo[] = [];

    for (const v of videos.items || []) {
      const details = v.liveStreamingDetails;
      const isLive = Boolean(details?.actualStartTime) && !details?.actualEndTime;
      const fallback = metaById.get(v.id);
      const title = v.snippet?.title || fallback?.title || "Video";
      const thumb =
        v.snippet?.thumbnails?.high?.url ||
        v.snippet?.thumbnails?.medium?.url ||
        fallback?.thumb ||
        "";

      if (isLive && !liveId) {
        liveId = v.id;
        liveTitle = title;
        liveViewers = Number(details?.concurrentViewers || 0);
        liveThumb = thumb;
        continue; // don't put active live into "recent VODs"
      }

      recent.push({
        id: v.id,
        title,
        thumbnail: thumb,
        published_at: v.snippet?.publishedAt || fallback?.published || undefined,
      });
    }

    // If everything was live-only, still surface playlist items as recent
    if (!recent.length) {
      for (const vid of videoIds) {
        if (vid === liveId) continue;
        const m = metaById.get(vid);
        if (!m) continue;
        recent.push({
          id: vid,
          title: m.title,
          thumbnail: m.thumb,
          published_at: m.published || undefined,
        });
      }
    }

    const latest = recent[0];
    const previouslyLive = Boolean(creator.is_live);
    await supabase
      .from("tracked_creators")
      .update({
        is_live: Boolean(liveId),
        live_title: liveId ? liveTitle : null,
        live_video_id: liveId,
        live_viewer_count: liveId ? liveViewers : 0,
        live_thumbnail: liveId ? liveThumb : null,
        latest_video_id: latest?.id || null,
        latest_video_title: latest?.title || null,
        latest_video_thumbnail: latest?.thumbnail || null,
        recent_videos: recent.slice(0, RECENT_LIMIT),
        last_checked_at: now,
        updated_at: now,
      })
      .eq("id", creator.id);

    if (liveId) {
      await notifyFollowersCreatorWentLive(
        supabase,
        {
          id: String(creator.id),
          platform: "youtube",
          channel_name: creator.channel_name as string | null,
          channel_id: channelId,
          live_video_id: liveId,
          live_title: liveTitle,
          live_thumbnail: liveThumb,
        },
        previouslyLive
      );
    }

    await recordLightUnits(units);
    return { ok: true, units };
  } catch (e) {
    console.error("refreshYoutubeCreator", creator.channel_name, e);
    return { ok: false, units };
  }
}

export async function refreshTwitchCreator(
  supabase: Service,
  creator: Record<string, unknown>,
  clientId: string,
  clientSecret: string
): Promise<{ ok: boolean }> {
  if (!clientId || !clientSecret) return { ok: false };

  const now = new Date().toISOString();
  const login = String(creator.channel_login || creator.channel_id || "").toLowerCase();
  let userId = /^\d+$/.test(String(creator.channel_id)) ? String(creator.channel_id) : "";

  try {
    // Resolve numeric user id if needed
    if (!userId && login) {
      const users = await twitchFetch(
        `/users?login=${encodeURIComponent(login)}`,
        clientId,
        clientSecret
      );
      userId = users.data?.[0]?.id || "";
      if (userId) {
        await supabase
          .from("tracked_creators")
          .update({ channel_id: userId, channel_login: login, updated_at: now })
          .eq("id", creator.id);
      }
    }

    // Live check
    let liveStream: Record<string, unknown> | null = null;
    if (userId) {
      const live = await twitchFetch(
        `/streams?user_id=${encodeURIComponent(userId)}`,
        clientId,
        clientSecret
      );
      liveStream = live.data?.[0] || null;
    } else if (login) {
      const live = await twitchFetch(
        `/streams?user_login=${encodeURIComponent(login)}`,
        clientId,
        clientSecret
      );
      liveStream = live.data?.[0] || null;
    }

    // Recent VODs / highlights
    const recent: CreatorRecentVideo[] = [];
    if (userId) {
      const vids = await twitchFetch(
        `/videos?user_id=${encodeURIComponent(userId)}&first=${RECENT_LIMIT}&type=all`,
        clientId,
        clientSecret
      );
      for (const v of vids.data || []) {
        recent.push({
          id: String(v.id),
          title: v.title || "VOD",
          thumbnail: String(v.thumbnail_url || "")
            .replace("%{width}", "440")
            .replace("%{height}", "248")
            .replace("{width}", "440")
            .replace("{height}", "248"),
          published_at: v.published_at || v.created_at || undefined,
        });
      }
    }

    const latest = recent[0];
    const previouslyLive = Boolean(creator.is_live);
    const liveVideoId = liveStream ? String(liveStream.user_login || login) : null;
    const liveTitle = liveStream ? String(liveStream.title || "") : null;
    const liveThumb = liveStream
      ? String(liveStream.thumbnail_url || "")
          .replace("{width}", "1280")
          .replace("{height}", "720")
      : null;

    await supabase
      .from("tracked_creators")
      .update({
        is_live: Boolean(liveStream),
        live_title: liveTitle,
        live_video_id: liveVideoId,
        live_viewer_count: liveStream ? Number(liveStream.viewer_count || 0) : 0,
        live_thumbnail: liveThumb,
        latest_video_id: latest?.id || null,
        latest_video_title: latest?.title || null,
        latest_video_thumbnail: latest?.thumbnail || null,
        recent_videos: recent.slice(0, RECENT_LIMIT),
        last_checked_at: now,
        updated_at: now,
      })
      .eq("id", creator.id);

    if (liveStream && liveVideoId) {
      await notifyFollowersCreatorWentLive(
        supabase,
        {
          id: String(creator.id),
          platform: "twitch",
          channel_name: creator.channel_name as string | null,
          channel_id: userId || String(creator.channel_id || ""),
          channel_login: login,
          live_video_id: liveVideoId,
          live_title: liveTitle,
          live_thumbnail: liveThumb,
        },
        previouslyLive
      );
    }

    return { ok: true };
  } catch (e) {
    console.error("refreshTwitchCreator", creator.channel_name, e);
    return { ok: false };
  }
}

export async function refreshPinnedCreators(
  supabase: Service,
  platform: "youtube" | "twitch" | "all" = "all"
) {
  const settings = await getAppSettingsFull();
  const out: Record<string, unknown> = {};

  if (platform === "youtube" || platform === "all") {
    const { data: creators } = await supabase
      .from("tracked_creators")
      .select("*")
      .eq("platform", "youtube")
      .gt("pin_count", 0)
      .order("last_checked_at", { ascending: true, nullsFirst: true });

    let checked = 0;
    let skippedFresh = 0;
    let skippedBudget = 0;
    let units = 0;
    const list = creators || [];

    for (const c of list) {
      if (checked >= YOUTUBE_PIN_REFRESH_MAX_PER_RUN) break;
      if (!isCreatorCacheStale(c.last_checked_at as string | null)) {
        skippedFresh += 1;
        continue;
      }
      const spend = await canSpendUnits(YOUTUBE_PIN_REFRESH_COST);
      if (!spend.ok) {
        skippedBudget += 1;
        break;
      }
      const r = await refreshYoutubeCreator(supabase, c, settings.youtube_api_key);
      if (r.ok) checked += 1;
      units += r.units;
    }
    out.youtube = {
      checked,
      units,
      total: list.length,
      skipped_fresh: skippedFresh,
      skipped_budget: skippedBudget,
      max_per_run: YOUTUBE_PIN_REFRESH_MAX_PER_RUN,
    };
  }

  if (platform === "twitch" || platform === "all") {
    const { data: creators } = await supabase
      .from("tracked_creators")
      .select("*")
      .eq("platform", "twitch")
      .gt("pin_count", 0);

    let checked = 0;
    for (const c of creators || []) {
      const r = await refreshTwitchCreator(
        supabase,
        c,
        settings.twitch_client_id,
        settings.twitch_client_secret
      );
      if (r.ok) checked += 1;
    }
    out.twitch = { checked, total: creators?.length || 0 };
  }

  return out;
}
