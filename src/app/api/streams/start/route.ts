import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { CommunityGame } from "@/lib/types";
import { COMMUNITY_GAMES } from "@/lib/types";

interface Body {
  stream_title?: string;
  game?: string;
  youtube_video_id?: string | null;
  resolution?: string;
  mic_enabled?: boolean;
  creator_name?: string;
  source?: "mobile" | "pc" | "youtube";
  playback_url?: string | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    // Demo / offline: return a synthetic live row
    const body = (await request.json().catch(() => ({}))) as Body;
    const id = crypto.randomUUID();
    return NextResponse.json({
      stream: {
        id,
        user_id: "demo",
        creator_name: body.creator_name || "Demo Creator",
        game: body.game || "Other",
        stream_title: body.stream_title || "Live now",
        youtube_video_id: body.youtube_video_id || null,
        is_live: true,
        started_at: new Date().toISOString(),
        resolution: body.resolution || "720p60",
        mic_enabled: body.mic_enabled !== false,
      },
      demo: true,
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, is_banned, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_banned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (profile.subscription_tier !== "pro") {
    return NextResponse.json({ error: "Pro subscription required", code: "PRO_REQUIRED" }, { status: 402 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const streamTitle = (body.stream_title || "").trim();
  const game = (body.game || "").trim() as CommunityGame;
  if (!streamTitle) {
    return NextResponse.json({ error: "stream_title is required" }, { status: 400 });
  }
  if (!COMMUNITY_GAMES.includes(game)) {
    return NextResponse.json({ error: "Invalid game" }, { status: 400 });
  }

  const creatorName =
    (body.creator_name || "").trim() ||
    profile.full_name ||
    profile.email?.split("@")[0] ||
    "Creator";

  // End any previous live rows for this user
  const service = createServiceClient() || supabase;
  await service
    .from("community_live_streams")
    .update({ is_live: false, ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_live", true);

  const { data, error } = await service
    .from("community_live_streams")
    .insert({
      user_id: user.id,
      creator_name: creatorName,
      game,
      stream_title: streamTitle,
      youtube_video_id: body.youtube_video_id || null,
      is_live: true,
      resolution: body.resolution || "720p60",
      mic_enabled: body.mic_enabled !== false,
      source: body.source || "mobile",
      playback_url: body.playback_url || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stream: data });
}
