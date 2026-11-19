import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    platform?: string;
    timezone?: string;
    country?: string;
  } | null;

  const token = body?.token?.trim();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const platform = ["web", "android", "ios"].includes(body?.platform || "")
    ? (body!.platform as string)
    : "web";
  const timezone = (body?.timezone || "UTC").slice(0, 64);
  const country = body?.country?.slice(0, 8) || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { error } = await service.from("push_devices").upsert(
    {
      token,
      platform,
      timezone,
      country,
      user_id: user?.id ?? null,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "token" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
