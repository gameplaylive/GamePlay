/** Default games for homepage discovery — one YouTube search.list / 20 min. */

export interface DefaultGameDef {
  id: string;
  title: string;
  slug: string;
  cover_image: string;
  /** Primary Twitch category id (also used in games table). */
  twitch_game_id: string;
  /** Extra Twitch category ids batched into the same sync (e.g. COD Warzone + CODM). */
  twitch_game_ids?: string[];
  youtube_query: string;
  /** Keywords used to classify a single broad YouTube search.list result */
  classifyKeywords: string[];
}

/** Display / pill order — first items appear first (not alphabetical). */
export const DEFAULT_GAME_SLUGS = [
  "gta",
  "bgmi",
  "free-fire",
  "valorant",
  "minecraft",
  "roblox",
  "cs2",
  "dota-2",
  "fortnite",
  "call-of-duty",
  "euro-truck-simulator-2",
] as const;

export type DefaultGameSlug = (typeof DEFAULT_GAME_SLUGS)[number];

export const DEFAULT_GAMES: DefaultGameDef[] = [
  {
    // Single GTA bucket — GTA V + GTA VI Twitch categories + all title variants
    id: "11111111-1111-1111-1111-111111111101",
    title: "GTA",
    slug: "gta",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/1867279146_IGDB-285x380.jpg",
    twitch_game_id: "1867279146", // Grand Theft Auto VI
    twitch_game_ids: ["32982", "1867279146"], // V + VI
    youtube_query: "GTA",
    classifyKeywords: [
      "gta",
      "gta 6",
      "gta6",
      "gta vi",
      "gtavi",
      "gta v",
      "gta 5",
      "gta5",
      "gtav",
      "grand theft auto",
      "grand theft auto vi",
      "grand theft auto 6",
      "grand theft auto v",
      "nopixel",
      "gta rp",
      "gta roleplay",
      "gta six",
    ],
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    title: "BGMI",
    slug: "bgmi",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/505884_IGDB-285x380.jpg",
    // Twitch category is "PUBG MOBILE" (505884). Legacy 587342 returns 0 lives.
    twitch_game_id: "505884",
    twitch_game_ids: ["587342"],
    youtube_query: "BGMI",
    classifyKeywords: [
      "bgmi",
      "pubg mobile",
      "pubgm",
      "battlegrounds mobile india",
      "battlegrounds mobile",
      "krafton bgmi",
      "erangel",
      "tdm bgmi",
      "bgmi live",
      "pubg m",
      "bgmi ranked",
      "bgmi scrims",
      "bgmi tournament",
      "bgmi gameplay",
      "india bgmi",
    ],
  },
  {
    id: "11111111-1111-1111-1111-111111111106",
    title: "Free Fire",
    slug: "free-fire",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/502732_IGDB-285x380.jpg",
    twitch_game_id: "502732",
    youtube_query: "Free Fire",
    classifyKeywords: ["free fire", "freefire", "ff max", "garena free fire"],
  },
  {
    id: "11111111-1111-1111-1111-111111111104",
    title: "Valorant",
    slug: "valorant",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/516575_IGDB-285x380.jpg",
    twitch_game_id: "516575",
    youtube_query: "Valorant",
    classifyKeywords: ["valorant", "val ranked"],
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
    title: "Minecraft",
    slug: "minecraft",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg",
    twitch_game_id: "27471",
    youtube_query: "Minecraft",
    classifyKeywords: ["minecraft", "mc smp", "hardcore minecraft"],
  },
  {
    id: "11111111-1111-1111-1111-111111111107",
    title: "Roblox",
    slug: "roblox",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/23020_IGDB-285x380.jpg",
    twitch_game_id: "23020",
    youtube_query: "Roblox",
    classifyKeywords: ["roblox", "brookhaven", "adopt me", "blox fruits"],
  },
  {
    id: "11111111-1111-1111-1111-111111111108",
    title: "CS2",
    slug: "cs2",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/32399_IGDB-285x380.jpg",
    twitch_game_id: "32399",
    youtube_query: "CS2",
    classifyKeywords: ["cs2", "cs 2", "counter-strike", "counter strike", "csgo", "cs:go"],
  },
  {
    id: "11111111-1111-1111-1111-111111111109",
    title: "Dota 2",
    slug: "dota-2",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/29595_IGDB-285x380.jpg",
    twitch_game_id: "29595",
    youtube_query: "Dota 2",
    classifyKeywords: ["dota 2", "dota2", "dota", "ti13", "the international"],
  },
  {
    id: "11111111-1111-1111-1111-111111111105",
    title: "Fortnite",
    slug: "fortnite",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/33214_IGDB-285x380.jpg",
    twitch_game_id: "33214",
    youtube_query: "Fortnite",
    classifyKeywords: ["fortnite", "fort nite", "fn remix", "zero build"],
  },
  {
    id: "11111111-1111-1111-1111-111111111110",
    title: "Call of Duty",
    slug: "call-of-duty",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/512710_IGDB-285x380.jpg",
    // Warzone primary; also batch CODM + recent COD titles into this homepage tab
    twitch_game_id: "512710",
    twitch_game_ids: [
      "512710", // Call of Duty: Warzone
      "1788750875", // Call of Duty: Mobile
      "1469308723", // Call of Duty: Modern Warfare III
      "511224", // Call of Duty: Black Ops Cold War / legacy COD categories vary
    ],
    youtube_query: "Call of Duty",
    classifyKeywords: [
      "call of duty",
      "warzone",
      "codm",
      "cod mobile",
      "modern warfare",
      "black ops",
      "mw3",
      "mw2",
      "cod warzone",
      "cod ",
    ],
  },
  {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Euro Truck Simulator 2",
    slug: "euro-truck-simulator-2",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/75467_IGDB-285x380.jpg",
    twitch_game_id: "75467",
    youtube_query: "Euro Truck Simulator 2",
    classifyKeywords: [
      "euro truck simulator 2",
      "euro truck simulator",
      "ets2",
      "ets 2",
      "eurotruck",
      "euro truck",
      "truckersmp",
      "truckers mp",
      "convoy ets",
      "vtc",
      "promods",
    ],
  },
];

