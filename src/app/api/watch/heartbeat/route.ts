import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const HEARTBEAT_SECONDS = 30;
const MAX_DURATION_SECONDS = 60 * 60 * 12; // 12h cap per session

type Body = {
  session_id?: string | null;
  stream_id?: string;
  stream_title?: string;
  streamer_name?: string;
  game_slug?: string;
  game_title?: string;
  content_type?: string;
  platform?: string;
  ended?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, skipped: true, reason: "no_supabase" });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, skipped: true, reason: "unauthenticated" });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const streamId = String(body.stream_id || "").trim();
  if (!streamId) {
    return NextResponse.json({ error: "stream_id required" }, { status: 400 });
  }

  const contentType = ["live", "video", "trending", "tournament"].includes(
    String(body.content_type || "")
  )
    ? String(body.content_type)
    : "live";

  const now = new Date().toISOString();
  const sessionId = body.session_id ? String(body.session_id) : null;

  if (sessionId) {
    const { data: existing, error: readErr } = await supabase
      .from("watch_sessions")
      .select("id, duration_seconds, user_id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (readErr) {
      // Table may not exist yet — soft-skip so the player keeps working
      if (
        readErr.message?.toLowerCase().includes("does not exist") ||
        readErr.code === "42P01" ||
        readErr.code === "PGRST205"
      ) {
        return NextResponse.json({ ok: false, skipped: true, reason: "no_table" });
      }
      return NextResponse.json({ error: readErr.message }, { status: 500 });
    }

    if (existing) {
      const nextDuration = Math.min(
        MAX_DURATION_SECONDS,
        num(existing.duration_seconds) + HEARTBEAT_SECONDS
      );
      const patch: Record<string, unknown> = {
        last_heartbeat_at: now,
        duration_seconds: nextDuration,
        stream_title: String(body.stream_title || ""),
        streamer_name: String(body.streamer_name || ""),
        game_slug: String(body.game_slug || ""),
        game_title: String(body.game_title || ""),
      };
      if (body.ended) patch.ended_at = now;

      const { error: updErr } = await supabase
        .from("watch_sessions")
        .update(patch)
        .eq("id", sessionId)
        .eq("user_id", user.id);

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, session_id: sessionId, duration_seconds: nextDuration });
    }
  }

  const { data: created, error: insErr } = await supabase
    .from("watch_sessions")
    .insert({
      user_id: user.id,
      stream_id: streamId,
      stream_title: String(body.stream_title || ""),
      streamer_name: String(body.streamer_name || ""),
      game_slug: String(body.game_slug || ""),
      game_title: String(body.game_title || ""),
      content_type: contentType,
      platform: String(body.platform || "youtube"),
      started_at: now,
      last_heartbeat_at: now,
      duration_seconds: HEARTBEAT_SECONDS,
      ended_at: body.ended ? now : null,
    })
    .select("id, duration_seconds")
    .maybeSingle();

  if (insErr) {
    if (
      insErr.message?.toLowerCase().includes("does not exist") ||
      insErr.code === "42P01" ||
      insErr.code === "PGRST205"
    ) {
      return NextResponse.json({ ok: false, skipped: true, reason: "no_table" });
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    session_id: created?.id,
    duration_seconds: created?.duration_seconds ?? HEARTBEAT_SECONDS,
  });
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
