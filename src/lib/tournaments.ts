import type { CustomTournament, Platform, TournamentMatch, TournamentStatus } from "@/lib/types";

/** Call at request/effect time — never freeze Date.now() at module load (breaks hydration). */
export function getSamplePandascoreMatches(now = Date.now()): TournamentMatch[] {
  return [
    {
      id: "ps-sample-val-1",
      source: "pandascore",
      status: "LIVE",
      game: "Valorant",
      tournament_name: "VCT Masters Sample",
      match_title: "Semi Final — Map 2",
      start_time: new Date(now - 25 * 60000).toISOString(),
      team_a: "Sentinels",
      team_b: "Paper Rex",
      team_a_logo: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=80&h=80&q=80",
      team_b_logo: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=80&h=80&q=80",
      platform: "twitch",
      stream_url: "https://www.twitch.tv/valorant",
      embed_external_id: "valorant",
      is_featured: true,
    },
    {
      id: "ps-sample-cs2-1",
      source: "pandascore",
      status: "UPCOMING",
      game: "CS2",
      tournament_name: "BLAST Premier Sample",
      match_title: "Quarter Final",
      start_time: new Date(now + 3 * 3600000).toISOString(),
      team_a: "Natus Vincere",
      team_b: "G2 Esports",
      team_a_logo: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=80&h=80&q=80",
      team_b_logo: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=80&h=80&q=80",
      platform: "twitch",
      stream_url: "https://www.twitch.tv/eslcs",
      embed_external_id: "eslcs",
      is_featured: true,
    },
    {
      id: "ps-sample-lol-1",
      source: "pandascore",
      status: "UPCOMING",
      game: "LoL",
      tournament_name: "LCK Spring Sample",
      match_title: "Week 3 — Bo3",
      start_time: new Date(now + 26 * 3600000).toISOString(),
      team_a: "T1",
      team_b: "Gen.G",
      platform: "youtube",
      stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embed_external_id: "dQw4w9WgXcQ",
      is_featured: false,
    },
  ];
}

export function getSampleCustomMatches(now = Date.now()): TournamentMatch[] {
  return [
    {
      id: "33333333-3333-3333-3333-333333333302",
      source: "custom",
      status: "LIVE",
      game: "Free Fire",
      tournament_name: "Free Fire World Series IN",
      match_title: "Semi Finals — Booyah Stage",
      start_time: new Date(now - 30 * 60000).toISOString(),
      end_time: new Date(now + 3 * 3600000).toISOString(),
      platform: "youtube",
      stream_url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      embed_external_id: "jNQXAC9IVRw",
      is_featured: true,
    },
    {
      id: "33333333-3333-3333-3333-333333333301",
      source: "custom",
      status: "UPCOMING",
      game: "BGMI",
      tournament_name: "BGIS 2026 Grand Finals",
      match_title: "Day 3 — Finals Lobby",
      start_time: new Date(now + 2 * 3600000).toISOString(),
      end_time: new Date(now + 6 * 3600000).toISOString(),
      platform: "youtube",
      stream_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embed_external_id: "dQw4w9WgXcQ",
      is_featured: true,
    },
    {
      id: "33333333-3333-3333-3333-333333333303",
      source: "custom",
      status: "UPCOMING",
      game: "BGMI",
      tournament_name: "BGMI Challengers Cup",
      match_title: "Qualifier Week 2",
      start_time: new Date(now + 24 * 3600000).toISOString(),
      platform: "twitch",
      channel_id: "pubgmobile",
      stream_url: "https://www.twitch.tv/pubgmobile",
      embed_external_id: "pubgmobile",
      is_featured: true,
    },
  ];
}

export function sortTournamentMatches(matches: TournamentMatch[]): TournamentMatch[] {
  const rank: Record<TournamentStatus, number> = { LIVE: 0, UPCOMING: 1, ENDED: 2 };
  return [...matches].sort((a, b) => {
    const byStatus = rank[a.status] - rank[b.status];
    if (byStatus !== 0) return byStatus;
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });
}

export function parseStreamUrl(url: string | null | undefined): {
  platform: Platform | null;
  externalId: string | null;
} {
  if (!url) return { platform: null, externalId: null };
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      if (host.includes("youtu.be")) {
        return { platform: "youtube", externalId: u.pathname.replace("/", "") || null };
      }
      const v = u.searchParams.get("v");
      if (v) return { platform: "youtube", externalId: v };
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "live" || parts[0] === "embed") {
        return { platform: "youtube", externalId: parts[1] || null };
      }
      return { platform: "youtube", externalId: null };
    }
    if (host.includes("twitch.tv")) {
      const channel = u.pathname.split("/").filter(Boolean)[0] || null;
      return { platform: "twitch", externalId: channel };
    }
  } catch {
    return { platform: null, externalId: null };
  }
  return { platform: null, externalId: null };
}

