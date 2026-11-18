"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Radio, X } from "lucide-react";
import type { FavoriteGamerStatus } from "@/lib/types";
import { formatViewers } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProviders";

interface Props {
  gamer: FavoriteGamerStatus | null;
  onClose: () => void;
}

function watchHref(f: FavoriteGamerStatus, kind: "live" | "latest") {
  if (kind === "live" && f.is_live && f.live_external_id) {
    return `/watch/fav-${f.platform}-${encodeURIComponent(f.channel_id_or_username)}?platform=${f.platform}&external=${encodeURIComponent(f.live_external_id)}&type=live&title=${encodeURIComponent(f.live_title || f.channel_name)}&streamer=${encodeURIComponent(f.channel_name)}`;
  }
  if (kind === "latest" && f.latest_video_id) {
    const type = f.platform === "twitch" ? "video" : "video";
    return `/watch/fav-${f.platform}-vod-${encodeURIComponent(f.latest_video_id)}?platform=${f.platform}&external=${encodeURIComponent(f.latest_video_id)}&type=${type}&title=${encodeURIComponent(f.latest_video_title || f.channel_name)}&streamer=${encodeURIComponent(f.channel_name)}`;
  }
  return null;
}

/**
 * Cache-only creator sheet (tracked_creators via favorites/status).
 * No YouTube/Twitch API calls when opening.
 */
export function FavoriteGamerSheet({ gamer, onClose }: Props) {
  const { profile, signInWithGoogle } = useApp();
  if (!gamer) return null;

  const liveHref = watchHref(gamer, "live");
  const latestHref = watchHref(gamer, "latest");
  const hero =
    gamer.live_thumbnail ||
    gamer.latest_video_thumbnail ||
    gamer.avatar_url ||
    "/icons/icon-512.png";

  function gate(e: React.MouseEvent, path: string) {
    if (!profile) {
      e.preventDefault();
      void signInWithGoogle(path);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gamer-sheet-title"
    >
      <div
        className="glass glow-border max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/9] bg-black/50">
          <Image src={hero} alt={gamer.channel_name} fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090f] via-black/20 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/50 p-2 text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          {gamer.is_live && (
            <span className="live-pulse absolute left-3 top-3 rounded-md bg-crimson px-2 py-1 text-[10px] font-black text-white">
              LIVE
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan">
              {gamer.platform}
            </p>
            <h2 id="gamer-sheet-title" className="font-display text-2xl font-bold text-white">
              {gamer.channel_name}
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              From cached creator status · refreshed by server cron (no extra API quota on open)
            </p>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {gamer.is_live && liveHref ? (
            <Link
              href={liveHref}
              onClick={(e) => gate(e, liveHref)}
              className="flex items-center gap-3 rounded-2xl border border-crimson/35 bg-crimson/10 p-3 transition hover:bg-crimson/15"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-crimson/20 text-crimson">
                <Radio size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-crimson">Live now</p>
                <p className="truncate text-sm font-semibold text-white">
                  {gamer.live_title || "Streaming live"}
                </p>
                <p className="text-[10px] text-muted">
                  {formatViewers(gamer.live_viewer_count || 0)} watching
                </p>
              </div>
              <ExternalLink size={14} className="shrink-0 text-muted" />
            </Link>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-[12px] text-muted">
              Not live right now — check their latest cached upload below.
            </div>
          )}

          {latestHref ? (
            <Link
              href={latestHref}
              onClick={(e) => gate(e, latestHref)}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-cyan/35"
            >
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-black/40">
                <Image
                  src={gamer.latest_video_thumbnail || gamer.avatar_url || "/icons/icon-512.png"}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-cyan">
                  Latest upload
                </p>
                <p className="line-clamp-2 text-sm font-semibold text-white">
                  {gamer.latest_video_title || "Recent video"}
                </p>
              </div>
              <ExternalLink size={14} className="shrink-0 text-muted" />
            </Link>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-muted">
              No cached video yet — next server refresh will fill this in.
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-white/10 py-2.5 text-sm font-semibold text-muted hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
