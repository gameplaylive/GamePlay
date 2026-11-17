import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import { twitchFetch } from "@/lib/twitch";
import { youtubeFetch } from "@/lib/youtube";
import { aliasTokens, extractYoutubeHandleOrId, normalizeSearchQuery } from "@/lib/creator-parse";
import { canSpendSearchList, recordLightUnits, recordSearchListCall } from "@/lib/youtube-quota";
import type { CreatorSearchResult } from "@/lib/types";

function mapTracked(row: {
  platform: string;
  channel_name: string;
  channel_id: string;
  channel_login?: string;
  avatar_url?: string;
  is_live?: boolean;
}): CreatorSearchResult {
  return {
    platform: row.platform as "youtube" | "twitch",
    channel_name: row.channel_name,
    channel_id_or_username:
      row.platform === "twitch" ? row.channel_login || row.channel_id : row.channel_id,
    avatar_url: row.avatar_url || "",
    is_live: Boolean(row.is_live),
  };
}

async function upsertTracked(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  row: {
    platform: "youtube" | "twitch";
    channel_id: string;
    channel_login?: string;
    channel_name: string;
    avatar_url?: string;
    uploads_playlist_id?: string | null;
    aliases: string[];
    cacheHours?: number;
  }
) {
  const until = new Date(Date.now() + (row.cacheHours ?? 24) * 3600_000).toISOString();
  const { data: existing } = await service
    .from("tracked_creators")
    .select("id, search_aliases")
    .eq("platform", row.platform)
    .eq("channel_id", row.channel_id)
    .maybeSingle();

  const aliases = Array.from(
    new Set([...(existing?.search_aliases || []), ...row.aliases].map((a) => a.toLowerCase()))
  );

  if (existing) {
    await service
      .from("tracked_creators")
      .update({
        channel_name: row.channel_name,
        channel_login: row.channel_login || "",
        avatar_url: row.avatar_url || "",
        uploads_playlist_id: row.uploads_playlist_id ?? undefined,
        search_aliases: aliases,
        search_cached_until: until,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await service.from("tracked_creators").insert({
      platform: row.platform,
      channel_id: row.channel_id,
      channel_login: row.channel_login || "",
      channel_name: row.channel_name,
      avatar_url: row.avatar_url || "",
      uploads_playlist_id: row.uploads_playlist_id || null,
      search_aliases: aliases,
      search_cached_until: until,
    });
  }
}

export async function GET(request: Request) {
  const q = normalizeSearchQuery(new URL(request.url).searchParams.get("q") || "");
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });

  const settings = await getAppSettingsFull();
  const service = createServiceClient();
  const results: CreatorSearchResult[] = [];
  const aliases = aliasTokens(q);
  let youtubeSource: "cache" | "handle" | "search" | "none" = "none";
  let quota: { used: number; cap: number } | undefined;

  // ── Twitch (free, parallel) ─────────────────────────────────────────────
  const twitchPromise = (async () => {
    const out: CreatorSearchResult[] = [];
    if (!settings.twitch_client_id || !settings.twitch_client_secret) return out;

    try {
      const data = await twitchFetch(
        `/search/channels?query=${encodeURIComponent(q)}&first=8`,
        settings.twitch_client_id,
        settings.twitch_client_secret
      );
      for (const c of data.data || []) {
        const item: CreatorSearchResult = {
          platform: "twitch",
          channel_name: c.display_name || c.broadcaster_login,
          channel_id_or_username: c.broadcaster_login,
          avatar_url: c.thumbnail_url || "",
          is_live: Boolean(c.is_live),
        };
        out.push(item);
        if (service) {
          await upsertTracked(service, {
            platform: "twitch",
            channel_id: String(c.id || c.broadcaster_login),
            channel_login: c.broadcaster_login,
            channel_name: item.channel_name,
            avatar_url: item.avatar_url,
            aliases: [...aliases, String(c.broadcaster_login).toLowerCase()],
          });
        }
      }
    } catch (e) {
      console.error("twitch search", e);
    }

    // de-dupe
    const seen = new Set<string>();
    return out.filter((r) => {
      const k = `${r.platform}:${r.channel_id_or_username}`.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  })();

  // ── YouTube quota-safe order ─────────────────────────────────────────────
  const youtubePromise = (async () => {
    const out: CreatorSearchResult[] = [];
    if (!settings.youtube_api_key) return { results: out, source: "none" as const, quota };

    // 1) Shared directory / 24h cache (0 units)
    if (service) {
      const { data: cached } = await service
        .from("tracked_creators")
        .select("*")
        .eq("platform", "youtube")
        .gt("search_cached_until", new Date().toISOString())
        .limit(40);

      const matched = (cached || []).filter((row) => {
        const hay = [
          row.channel_name,
          row.channel_login,
          row.channel_id,
          ...(row.search_aliases || []),
        ]
          .join(" ")
          .toLowerCase();
        return aliases.some((a) => hay.includes(a));
      });

      if (matched.length) {
        youtubeSource = "cache";
        return { results: matched.map(mapTracked), source: youtubeSource, quota };
      }

      // Also match aliases without requiring unexpired cache (still 0 units)
      for (const a of aliases) {
        const { data } = await service
          .from("tracked_creators")
          .select("*")
          .eq("platform", "youtube")
          .contains("search_aliases", [a])
          .limit(8);
        for (const row of data || []) out.push(mapTracked(row));
      }
      if (out.length) {
        youtubeSource = "cache";
        return { results: out, source: youtubeSource, quota };
      }
    }

    const parsed = extractYoutubeHandleOrId(q);

    // 2) @handle or channel URL → channels.list (1 unit)
    if (parsed.handle || parsed.channelId) {
      try {
        const path = parsed.channelId
          ? `/channels?part=snippet,contentDetails&id=${encodeURIComponent(parsed.channelId)}`
          : `/channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(parsed.handle!)}`;
        const data = await youtubeFetch(path, settings.youtube_api_key);
        await recordLightUnits(1);
        for (const item of data.items || []) {
          const channelId = item.id as string;
          const uploads = item.contentDetails?.relatedPlaylists?.uploads || null;
          const result: CreatorSearchResult = {
            platform: "youtube",
            channel_name: item.snippet?.title || parsed.handle || channelId,
            channel_id_or_username: channelId,
            avatar_url:
              item.snippet?.thumbnails?.default?.url ||
              item.snippet?.thumbnails?.medium?.url ||
              "",
          };
          out.push(result);
          if (service) {
            await upsertTracked(service, {
              platform: "youtube",
              channel_id: channelId,
              channel_login: parsed.handle || "",
              channel_name: result.channel_name,
              avatar_url: result.avatar_url,
              uploads_playlist_id: uploads,
              aliases: [...aliases, channelId.toLowerCase()],
            });
          }
        }
        if (out.length) {
          youtubeSource = "handle";
          return { results: out, source: youtubeSource, quota };
        }
      } catch (e) {
        console.error("youtube forHandle", e);
      }
    }

    // 3) search.list type=channel — only if under soft cap
    const spend = await canSpendSearchList();
    quota = { used: spend.used, cap: spend.cap };
    if (!spend.ok) {
      return {
        results: out,
        source: "none" as const,
        quota,
        warning: `YouTube search budget reached (${spend.used}/${spend.cap}). Try @handle or a channel URL.`,
      };
    }

    try {
      const data = await youtubeFetch(
        `/search?part=snippet&type=channel&maxResults=8&q=${encodeURIComponent(q)}`,
        settings.youtube_api_key
      );
      await recordSearchListCall(1);
      youtubeSource = "search";

      for (const item of data.items || []) {
        const channelId = item.snippet?.channelId || item.id?.channelId;
        if (!channelId) continue;
        const result: CreatorSearchResult = {
          platform: "youtube",
          channel_name: item.snippet?.channelTitle || item.snippet?.title,
          channel_id_or_username: channelId,
          avatar_url: item.snippet?.thumbnails?.default?.url || "",
        };
        out.push(result);
        if (service) {
          // Resolve uploads playlist lazily on pin; cache search hit for 24h
          await upsertTracked(service, {
            platform: "youtube",
            channel_id: channelId,
            channel_name: result.channel_name,
            avatar_url: result.avatar_url,
            aliases: [...aliases, channelId.toLowerCase(), result.channel_name.toLowerCase()],
          });
        }
      }
    } catch (e) {
      console.error("youtube channel search", e);
    }

    return { results: out, source: youtubeSource, quota };
  })();

  const [twitchResults, yt] = await Promise.all([twitchPromise, youtubePromise]);
  results.push(...yt.results, ...twitchResults);

  // Stable order: YouTube first (India-first), then Twitch — side by side badges in UI
  results.sort((a, b) => {
    if (a.platform === b.platform) return a.channel_name.localeCompare(b.channel_name);
    return a.platform === "youtube" ? -1 : 1;
  });

  if (!results.length) {
    return NextResponse.json({
      results: [],
      youtube_source: yt.source,
      quota: yt.quota,
      warning: "warning" in yt ? yt.warning : undefined,
      error:
        "No creators found. Try another name, @handle, or YouTube/Twitch URL.",
    });
  }

  return NextResponse.json({
    results,
    youtube_source: yt.source,
    quota: yt.quota,
    warning: "warning" in yt ? yt.warning : undefined,
  });
}
