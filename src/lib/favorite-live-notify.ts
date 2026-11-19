import type { createServiceClient } from "@/lib/supabase/server";
import { sendFcmToMany } from "@/lib/fcm-server";
import { getAppUrl } from "@/lib/utils";

type Service = NonNullable<ReturnType<typeof createServiceClient>>;

/**
 * When a tracked creator flips offline → live, notify followers once per live session.
 */
export async function notifyFollowersCreatorWentLive(
  supabase: Service,
  creator: {
    id: string;
    platform: string;
    channel_name?: string | null;
    channel_id?: string | null;
    channel_login?: string | null;
    live_video_id?: string | null;
    live_title?: string | null;
    live_thumbnail?: string | null;
  },
  previouslyLive: boolean
): Promise<{ notified: number }> {
  if (previouslyLive) return { notified: 0 };
  if (!creator.live_video_id) return { notified: 0 };

  const sessionKey = `${creator.platform}:${creator.live_video_id}`;
  const channelKey = String(creator.channel_id || creator.channel_login || "").trim();
  if (!channelKey) return { notified: 0 };

  const { data: favorites } = await supabase
    .from("user_favorites")
    .select("user_id, channel_id_or_username, platform")
    .eq("platform", creator.platform)
    .eq("channel_id_or_username", channelKey);

  // Also match by login alias when channel_id is numeric Twitch id
  let extra: { user_id: string }[] = [];
  if (creator.channel_login) {
    const { data } = await supabase
      .from("user_favorites")
      .select("user_id")
      .eq("platform", creator.platform)
      .ilike("channel_id_or_username", creator.channel_login);
    extra = data || [];
  }

  const userIds = Array.from(
    new Set([...(favorites || []).map((f) => String(f.user_id)), ...extra.map((f) => String(f.user_id))])
  );
  if (!userIds.length) return { notified: 0 };

  const watchPath =
    creator.platform === "twitch"
      ? `/watch/fav-${creator.id}?platform=twitch&external=${encodeURIComponent(String(creator.channel_login || creator.live_video_id))}&type=live`
      : `/watch/fav-${creator.id}?platform=youtube&external=${encodeURIComponent(String(creator.live_video_id))}&type=live`;

  const title = `${creator.channel_name || "Your gamer"} is LIVE`;
  const body = creator.live_title || "Tap to watch now on GamePlay Live";
  const url = `${getAppUrl()}${watchPath}`;

  let notified = 0;
  for (const uid of userIds) {
    const { error: dedupeErr } = await supabase.from("favorite_live_alerts").insert({
      user_id: uid,
      creator_id: creator.id,
      live_session_key: sessionKey,
    });
    // Unique violation → already notified this session
    if (dedupeErr) continue;

    await supabase.from("in_app_notifications").insert({
      user_id: uid,
      title,
      body,
      link_url: watchPath,
      is_read: false,
    });

    const { data: devices } = await supabase
      .from("push_devices")
      .select("token")
      .eq("user_id", uid)
      .eq("enabled", true);

    const tokens = (devices || []).map((d) => String(d.token)).filter(Boolean);
    if (tokens.length) {
      await sendFcmToMany(tokens, {
        title,
        body,
        imageUrl: creator.live_thumbnail,
        url,
      });
    }
    notified += 1;
  }

  return { notified };
}
