import type { SupabaseClient } from "@supabase/supabase-js";

export interface AnalyticsOverview {
  total_users: number;
  active_subscribers: number;
  banned_users: number;
  admin_users: number;
  live_streams: number;
  video_streams: number;
  total_watch_seconds: number;
  total_watch_sessions: number;
}

export interface TrafficOverview {
  views_today: number;
  views_7d: number;
  unique_today: number;
  unique_7d: number;
  web_views_7d: number;
  android_views_7d: number;
  signed_in_views_7d: number;
  push_devices: number;
  top_paths: { path: string; views: number }[];
}

export interface ProSubscriberRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  subscription_tier: string;
  payment_provider: string | null;
  cashfree_subscription_id: string | null;
  pro_expires_at: string | null;
  updated_at: string;
  subscription_status: "active" | "expired" | "inactive" | string;
}

export interface CreatorLeaderboardRow {
  streamer_name: string;
  platform: string;
  watch_count: number;
  total_watch_seconds: number;
  avg_minutes_per_session: number;
  /** Present when falling back to live viewer_count proxies */
  live_viewers?: number;
}

export interface StreamLeaderboardRow {
  stream_id: string;
  stream_title: string;
  streamer_name: string;
  game_slug: string;
  game_title: string;
  content_type: string;
  platform: string;
  watch_count: number;
  total_watch_seconds: number;
  avg_minutes_per_session: number;
  viewer_count?: number;
}

export interface GameEngagementRow {
  game_slug: string;
  game_title: string;
  watch_count: number;
  total_watch_seconds: number;
  avg_minutes_per_session: number;
  unique_viewers: number;
}

