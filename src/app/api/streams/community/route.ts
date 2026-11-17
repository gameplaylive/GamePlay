import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CommunityLiveStream } from "@/lib/types";

const DEMO_CREATORS: CommunityLiveStream[] = [
  {
    id: "demo-community-1",
    user_id: "demo",
    creator_name: "ShadowAce",
    game: "BGMI",
    stream_title: "BGMI Rank Push Live | Gameplay Live",
    youtube_video_id: "dQw4w9WgXcQ",
    is_live: true,
    started_at: new Date(Date.now() - 8 * 60000).toISOString(),
    source: "mobile",
  },
  {
    id: "demo-community-2",
    user_id: "demo",
    creator_name: "PixelNova",
    game: "Minecraft",
    stream_title: "Survival SMP night build",
    youtube_video_id: "jNQXAC9IVRw",
    is_live: true,
    started_at: new Date(Date.now() - 22 * 60000).toISOString(),
    source: "mobile",
  },
  {
    id: "demo-community-3",
    user_id: "demo",
    creator_name: "OBS_Rogue",
    game: "Valorant",
    stream_title: "Ranked from PC · OBS",
    youtube_video_id: null,
    is_live: true,
    started_at: new Date(Date.now() - 5 * 60000).toISOString(),
    source: "pc",
    playback_url: "https://live.gameplaylive.com/hls/demo/index.m3u8",
  },
];

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ streams: DEMO_CREATORS, demo: true });
  }

  const { data, error } = await supabase
    .from("community_live_streams")
    .select("*")
    .eq("is_live", true)
    .order("started_at", { ascending: false })
    .limit(24);

  if (error) {
    return NextResponse.json({ streams: DEMO_CREATORS, demo: true, warning: error.message });
  }

  if (!data?.length) {
    return NextResponse.json({ streams: [], demo: false });
  }

  return NextResponse.json({ streams: data as CommunityLiveStream[] });
}
