import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import { badgeForType, tournamentToPulse } from "@/lib/events";
import { getUnifiedTournaments } from "@/lib/fetch-tournaments";
import type { PulseEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

async function fetchTournamentPulse(): Promise<PulseEvent[]> {
  try {
    const data = await getUnifiedTournaments();
    return data.matches
      .filter((m) => m.status === "LIVE" || m.status === "UPCOMING")
      .slice(0, 12)
      .map(tournamentToPulse);
  } catch (e) {
    console.error("pulse tournaments", e);
    return [];
  }
}

/**
 * Do NOT call YouTube search.list here.
 * Homepage loads this on every visit; each search.list costs 100 units and was
 * starving Live Now. Pulse is tournaments + special_events only.
 */
async function fetchYoutubeUpcoming(): Promise<PulseEvent[]> {
  return [];
}

async function fetchSpecialEvents(): Promise<PulseEvent[]> {
  const supabase = createServiceClient() || (await createClient());
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("special_events")
    .select("*")
    .eq("is_active", true)
    .gte("start_time", new Date(Date.now() - 2 * 3600000).toISOString())
    .order("start_time", { ascending: true })
    .limit(20);

  if (error || !data?.length) {
    if (error) console.error("special_events", error.message);
    return [];
  }

  return data.map((row) => {
    const type = (row.category === "tournament"
      ? "tournament"
      : row.category === "gameplay"
        ? "gameplay"
        : "game_show") as PulseEvent["event_type"];
    const start = new Date(row.start_time).getTime();
    return {
      id: `special:${row.id}`,
      title: row.title as string,
      game_name: (row.game_name as string) || "Multi",
      event_type: type,
      badge: badgeForType(type),
      start_time: row.start_time as string,
      stream_url: (row.stream_url as string) || "",
      status: start <= Date.now() ? ("LIVE" as const) : ("UPCOMING" as const),
    };
  });
}

export async function GET() {
  const [tournaments, youtube, specials] = await Promise.all([
    fetchTournamentPulse(),
    fetchYoutubeUpcoming(),
    fetchSpecialEvents(),
  ]);

  const seen = new Set<string>();
  const merged: PulseEvent[] = [];
  for (const e of [...tournaments, ...specials, ...youtube]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    merged.push(e);
  }

  merged.sort((a, b) => {
    if (a.status !== b.status) return a.status === "LIVE" ? -1 : 1;
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });

  return NextResponse.json({
    events: merged.slice(0, 24),
    youtube_configured: Boolean((await getAppSettingsFull()).youtube_api_key),
  });
}
