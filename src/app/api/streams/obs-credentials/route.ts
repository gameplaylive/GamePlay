import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  buildHlsPlaybackUrl,
  generateStreamKey,
  getObsIngestServerUrl,
  obsSettingsClipboard,
} from "@/lib/obs-ingest";
import { COMMUNITY_GAMES, type CommunityGame } from "@/lib/types";

interface PatchBody {
  pending_title?: string;
  pending_game?: string;
  rotate?: boolean;
}

function demoPayload(title: string, game: string) {
  const streamKey = `gpl_demo_${Date.now().toString(36)}`;
  const server = getObsIngestServerUrl();
  return {
    server,
    stream_key: streamKey,
    playback_url: buildHlsPlaybackUrl(streamKey),
    pending_title: title,
    pending_game: game,
    obs_clipboard: obsSettingsClipboard(server, streamKey),
    demo: true,
  };
}

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(demoPayload("Live on GamePlay Live", "Other"));
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
  const service = createServiceClient() || supabase;
  let { data: cred } = await service
    .from("creator_ingest_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cred) {
    const streamKey = generateStreamKey(user.id);
    const { data: created, error } = await service
      .from("creator_ingest_credentials")
      .insert({
        user_id: user.id,
        stream_key: streamKey,
        pending_title: "Live on GamePlay Live",
        pending_game: "Other",
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    cred = created;
  }

  const server = getObsIngestServerUrl();
  return NextResponse.json({
    server,
    stream_key: cred.stream_key,
    playback_url: buildHlsPlaybackUrl(cred.stream_key),
    pending_title: cred.pending_title,
    pending_game: cred.pending_game,
    obs_clipboard: obsSettingsClipboard(server, cred.stream_key),
    is_live: false,
  });
}

/** Update pending title/game (used when OBS connects) or rotate key. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json().catch(() => ({}))) as PatchBody;

  if (!supabase) {
    const title = (body.pending_title || "Live on GamePlay Live").trim();
    const game = (body.pending_game || "Other").trim();
    return NextResponse.json(demoPayload(title, game));
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
  const service = createServiceClient() || supabase;
  let { data: cred } = await service
    .from("creator_ingest_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const title = (body.pending_title || cred?.pending_title || "Live on GamePlay Live").trim().slice(0, 120);
  let game = (body.pending_game || cred?.pending_game || "Other").trim() as CommunityGame;
  if (!COMMUNITY_GAMES.includes(game)) game = "Other";

  if (!cred) {
    const streamKey = generateStreamKey(user.id);
    const { data: created, error } = await service
      .from("creator_ingest_credentials")
      .insert({
        user_id: user.id,
        stream_key: streamKey,
        pending_title: title,
        pending_game: game,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    cred = created;
  } else {
    const patch: Record<string, unknown> = {
      pending_title: title,
      pending_game: game,
      updated_at: new Date().toISOString(),
    };
    if (body.rotate) {
      patch.stream_key = generateStreamKey(user.id);
    }
    const { data: updated, error } = await service
      .from("creator_ingest_credentials")
      .update(patch)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    cred = updated;
  }

  const server = getObsIngestServerUrl();
  return NextResponse.json({
    server,
    stream_key: cred.stream_key,
    playback_url: buildHlsPlaybackUrl(cred.stream_key),
    pending_title: cred.pending_title,
    pending_game: cred.pending_game,
    obs_clipboard: obsSettingsClipboard(server, cred.stream_key),
  });
}
