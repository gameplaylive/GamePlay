"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { watchHrefForCommunity } from "@/lib/go-live";
import type { CommunityLiveStream } from "@/lib/types";

export function CommunityCreatorsRow() {
  const [streams, setStreams] = useState<CommunityLiveStream[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/streams/community");
        const data = await res.json();
        if (!cancelled && Array.isArray(data.streams)) {
          setStreams(data.streams.filter((s: CommunityLiveStream) => s.is_live));
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!streams.length) return null;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2 className="font-display text-base font-bold text-white sm:text-lg">
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-crimson align-middle" />
          Live Gameplay Live Creators
        </h2>
        <Link href="/go-live" className="text-[11px] font-bold text-cyan">
          Go Live →
        </Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
        {streams.map((s) => {
          const href = watchHrefForCommunity(s);
          const thumb = s.youtube_video_id
            ? `https://i.ytimg.com/vi/${s.youtube_video_id}/hqdefault.jpg`
            : "/icons/icon-512.png";
          const sourceBadge = s.source === "pc" ? "PC" : s.source === "mobile" ? "PHONE" : null;
          const card = (
            <div className="relative w-[148px] shrink-0 overflow-hidden rounded-2xl border border-crimson/25 bg-[#0c101a] sm:w-[168px]">
              <div className="relative aspect-[16/10]">
                <Image src={thumb} alt={s.stream_title} fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07090f] via-transparent to-transparent" />
                <span className="live-pulse absolute left-1.5 top-1.5 rounded-md bg-crimson px-1.5 py-0.5 text-[9px] font-black text-white">
                  LIVE
                </span>
                <span className="absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white/90">
                  {s.game}
                </span>
                {sourceBadge && (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-cyan/90 px-1 py-0.5 text-[8px] font-black text-obsidian">
                    {sourceBadge}
                  </span>
                )}
              </div>
              <div className="space-y-0.5 p-2">
                <p className="truncate text-[11px] font-bold text-white">{s.creator_name}</p>
                <p className="line-clamp-2 text-[10px] leading-snug text-white/55">{s.stream_title}</p>
              </div>
            </div>
          );
          return href ? (
            <Link key={s.id} href={href} className="shrink-0">
              {card}
            </Link>
          ) : (
            <div key={s.id} className="shrink-0 opacity-80">
              {card}
            </div>
          );
        })}
      </div>
    </section>
  );
}
