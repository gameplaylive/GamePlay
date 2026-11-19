"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Heart, HeartOff, Radio, ExternalLink, RefreshCw } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import type { CreatorRecentVideo, FavoriteGamerStatus, UserFavorite } from "@/lib/types";
import { formatViewers } from "@/lib/utils";

interface Props {
  favoriteId: string;
}

function liveWatchHref(f: FavoriteGamerStatus) {
  if (!f.is_live || !f.live_external_id) return null;
  return `/watch/fav-${f.platform}-${encodeURIComponent(f.channel_id_or_username)}?platform=${f.platform}&external=${encodeURIComponent(f.live_external_id)}&type=live&title=${encodeURIComponent(f.live_title || f.channel_name)}&streamer=${encodeURIComponent(f.channel_name)}`;
}

function videoWatchHref(f: FavoriteGamerStatus, video: CreatorRecentVideo) {
  return `/watch/fav-${f.platform}-vod-${encodeURIComponent(video.id)}?platform=${f.platform}&external=${encodeURIComponent(video.id)}&type=video&title=${encodeURIComponent(video.title || f.channel_name)}&streamer=${encodeURIComponent(f.channel_name)}`;
}

export function GamerProfileClient({ favoriteId }: Props) {
  const { profile, favorites, setFavorites, signInWithGoogle, demoMode } = useApp();
  const [gamer, setGamer] = useState<FavoriteGamerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isFollowing = favorites.some((f) => f.id === favoriteId);

  const applyStatus = useCallback((base: UserFavorite, status?: Partial<FavoriteGamerStatus> | null) => {
    const merged: FavoriteGamerStatus = {
      ...base,
      is_live: false,
      recent_videos: [],
      ...status,
    };
    if (!merged.recent_videos?.length && merged.latest_video_id) {
      merged.recent_videos = [
        {
          id: merged.latest_video_id,
          title: merged.latest_video_title || "Recent video",
          thumbnail: merged.latest_video_thumbnail || "",
        },
      ];
    }
    setGamer(merged);
  }, []);

  const refreshVideos = useCallback(
    async (base: UserFavorite, force = false) => {
      setRefreshing(true);
      try {
        const res = await fetch("/api/favorites/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: base.platform,
            channel_id_or_username: base.channel_id_or_username,
            force,
          }),
        });
        const data = await res.json();
        if (res.ok && data.status) {
          applyStatus(base, data.status as Partial<FavoriteGamerStatus>);
        }
      } catch {
        /* keep cached */
      } finally {
        setRefreshing(false);
      }
    },
    [applyStatus]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let fav = favorites.find((f) => f.id === favoriteId) || null;

      if (!fav) {
        const listRes = await fetch("/api/favorites");
        const listData = await listRes.json().catch(() => ({}));
        fav =
          ((listData.favorites || []) as UserFavorite[]).find((f) => f.id === favoriteId) || null;
      }

      if (!fav && demoMode) {
        fav = {
          id: favoriteId,
          user_id: "demo",
          channel_name: "Demo Gamer",
          platform: "youtube",
          channel_id_or_username: favoriteId,
          avatar_url: "/icons/icon-512.png",
          created_at: new Date().toISOString(),
        };
      }

      if (!fav) {
        setError("Gamer not found. Add them from My Gamers first.");
        setGamer(null);
        return;
      }

      const statusRes = await fetch("/api/favorites/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: [fav] }),
      });
      const statusData = await statusRes.json();
      const cached = (statusData.statuses?.[0] as FavoriteGamerStatus) || {
        ...fav,
        is_live: false,
        recent_videos: [],
      };
      applyStatus(fav, cached);

      // Pull fresh recent uploads if cache empty/stale (same ~20m window as feed sync)
      const needsRefresh =
        !cached.recent_videos?.length && !cached.latest_video_id
          ? true
          : !cached.last_checked_at;

      if (needsRefresh || !cached.recent_videos?.length) {
        void refreshVideos(fav, !cached.recent_videos?.length && !cached.latest_video_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load gamer");
    } finally {
      setLoading(false);
    }
  }, [favoriteId, favorites, demoMode, applyStatus, refreshVideos]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!profile) {
      await signInWithGoogle(`/gamer/${favoriteId}`);
      return;
    }
    if (!gamer) return;
    setBusy(true);
    try {
      if (isFollowing) {
        const res = await fetch("/api/favorites", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: gamer.id }),
        });
        if (!res.ok && !demoMode) throw new Error("Could not unfollow");
        setFavorites(favorites.filter((f) => f.id !== gamer.id));
      } else {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: gamer.platform,
            channel_name: gamer.channel_name,
            channel_id_or_username: gamer.channel_id_or_username,
            avatar_url: gamer.avatar_url,
          }),
        });
        const data = await res.json();
        if (!res.ok && !demoMode) throw new Error(data.error || "Could not follow");
        if (data.favorite) {
          setFavorites([data.favorite as UserFavorite, ...favorites]);
          void refreshVideos(data.favorite as UserFavorite, true);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Follow update failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted">Loading gamer…</div>;
  }

  if (!gamer) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12 text-center">
        <p className="text-sm text-crimson">{error || "Gamer not found"}</p>
        <Link href="/?tab=favorites" className="text-sm font-bold text-cyan">
          ← Back to My Gamers
        </Link>
      </div>
    );
  }

  const liveHref = liveWatchHref(gamer);
  const videos = gamer.recent_videos?.length
    ? gamer.recent_videos
    : gamer.latest_video_id
      ? [
          {
            id: gamer.latest_video_id,
            title: gamer.latest_video_title || "Recent video",
            thumbnail: gamer.latest_video_thumbnail || "",
          },
        ]
      : [];
  const hero =
    gamer.live_thumbnail ||
    videos[0]?.thumbnail ||
    gamer.latest_video_thumbnail ||
    gamer.avatar_url ||
    "/icons/icon-512.png";

  return (
    <div className="mx-auto max-w-lg space-y-4 px-3 pb-24 pt-4 md:px-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/?tab=favorites"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-white"
        >
          <ArrowLeft size={14} /> My Gamers
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refreshVideos(gamer, true)}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1.5 text-[11px] font-bold text-muted hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleFollow()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            {isFollowing ? (
              <>
                <HeartOff size={13} className="text-crimson" /> Unfollow
              </>
            ) : (
              <>
                <Heart size={13} className="text-crimson" /> Follow
              </>
            )}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c101a]">
        <div className="relative aspect-[16/9] bg-black/40">
          <Image src={hero} alt={gamer.channel_name} fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090f] via-transparent to-transparent" />
          {gamer.is_live && (
            <span className="live-pulse absolute left-3 top-3 rounded-md bg-crimson px-2 py-1 text-[10px] font-black text-white">
              LIVE
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
            <Image
              src={gamer.avatar_url || "/icons/icon-192.png"}
              alt=""
              width={52}
              height={52}
              className="rounded-full border-2 border-white/20"
              unoptimized
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan">{gamer.platform}</p>
              <h1 className="truncate font-display text-2xl font-bold text-white">{gamer.channel_name}</h1>
            </div>
          </div>
        </div>
      </div>

      {gamer.is_live && liveHref ? (
        <Link
          href={liveHref}
          className="flex items-center gap-3 rounded-2xl border border-crimson/35 bg-crimson/10 p-3 transition hover:bg-crimson/15"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-crimson/20 text-crimson">
            <Radio size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-crimson">Live now</p>
            <p className="truncate text-sm font-semibold text-white">{gamer.live_title || "Streaming live"}</p>
            <p className="text-[10px] text-muted">{formatViewers(gamer.live_viewer_count || 0)} watching</p>
          </div>
          <ExternalLink size={14} className="shrink-0 text-muted" />
        </Link>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-[12px] text-muted">
          Not live right now — browse their recent videos below.
        </div>
      )}

      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold">Recent videos</h2>
          {refreshing && <span className="text-[10px] text-muted">Updating from {gamer.platform}…</span>}
        </div>

        {videos.length > 0 ? (
          <div className="space-y-2">
            {videos.map((v) => (
              <Link
                key={v.id}
                href={videoWatchHref(gamer, v)}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-cyan/35"
              >
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-black/40">
                  <Image
                    src={v.thumbnail || gamer.avatar_url || "/icons/icon-512.png"}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cyan">
                    {gamer.platform === "twitch" ? "VOD" : "Upload"}
                  </p>
                  <p className="line-clamp-2 text-sm font-semibold text-white">{v.title}</p>
                </div>
                <ExternalLink size={14} className="shrink-0 text-muted" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-3 py-6 text-center text-[11px] text-muted">
            {refreshing
              ? "Fetching recent videos…"
              : "No recent videos cached yet. Tap Refresh, or wait for the next sync (~10–20 min)."}
          </div>
        )}
      </section>

      {error && <p className="text-sm text-crimson">{error}</p>}
    </div>
  );
}
