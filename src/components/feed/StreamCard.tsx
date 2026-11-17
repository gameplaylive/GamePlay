"use client";

import Image from "next/image";
import Link from "next/link";
import { Share2 } from "lucide-react";
import { useState } from "react";
import type { CachedStream } from "@/lib/types";
import { formatViewers, timeAgo } from "@/lib/utils";
import { ShareModal, shareContent } from "@/components/ShareModal";
import { useApp } from "@/components/providers/AppProviders";

export function StreamCard({ stream }: { stream: CachedStream }) {
  const { profile, loading, signInWithGoogle } = useApp();
  const [shareOpen, setShareOpen] = useState(false);
  const isLive =
    stream.content_type === "live" ||
    (stream.content_type === "trending" && stream.platform === "twitch" && stream.viewer_count > 0);
  const path = `/watch/${stream.id}`;
  const watchUrl =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  async function onShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const shared = await shareContent(watchUrl, stream.title);
    if (!shared) setShareOpen(true);
  }

  function onWatchClick(e: React.MouseEvent) {
    if (loading) {
      e.preventDefault();
      return;
    }
    if (!profile) {
      e.preventDefault();
      void signInWithGoogle(path);
    }
  }

  return (
    <>
      <Link
        href={path}
        onClick={onWatchClick}
        className="group relative block overflow-hidden rounded-2xl border border-white/5 bg-[#0c101a] shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-cyan/35 hover:shadow-[0_16px_40px_rgba(0,240,255,0.12)] animate-in"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          <Image
            src={stream.thumbnail_url || "/icons/icon-512.png"}
            alt={stream.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.06]"
            sizes="(max-width:768px) 50vw, 33vw"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090f] via-[#07090f]/25 to-transparent" />

          <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
            {isLive ? (
              <span className="live-pulse rounded-md bg-crimson px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white">
                LIVE
              </span>
            ) : (
              <span className="rounded-md bg-purple/95 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white">
                {stream.content_type === "trending" ? "HOT" : "NEW"}
              </span>
            )}
          </div>

          <span className="absolute right-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-sm">
            {stream.platform}
          </span>

          <div className="absolute inset-x-0 bottom-0 space-y-1 p-2">
            <div className="flex items-center justify-between gap-1">
              <span className="max-w-[65%] truncate rounded-md bg-cyan/15 px-1.5 py-0.5 text-[8px] font-semibold text-cyan backdrop-blur-sm">
                {stream.game_title}
              </span>
              <span className="shrink-0 rounded-md bg-black/55 px-1.5 py-0.5 text-[8px] font-semibold text-white/90 backdrop-blur-sm">
                {isLive ? formatViewers(stream.viewer_count) : timeAgo(stream.published_at)}
              </span>
            </div>
            <h3 className="line-clamp-2 font-display text-[12px] font-bold leading-tight text-white sm:text-[13px]">
              {stream.title}
            </h3>
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-[10px] text-white/55">{stream.streamer_name}</p>
              <button
                onClick={onShare}
                className="rounded-full bg-white/10 p-1 text-white/70 transition hover:bg-cyan/20 hover:text-cyan"
                aria-label="Share"
              >
                <Share2 size={11} />
              </button>
            </div>
          </div>
        </div>
      </Link>
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} url={watchUrl} title={stream.title} />
    </>
  );
}
