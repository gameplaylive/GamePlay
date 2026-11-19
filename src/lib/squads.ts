/** Squad Finder — games, modes, validation (no PII / contact spam). */

export const SQUAD_GAMES = [
  "BGMI",
  "Free Fire",
  "Valorant",
  "CS2",
  "Fortnite",
  "GTA V",
  "Call of Duty",
  "Minecraft",
  "Roblox",
  "Dota 2",
] as const;

export const SQUAD_MODES = [
  "Duo",
  "Full Squad",
  "Ranked Push",
  "Chill / Casual",
  "Custom Room",
] as const;

/** Paywall removed — kept for API shape compatibility; no longer enforced. */
export const FREE_SQUAD_POSTS_PER_DAY = 999;
export const SQUAD_NOTE_MAX = 120;
export const SQUAD_ID_MAX = 48;

export type SquadGame = (typeof SQUAD_GAMES)[number];
export type SquadMode = (typeof SQUAD_MODES)[number];

export interface SquadPost {
  id: string;
  user_id: string;
  creator_name: string;
  is_pro: boolean;
  game: string;
  mode: string;
  mic_required: boolean;
  in_game_id: string;
  note: string;
  expires_at: string;
  created_at: string;
}

const CONTACT_BLOCK =
  /(@|https?:\/\/|www\.|whatsapp|wa\.me|telegram|t\.me|discord\.gg|discord\.com\/invite|mailto:|\+91[\s-]?\d|\b\d{10,}\b)/i;

export function looksLikeContactInfo(value: string): boolean {
  return CONTACT_BLOCK.test(value.trim());
}

export function sanitizeSquadText(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function validateSquadPayload(input: {
  game?: string;
  mode?: string;
  in_game_id?: string;
  note?: string;
  mic_required?: boolean;
}): { ok: true; data: { game: string; mode: string; in_game_id: string; note: string; mic_required: boolean } } | { ok: false; error: string } {
  const game = sanitizeSquadText(input.game || "", 40);
  const mode = sanitizeSquadText(input.mode || "", 40);
  const in_game_id = sanitizeSquadText(input.in_game_id || "", SQUAD_ID_MAX);
  const note = sanitizeSquadText(input.note || "", SQUAD_NOTE_MAX);

  if (!SQUAD_GAMES.includes(game as SquadGame)) {
    return { ok: false, error: "Pick a supported game." };
  }
  if (!SQUAD_MODES.includes(mode as SquadMode)) {
    return { ok: false, error: "Pick a valid squad mode." };
  }
  if (in_game_id.length < 2) {
    return { ok: false, error: "Enter your in-game ID / IGN / room code." };
  }
  if (looksLikeContactInfo(in_game_id) || looksLikeContactInfo(note)) {
    return {
      ok: false,
      error: "For safety, don’t post emails, phone numbers, WhatsApp, Telegram, or Discord links — use in-game ID / room code only.",
    };
  }

  return {
    ok: true,
    data: {
      game,
      mode,
      in_game_id,
      note,
      mic_required: input.mic_required !== false,
    },
  };
}

export function formatExpiresIn(expiresAt: string, nowMs = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - nowMs;
  if (ms <= 0) return "Expired";
  const totalMins = Math.floor(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours <= 0) return `Expires in ${mins}m`;
  return `Expires in ${hours}h ${mins}m`;
}

export const FREE_LIMIT_MESSAGE =
  "Could not create squad post. Please try again.";