export interface AdminAnalyticsPayload {
  overview: AnalyticsOverview;
  traffic: TrafficOverview;
  subscribers: ProSubscriberRow[];
  top_creators: CreatorLeaderboardRow[];
  top_live: StreamLeaderboardRow[];
  top_videos: StreamLeaderboardRow[];
  game_engagement: GameEngagementRow[];
  source: "telemetry" | "proxy";
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

async function fetchOverview(
  service: SupabaseClient
): Promise<{ overview: AnalyticsOverview; fromView: boolean }> {
  const { data, error } = await service.from("admin_user_overview").select("*").maybeSingle();
  if (!error && data) {
    const [{ count: live }, { count: videos }, sessionsAgg] = await Promise.all([
      service
        .from("cached_streams")
        .select("*", { count: "exact", head: true })
        .eq("content_type", "live"),
      service
        .from("cached_streams")
        .select("*", { count: "exact", head: true })
        .in("content_type", ["video", "trending"]),
      service.from("watch_sessions").select("duration_seconds"),
    ]);

    const sessions = sessionsAgg.data || [];
    return {
      fromView: true,
      overview: {
        total_users: num(data.total_users),
        active_subscribers: num(data.active_subscribers),
        banned_users: num(data.banned_users),
        admin_users: num(data.admin_users),
        live_streams: live ?? 0,
        video_streams: videos ?? 0,
        total_watch_seconds: sessions.reduce((s, r) => s + num(r.duration_seconds), 0),
        total_watch_sessions: sessions.length,
      },
    };
  }

  // Fallback: count profiles directly
  const { data: profiles } = await service
    .from("profiles")
    .select("subscription_tier, pro_expires_at, is_banned, role");
  const list = profiles || [];
  const now = Date.now();
  const activeSubs = list.filter(
    (p) =>
      p.subscription_tier === "pro" &&
      (!p.pro_expires_at || new Date(p.pro_expires_at).getTime() > now)
  ).length;

  const [{ count: live }, { count: videos }] = await Promise.all([
    service
      .from("cached_streams")
      .select("*", { count: "exact", head: true })
      .eq("content_type", "live"),
    service
      .from("cached_streams")
      .select("*", { count: "exact", head: true })
      .in("content_type", ["video", "trending"]),
  ]);

  return {
    fromView: false,
    overview: {
      total_users: list.length,
      active_subscribers: activeSubs,
      banned_users: list.filter((p) => p.is_banned).length,
      admin_users: list.filter((p) => p.role === "admin").length,
      live_streams: live ?? 0,
      video_streams: videos ?? 0,
      total_watch_seconds: 0,
      total_watch_sessions: 0,
    },
  };
}

async function fetchSubscribers(service: SupabaseClient): Promise<ProSubscriberRow[]> {
  const { data, error } = await service.from("admin_pro_subscribers").select("*").limit(200);
  if (!error && data) {
    return data as ProSubscriberRow[];
  }

  const { data: profiles } = await service
    .from("profiles")
    .select(
      "id, email, full_name, avatar_url, subscription_tier, payment_provider, cashfree_subscription_id, pro_expires_at, updated_at"
    )
    .eq("subscription_tier", "pro")
    .order("updated_at", { ascending: false })
    .limit(200);

  const now = Date.now();
  return (profiles || []).map((p) => {
    const expired =
      p.pro_expires_at != null && new Date(p.pro_expires_at).getTime() <= now;
    return {
      ...p,
      subscription_status: expired ? "expired" : "active",
    } as ProSubscriberRow;
  });
}

async function fetchTelemetryLeaderboards(service: SupabaseClient): Promise<{
  top_creators: CreatorLeaderboardRow[];
  top_live: StreamLeaderboardRow[];
  top_videos: StreamLeaderboardRow[];
  game_engagement: GameEngagementRow[];
  hasTelemetry: boolean;
}> {
  const [creatorsRes, streamsRes, gamesRes] = await Promise.all([
    service.from("admin_top_creators").select("*").limit(25),
    service.from("admin_top_streams").select("*").limit(50),
    service.from("admin_game_engagement").select("*").limit(25),
  ]);

  if (
    isMissingRelation(creatorsRes.error) ||
    isMissingRelation(streamsRes.error) ||
    isMissingRelation(gamesRes.error)
  ) {
    return {
      top_creators: [],
      top_live: [],
      top_videos: [],
      game_engagement: [],
      hasTelemetry: false,
    };
  }

  const creators = (creatorsRes.data || []).map((r) => ({
    streamer_name: String(r.streamer_name || ""),
    platform: String(r.platform || ""),
    watch_count: num(r.watch_count),
    total_watch_seconds: num(r.total_watch_seconds),
    avg_minutes_per_session: num(r.avg_minutes_per_session),
  }));

  const streams = (streamsRes.data || []).map((r) => ({
    stream_id: String(r.stream_id || ""),
    stream_title: String(r.stream_title || ""),
    streamer_name: String(r.streamer_name || ""),
    game_slug: String(r.game_slug || ""),
    game_title: String(r.game_title || ""),
    content_type: String(r.content_type || ""),
    platform: String(r.platform || ""),
    watch_count: num(r.watch_count),
    total_watch_seconds: num(r.total_watch_seconds),
    avg_minutes_per_session: num(r.avg_minutes_per_session),
  }));

  const games = (gamesRes.data || []).map((r) => ({
    game_slug: String(r.game_slug || ""),
    game_title: String(r.game_title || ""),
    watch_count: num(r.watch_count),
    total_watch_seconds: num(r.total_watch_seconds),
    avg_minutes_per_session: num(r.avg_minutes_per_session),
    unique_viewers: num(r.unique_viewers),
  }));

  const hasTelemetry = creators.length > 0 || streams.length > 0 || games.length > 0;

  return {
    top_creators: creators,
    top_live: streams.filter((s) => s.content_type === "live" || s.content_type === "tournament"),
    top_videos: streams.filter((s) => s.content_type === "video" || s.content_type === "trending"),
    game_engagement: games,
    hasTelemetry,
  };
}

/** Proxy metrics from cached_streams when watch_sessions are empty / not migrated yet. */
async function fetchProxyLeaderboards(service: SupabaseClient): Promise<{
  top_creators: CreatorLeaderboardRow[];
  top_live: StreamLeaderboardRow[];
  top_videos: StreamLeaderboardRow[];
  game_engagement: GameEngagementRow[];
}> {
  const { data: streams } = await service
    .from("cached_streams")
    .select(
      "id, title, streamer_name, game_slug, game_title, content_type, platform, viewer_count"
    )
    .order("viewer_count", { ascending: false })
    .limit(100);

  const list = streams || [];

  const creatorMap = new Map<string, CreatorLeaderboardRow>();
  for (const s of list) {
    const key = s.streamer_name || "Unknown";
    const prev = creatorMap.get(key);
    const viewers = num(s.viewer_count);
    if (!prev) {
      creatorMap.set(key, {
        streamer_name: key,
        platform: String(s.platform || ""),
        watch_count: 1,
        total_watch_seconds: viewers * 60,
        avg_minutes_per_session: viewers > 0 ? Math.round(viewers / 10) : 0,
        live_viewers: viewers,
      });
    } else {
      prev.watch_count += 1;
      prev.live_viewers = (prev.live_viewers || 0) + viewers;
      prev.total_watch_seconds += viewers * 60;
    }
  }

  const top_creators = [...creatorMap.values()]
    .sort((a, b) => (b.live_viewers || 0) - (a.live_viewers || 0))
    .slice(0, 15);

  const mapStream = (s: (typeof list)[number]): StreamLeaderboardRow => ({
    stream_id: String(s.id),
    stream_title: String(s.title || ""),
    streamer_name: String(s.streamer_name || ""),
    game_slug: String(s.game_slug || ""),
    game_title: String(s.game_title || ""),
    content_type: String(s.content_type || ""),
    platform: String(s.platform || ""),
    watch_count: 1,
    total_watch_seconds: num(s.viewer_count) * 60,
    avg_minutes_per_session: 0,
    viewer_count: num(s.viewer_count),
  });

  const top_live = list
    .filter((s) => s.content_type === "live")
    .slice(0, 15)
    .map(mapStream);

  const top_videos = list
    .filter((s) => s.content_type === "video" || s.content_type === "trending")
    .slice(0, 15)
    .map(mapStream);

  const gameMap = new Map<string, GameEngagementRow & { viewers: number }>();
  for (const s of list) {
    const slug = s.game_slug || "unknown";
    const prev = gameMap.get(slug);
    const viewers = num(s.viewer_count);
    if (!prev) {
      gameMap.set(slug, {
        game_slug: slug,
        game_title: String(s.game_title || slug),
        watch_count: 1,
        total_watch_seconds: viewers * 60,
        avg_minutes_per_session: 0,
        unique_viewers: viewers,
        viewers,
      });
    } else {
      prev.watch_count += 1;
      prev.viewers += viewers;
      prev.total_watch_seconds += viewers * 60;
      prev.unique_viewers = prev.viewers;
    }
  }

  const game_engagement = [...gameMap.values()]
    .map(({ viewers: _v, ...rest }) => rest)
    .sort((a, b) => b.total_watch_seconds - a.total_watch_seconds)
    .slice(0, 15);

  return { top_creators, top_live, top_videos, game_engagement };
}

async function fetchTraffic(service: SupabaseClient): Promise<TrafficOverview> {
  const empty: TrafficOverview = {
    views_today: 0,
    views_7d: 0,
    unique_today: 0,
    unique_7d: 0,
    web_views_7d: 0,
    android_views_7d: 0,
    signed_in_views_7d: 0,
    push_devices: 0,
    top_paths: [],
  };

  const start7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const startDay = new Date();
  startDay.setUTCHours(0, 0, 0, 0);
  const startToday = startDay.toISOString();

  const [{ data: rows, error }, pushCount] = await Promise.all([
    service
      .from("analytics_page_views")
      .select("path, client, anon_id, user_id, created_at")
      .gte("created_at", start7)
      .order("created_at", { ascending: false })
      .limit(5000),
    service
      .from("push_devices")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true),
  ]);