/**
 * YouTube search.list rejects oversized OR queries (returns 0 items with no error).
 * Keep each batch short: single-token ORs are fine; multi-word titles need their own call.
 * Cron runs one batch / 20 min; empty-cache refill may run all batches once.
 */
export type YoutubeLiveSearchBatch = {
  id: string;
  query: string;
  /** Cache rows replaced when this batch succeeds */
  slugs: DefaultGameSlug[];
};

export const YOUTUBE_LIVE_SEARCH_BATCHES: YoutubeLiveSearchBatch[] = [
  {
    id: "tokens-a",
    query: "BGMI|Valorant|Minecraft|Roblox|CS2",
    slugs: ["bgmi", "valorant", "minecraft", "roblox", "cs2"],
  },
  {
    id: "tokens-b",
    query: "Fortnite|Warzone|CODM|ETS2|GTA",
    slugs: ["fortnite", "call-of-duty", "euro-truck-simulator-2", "gta"],
  },
  {
    id: "free-fire",
    query: '"Free Fire"',
    slugs: ["free-fire"],
  },
  {
    id: "dota-2",
    query: '"Dota 2"',
    slugs: ["dota-2"],
  },
  {
    id: "cod-phrase",
    query: '"Call of Duty"',
    slugs: ["call-of-duty"],
  },
];

/** @deprecated Mega-OR returns 0 from YouTube — use YOUTUBE_LIVE_SEARCH_BATCHES */
export const YOUTUBE_LIVE_BROAD_QUERY = YOUTUBE_LIVE_SEARCH_BATCHES.map(
  (b) => b.query
).join("|");

/** Rotate which batch the Live cron fetches this tick. */
export function youtubeLiveBatchForTick(
  nowMs = Date.now()
): YoutubeLiveSearchBatch {
  const periodMs = 20 * 60 * 1000;
  const idx =
    Math.floor(nowMs / periodMs) % YOUTUBE_LIVE_SEARCH_BATCHES.length;
  return YOUTUBE_LIVE_SEARCH_BATCHES[idx]!;
}

/** All signed-in users share the same following cap (Pro paywall removed for launch). */
export const FAVORITE_LIMITS = {
  free: 15,
  pro: 15,
} as const;

/**
 * Soft cap on YouTube search.list *count* for non-Live discovery
 * (favorite channel search, etc.). Live cron is reserved separately
 * (~72/day) inside youtube-quota.ts — do not raise this toward 95 again
 * or shared spenders can starve Live Now.
 */
export const YOUTUBE_SEARCH_SOFT_CAP = 20;

/** Max YouTube pinned creators refreshed in one cron tick (oldest-stale first). */
export const YOUTUBE_PIN_REFRESH_MAX_PER_RUN = 12;

/** Sort games by DEFAULT_GAME_SLUGS order (unknown slugs last, A–Z). */
export function sortByDefaultGameOrder<T extends { slug: string; title?: string }>(
  games: T[]
): T[] {
  const rank = new Map((DEFAULT_GAME_SLUGS as readonly string[]).map((s, i) => [s, i]));
  return [...games].sort((a, b) => {
    const ra = rank.has(a.slug) ? (rank.get(a.slug) as number) : 999;
    const rb = rank.has(b.slug) ? (rank.get(b.slug) as number) : 999;
    if (ra !== rb) return ra - rb;
    return String(a.title || a.slug).localeCompare(String(b.title || b.slug));
  });
}

/** All Twitch category ids to batch in one /helix/streams request. */
export function twitchGameIdBatch(): string[] {
  const ids = new Set<string>();
  for (const g of DEFAULT_GAMES) {
    ids.add(g.twitch_game_id);
    for (const extra of g.twitch_game_ids || []) ids.add(extra);
  }
  return [...ids];
}

export function gameFromTwitchId(twitchGameId: string): DefaultGameDef | null {
  for (const g of DEFAULT_GAMES) {
    if (g.twitch_game_id === twitchGameId) return g;
    if (g.twitch_game_ids?.includes(twitchGameId)) return g;
  }
  return null;
}

export function classifyYoutubeLiveItem(title: string, description = ""): DefaultGameDef | null {
  const hay = `${title} ${description}`.toLowerCase();
  let best: DefaultGameDef | null = null;
  let bestScore = 0;
  for (const game of DEFAULT_GAMES) {
    let score = 0;
    for (const kw of game.classifyKeywords) {
      if (hay.includes(kw.toLowerCase())) score += kw.length;
    }
    // Light boost for exact youtube_query / title tokens
    if (hay.includes(game.youtube_query.toLowerCase())) score += game.youtube_query.length;
    if (hay.includes(game.title.toLowerCase())) score += Math.min(game.title.length, 8);
    if (score > bestScore) {
      bestScore = score;
      best = game;
    }
  }
  return bestScore > 0 ? best : null;
}
