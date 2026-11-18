import { NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";
import { MOCK_STREAMS } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

/** Public feed of cached live/video/trending streams (YouTube sync writes here). */
export async function GET() {
  const service = createServiceClient();
  const supabase = service || (await createClient());
  if (!supabase) {
    return NextResponse.json({ streams: MOCK_STREAMS, source: "mock" });
  }

  // Cap high enough for YouTube + Twitch lives without one platform wiping the other from the feed
  const { data, error } = await supabase
    .from("cached_streams")
    .select("*")
    .order("viewer_count", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ streams: MOCK_STREAMS, source: "mock", error: error.message });
  }

  return NextResponse.json({
    streams: data?.length ? data : MOCK_STREAMS,
    source: data?.length ? "supabase" : "mock",
  });
}