  if (error || !rows) {
    if (!isMissingRelation(error)) console.error("analytics_page_views", error?.message);
    empty.push_devices = pushCount.count ?? 0;
    return empty;
  }

  const uniqueToday = new Set<string>();
  const unique7 = new Set<string>();
  const pathCounts = new Map<string, number>();
  let viewsToday = 0;
  let views7 = 0;
  let web7 = 0;
  let android7 = 0;
  let signed7 = 0;

  for (const r of rows) {
    views7 += 1;
    const key = r.user_id || r.anon_id || `row-${views7}`;
    unique7.add(String(key));
    if (r.client === "android") android7 += 1;
    else web7 += 1;
    if (r.user_id) signed7 += 1;
    const path = String(r.path || "/").split("?")[0] || "/";
    pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
    if (String(r.created_at) >= startToday) {
      viewsToday += 1;
      uniqueToday.add(String(key));
    }
  }

  const top_paths = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, views]) => ({ path, views }));

  return {
    views_today: viewsToday,
    views_7d: views7,
    unique_today: uniqueToday.size,
    unique_7d: unique7.size,
    web_views_7d: web7,
    android_views_7d: android7,
    signed_in_views_7d: signed7,
    push_devices: pushCount.count ?? 0,
    top_paths,
  };
}

/** Server-side aggregator used by /api/admin/analytics */
export async function loadAdminAnalytics(
  service: SupabaseClient
): Promise<AdminAnalyticsPayload> {
  const [{ overview }, subscribers, telemetry, traffic] = await Promise.all([
    fetchOverview(service),
    fetchSubscribers(service),
    fetchTelemetryLeaderboards(service),
    fetchTraffic(service),
  ]);

  if (telemetry.hasTelemetry) {
    return {
      overview,
      traffic,
      subscribers,
      top_creators: telemetry.top_creators,
      top_live: telemetry.top_live,
      top_videos: telemetry.top_videos,
      game_engagement: telemetry.game_engagement,
      source: "telemetry",
    };
  }

  const proxy = await fetchProxyLeaderboards(service);
  return {
    overview,
    traffic,
    subscribers,
    ...proxy,
    source: "proxy",
  };
}

export function formatWatchDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
