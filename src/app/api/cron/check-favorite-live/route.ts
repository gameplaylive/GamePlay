import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import { twitchFetch } from "@/lib/twitch";
import { youtubeFetch } from "@/lib/youtube";
import { recordLightUnits } from "@/lib/youtube-quota";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Shared live status for pinned creators.
 * ?platform=youtube — every ~10 min: playlistItems (1u) + videos.list batch (1u) per chunk of 50
 * ?platform=twitch  — every ~3 min: single /helix/streams?user_id=... batch
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = new URL(request.url).searchParams.get("platform") || "all";
  const settings = await getAppSettingsFull();
  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, message: "Supabase not configured" });
  }

  const out: Record<string, unknown> = {};

  if (platform === "youtube" || platform === "all") {
    out.youtube = await checkYoutubePinned(supabase, settings.youtube_api_key);
  }
  if (platform === "twitch" || platform === "all") {
    out.twitch = await checkTwitchPinned(
      supabase,
      settings.twitch_client_id,
      settings.twitch_client_secret
    );
  }

  return NextResponse.json({ ok: true, ...out });
}

async function checkYoutubePinned(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  apiKey: string
) {
  if (!apiKey) return { skipped: true };

  const { data: creators } = await supabase
    .from("tracked_creators")
    .select("*")
    .eq("platform", "youtube")
    .gt("pin_count", 0);

  if (!creators?.length) return { checked: 0 };

  const now = new Date().toISOString();
  const videoIds: string[] = [];
  const creatorByVideo = new Map<string, (typeof creators)[0]>();
  let playlistCalls = 0;

  for (const c of creators) {
    let playlistId = c.uploads_playlist_id as string | null;
    if (!playlistId && c.channel_id) {
      // Derive uploads playlist: UC… → UU…
      const cid = String(c.channel_id);
      if (cid.startsWith("UC") && cid.length >= 24) {
        playlistId = `UU${cid.slice(2)}`;
        await supabase
          .from("tracked_creators")
          .update({ uploads_playlist_id: playlistId, updated_at: now })
          .eq("id", c.id);
      }
    }
    if (!playlistId) continue;

    try {
      const items = await youtubeFetch(
        `/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=1`,
        apiKey
      );
      playlistCalls += 1;
      const vid = items.items?.[0]?.contentDetails?.videoId || items.items?.[0]?.snippet?.resourceId?.videoId;
      if (vid) {
        videoIds.push(vid);
        creatorByVideo.set(vid, c);
        // stash as latest candidate
        await supabase
          .from("tracked_creators")
          .update({
            latest_video_id: vid,
            latest_video_title: items.items?.[0]?.snippet?.title || c.latest_video_title,
            latest_video_thumbnail:
              items.items?.[0]?.snippet?.thumbnails?.high?.url ||
              items.items?.[0]?.snippet?.thumbnails?.medium?.url ||
              c.latest_video_thumbnail,
            updated_at: now,
          })
          .eq("id", c.id);
      }
    } catch (e) {
      console.error("playlistItems", c.channel_name, e);
    }
  }

  // Batch videos.list for liveStreamingDetails (1 unit / up to 50 ids)
  let liveFound = 0;
  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) chunks.push(videoIds.slice(i, i + 50));

  for (const chunk of chunks) {
    try {
      const videos = await youtubeFetch(
        `/videos?part=snippet,liveStreamingDetails,statistics&id=${chunk.map(encodeURIComponent).join(",")}`,
        apiKey
      );
      const liveIds = new Set<string>();
      for (const v of videos.items || []) {
        const details = v.liveStreamingDetails;
        const isLive = Boolean(details?.actualStartTime) && !details?.actualEndTime;
        const creator = creatorByVideo.get(v.id);
        if (!creator) continue;
        if (isLive) {
          liveIds.add(v.id);
          liveFound += 1;
          await supabase
            .from("tracked_creators")
            .update({
              is_live: true,
              live_title: v.snippet?.title || "",
              live_video_id: v.id,
              live_viewer_count: Number(details?.concurrentViewers || 0),
              live_thumbnail:
                v.snippet?.thumbnails?.high?.url ||
                v.snippet?.thumbnails?.medium?.url ||
                "",
              last_checked_at: now,
              updated_at: now,
            })
            .eq("id", creator.id);
        }
      }
      // Mark non-live among this chunk
      for (const vid of chunk) {
        if (liveIds.has(vid)) continue;
        const creator = creatorByVideo.get(vid);
        if (!creator) continue;
        await supabase
          .from("tracked_creators")
          .update({
            is_live: false,
            live_title: null,
            live_video_id: null,
            live_viewer_count: 0,
            last_checked_at: now,
            updated_at: now,
          })
          .eq("id", creator.id);
      }
    } catch (e) {
      console.error("videos.list batch", e);
    }
  }

  await recordLightUnits(playlistCalls + chunks.length);

  return {
    checked: creators.length,
    playlist_calls: playlistCalls,
    video_batches: chunks.length,
    live: liveFound,
    units: playlistCalls + chunks.length,
  };
}

