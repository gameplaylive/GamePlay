import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildHlsPlaybackUrl } from "@/lib/obs-ingest";
import { COMMUNITY_GAMES, type CommunityGame } from "@/lib/types";

/**
 * Webhook for nginx-rtmp / MediaMTX when OBS starts or stops pushing.
 *
 * nginx-rtmp (form): call=publish|publish_done, name=<stream_key>
 * JSON: { event: "publish"|"publish_done", stream_key: "..." }
 *
 * Auth: Authorization: Bearer $INGEST_WEBHOOK_SECRET (or ?secret=)
 */

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function checkSecret(request: Request, form: URLSearchParams): boolean {
  const expected = process.env.INGEST_WEBHOOK_SECRET || process.env.CRON_SECRET || "";
  if (!expected) return true;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const got =
    bearer ||
    request.headers.get("x-ingest-secret") ||
    form.get("secret") ||
    new URL(request.url).searchParams.get("secret") ||
    "";
  return got === expected;
}

export async function POST(request: Request) {
  const ctype = request.headers.get("content-type") || "";
  let event: "publish" | "publish_done" | "unknown" = "unknown";
  let streamKey = "";
  let form = new URLSearchParams();

  if (ctype.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as {
      event?: string;
      call?: string;
      stream_key?: string;
      name?: string;
      secret?: string;
    };
    if (json.secret) form.set("secret", json.secret);
    const call = (json.event || json.call || "").toLowerCase();
    event =
      call.includes("done") || call === "unpublish"
        ? "publish_done"
        : call.includes("publish")
          ? "publish"
          : "unknown";
    streamKey = (json.stream_key || json.name || "").trim();
  } else {
    const text = await request.text();
    form = new URLSearchParams(text);
    new URL(request.url).searchParams.forEach((v, k) => {
      if (!form.has(k)) form.set(k, v);
    });
    const call = (form.get("call") || form.get("event") || "").toLowerCase();
    event =
      call === "publish_done" || call === "done" || call === "unpublish"
        ? "publish_done"
        : call === "publish" || call === "on_publish"
          ? "publish"
          : "unknown";
    streamKey = (form.get("name") || form.get("stream_key") || form.get("stream") || "").trim();
  }

  if (!checkSecret(request, form)) return unauthorized();
  if (!streamKey) {
    return NextResponse.json({ error: "stream key (name) required" }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ ok: true, demo: true, event, stream_key: streamKey });
  }

  const { data: cred } = await service
    .from("creator_ingest_credentials")
    .select("*")
    .eq("stream_key", streamKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!cred) {
    return NextResponse.json({ error: "Invalid stream key" }, { status: 403 });
  }

  const { data: profile } = await service
    .from("profiles")
    .select("full_name, email, subscription_tier, is_banned")
    .eq("id", cred.user_id)
    .maybeSingle();

  if (!profile || profile.is_banned || profile.subscription_tier !== "pro") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const userId = cred.user_id as string;
  const creatorName = profile.full_name || profile.email?.split("@")[0] || "Creator";
  const title = (cred.pending_title as string) || "Live on GamePlay Live";
  const g = (cred.pending_game as CommunityGame) || "Other";
  const game = COMMUNITY_GAMES.includes(g) ? g : "Other";

  if (event === "publish_done") {
    await service
      .from("community_live_streams")
      .update({ is_live: false, ended_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_live", true)
      .eq("source", "pc");

    return NextResponse.json({ ok: true, event: "publish_done", user_id: userId });
  }

  if (event !== "publish") {
    return NextResponse.json({ ok: true, event: "ignored" });
  }

  await service
    .from("creator_ingest_credentials")
    .update({ last_published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  await service
    .from("community_live_streams")
    .update({ is_live: false, ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_live", true);

  const playbackUrl = buildHlsPlaybackUrl(streamKey);
  const { data: stream, error } = await service
    .from("community_live_streams")
    .insert({
      user_id: userId,
      creator_name: creatorName,
      game,
      stream_title: title,
      youtube_video_id: null,
      is_live: true,
      source: "pc",
      playback_url: playbackUrl,
      ingest_stream_key: streamKey,
      resolution: "1080p30",
      mic_enabled: true,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event: "publish", stream, featured: true });
}

export async function GET(request: Request) {
  const form = new URLSearchParams();
  new URL(request.url).searchParams.forEach((v, k) => form.set(k, v));
  if (!checkSecret(request, form)) return unauthorized();
  return NextResponse.json({ ok: true, service: "gameplay-live-ingest-hook" });
}
