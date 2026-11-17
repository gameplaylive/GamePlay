/** Parse @handles and YouTube / Twitch URLs from favorite search input. */

export function normalizeSearchQuery(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

export function extractYoutubeHandleOrId(input: string): {
  handle?: string;
  channelId?: string;
  url?: boolean;
} {
  const q = input.trim();

  // UC… channel id
  if (/^UC[\w-]{20,}$/i.test(q)) return { channelId: q };

  // @handle
  const at = q.match(/^@([\w.-]+)$/);
  if (at) return { handle: at[1] };

  try {
    const url = new URL(q.startsWith("http") ? q : `https://${q}`);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname)) return {};

    const handlePath = url.pathname.match(/^\/@([\w.-]+)/);
    if (handlePath) return { handle: handlePath[1], url: true };

    const channelPath = url.pathname.match(/^\/channel\/(UC[\w-]+)/i);
    if (channelPath) return { channelId: channelPath[1], url: true };

    const cPath = url.pathname.match(/^\/c\/([\w.-]+)/);
    if (cPath) return { handle: cPath[1], url: true };

    const userPath = url.pathname.match(/^\/user\/([\w.-]+)/);
    if (userPath) return { handle: userPath[1], url: true };
  } catch {
    // not a URL
  }

  return {};
}

export function aliasTokens(q: string): string[] {
  const base = normalizeSearchQuery(q).toLowerCase();
  const tokens = new Set<string>([base, base.replace(/^@/, "")]);
  const parsed = extractYoutubeHandleOrId(q);
  if (parsed.handle) tokens.add(parsed.handle.toLowerCase());
  if (parsed.channelId) tokens.add(parsed.channelId.toLowerCase());
  return [...tokens].filter(Boolean);
}
