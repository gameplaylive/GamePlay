import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CommunityLiveStream } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ streams: [], demo: false });
  }

  const { data, error } = await supabase
    .from("community_live_streams")
    .select("*")
    .eq("is_live", true)
    .order("started_at", { ascending: false })
    .limit(24);

  if (error) {
    return NextResponse.json({ streams: [], demo: false, warning: error.message });
  }

  return NextResponse.json({ streams: (data || []) as CommunityLiveStream[], demo: false });
}