async function checkTwitchPinned(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  clientId: string,
  clientSecret: string
) {
  if (!clientId || !clientSecret) return { skipped: true };

  const { data: creators } = await supabase
    .from("tracked_creators")
    .select("*")
    .eq("platform", "twitch")
    .gt("pin_count", 0);

  if (!creators?.length) return { checked: 0 };

  // Prefer numeric user ids; fall back to login batch
  const withId = creators.filter((c) => /^\d+$/.test(String(c.channel_id)));
  const withLogin = creators.filter((c) => !/^\d+$/.test(String(c.channel_id)));

  const liveByKey = new Map<string, Record<string, unknown>>();
  const now = new Date().toISOString();

  // Batch by user_id (100 max)
  for (let i = 0; i < withId.length; i += 100) {
    const slice = withId.slice(i, i + 100);
    const qs = slice.map((c) => `user_id=${encodeURIComponent(c.channel_id)}`).join("&");
    try {
      const live = await twitchFetch(`/streams?${qs}`, clientId, clientSecret);
      for (const s of live.data || []) {
        liveByKey.set(`id:${s.user_id}`, s);
        liveByKey.set(`login:${String(s.user_login).toLowerCase()}`, s);
      }
    } catch (e) {
      console.error("twitch streams user_id", e);
    }
  }

  for (let i = 0; i < withLogin.length; i += 100) {
    const slice = withLogin.slice(i, i + 100);
    const qs = slice
      .map((c) => `user_login=${encodeURIComponent(c.channel_login || c.channel_id)}`)
      .join("&");
    try {
      const live = await twitchFetch(`/streams?${qs}`, clientId, clientSecret);
      for (const s of live.data || []) {
        liveByKey.set(`login:${String(s.user_login).toLowerCase()}`, s);
      }
    } catch (e) {
      console.error("twitch streams login", e);
    }
  }

  let liveCount = 0;
  for (const c of creators) {
    const s =
      liveByKey.get(`id:${c.channel_id}`) ||
      liveByKey.get(`login:${String(c.channel_login || c.channel_id).toLowerCase()}`);
    if (s) {
      liveCount += 1;
      await supabase
        .from("tracked_creators")
        .update({
          is_live: true,
          live_title: s.title,
          live_video_id: s.user_login,
          live_viewer_count: s.viewer_count || 0,
          live_thumbnail: String(s.thumbnail_url || "")
            .replace("{width}", "1280")
            .replace("{height}", "720"),
          last_checked_at: now,
          updated_at: now,
        })
        .eq("id", c.id);
    } else {
      await supabase
        .from("tracked_creators")
        .update({
          is_live: false,
          live_title: null,
          live_video_id: null,
          live_viewer_count: 0,
          last_checked_at: now,
          updated_at: now,
        })
        .eq("id", c.id);
    }
  }

  return { checked: creators.length, live: liveCount };
}

export async function POST(request: Request) {
  return GET(request);
}
