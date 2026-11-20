import { createServiceClient, createClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import { twitchFetch } from "@/lib/twitch";
import { youtubeFetch } from "@/lib/youtube";
import {
  canSpendSearchList,
  canSpendUnits,
  recordLightUnits,
  recordSearchListCall,
} from "@/lib/youtube-quota";
import {
  getSamplePandascoreMatches,
  mapCustomTournament,
  mapPandaScoreMatch,
  parseStreamUrl,
  sortTournamentMatches,
} from "@/lib/tournaments";
import type {
  CustomTournament,
  Platform,
  TournamentMatch,
  TournamentSource,
  TournamentsApiResponse,
} from "@/lib/types";

type CacheEntry = { at: number; payload: TournamentsApiResponse };
let tournamentsCache: CacheEntry | null = null;
const TOURNAMENTS_CACHE_MS = 90_000;

/** Title heuristics for live YouTube / Twitch streams that are cups / finals / orgs. */
const TOURNAMENT_TITLE_RE =
  /\b(tournament|tour|championship|finals?|semi[\s-]?finals?|playoffs?|invitational|masters|premier|pro league|esl|blast|vct|bgis|bmps|pmgc|ffws|world series|qualifier|scrims?|lobby\s*\d+|grand final)\b/i;

function looksLikeTournament(title: string, streamer: string): boolean {
  const hay = `${title} ${streamer}`;
  return TOURNAMENT_TITLE_RE.test(hay);
}

async function fetchYoutubeTwitchTournaments(): Promise<TournamentMatch[]> {
  const service = createServiceClient();
  const anon = service || (await createClient());
  if (!anon) return [];

  const { data, error } = await anon
    .from("cached_streams")
    .select(
      "id, title, streamer_name, game_slug, game_title, platform, external_id, thumbnail_url, viewer_count, published_at, content_type"
    )
    .eq("content_type", "live")
    .in("platform", ["youtube", "twitch"])
    .order("viewer_count", { ascending: false })
    .limit(120);

  if (error || !data?.length) {
    if (error) console.error("platform tournaments", error.message);
    return [];
  }

  const out: TournamentMatch[] = [];
  for (const row of data) {
    const title = String(row.title || "");
    const streamer = String(row.streamer_name || "");
    if (!looksLikeTournament(title, streamer)) continue;

    const platform = row.platform === "youtube" ? "youtube" : "twitch";
    const externalId = String(row.external_id || "");
    if (!externalId) continue;

    const source = platform as TournamentSource;
    out.push({
      id: `plat:${platform}:${externalId}`,
      source,
      status: "LIVE",
      game: String(row.game_title || row.game_slug || "Esports"),
      tournament_name: streamer || title.slice(0, 48) || "Live Cup",
      match_title: title || "Live tournament stream",
      start_time: String(row.published_at || new Date().toISOString()),
      platform,
      stream_url:
        platform === "youtube"
          ? `https://www.youtube.com/watch?v=${externalId}`
          : `https://www.twitch.tv/${externalId}`,
      embed_external_id: externalId,
      channel_id: externalId,
      is_featured: Number(row.viewer_count || 0) >= 50,
    });
  }

  return out.slice(0, 40);
}

async function detectChannelLive(
  platform: "youtube" | "twitch",
  channelId: string,
  settings: Awaited<ReturnType<typeof getAppSettingsFull>>
): Promise<{ live: boolean; videoId?: string; login?: string; checked: boolean }> {
  if (!channelId) return { live: false, checked: false };

  try {
    if (platform === "youtube" && settings.youtube_api_key) {
      // Prefer cheap videos.list when we already have a video id
      if (/^[\w-]{11}$/.test(channelId) && !channelId.startsWith("UC")) {
        const light = await canSpendUnits(1);
        if (!light.ok) return { live: false, checked: false };
        const data = await youtubeFetch(
          `/videos?part=snippet,liveStreamingDetails&id=${encodeURIComponent(channelId)}`,
          settings.youtube_api_key
        );
        await recordLightUnits(1);
        const item = data.items?.[0];
        const liveState = item?.snippet?.liveBroadcastContent;
        if (liveState === "live") return { live: true, videoId: channelId, checked: true };
        return { live: false, checked: true };
      } else if (channelId.startsWith("UC")) {
        const spend = await canSpendSearchList();
        if (!spend.ok) return { live: false, checked: false };
        const data = await youtubeFetch(
          `/search?part=snippet&channelId=${encodeURIComponent(channelId)}&eventType=live&type=video&maxResults=1`,
          settings.youtube_api_key
        );
        await recordSearchListCall(1);
        const item = data.items?.[0];
        if (item?.id?.videoId) return { live: true, videoId: item.id.videoId, checked: true };
        return { live: false, checked: true };
      }
    }

    if (platform === "twitch" && settings.twitch_client_id && settings.twitch_client_secret) {
      const data = await twitchFetch(
        `/streams?user_login=${encodeURIComponent(channelId)}`,
        settings.twitch_client_id,
        settings.twitch_client_secret
      );
      const s = data.data?.[0];
      if (s) return { live: true, login: s.user_login || channelId, checked: true };
      return { live: false, checked: true };
    }
  } catch (e) {
    console.error("channel live detect", channelId, e);
  }

  return { live: false, checked: false };
}

/**
 * Soften LIVE verification:
 * - Keep PandaScore "running" as LIVE when we cannot check (no channel / quota).
 * - Demote only when a check explicitly says the channel is offline.
 */
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
      // No embed to verify — keep LIVE so tournaments still surface.
      out.push(m);
      continue;
    }

    const liveMeta = await detectChannelLive(platform, channel, settings);
    if (!liveMeta.checked) {
      out.push(m);
      continue;
    }
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
    let liveMeta: { live: boolean; videoId?: string; login?: string; checked: boolean } = {
      live: false,
      checked: false,
    };

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

async function loadUnifiedTournamentsFresh(): Promise<TournamentsApiResponse> {
  const settings = await getAppSettingsFull();
  const [panda, custom, platform] = await Promise.all([
    fetchPandaScore(),
    fetchCustomTournaments(settings),
    fetchYoutubeTwitchTournaments(),
  ]);

  const verifiedPanda = await verifyLiveMatches(panda.matches, settings);
  // Prefer real YouTube/Twitch tournament lives + admin custom cups; PandaScore optional.
  let matches = sortTournamentMatches([...platform, ...custom, ...verifiedPanda]);

  // Dedupe by embed / stream url
  const seen = new Set<string>();
  matches = matches.filter((m) => {
    const key = `${m.platform}:${m.embed_external_id || m.stream_url || m.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Fallback samples only when nothing real is available
  if (matches.length === 0) {
    matches = sortTournamentMatches([
      ...getSamplePandascoreMatches(),
    ]);
  }

  return {
    matches,
    live_count: matches.filter((m) => m.status === "LIVE").length,
    pandascore_configured: panda.configured,
    custom_count: custom.length,
  };
}

export async function getUnifiedTournaments(): Promise<TournamentsApiResponse> {
  const now = Date.now();
  if (tournamentsCache && now - tournamentsCache.at < TOURNAMENTS_CACHE_MS) {
    return tournamentsCache.payload;
  }
  const payload = await loadUnifiedTournamentsFresh();
  tournamentsCache = { at: now, payload };
  return payload;
}
