import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

interface Body {
  stream_id?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const service = createServiceClient() || supabase;

  let query = service
    .from("community_live_streams")
    .update({ is_live: false, ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_live", true);

  if (body.stream_id) {
    query = service
      .from("community_live_streams")
      .update({ is_live: false, ended_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("id", body.stream_id);
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
