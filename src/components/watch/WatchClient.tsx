"use client";

import { useEffect, useMemo, useState } from "react";
import { Grid2X2, Share2, Volume2, VolumeX, X } from "lucide-react";
import type { CachedStream } from "@/lib/types";
import { VideoPlayer } from "@/components/watch/VideoPlayer";
import { LiveChat } from "@/components/watch/LiveChat";
import { MatchPoll } from "@/components/watch/MatchPoll";
import { StreamCard } from "@/components/feed/StreamCard";
import { ShareModal, shareContent } from "@/components/ShareModal";
import { useApp } from "@/components/providers/AppProviders";
import { WatchLoginGate } from "@/components/auth/WatchLoginGate";
import { AdBanner } from "@/components/AdBanner";

interface Props {
  stream: CachedStream;
  related: CachedStream[];
  startMulti?: boolean;
}

export function WatchClient({ stream, related, startMulti = false }: Props) {
  const { profile, loading, openProModal } = useApp();
  const [shareOpen, setShareOpen] = useState(false);
  const [multi, setMulti] = useState(false);
  const [grid, setGrid] = useState<CachedStream[]>([stream]);
  const [mutedSlots, setMutedSlots] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!startMulti || !profile) return;
    if (profile.subscription_tier === "pro") {
      setMulti(true);
      setGrid([stream]);
    } else {
      openProModal({ highlight: "multi-view" });
    }
  }, [startMulti, profile, stream, openProModal]);

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

  function toggleMulti() {
    if (profile?.subscription_tier !== "pro") {
      openProModal({ highlight: "multi-view" });
      return;
    }
    setMulti((v) => !v);
    setGrid([stream]);
  }

  function addToGrid(s: CachedStream) {
    if (profile?.subscription_tier !== "pro") {
      openProModal({ highlight: "multi-view" });
      return;
    }
    setMulti(true);
    setGrid((prev) => {
      if (prev.find((x) => x.id === s.id)) return prev;
      if (prev.length >= 4) return [...prev.slice(1), s];
      return [...prev, s];
    });
  }

  function removeSlot(id: string) {
    setGrid((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 md:space-y-5 md:px-6">
      {/* Player only — never place ads on top of the iframe */}
      {!multi ? (
        <VideoPlayer
          platform={stream.platform}
          externalId={stream.external_id}
          contentType={stream.content_type}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {grid.map((s) => (
            <div key={s.id} className="relative">
              <VideoPlayer platform={s.platform} externalId={s.external_id} contentType={s.content_type} />
              <div className="absolute right-2 top-2 flex gap-1">
                <button
                  onClick={() => setMutedSlots((m) => ({ ...m, [s.id]: !m[s.id] }))}
                  className="rounded-full bg-black/70 p-2 text-white"
                  title="Audio focus (UI hint — iframe audio is controlled by the player)"
                >
                  {mutedSlots[s.id] ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                {grid.length > 1 && (
                  <button onClick={() => removeSlot(s.id)} className="rounded-full bg-black/70 p-2 text-white">
                    <X size={14} />
                  </button>
                )}
              </div>
              <p className="mt-1 truncate text-xs text-muted">{s.title}</p>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 4 - grid.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border-glow text-sm text-muted"
            >
              Add a stream from Up Next
            </div>
          ))}
        </div>
      )}

      {/* Ad 1 — directly under player */}
      <AdBanner variant="strip" label="Sponsored" />

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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void onShare()}
            className="inline-flex items-center gap-2 rounded-full border border-border-glow px-4 py-2.5 text-sm font-semibold hover:border-cyan"
          >
            <Share2 size={16} /> Share
          </button>
          <button
            onClick={toggleMulti}
            className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm font-bold text-gold"
          >
            <Grid2X2 size={16} /> {multi ? "Exit Multi-View" : "2×2 Multi-View"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div>
            <h2 className="mb-3 font-display text-lg font-bold">Up Next · Same Game</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {related.map((s) => (
                <div key={s.id} className="w-64 shrink-0">
                  <StreamCard stream={s} />
                  {multi && (
                    <button
                      onClick={() => addToGrid(s)}
                      className="mt-2 w-full rounded-xl border border-purple/40 py-1.5 text-xs font-bold text-purple"
                    >
                      Add to grid
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <MatchPoll streamId={stream.id} />
          <div className="h-[420px]">
            <LiveChat streamId={stream.id} />
          </div>
          {/* Ad 2 — below chat */}
          <AdBanner variant="strip" label="Sponsored" />
        </div>
      </div>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} url={watchUrl} title={stream.title} />
    </div>
  );
}
