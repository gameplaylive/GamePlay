import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ reminders: [] });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ reminders: [], unauthorized: true });

  const { data } = await supabase
    .from("tournament_reminders")
    .select("tournament_id, notified, start_time, tournament_title")
    .eq("user_id", user.id)
    .eq("notified", false);

  return NextResponse.json({
    reminders: data || [],
    ids: (data || []).map((r) => String(r.tournament_id)),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const tournamentId = String(body.tournament_id || "").trim();
  const enabled = body.enabled !== false;

  if (!tournamentId) {
    return NextResponse.json({ error: "Missing tournament_id" }, { status: 400 });
  }

  if (!enabled) {
    await supabase
      .from("tournament_reminders")
      .delete()
      .eq("user_id", user.id)
      .eq("tournament_id", tournamentId);
    return NextResponse.json({ ok: true, enabled: false });
  }

  const row = {
    user_id: user.id,
    tournament_id: tournamentId,
    tournament_title: String(body.tournament_title || body.match_title || "Tournament"),
    game: String(body.game || ""),
    start_time: body.start_time ? String(body.start_time) : null,
    watch_path: body.watch_path ? String(body.watch_path) : null,
    notified: false,
  };

  const { error } = await supabase.from("tournament_reminders").upsert(row, {
    onConflict: "user_id,tournament_id",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, enabled: true });
}
