/** Top 10 default games — homepage discovery uses one YouTube search.list / 20 min. */

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

export const DEFAULT_GAME_SLUGS = [
  "bgmi",
  "free-fire",
  "valorant",
  "gta-v",
  "minecraft",
  "roblox",
  "cs2",
  "dota-2",
  "fortnite",
  "call-of-duty",
] as const;

export type DefaultGameSlug = (typeof DEFAULT_GAME_SLUGS)[number];

export const DEFAULT_GAMES: DefaultGameDef[] = [
  {
    id: "11111111-1111-1111-1111-111111111103",
    title: "BGMI",
    slug: "bgmi",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/587342_IGDB-285x380.jpg",
    twitch_game_id: "587342",
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
    id: "11111111-1111-1111-1111-111111111101",
    title: "GTA V",
    slug: "gta-v",
    cover_image: "https://static-cdn.jtvnw.net/ttv-boxart/32982_IGDB-285x380.jpg",
    twitch_game_id: "32982",
    youtube_query: "GTA V",
    classifyKeywords: ["gta v", "gta 5", "gta5", "gtav", "nopixel", "roleplay gta"],
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
];

/** Single YouTube search.list query covering all 10 titles (OR). Still 1 call / 20 min. */
export const YOUTUBE_LIVE_BROAD_QUERY =
  'BGMI|"Free Fire"|Valorant|"GTA V"|Minecraft|Roblox|CS2|"Dota 2"|Fortnite|"Call of Duty"|Warzone|CODM';

export const FAVORITE_LIMITS = {
  free: 5,
  pro: 15,
} as const;

/** Soft cap on YouTube search.list calls for channel discovery (live sync uses ~72/day). */
export const YOUTUBE_SEARCH_SOFT_CAP = 95;

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
    if (score > bestScore) {
      bestScore = score;
      best = game;
    }
  }
  return bestScore > 0 ? best : null;
}
