"use client";

import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import type { CachedStream } from "@/lib/types";
import { VideoPlayer } from "@/components/watch/VideoPlayer";
import { LiveChat } from "@/components/watch/LiveChat";
import { MatchPoll } from "@/components/watch/MatchPoll";
import { StreamCard } from "@/components/feed/StreamCard";
import { ShareModal, shareContent } from "@/components/ShareModal";
import { useApp } from "@/components/providers/AppProviders";
import { WatchLoginGate } from "@/components/auth/WatchLoginGate";
import { AdBanner } from "@/components/AdBanner";
import { WatchTelemetry } from "@/components/watch/WatchTelemetry";

interface Props {
  stream: CachedStream;
  related: CachedStream[];
}

/** Single-stream watch layout. Ads only in sidebar / below related — never on the player. */
export function WatchClient({ stream, related }: Props) {
  const { profile, loading } = useApp();
  const [shareOpen, setShareOpen] = useState(false);

  const watchPath = useMemo(() => {
    if (typeof window === "undefined") return `/watch/${stream.id}`;
    return `${window.location.pathname}${window.location.search}`;
  }, [stream.id]);

  const watchUrl = useMemo(() => {
    if (typeof window === "undefined") return `/watch/${stream.id}`;
    return `${window.location.origin}${watchPath}`;
  }, [stream.id, watchPath]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-muted md:px-6">
        Checking your session…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-4 md:px-6">
        <WatchLoginGate nextPath={watchPath} title={stream.title} />
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight md:text-3xl">{stream.title}</h1>
          <p className="mt-1 text-sm text-muted">{stream.streamer_name}</p>
        </div>
      </div>
    );
  }

  async function onShare() {
    const ok = await shareContent(watchUrl, stream.title);
    if (!ok) setShareOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 md:space-y-5 md:px-6">
      <WatchTelemetry stream={stream} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column: player first, then ad + meta (never inside the iframe) */}
        <div className="min-w-0 space-y-4">
          <VideoPlayer
            platform={stream.platform}
            externalId={stream.external_id}
            contentType={stream.content_type}
          />

          {/* Ad 1/2: under player, above Share — spaced away from iframe controls */}
          <div className="pt-1">
            <AdBanner variant="strip" label="Sponsored" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                {stream.content_type === "live" && (
                  <span className="live-pulse rounded bg-crimson px-2 py-0.5 text-white">Live</span>
                )}
                <span className="rounded bg-white/10 px-2 py-0.5">{stream.platform}</span>
                <span className="rounded bg-cyan/15 px-2 py-0.5 text-cyan">{stream.game_title}</span>
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight md:text-3xl">{stream.title}</h1>
              <p className="mt-1 text-sm text-muted">{stream.streamer_name}</p>
            </div>
            <button
              onClick={() => void onShare()}
              className="inline-flex items-center gap-2 rounded-full border border-border-glow px-4 py-2.5 text-sm font-semibold hover:border-cyan"
            >
              <Share2 size={16} /> Share
            </button>
          </div>

          <div>
            <h2 className="mb-3 font-display text-lg font-bold">Up Next · Same Game</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {related.map((s) => (
                <div key={s.id} className="w-64 shrink-0">
                  <StreamCard stream={s} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar: chat — Ad 2/2 below chat */}
        <aside className="space-y-4">
          <MatchPoll streamId={stream.id} />
          <div className="h-[420px]">
            <LiveChat streamId={stream.id} />
          </div>
          <AdBanner variant="strip" label="Sponsored" />
        </aside>
      </div>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} url={watchUrl} title={stream.title} />
    </div>
  );
}
