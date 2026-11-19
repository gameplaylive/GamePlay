import { createServiceClient, createClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import { twitchFetch } from "@/lib/twitch";
import { youtubeFetch } from "@/lib/youtube";
import {
  mapCustomTournament,
  mapPandaScoreMatch,
  parseStreamUrl,
  sortTournamentMatches,
} from "@/lib/tournaments";
import type { CustomTournament, Platform, TournamentMatch, TournamentsApiResponse } from "@/lib/types";

async function detectChannelLive(
  platform: "youtube" | "twitch",
  channelId: string,
  settings: Awaited<ReturnType<typeof getAppSettingsFull>>
): Promise<{ live: boolean; videoId?: string; login?: string }> {
  if (!channelId) return { live: false };

  try {
    if (platform === "youtube" && settings.youtube_api_key) {
      // Prefer channel live search when channelId looks like a UC… id
      if (channelId.startsWith("UC")) {
        const data = await youtubeFetch(
          `/search?part=snippet&channelId=${encodeURIComponent(channelId)}&eventType=live&type=video&maxResults=1`,
          settings.youtube_api_key
        );
        const item = data.items?.[0];
        if (item?.id?.videoId) return { live: true, videoId: item.id.videoId };
      } else if (/^[\w-]{11}$/.test(channelId)) {
        // Treat as video id — check liveBroadcastContent
        const data = await youtubeFetch(
          `/videos?part=snippet,liveStreamingDetails&id=${encodeURIComponent(channelId)}`,
          settings.youtube_api_key
        );
        const item = data.items?.[0];
        const liveState = item?.snippet?.liveBroadcastContent;
        if (liveState === "live") return { live: true, videoId: channelId };
      }
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

/** Demote LIVE → UPCOMING unless the embed channel is actually broadcasting. */
async function verifyLiveMatches(
  matches: TournamentMatch[],
  settings: Awaited<ReturnType<typeof getAppSettingsFull>>
): Promise<TournamentMatch[]> {
  const out: TournamentMatch[] = [];

  for (const m of matches) {
    if (m.status !== "LIVE") {
      out.push(m);
      continue;
    }

    let platform = m.platform as Platform | null | undefined;
    let channel = m.channel_id || m.embed_external_id || null;
    if ((!platform || !channel) && m.stream_url) {
      const parsed = parseStreamUrl(m.stream_url);
      platform = platform || parsed.platform;
      channel = channel || parsed.externalId;
    }

    if (!platform || !channel || (platform !== "youtube" && platform !== "twitch")) {
      out.push({ ...m, status: "UPCOMING" });
      continue;
    }

    const liveMeta = await detectChannelLive(platform, channel, settings);
    if (!liveMeta.live) {
      out.push({ ...m, status: "UPCOMING" });
      continue;
    }

    const embed = liveMeta.videoId || liveMeta.login || channel;
    out.push({
      ...m,
      status: "LIVE",
      platform,
      embed_external_id: embed,
      stream_url:
        platform === "youtube"
          ? `https://www.youtube.com/watch?v=${embed}`
          : `https://www.twitch.tv/${embed}`,
    });
  }

  return out;
}

async function fetchPandaScore(): Promise<{ matches: TournamentMatch[]; configured: boolean }> {
  const key = process.env.PANDASCORE_API_KEY?.trim();
  if (!key) {
    return { matches: [], configured: false };
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
      return { matches: [], configured: true };
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

    return { matches: mapped, configured: true };
  } catch {
    return { matches: [], configured: true };
  }
}

async function fetchCustomTournaments(
  settings: Awaited<ReturnType<typeof getAppSettingsFull>>
): Promise<TournamentMatch[]> {
  const service = createServiceClient();
  const anon = service || (await createClient());

  if (!anon) return [];

  const { data, error } = await anon
    .from("custom_tournaments")
    .select("*")
    .order("start_time", { ascending: true });

  if (error || !data?.length) {
    if (error) console.error("custom_tournaments", error.message);
    return [];
  }

  const rows = data as CustomTournament[];
  const mapped: TournamentMatch[] = [];

  for (const row of rows) {
    let liveMeta: { live: boolean; videoId?: string; login?: string } = { live: false };

    // Prefer official channel id; else parse fallback stream URL
    let checkPlatform = row.platform;
    let checkId = row.channel_id?.trim() || "";
    if (!checkId && row.fallback_stream_url) {
      const parsed = parseStreamUrl(row.fallback_stream_url);
      if (parsed.platform && parsed.externalId) {
        checkPlatform = parsed.platform;
        checkId = parsed.externalId;
      }
    }

    if (checkId && (checkPlatform === "youtube" || checkPlatform === "twitch")) {
      liveMeta = await detectChannelLive(checkPlatform, checkId, settings);
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
  const settings = await getAppSettingsFull();
  const [panda, custom] = await Promise.all([
    fetchPandaScore(),
    fetchCustomTournaments(settings),
  ]);

  // PandaScore "running" ≠ stream online — verify before exposing as LIVE / Watch Live
  const verifiedPanda = await verifyLiveMatches(panda.matches, settings);
  const matches = sortTournamentMatches([...verifiedPanda, ...custom]);

  return {
    matches,
    live_count: matches.filter((m) => m.status === "LIVE").length,
    pandascore_configured: panda.configured,
    custom_count: custom.length,
  };
}
