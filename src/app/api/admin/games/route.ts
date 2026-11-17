import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Service role missing" }, { status: 503 });
  const { data } = await service.from("games").select("*").order("title");
  return NextResponse.json({ games: data });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Service role missing" }, { status: 503 });

  const body = await request.json();
  const row = {
    title: String(body.title || ""),
    slug: String(body.slug || slugify(body.title || "")),
    cover_image: String(body.cover_image || ""),
    twitch_game_id: String(body.twitch_game_id || ""),
    youtube_query: String(body.youtube_query || ""),
    is_active: body.is_active !== false,
  };
  if (!row.title || !row.slug) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const { data, error } = await service.from("games").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ game: data });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Service role missing" }, { status: 503 });

  const body = await request.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of ["title", "slug", "cover_image", "twitch_game_id", "youtube_query", "is_active"]) {
    if (key in body) patch[key] = body[key];
  }

  const { error } = await service.from("games").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
