import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import { youtubeFetch } from "@/lib/youtube";
import { FAVORITE_LIMITS } from "@/lib/default-games";
import { recordLightUnits } from "@/lib/youtube-quota";
import type { Platform } from "@/lib/types";

interface Body {
  platform?: Platform;
  channel_name?: string;
  channel_id_or_username?: string;
  avatar_url?: string;
  id?: string;
}

const FAV_LIMIT = FAVORITE_LIMITS.free;

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ favorites: [], limit: FAV_LIMIT, used: 0 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: favorites } = await supabase
    .from("user_favorites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    favorites: favorites || [],
    used: favorites?.length || 0,
    limit: FAV_LIMIT,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const platform = body.platform;
  const channelId = (body.channel_id_or_username || "").trim();
  const channelName = (body.channel_name || "").trim();
  if (!platform || !channelId || !channelName) {
    return NextResponse.json({ error: "platform, channel_name, channel_id_or_username required" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    // Demo path — client enforces locally; acknowledge
    return NextResponse.json({
      ok: true,
      demo: true,
      limit: FAVORITE_LIMITS.free,
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_banned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = FAV_LIMIT;

  const { data: existing, count } = await supabase
    .from("user_favorites")
    .select("*", { count: "exact" })
    .eq("user_id", user.id);

  const already = (existing || []).find(
    (f) => f.platform === platform && f.channel_id_or_username === channelId
  );
  if (already) {
    return NextResponse.json({ favorite: already, used: count || existing?.length || 0, limit });
  }

  const used = count ?? existing?.length ?? 0;
  if (used >= limit) {
    return NextResponse.json(
      {
        error: "SLOT_LIMIT",
        message: `Maximum Limit Reached (${limit}/${limit}): Remove an existing gamer to add a new one.`,
        used,
        limit,
      },
      { status: 403 }
    );
  }

  const { data: fav, error } = await supabase
    .from("user_favorites")
    .upsert(
      {
        user_id: user.id,
        channel_name: channelName,
        platform,
        channel_id_or_username: channelId,
        avatar_url: body.avatar_url || "",
      },
      { onConflict: "user_id,platform,channel_id_or_username" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ensure tracked_creators row + bump pin_count; resolve uploads playlist for YT
  const service = createServiceClient() || supabase;
  await ensureTrackedCreator(service, {
    platform,
    channelId,
    channelName,
    avatarUrl: body.avatar_url || "",
  });

  return NextResponse.json({
    favorite: fav,
    used: used + 1,
    limit,
  });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const id = body.id;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok: true, demo: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: fav } = await supabase
    .from("user_favorites")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase.from("user_favorites").delete().eq("id", id).eq("user_id", user.id);

  if (fav) {
    const service = createServiceClient();
    if (service) {
      const channelKey =
        fav.platform === "youtube" ? fav.channel_id_or_username : fav.channel_id_or_username;
      const { data: tracked } = await service
        .from("tracked_creators")
        .select("id, pin_count, channel_id, channel_login")
        .eq("platform", fav.platform)
        .or(
          fav.platform === "youtube"
            ? `channel_id.eq.${channelKey}`
            : `channel_login.eq.${channelKey},channel_id.eq.${channelKey}`
        )
        .maybeSingle();
      if (tracked) {
        await service
          .from("tracked_creators")
          .update({
            pin_count: Math.max(0, Number(tracked.pin_count || 1) - 1),
            updated_at: new Date().toISOString(),
          })
          .eq("id", tracked.id);
      }
    }
  }

  const { count } = await supabase
    .from("user_favorites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({
    ok: true,
    used: count || 0,
    limit: FAV_LIMIT,
  });
}

async function ensureTrackedCreator(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  opts: {
    platform: Platform;
    channelId: string;
    channelName: string;
    avatarUrl: string;
  }
) {
  const { platform, channelId, channelName, avatarUrl } = opts;
  const now = new Date().toISOString();

  if (platform === "youtube") {
    const { data: existing } = await service
      .from("tracked_creators")
      .select("*")
      .eq("platform", "youtube")
      .eq("channel_id", channelId)
      .maybeSingle();

    let uploads = existing?.uploads_playlist_id as string | null | undefined;
    if (!uploads) {
      const settings = await getAppSettingsFull();
      if (settings.youtube_api_key) {
        try {
          const data = await youtubeFetch(
            `/channels?part=snippet,contentDetails&id=${encodeURIComponent(channelId)}`,
            settings.youtube_api_key
          );
          await recordLightUnits(1);
          uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
          if (!uploads && channelId.startsWith("UC")) uploads = `UU${channelId.slice(2)}`;
        } catch (e) {
          console.error("resolve uploads playlist", e);
          if (channelId.startsWith("UC")) uploads = `UU${channelId.slice(2)}`;
        }
      } else if (channelId.startsWith("UC")) {
        uploads = `UU${channelId.slice(2)}`;
      }
    }

    if (existing) {
      await service
        .from("tracked_creators")
        .update({
          pin_count: Number(existing.pin_count || 0) + 1,
          channel_name: channelName,
          avatar_url: avatarUrl || existing.avatar_url,
          uploads_playlist_id: uploads || existing.uploads_playlist_id,
          updated_at: now,
        })
        .eq("id", existing.id);
    } else {
      await service.from("tracked_creators").insert({
        platform: "youtube",
        channel_id: channelId,
        channel_name: channelName,
        avatar_url: avatarUrl,
        uploads_playlist_id: uploads || null,
        search_aliases: [channelName.toLowerCase(), channelId.toLowerCase()],
        pin_count: 1,
      });
    }
    return;
  }

  // Twitch
  const { data: existing } = await service
    .from("tracked_creators")
    .select("*")
    .eq("platform", "twitch")
    .or(`channel_login.eq.${channelId},channel_id.eq.${channelId}`)
    .maybeSingle();

  if (existing) {
    await service
      .from("tracked_creators")
      .update({
        pin_count: Number(existing.pin_count || 0) + 1,
        channel_name: channelName,
        channel_login: existing.channel_login || channelId,
        avatar_url: avatarUrl || existing.avatar_url,
        updated_at: now,
      })
      .eq("id", existing.id);
  } else {
    await service.from("tracked_creators").insert({
      platform: "twitch",
      channel_id: channelId,
      channel_login: channelId,
      channel_name: channelName,
      avatar_url: avatarUrl,
      search_aliases: [channelName.toLowerCase(), channelId.toLowerCase()],
      pin_count: 1,
    });
  }
}
