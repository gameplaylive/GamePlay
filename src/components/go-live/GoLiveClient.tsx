"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  Mic,
  MicOff,
  Monitor,
  Radio,
  Smartphone,
  Tv,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { PcObsPanel } from "@/components/go-live/PcObsPanel";
import {
  buildRtmpUrl,
  gamePackageName,
  isAndroidNativeApp,
  resolutionLabel,
} from "@/lib/go-live";
import { createClient } from "@/lib/supabase/client";
import type { CommunityGame, StreamResolution } from "@/lib/types";
import { COMMUNITY_GAMES } from "@/lib/types";
import { cn } from "@/lib/utils";

const APP_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_ANDROID_APK_URL ||
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ||
  "https://play.google.com/store/apps/details?id=app.gameplaylive";

type ConnectMode = "auto" | "advanced";
type StudioPlatform = "mobile" | "pc";

export function GoLiveClient() {
  const { profile, loading, openProModal, signInWithGoogle, connectYouTube, demoMode } = useApp();
  const [studio, setStudio] = useState<StudioPlatform>("mobile");
  const [title, setTitle] = useState("BGMI Rank Push Live | Gameplay Live");
  const [game, setGame] = useState<CommunityGame>("BGMI");
  const [resolution, setResolution] = useState<StreamResolution>("720p60");
  const [micEnabled, setMicEnabled] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualKey, setManualKey] = useState("");
  const [mode, setMode] = useState<ConnectMode>("auto");
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [rtmpUrl, setRtmpUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [liveStreamId, setLiveStreamId] = useState<string | null>(null);
  const [nativeApp, setNativeApp] = useState(false);

  const isPro = profile?.subscription_tier === "pro";

  useEffect(() => {
    setNativeApp(isAndroidNativeApp());
  }, []);

  useEffect(() => {
    if (game === "BGMI") setTitle("BGMI Rank Push Live | Gameplay Live");
    else if (game === "Free Fire") setTitle("Free Fire MAX Live | Gameplay Live");
    else setTitle(`${game} Live | Gameplay Live`);
  }, [game]);

  useEffect(() => {
    if (!loading && profile && !isPro) {
      openProModal({
        highlight: "go-live",
        contextTitle: "Unlock Direct-to-YouTube Creator Studio with Pro",
      });
    }
  }, [loading, profile, isPro, openProModal]);

  const canLaunch = useMemo(() => {
    if (!title.trim()) return false;
    if (mode === "advanced") return Boolean(manualKey.trim());
    return youtubeReady && Boolean(rtmpUrl);
  }, [title, mode, manualKey, youtubeReady, rtmpUrl]);

  const ensureAuth = useCallback(async () => {
    if (!profile) {
      await signInWithGoogle("/go-live");
      return false;
    }
    if (!isPro) {
      openProModal({
        highlight: "go-live",
        contextTitle: "Unlock Direct-to-YouTube Creator Studio with Pro",
      });
      return false;
    }
    return true;
  }, [profile, isPro, signInWithGoogle, openProModal]);

  const onProRequired = useCallback(() => {
    openProModal({
      highlight: "go-live",
      contextTitle: "Unlock Direct-to-YouTube Creator Studio with Pro",
    });
  }, [openProModal]);

  async function handleConnectYouTube() {
    setError("");
    setStatus("");
    if (!(await ensureAuth())) return;
    setBusy(true);
    try {
      const token = await connectYouTube("/go-live");
      if (!token && !demoMode) {
        setStatus("Redirecting to Google for YouTube access…");
        return;
      }

      const googleAccessToken = token || "";
      const res = await fetch("/api/youtube/create-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          game,
          googleAccessToken: googleAccessToken || undefined,
        }),
      });
      const data = await res.json();

      if (res.status === 401 && data.code === "YOUTUBE_AUTH_REQUIRED") {
        setStatus("Need YouTube permission — connecting Google…");
        await connectYouTube("/go-live");
        return;
      }

      if (!res.ok) {
        if (demoMode || res.status === 503) {
          const demoKey = `demo-key-${Date.now().toString(36)}`;
          const demoVid = `demo${Date.now().toString(36)}`;
          setRtmpUrl(buildRtmpUrl(demoKey));
          setVideoId(demoVid);
          setYoutubeReady(true);
          setMode("auto");
          setStatus("Demo broadcast ready (no YouTube API). Launch when you’re set.");
          return;
        }
        throw new Error(data.error || "Could not create broadcast");
      }

      setRtmpUrl(data.rtmp_url || buildRtmpUrl(data.stream_key));
      setVideoId(data.youtube_video_id || null);
      setYoutubeReady(true);
      setMode("auto");
      setStatus("YouTube broadcast created. Ready to launch.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "YouTube connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLaunch() {
    setError("");
    setStatus("");
    if (!(await ensureAuth())) return;

    const finalRtmp = mode === "advanced" ? buildRtmpUrl(manualKey) : rtmpUrl;
    if (!finalRtmp) {
      setError("Connect YouTube or paste a stream key in Advanced.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/streams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream_title: title.trim(),
          game,
          youtube_video_id: mode === "auto" ? videoId : null,
          resolution,
          mic_enabled: micEnabled,
          creator_name: profile?.full_name || undefined,
          source: "mobile",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "PRO_REQUIRED") {
          openProModal({
            highlight: "go-live",
            contextTitle: "Unlock Direct-to-YouTube Creator Studio with Pro",
          });
          return;
        }
        throw new Error(data.error || "Could not start stream");
      }

      setLiveStreamId(data.stream?.id || null);
      const pkg = gamePackageName(game);

      if (isAndroidNativeApp() && window.AndroidStreamBridge?.startStream) {
        window.AndroidStreamBridge.startStream(finalRtmp, pkg, resolution, micEnabled);
        setStatus("Streaming started — launching game…");
      } else {
        setStatus("Marked live on GamePlay Live. Open the Android app to stream your screen.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    setError("");
    try {
      await fetch("/api/streams/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stream_id: liveStreamId }),
      });
      window.AndroidStreamBridge?.stopStream?.();
      setLiveStreamId(null);
      setStatus("Stream stopped.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stop failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!profile || !isPro || youtubeReady || studio !== "mobile") return;
    const flag = sessionStorage.getItem("gameplay_live_youtube_connect");
    if (flag !== "1") return;
    sessionStorage.removeItem("gameplay_live_youtube_connect");
    void (async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.provider_token;
      if (!token) return;
      setBusy(true);
      try {
        const res = await fetch("/api/youtube/create-broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), game, googleAccessToken: token }),
        });
        const payload = await res.json();
        if (res.ok) {
          setRtmpUrl(payload.rtmp_url || buildRtmpUrl(payload.stream_key));
          setVideoId(payload.youtube_video_id || null);
          setYoutubeReady(true);
          setStatus("YouTube connected. Broadcast ready.");
        }
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isPro, studio]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted">
        Loading creator studio…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12 text-center">
        <Radio className="mx-auto text-crimson" size={36} />
        <h1 className="font-display text-3xl font-bold">Go Live</h1>
        <p className="text-sm text-muted">Sign in with Google to open the creator studio.</p>
        <button
          onClick={() => void signInWithGoogle("/go-live")}
          className="btn-primary w-full rounded-2xl py-3.5 text-sm font-bold"
        >
          Continue with Google
        </button>
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12 text-center">
        <Radio className="mx-auto text-gold" size={36} />
        <h1 className="font-display text-3xl font-bold">Pro creators only</h1>
        <p className="text-sm text-muted">
          Stream from phone or OBS on PC — ₹99/month. Featured on the GamePlay Live homepage.
        </p>
        <button
          onClick={() =>
            openProModal({
              highlight: "go-live",
              contextTitle: "Unlock Direct-to-YouTube Creator Studio with Pro",
            })
          }
          className="pro-cta-glow w-full rounded-2xl bg-gradient-to-r from-[#2F8F62] via-[#3FA572] to-[#C9A227] py-3.5 text-sm font-bold text-[#0B100C]"
        >
          Upgrade to Pro Now — ₹99/mo
        </button>
        <Link href="/" className="block text-sm text-cyan">
          Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-3 pb-24 pt-4 md:px-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-crimson">Creator studio</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Go Live</h1>
        <p className="mt-1 text-sm text-muted">
          Mobile screen → YouTube, or PC → OBS into GamePlay Live ingest.
        </p>
      </div>

      <div className="glass grid grid-cols-2 gap-1 rounded-2xl p-1">
        <button
          type="button"
          onClick={() => {
            setStudio("mobile");
            setStatus("");
            setError("");
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-bold transition sm:text-xs",
            studio === "mobile" ? "bg-white/10 text-white" : "text-muted hover:text-white"
          )}
        >
          <Smartphone size={14} />
          Stream from Mobile Phone
        </button>
        <button
          type="button"
          onClick={() => {
            setStudio("pc");
            setStatus("");
            setError("");
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-bold transition sm:text-xs",
            studio === "pc" ? "bg-white/10 text-white" : "text-muted hover:text-white"
          )}
        >
          <Monitor size={14} />
          Stream from PC (OBS Studio)
        </button>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">Stream title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-cyan/50"
          placeholder='e.g. "BGMI Rank Push Live | Gameplay Live"'
          maxLength={100}
        />
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

      {studio === "pc" ? (
        <PcObsPanel
          title={title}
          game={game}
          onStatus={setStatus}
          onError={setError}
          onProRequired={onProRequired}
        />
      ) : (
        <>
          {!nativeApp && (
            <div className="rounded-2xl border border-cyan/30 bg-cyan/10 p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 shrink-0 text-cyan" size={20} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">
                    Download Gameplay Live Android App to Stream Your Mobile Screen
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Browser preview works for setup. Screen capture + game auto-launch need the native app.
                  </p>
                  <a
                    href={APP_DOWNLOAD_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cyan px-3 py-1.5 text-xs font-bold text-obsidian"
                  >
                    <Download size={14} />
                    Get Android app
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Tv size={18} className="text-crimson" />
              <p className="text-sm font-bold">YouTube connection</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConnectYouTube()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-crimson py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <Tv size={18} />
              {youtubeReady ? "Reconnect YouTube & create broadcast" : "Connect YouTube with Google"}
            </button>
            {youtubeReady && (
              <p className="text-xs text-cyan">
                Broadcast ready{videoId ? ` · video ${videoId}` : ""}. Keys stay hidden.
              </p>
            )}

            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-muted"
            >
              Advanced — paste stream key manually
              <ChevronDown size={14} className={cn("transition", advancedOpen && "rotate-180")} />
            </button>
            {advancedOpen && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted">
                  Paste only the stream key (or full RTMPS URL). Base: rtmps://a.rtmp.youtube.com/live2
                </p>
                <input
                  value={manualKey}
                  onChange={(e) => {
                    setManualKey(e.target.value);
                    setMode("advanced");
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs outline-none"
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  autoComplete="off"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Resolution & bitrate</span>
            <div className="grid grid-cols-2 gap-2">
              {(["720p60", "1080p30"] as StreamResolution[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResolution(r)}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-left text-xs font-semibold",
                    resolution === r
                      ? "border-cyan/50 bg-cyan/15 text-white"
                      : "border-white/10 text-muted"
                  )}
                >
                  {resolutionLabel(r)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMicEnabled((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold",
                micEnabled ? "border-purple/40 bg-purple/15 text-white" : "border-white/10 text-muted"
              )}
            >
              {micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
              Microphone {micEnabled ? "on" : "off"}
            </button>
          </div>

          <button
            type="button"
            disabled={busy || !canLaunch}
            onClick={() => void handleLaunch()}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold disabled:opacity-40"
          >
            <Radio size={18} />
            Launch Game & Start Streaming
          </button>

          {liveStreamId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleStop()}
              className="w-full rounded-2xl border border-crimson/40 py-3 text-sm font-bold text-crimson"
            >
              End stream
            </button>
          )}
        </>
      )}

      {status && <p className="text-sm text-cyan">{status}</p>}
      {error && <p className="text-sm text-crimson">{error}</p>}
    </div>
  );
}
