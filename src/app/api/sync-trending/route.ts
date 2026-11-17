import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import { twitchFetch } from "@/lib/twitch";
import { youtubeFetch } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getAppSettingsFull();
  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, message: "Supabase not configured" });
  }

  const rows: Record<string, unknown>[] = [];

  if (settings.youtube_api_key) {
    try {
      const data = await youtubeFetch(
        `/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=20&maxResults=20&regionCode=US`,
        settings.youtube_api_key
      );
      for (const item of data.items || []) {
        rows.push({
          game_id: null,
          game_slug: "trending",
          game_title: "Trending",
          content_type: "trending",
          platform: "youtube",
          external_id: item.id,
          title: item.snippet?.title,
          streamer_name: item.snippet?.channelTitle,
          thumbnail_url:
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.medium?.url ||
            "",
          viewer_count: Number(item.statistics?.viewCount || 0),
          published_at: item.snippet?.publishedAt,
          language: "English",
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("YouTube trending error", e);
    }
  }

  if (settings.twitch_client_id && settings.twitch_client_secret) {
    try {
      const data = await twitchFetch(
        `/streams?first=20`,
        settings.twitch_client_id,
        settings.twitch_client_secret
      );
      for (const s of data.data || []) {
        rows.push({
          game_id: null,
          game_slug: "trending",
          game_title: s.game_name || "Trending",
          content_type: "trending",
          platform: "twitch",
          external_id: s.user_login,
          title: s.title,
          streamer_name: s.user_name,
          thumbnail_url: String(s.thumbnail_url || "")
            .replace("{width}", "1280")
            .replace("{height}", "720"),
          viewer_count: s.viewer_count || 0,
          published_at: s.started_at,
          language: s.language === "en" ? "English" : s.language || "English",
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("Twitch trending error", e);
    }
  }

  await supabase.from("cached_streams").delete().eq("content_type", "trending");
  if (rows.length) await supabase.from("cached_streams").insert(rows);

  return NextResponse.json({ ok: true, count: rows.length });
}

export async function POST(request: Request) {
  return GET(request);
}