export function deriveCustomStatus(row: CustomTournament, isLiveDetected: boolean): TournamentStatus {
  if (isLiveDetected) return "LIVE";
  const now = Date.now();
  const start = new Date(row.start_time).getTime();
  const end = row.end_time ? new Date(row.end_time).getTime() : start + 4 * 3600000;
  if (now >= start && now <= end) return "LIVE";
  if (now > end) return "ENDED";
  return "UPCOMING";
}

export function mapCustomTournament(
  row: CustomTournament,
  opts?: { isLive?: boolean; liveVideoId?: string | null; liveLogin?: string | null }
): TournamentMatch {
  const isLive = Boolean(opts?.isLive);
  const status = deriveCustomStatus(row, isLive);
  let platform = row.platform;
  let embed = opts?.liveVideoId || opts?.liveLogin || null;
  let streamUrl = row.fallback_stream_url || null;

  if (isLive && opts?.liveVideoId && row.platform === "youtube") {
    embed = opts.liveVideoId;
    streamUrl = `https://www.youtube.com/watch?v=${opts.liveVideoId}`;
  } else if (isLive && (opts?.liveLogin || row.channel_id) && row.platform === "twitch") {
    embed = opts?.liveLogin || row.channel_id;
    streamUrl = `https://www.twitch.tv/${embed}`;
  } else if (!embed && row.fallback_stream_url) {
    const parsed = parseStreamUrl(row.fallback_stream_url);
    platform = parsed.platform || platform;
    embed = parsed.externalId;
  } else if (!embed && row.platform === "twitch" && row.channel_id) {
    embed = row.channel_id;
    streamUrl = streamUrl || `https://www.twitch.tv/${row.channel_id}`;
  }

  return {
    id: row.id,
    source: "custom",
    status,
    game: row.game,
    tournament_name: row.tournament_name,
    match_title: row.match_title || row.tournament_name,
    start_time: row.start_time,
    end_time: row.end_time,
    platform,
    channel_id: row.channel_id || null,
    stream_url: streamUrl,
    embed_external_id: embed,
    is_featured: row.is_featured,
  };
}

function mapPandaGame(videogame?: { name?: string; slug?: string } | null): string {
  const name = (videogame?.name || videogame?.slug || "").toLowerCase();
  if (name.includes("valorant")) return "Valorant";
  if (name.includes("counter") || name.includes("cs2") || name.includes("cs-go") || name.includes("csgo"))
    return "CS2";
  if (name.includes("league") || name.includes("lol")) return "LoL";
  if (name.includes("dota")) return "Dota 2";
  return videogame?.name || "Esports";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPandaScoreMatch(raw: any, forcedStatus?: TournamentStatus): TournamentMatch | null {
  if (!raw?.id) return null;
  const opponents = raw.opponents || [];
  const a = opponents[0]?.opponent;
  const b = opponents[1]?.opponent;
  const streams = raw.streams_list || [];
  const preferred =
    streams.find((s: { main?: boolean }) => s.main) ||
    streams.find((s: { official?: boolean }) => s.official) ||
    streams[0];
  const streamUrl = preferred?.raw_url || preferred?.embed_url || null;
  const parsed = parseStreamUrl(streamUrl);

  let status: TournamentStatus = forcedStatus || "UPCOMING";
  if (!forcedStatus) {
    if (raw.status === "running") status = "LIVE";
    else if (raw.status === "finished" || raw.status === "canceled") status = "ENDED";
    else status = "UPCOMING";
  }

  const leagueName = raw.league?.name || raw.serie?.full_name || raw.tournament?.name || "Esports";
  const matchTitle =
    a?.name && b?.name
      ? `${a.name} vs ${b.name}`
      : raw.name || raw.tournament?.name || "Match";

  return {
    id: `ps-${raw.id}`,
    source: "pandascore",
    status,
    game: mapPandaGame(raw.videogame),
    tournament_name: leagueName,
    match_title: matchTitle,
    start_time: raw.begin_at || raw.scheduled_at || new Date().toISOString(),
    end_time: raw.end_at || null,
    team_a: a?.name,
    team_b: b?.name,
    team_a_logo: a?.image_url || null,
    team_b_logo: b?.image_url || null,
    platform: parsed.platform,
    stream_url: streamUrl,
    embed_external_id: parsed.externalId,
    is_featured: status === "LIVE",
  };
}

export function buildWatchPath(match: TournamentMatch): string | null {
  if (!match.embed_external_id || !match.platform) return null;
  const params = new URLSearchParams({
    platform: match.platform,
    external: match.embed_external_id,
    type: match.status === "LIVE" ? "live" : "video",
    title: match.match_title || match.tournament_name,
    streamer: match.tournament_name,
    game: match.game,
  });
  return `/watch/tournament-${encodeURIComponent(match.id)}?${params.toString()}`;
}

export function formatLocalStart(iso: string): string {
  try {
    // Fixed locale so SSR + browser never disagree (hydration-safe).
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString();
  }
}

export function countdownLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Starting soon";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Starts in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `Starts in ${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `Starts in ${days}d`;
}
