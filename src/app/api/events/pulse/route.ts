import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import { youtubeFetch } from "@/lib/youtube";
import {
  getSamplePulseEvents,
  badgeForType,
  tournamentToPulse,
  YOUTUBE_EVENT_QUERIES,
} from "@/lib/events";
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

async function fetchYoutubeUpcoming(): Promise<PulseEvent[]> {
  const settings = await getAppSettingsFull();
  if (!settings.youtube_api_key) return getSamplePulseEvents().filter((e) => e.event_type !== "tournament");

  const out: PulseEvent[] = [];
  for (const q of YOUTUBE_EVENT_QUERIES.slice(0, 4)) {
    try {
      const data = await youtubeFetch(
        `/search?part=snippet&type=video&eventType=upcoming&maxResults=2&q=${encodeURIComponent(q)}`,
        settings.youtube_api_key
      );
      for (const item of data.items || []) {
        const videoId = item.id?.videoId;
        if (!videoId) continue;
        const start =
          item.snippet?.publishTime ||
          item.snippet?.publishedAt ||
          new Date(Date.now() + 48 * 3600000).toISOString();
        out.push({
          id: `youtube:${videoId}`,
          title: item.snippet?.title || q,
          game_name: q.includes("Nintendo")
            ? "Nintendo"
            : q.includes("PlayStation") || q.includes("State of Play")
              ? "PlayStation"
              : "Multi",
          event_type: q.toLowerCase().includes("direct") || q.toLowerCase().includes("fest") || q.toLowerCase().includes("awards") || q.toLowerCase().includes("state of play")
            ? "game_show"
            : "gameplay",
          badge: badgeForType(
            q.toLowerCase().includes("direct") ||
              q.toLowerCase().includes("fest") ||
              q.toLowerCase().includes("awards") ||
              q.toLowerCase().includes("state of play")
              ? "game_show"
              : "gameplay"
          ),
          start_time: start,
          stream_url: `https://www.youtube.com/watch?v=${videoId}`,
          status: "UPCOMING",
        });
      }
    } catch (e) {
      console.error("youtube upcoming", q, e);
    }
  }

  return out.length ? out : getSamplePulseEvents();
}

async function fetchSpecialEvents(): Promise<PulseEvent[]> {
  const supabase = createServiceClient() || (await createClient());
  if (!supabase) {
    return getSamplePulseEvents().filter((e) => e.event_type === "game_show");
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
    return getSamplePulseEvents().filter((e) => e.event_type === "game_show").slice(0, 2);
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
