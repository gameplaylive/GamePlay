import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Service role missing" }, { status: 503 });
  const { data } = await service.from("app_settings").select("*").eq("id", 1).single();
  return NextResponse.json({ settings: data });
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Service role missing" }, { status: 503 });

  const body = await request.json();
  const allowed = [
    "youtube_api_key",
    "twitch_client_id",
    "twitch_client_secret",
    "stripe_secret_key",
    "stripe_webhook_secret",
    "stripe_price_id",
    "adsense_publisher_id",
    "adsense_slot_id",
    "adsense_enabled",
    "pro_price_usd",
    "pro_plan_name",
    "pro_plan_description",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const { error } = await service.from("app_settings").update(patch).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
