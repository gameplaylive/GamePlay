import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { adminCookieName, isTournamentsAdmin } from "@/lib/admin-auth";
import { SAMPLE_CUSTOM_MATCHES } from "@/lib/tournaments";
import type { CustomTournament } from "@/lib/types";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const memoryStore: CustomTournament[] = SAMPLE_CUSTOM_MATCHES.map((m) => ({
  id: m.id,
  tournament_name: m.tournament_name,
  game: m.game,
  match_title: m.match_title,
  start_time: m.start_time,
  end_time: m.end_time || null,
  platform: (m.platform || "youtube") as "youtube" | "twitch",
  channel_id: m.channel_id || "",
  fallback_stream_url: m.stream_url || "",
  is_featured: Boolean(m.is_featured),
  created_at: new Date().toISOString(),
}));

async function requireAdmin() {
  return isTournamentsAdmin();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  // Password gate unlock for ADMIN_PASSWORD
  if (body?.action === "unlock") {
    const pwd = process.env.ADMIN_PASSWORD?.trim();
    if (!pwd || body.password !== pwd) {
      return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
    }
    const jar = await cookies();
    jar.set(adminCookieName(), "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return NextResponse.json({ ok: true });
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  const row: Omit<CustomTournament, "id" | "created_at"> = {
    tournament_name: String(body.tournament_name || "").trim(),
    game: String(body.game || "").trim(),
    match_title: String(body.match_title || "").trim(),
    start_time: String(body.start_time || ""),
    end_time: body.end_time ? String(body.end_time) : null,
    platform: body.platform === "twitch" ? "twitch" : "youtube",
    channel_id: String(body.channel_id || "").trim(),
    fallback_stream_url: String(body.fallback_stream_url || "").trim(),
    is_featured: body.is_featured !== false,
  };

  if (!row.tournament_name || !row.game || !row.start_time) {
    return NextResponse.json({ error: "Tournament name, game, and start time are required" }, { status: 400 });
  }

  if (!service) {
    const created: CustomTournament = {
      id: crypto.randomUUID(),
      ...row,
      created_at: new Date().toISOString(),
    };
    memoryStore.unshift(created);
    return NextResponse.json({ tournament: created, demo: true });
  }

  const { data, error } = await service.from("custom_tournaments").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tournament: data });
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ tournaments: memoryStore, demo: true });
  }

  const { data, error } = await service
    .from("custom_tournaments")
    .select("*")
    .order("start_time", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tournaments: data || [] });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of [
    "tournament_name",
    "game",
    "match_title",
    "start_time",
    "end_time",
    "platform",
    "channel_id",
    "fallback_stream_url",
    "is_featured",
  ]) {
    if (key in body) patch[key] = body[key];
  }

  const service = createServiceClient();
  if (!service) {
    const idx = memoryStore.findIndex((t) => t.id === id);
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    memoryStore[idx] = { ...memoryStore[idx], ...patch } as CustomTournament;
    return NextResponse.json({ tournament: memoryStore[idx], demo: true });
  }

  const { data, error } = await service
    .from("custom_tournaments")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tournament: data });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const service = createServiceClient();
  if (!service) {
    const idx = memoryStore.findIndex((t) => t.id === id);
    if (idx >= 0) memoryStore.splice(idx, 1);
    return NextResponse.json({ ok: true, demo: true });
  }

  const { error } = await service.from("custom_tournaments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
