import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { FavoriteGamerStatus, UserFavorite } from "@/lib/types";

/**
 * Returns live status from shared tracked_creators cache (filled by
 * /api/cron/check-favorite-live). Does not spend YouTube quota per user view.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const favorites = (body.favorites || []) as UserFavorite[];
  const service = createServiceClient();

  if (!service || !favorites.length) {
    return NextResponse.json({
      statuses: favorites.map((f) => ({ ...f, is_live: false })),
      source: service ? "empty" : "demo",
    });
  }

  const ytIds = favorites
    .filter((f) => f.platform === "youtube")
    .map((f) => f.channel_id_or_username);
  const twLogins = favorites
    .filter((f) => f.platform === "twitch")
    .map((f) => f.channel_id_or_username.toLowerCase());

  const tracked: Record<string, Record<string, unknown>> = {};

  if (ytIds.length) {
    const { data } = await service
      .from("tracked_creators")
      .select("*")
      .eq("platform", "youtube")
      .in("channel_id", ytIds);
    for (const row of data || []) {
      tracked[`youtube:${row.channel_id}`] = row;
    }
  }

  if (twLogins.length) {
    const { data } = await service
      .from("tracked_creators")
      .select("*")
      .eq("platform", "twitch");
    for (const row of data || []) {
      const login = String(row.channel_login || "").toLowerCase();
      const id = String(row.channel_id || "").toLowerCase();
      if (twLogins.includes(login) || twLogins.includes(id)) {
        tracked[`twitch:${login || id}`] = row;
        tracked[`twitch:${id}`] = row;
      }
    }
  }

  const statuses: FavoriteGamerStatus[] = favorites.map((fav) => {
    const key =
      fav.platform === "youtube"
        ? `youtube:${fav.channel_id_or_username}`
        : `twitch:${fav.channel_id_or_username.toLowerCase()}`;
    const row = tracked[key];
    const status: FavoriteGamerStatus = { ...fav, is_live: false };
    if (!row) return status;

    status.is_live = Boolean(row.is_live);
    if (status.is_live) {
      status.live_title = (row.live_title as string) || undefined;
      status.live_viewer_count = Number(row.live_viewer_count || 0);
      status.live_external_id =
        (row.live_video_id as string) ||
        (fav.platform === "twitch" ? fav.channel_id_or_username : undefined);
      status.live_thumbnail = (row.live_thumbnail as string) || undefined;
    }
    status.latest_video_id = (row.latest_video_id as string) || undefined;
    status.latest_video_title = (row.latest_video_title as string) || undefined;
    status.latest_video_thumbnail = (row.latest_video_thumbnail as string) || undefined;
    return status;
  });

  return NextResponse.json({ statuses, source: "tracked_creators" });
}
