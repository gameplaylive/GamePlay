/** Squad Finder — games, modes, membership, validation (no PII / contact spam). */

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
  "Euro Truck Simulator 2",
] as const;

/** Aliases accepted on create/filter → canonical SQUAD_GAMES title */
export const SQUAD_GAME_ALIASES: Record<string, (typeof SQUAD_GAMES)[number]> = {
  ets2: "Euro Truck Simulator 2",
  "ets 2": "Euro Truck Simulator 2",
  "euro truck": "Euro Truck Simulator 2",
  "euro truck simulator": "Euro Truck Simulator 2",
  "euro truck simulator 2": "Euro Truck Simulator 2",
};

export const SQUAD_MODES = [
  "Duo",
  "Full Squad",
  "Ranked Push",
  "Chill / Casual",
  "Custom Room",
  "Convoy / VTC",
] as const;

export const SQUAD_NOTE_MAX = 120;
export const SQUAD_ID_MAX = 48;

export type SquadGame = (typeof SQUAD_GAMES)[number];
export type SquadMode = (typeof SQUAD_MODES)[number];

export interface SquadPost {
  id: string;
  user_id: string;
  creator_name: string;
  game: string;
  mode: string;
  mic_required: boolean;
  /** Host UID — only present for host / joined members */
  in_game_id: string | null;
  note: string;
  expires_at: string;
  created_at: string;
  max_slots: number;
  slots_filled: number;
  joined_user_ids: string[];
  is_full: boolean;
  i_joined: boolean;
  can_see_uid: boolean;
}

export function maxSlotsForMode(mode: string): number {
  if (mode === "Duo") return 2;
  if (mode === "Custom Room") return 5;
  if (mode === "Convoy / VTC") return 8;
  return 4;
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
}):
  | {
      ok: true;
      data: { game: string; mode: string; in_game_id: string; note: string; mic_required: boolean };
    }
  | { ok: false; error: string } {
  const rawGame = sanitizeSquadText(input.game || "", 40);
  const aliasKey = rawGame.toLowerCase();
  const game =
    SQUAD_GAME_ALIASES[aliasKey] ||
    (SQUAD_GAMES.includes(rawGame as SquadGame) ? rawGame : "");
  const mode = sanitizeSquadText(input.mode || "", 40);
  const in_game_id = sanitizeSquadText(input.in_game_id || "", SQUAD_ID_MAX);
  const note = sanitizeSquadText(input.note || "", SQUAD_NOTE_MAX);

  if (!game || !SQUAD_GAMES.includes(game as SquadGame)) {
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
      error:
        "For safety, don’t post emails, phone numbers, WhatsApp, Telegram, or Discord links — use in-game ID / room code only.",
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

export function shapeSquadPost(
  row: Record<string, unknown>,
  viewerId: string | null
): SquadPost {
  const hostId = String(row.user_id || "");
  const joined = Array.isArray(row.joined_user_ids)
    ? (row.joined_user_ids as string[]).map(String)
    : [];
  const maxSlots = Number(row.max_slots || maxSlotsForMode(String(row.mode || "")));
  const slotsFilled = Number(row.slots_filled || 1 + joined.length);
  const isHost = Boolean(viewerId && viewerId === hostId);
  const iJoined = Boolean(viewerId && joined.includes(viewerId));
  const canSee = isHost || iJoined;
  const rawUid = String(row.in_game_id || "");

  return {
    id: String(row.id),
    user_id: hostId,
    creator_name: String(row.creator_name || "Player"),
    game: String(row.game || ""),
    mode: String(row.mode || ""),
    mic_required: row.mic_required !== false,
    in_game_id: canSee ? rawUid : null,
    note: String(row.note || ""),
    expires_at: String(row.expires_at || ""),
    created_at: String(row.created_at || ""),
    max_slots: maxSlots,
    slots_filled: slotsFilled,
    joined_user_ids: joined,
    is_full: slotsFilled >= maxSlots,
    i_joined: iJoined,
    can_see_uid: canSee,
  };
}
