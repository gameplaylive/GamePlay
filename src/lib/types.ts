export type UserRole = "user" | "admin";
export type SubscriptionTier = "free" | "pro";
export type ContentType = "live" | "video" | "trending";
export type Platform = "youtube" | "twitch";
/** Viewer player backends — includes HLS for PC OBS ingest */
export type WatchPlatform = Platform | "hls";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  favorite_games: string[];
  preferred_language: string;
  subscription_tier: SubscriptionTier;
  payment_provider: "cashfree" | string;
  cashfree_subscription_id: string | null;
  pro_expires_at: string | null;
  /** @deprecated Stripe removed — kept nullable for old rows */
  stripe_customer_id: string | null;
  is_banned: boolean;
  updated_at: string;
}

export interface Game {
  id: string;
  title: string;
  slug: string;
  cover_image: string;
  twitch_game_id: string;
  youtube_query: string;
  is_active: boolean;
}

export interface CachedStream {
  id: string;
  game_id: string | null;
  game_slug: string;
  game_title: string;
  content_type: ContentType;
  platform: WatchPlatform;
  external_id: string;
  title: string;
  streamer_name: string;
  thumbnail_url: string;
  viewer_count: number;
  published_at: string | null;
  language: string;
  updated_at: string;
}

export interface AppSettingsPublic {
  id: number;
  /** Pro monthly price in INR (legacy column name; Cashfree charges ₹). */
  pro_price_usd: number;
  pro_plan_name: string;
  pro_plan_description: string;
  adsense_enabled: boolean;
  adsense_publisher_id: string;
  adsense_slot_id: string;
  admob_enabled: boolean;
  admob_app_id: string;
  admob_banner_unit_id: string;
  last_sync_time: string | null;
}

export interface AppSettings extends AppSettingsPublic {
  youtube_api_key: string;
  twitch_client_id: string;
  twitch_client_secret: string;
}

export interface ChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  is_pro: boolean;
  message: string;
  created_at: string;
}

export interface LivePoll {
  id: string;
  stream_id: string;
  question: string;
  option_a: string;
  option_b: string;
  votes_a: number;
  votes_b: number;
  is_active: boolean;
}

export interface UserFavorite {
  id: string;
  user_id: string;
  channel_name: string;
  platform: Platform;
  channel_id_or_username: string;
  avatar_url: string;
  created_at: string;
}

export interface CreatorSearchResult {
  platform: Platform;
  channel_name: string;
  channel_id_or_username: string;
  avatar_url: string;
  is_live?: boolean;
}

export interface CreatorRecentVideo {
  id: string;
  title: string;
  thumbnail: string;
  published_at?: string;
}

export interface FavoriteGamerStatus extends UserFavorite {
  is_live: boolean;
  live_title?: string;
  live_viewer_count?: number;
  live_thumbnail?: string;
  live_external_id?: string;
  latest_video_id?: string;
  latest_video_title?: string;
  latest_video_thumbnail?: string;
  /** Cached recent uploads / VODs (from favorites cron, ~10–20 min). */
  recent_videos?: CreatorRecentVideo[];
  last_checked_at?: string | null;
}

export type HomeTab = "live" | "trending" | "favorites";

export type TournamentStatus = "LIVE" | "UPCOMING" | "ENDED";
export type TournamentSource = "pandascore" | "custom" | "youtube" | "twitch";

export interface CustomTournament {
  id: string;
  tournament_name: string;
  game: string;
  match_title: string;
  start_time: string;
  end_time: string | null;
  platform: Platform;
  channel_id: string;
  fallback_stream_url: string;
  is_featured: boolean;
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  source: TournamentSource;
  status: TournamentStatus;
  game: string;
  tournament_name: string;
  match_title: string;
  start_time: string;
  end_time?: string | null;
  team_a?: string;
  team_b?: string;
  team_a_logo?: string | null;
  team_b_logo?: string | null;
  platform?: Platform | null;
  stream_url?: string | null;
  embed_external_id?: string | null;
  channel_id?: string | null;
  is_featured?: boolean;
}

export interface TournamentsApiResponse {
  matches: TournamentMatch[];
  live_count: number;
  pandascore_configured: boolean;
  custom_count: number;
}

export type PulseEventType = "tournament" | "game_show" | "gameplay";
export type PulseCategoryBadge = "TOURNAMENT" | "GAME SHOW" | "UPCOMING GAMEPLAY";

export interface PulseEvent {
  id: string;
  title: string;
  game_name: string;
  event_type: PulseEventType;
  badge: PulseCategoryBadge;
  start_time: string;
  stream_url: string;
  status: "LIVE" | "UPCOMING";
}

export interface EventReminder {
  id: string;
  user_id: string;
  user_email: string | null;
  push_subscription: Record<string, unknown> | null;
  event_id: string;
  event_title: string;
  event_type: PulseEventType;
  stream_url: string;
  event_start_time: string;
  notified_48h: boolean;
  notified_24h: boolean;
  notified_30m: boolean;
  notified_live: boolean;
  created_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link_url: string;
  event_id: string | null;
  is_read: boolean;
  created_at: string;
}

export type CommunityGame =
  | "BGMI"
  | "Free Fire"
  | "Minecraft"
  | "Roblox"
  | "Valorant"
  | "GTA V"
  | "Euro Truck Simulator 2"
  | "Other";

export type StreamResolution = "720p60" | "1080p30";

export type CommunityStreamSource = "mobile" | "pc" | "youtube" | "twitch";

export interface CommunityLiveStream {
  id: string;
  user_id: string;
  creator_name: string;
  game: CommunityGame;
  stream_title: string;
  youtube_video_id: string | null;
  is_live: boolean;
  started_at: string;
  ended_at?: string | null;
  resolution?: StreamResolution | string;
  mic_enabled?: boolean;
  source?: CommunityStreamSource;
  /** HLS URL for legacy PC ingest, or Twitch channel slug when source === "twitch". */
  playback_url?: string | null;
  ingest_stream_key?: string | null;
}

export const COMMUNITY_GAMES: CommunityGame[] = [
  "BGMI",
  "Free Fire",
  "Minecraft",
  "Roblox",
  "Valorant",
  "GTA V",
  "Euro Truck Simulator 2",
  "Other",
];

/** Android package names for auto-launch after Go Live */
export const GAME_ANDROID_PACKAGES: Record<CommunityGame, string | null> = {
  BGMI: "com.pubg.imobile",
  "Free Fire": "com.dts.freefiremax",
  Minecraft: "com.mojang.minecraftpe",
  Roblox: "com.roblox.client",
  Valorant: null,
  "GTA V": null,
  "Euro Truck Simulator 2": null,
  Other: null,
};
