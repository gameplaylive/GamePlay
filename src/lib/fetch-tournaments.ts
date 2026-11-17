import { createServiceClient, createClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import { twitchFetch } from "@/lib/twitch";
import { youtubeFetch } from "@/lib/youtube";
import {
  SAMPLE_CUSTOM_MATCHES,
  SAMPLE_PANDASCORE_MATCHES,
  mapCustomTournament,
  mapPandaScoreMatch,
  sortTournamentMatches,
} from "@/lib/tournaments";
import type { CustomTournament, TournamentMatch, TournamentsApiResponse } from "@/lib/types";

async function fetchPandaScore(): Promise<{ matches: TournamentMatch[]; configured: boolean }> {
  const key = process.env.PANDASCORE_API_KEY?.trim();
  if (!key) {
    return { matches: SAMPLE_PANDASCORE_MATCHES, configured: false };
  }

  const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };
  try {
    const [runningRes, upcomingRes] = await Promise.all([
      fetch("https://api.pandascore.co/matches/running?per_page=15", {
        headers,
        next: { revalidate: 0 },
      }),
      fetch("https://api.pandascore.co/matches/upcoming?per_page=20", {
        headers,
        next: { revalidate: 0 },
      }),
    ]);

    if (!runningRes.ok && !upcomingRes.ok) {
      return { matches: SAMPLE_PANDASCORE_MATCHES, configured: true };
    }

    const running = runningRes.ok ? await runningRes.json() : [];
    const upcoming = upcomingRes.ok ? await upcomingRes.json() : [];
    const mapped: TournamentMatch[] = [];

    for (const raw of running || []) {
      const m = mapPandaScoreMatch(raw, "LIVE");
      if (m) mapped.push(m);
    }
    for (const raw of upcoming || []) {
      const m = mapPandaScoreMatch(raw, "UPCOMING");
      if (m) mapped.push(m);
    }

    if (!mapped.length) return { matches: SAMPLE_PANDASCORE_MATCHES, configured: true };
    return { matches: mapped, configured: true };
  } catch {
    return { matches: SAMPLE_PANDASCORE_MATCHES, configured: true };
  }
}

async function detectChannelLive(
  platform: "youtube" | "twitch",
  channelId: string,
  settings: Awaited<ReturnType<typeof getAppSettingsFull>>
): Promise<{ live: boolean; videoId?: string; login?: string }> {
  if (!channelId) return { live: false };

  try {
    if (platform === "youtube" && settings.youtube_api_key) {
      const data = await youtubeFetch(
        `/search?part=snippet&channelId=${encodeURIComponent(channelId)}&eventType=live&type=video&maxResults=1`,
        settings.youtube_api_key
      );
      const item = data.items?.[0];
      if (item?.id?.videoId) return { live: true, videoId: item.id.videoId };
    }

    if (platform === "twitch" && settings.twitch_client_id && settings.twitch_client_secret) {
      const data = await twitchFetch(
        `/streams?user_login=${encodeURIComponent(channelId)}`,
        settings.twitch_client_id,
        settings.twitch_client_secret
      );
      const s = data.data?.[0];
      if (s) return { live: true, login: s.user_login || channelId };
    }
  } catch (e) {
    console.error("channel live detect", channelId, e);
  }

  return { live: false };
}

async function fetchCustomTournaments(): Promise<TournamentMatch[]> {
  const settings = await getAppSettingsFull();
  const service = createServiceClient();
  const anon = service || (await createClient());

  if (!anon) return SAMPLE_CUSTOM_MATCHES;

  const { data, error } = await anon
    .from("custom_tournaments")
    .select("*")
    .order("start_time", { ascending: true });

  if (error || !data?.length) {
    if (error) console.error("custom_tournaments", error.message);
    return SAMPLE_CUSTOM_MATCHES;
  }

  const rows = data as CustomTournament[];
  const mapped: TournamentMatch[] = [];

  for (const row of rows) {
    let liveMeta: { live: boolean; videoId?: string; login?: string } = { live: false };
    if (row.channel_id) {
      liveMeta = await detectChannelLive(row.platform, row.channel_id, settings);
    }
    mapped.push(
      mapCustomTournament(row, {
        isLive: liveMeta.live,
        liveVideoId: liveMeta.videoId,
        liveLogin: liveMeta.login,
      })
    );
  }

  return mapped.filter((m) => m.status !== "ENDED");
}

export async function getUnifiedTournaments(): Promise<TournamentsApiResponse> {
  const [panda, custom] = await Promise.all([fetchPandaScore(), fetchCustomTournaments()]);
  const matches = sortTournamentMatches([...panda.matches, ...custom]);
  return {
    matches,
    live_count: matches.filter((m) => m.status === "LIVE").length,
    pandascore_configured: panda.configured,
    custom_count: custom.length,
  };
}
