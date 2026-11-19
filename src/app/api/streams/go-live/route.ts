import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseStreamLink, type LinkedPlatform } from "@/lib/stream-link";
import { COMMUNITY_GAMES, type CommunityGame } from "@/lib/types";

interface Body {
  platform?: LinkedPlatform;
  stream_link?: string;
  stream_title?: string;
  game?: string;
}

/** Current live row for the signed-in creator (if any). */
export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ stream: null, demo: true });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient() || supabase;
  const { data, error } = await service
    .from("community_live_streams")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_live", true)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stream: data || null });
}

/**
 * Link an already-live YouTube / Twitch stream onto GamePlay Live.
 * Authenticated signed-in users only (free launch — no Pro gate).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    const body = (await request.json().catch(() => ({}))) as Body;
    return NextResponse.json({
      stream: {
        id: crypto.randomUUID(),
        user_id: "demo",
        creator_name: "Demo Creator",
        game: body.game || "Other",
        stream_title: body.stream_title || "Live now",
        youtube_video_id: body.platform === "youtube" ? "dQw4w9WgXcQ" : null,
        playback_url: body.platform === "twitch" ? "demo_channel" : null,
        is_live: true,
        started_at: new Date().toISOString(),
        source: body.platform === "twitch" ? "twitch" : "youtube",
      },
      demo: true,
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to go live." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_banned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const platform = body.platform;
  if (platform !== "youtube" && platform !== "twitch") {
    return NextResponse.json({ error: "Choose YouTube Live or Twitch." }, { status: 400 });
  }

  const parsed = parseStreamLink(platform, String(body.stream_link || ""));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const streamTitle = String(body.stream_title || "").trim().slice(0, 100);
  if (!streamTitle) {
    return NextResponse.json({ error: "Add a short stream title." }, { status: 400 });
  }

  const game = String(body.game || "").trim() as CommunityGame;
  if (!COMMUNITY_GAMES.includes(game)) {
    return NextResponse.json({ error: "Pick a game." }, { status: 400 });
  }

  const creatorName =
    profile.full_name?.trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    profile.email?.split("@")[0] ||
    "Creator";

  const service = createServiceClient() || supabase;

  await service
    .from("community_live_streams")
    .update({ is_live: false, ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_live", true);

  const insertRow = {
    user_id: user.id,
    creator_name: creatorName.slice(0, 64),
    game,
    stream_title: streamTitle,
    youtube_video_id: parsed.platform === "youtube" ? parsed.videoId : null,
    playback_url: parsed.platform === "twitch" ? parsed.channel : null,
    is_live: true,
    source: parsed.platform === "twitch" ? "twitch" : "youtube",
    resolution: "720p60",
    mic_enabled: true,
  };

  const { data, error } = await service
    .from("community_live_streams")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) {
    const hint =
      /source/i.test(error.message) && /check/i.test(error.message)
        ? " Run supabase/migrations/20261119_community_stream_twitch_source.sql in the SQL editor."
        : "";
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }

  return NextResponse.json({
    stream: data,
    embed_url: parsed.embedUrl,
  });
}

/** End the creator's active linked stream. */
export async function DELETE() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient() || supabase;
  const { error } = await service
    .from("community_live_streams")
    .update({ is_live: false, ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_live", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
