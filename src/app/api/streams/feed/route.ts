import { NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Public feed of cached live/video/trending streams — real DB rows only (no mock filler). */
export async function GET() {
  const service = createServiceClient();
  const supabase = service || (await createClient());
  if (!supabase) {
    return NextResponse.json({ streams: [], source: "unavailable" });
  }

  const { data, error } = await supabase
    .from("cached_streams")
    .select("*")
    .order("viewer_count", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ streams: [], source: "error", error: error.message });
  }

  return NextResponse.json({
    streams: data || [],
    source: "supabase",
  });
}
