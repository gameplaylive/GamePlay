"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Link2, Radio, Tv } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { parseStreamLink, type LinkedPlatform } from "@/lib/stream-link";
import { watchHrefForCommunity } from "@/lib/go-live";
import type { CommunityGame, CommunityLiveStream } from "@/lib/types";
import { COMMUNITY_GAMES } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GoLiveClient() {
  const { profile, loading, signInWithGoogle } = useApp();
  const [platform, setPlatform] = useState<LinkedPlatform>("youtube");
  const [streamLink, setStreamLink] = useState("");
  const [title, setTitle] = useState("BGMI Rank Push Live");
  const [game, setGame] = useState<CommunityGame>("BGMI");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [liveStream, setLiveStream] = useState<CommunityLiveStream | null>(null);

  useEffect(() => {
    if (game === "BGMI") setTitle("BGMI Rank Push Live");
    else if (game === "Free Fire") setTitle("Free Fire MAX Live");
    else setTitle(`${game} Live`);
  }, [game]);

  const loadLive = useCallback(async () => {
    try {
      const res = await fetch("/api/streams/go-live");
      if (res.status === 401) return;
      const data = await res.json();
      if (data.stream?.is_live) setLiveStream(data.stream as CommunityLiveStream);
      else setLiveStream(null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (profile) void loadLive();
  }, [profile, loadLive]);

  const preview = useMemo(() => {
    if (!streamLink.trim()) return null;
    return parseStreamLink(platform, streamLink);
  }, [platform, streamLink]);

  const canGoLive = Boolean(title.trim() && streamLink.trim() && preview?.ok);

  async function handleGoLive() {
    setError("");
    setStatus("");
    if (!profile) {
      await signInWithGoogle("/go-live");
      return;
    }

    const parsed = parseStreamLink(platform, streamLink);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (!title.trim()) {
      setError("Add a short title for your stream card.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/streams/go-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          stream_link: streamLink.trim(),
          stream_title: title.trim(),
          game,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not go live");

      setLiveStream(data.stream as CommunityLiveStream);
      setStatus("You're live on GamePlay Live — fans can watch from the homepage.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not go live");
    } finally {
      setBusy(false);
    }
  }

  async function handleEndStream() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/streams/go-live", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not end stream");
      setLiveStream(null);
      setStatus("Stream ended. You can link a new live anytime.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not end stream");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12 text-center">
        <Radio className="mx-auto text-crimson" size={36} />
        <h1 className="font-display text-3xl font-bold">Go Live</h1>
        <p className="text-sm text-muted">
          Already live on YouTube or Twitch? Sign in, paste your link, and show up on GamePlay Live
          in one tap.
        </p>
        <button
          onClick={() => void signInWithGoogle("/go-live")}
          className="btn-primary w-full rounded-2xl py-3.5 text-sm font-bold"
        >
          Continue with Google
        </button>
      </div>
    );
  }

  const watchHref = liveStream ? watchHrefForCommunity(liveStream) : null;
  const isLive = Boolean(liveStream?.is_live);

  return (
    <div className="mx-auto max-w-lg space-y-5 px-3 pb-24 pt-4 md:px-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-crimson">Creator studio</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Go Live</h1>
        <p className="mt-1 text-sm text-muted">
          Start streaming on YouTube or Twitch as usual — then paste your link here. We embed it; no
          extra bandwidth on our side.
        </p>
      </div>

      {isLive && liveStream && (
        <div className="space-y-3 rounded-2xl border border-crimson/40 bg-crimson/10 p-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-crimson" />
            </span>
            <p className="text-sm font-bold text-white">You&apos;re live on GamePlay Live</p>
          </div>
          <p className="text-xs text-muted">
            {liveStream.game} · {liveStream.stream_title}
          </p>
          {watchHref && (
            <Link href={watchHref} className="text-xs font-bold text-cyan underline-offset-2 hover:underline">
              Open your watch page →
            </Link>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleEndStream()}
            className="w-full rounded-2xl bg-crimson py-3.5 text-sm font-bold text-white disabled:opacity-50"
          >
            End Stream
          </button>
        </div>
      )}

      {!isLive && (
        <>
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Platform</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlatform("youtube");
                  setError("");
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition",
                  platform === "youtube"
                    ? "border-crimson/60 bg-crimson/20 text-white"
                    : "border-white/10 text-muted hover:text-white"
                )}
              >
                <Tv size={18} />
                YouTube Live
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlatform("twitch");
                  setError("");
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition",
                  platform === "twitch"
                    ? "border-purple/60 bg-purple/20 text-white"
                    : "border-white/10 text-muted hover:text-white"
                )}
              >
                <Radio size={18} />
                Twitch
              </button>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              {platform === "youtube" ? "YouTube Live link" : "Twitch link or username"}
            </span>
            <div className="relative">
              <Link2
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={streamLink}
                onChange={(e) => {
                  setStreamLink(e.target.value);
                  setError("");
                }}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan/50"
                placeholder={
                  platform === "youtube"
                    ? "https://youtube.com/watch?v=… or youtube.com/live/…"
                    : "twitch.tv/yourname or yourname"
                }
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {preview && !preview.ok && streamLink.trim() && (
              <p className="text-xs text-crimson">{preview.error}</p>
            )}
            {preview?.ok && (
              <p className="text-xs text-cyan">
                {preview.platform === "youtube"
                  ? `Ready · video ${preview.videoId}`
                  : `Ready · channel ${preview.channel}`}
              </p>
            )}
          </label>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Game</span>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_GAMES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGame(g)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    game === g
                      ? "border-crimson/60 bg-crimson/20 text-white"
                      : "border-white/10 text-muted hover:text-white"
                  )}
                >
                  {g === "Free Fire" ? "Free Fire MAX" : g}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Stream title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-cyan/50"
              placeholder="Short title for your card"
              maxLength={100}
            />
          </label>

          {platform === "youtube" && (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-muted">
              Tip: In YouTube Studio → Live → Settings, keep{" "}
              <span className="font-semibold text-white/80">Allow embedding</span> on (it&apos;s on by
              default) so fans can watch inside GamePlay Live.
            </p>
          )}

          <button
            type="button"
            disabled={busy || !canGoLive}
            onClick={() => void handleGoLive()}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold disabled:opacity-40"
          >
            <Radio size={18} />
            Go Live on GamePlay
          </button>
        </>
      )}

      {status && <p className="text-sm text-cyan">{status}</p>}
      {error && <p className="text-sm text-crimson">{error}</p>}
    </div>
  );
}
