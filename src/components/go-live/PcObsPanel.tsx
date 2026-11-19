"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Monitor, RefreshCw } from "lucide-react";
import type { CommunityGame } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Creds {
  server: string;
  stream_key: string;
  playback_url: string;
  obs_clipboard: string;
}

interface Props {
  title: string;
  game: CommunityGame;
  onStatus: (msg: string) => void;
  onError: (msg: string) => void;
  onProRequired: () => void;
}

export function PcObsPanel({ title, game, onStatus, onError, onProRequired }: Props) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [armed, setArmed] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    onError("");
    try {
      const res = await fetch("/api/streams/obs-credentials");
      const data = await res.json();
      if (res.status === 402 || data.code === "PRO_REQUIRED") {
        onProRequired();
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not load OBS credentials");
      setCreds({
        server: data.server,
        stream_key: data.stream_key,
        playback_url: data.playback_url,
        obs_clipboard: data.obs_clipboard,
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load credentials");
    } finally {
      setBusy(false);
    }
  }, [onError, onProRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePending() {
    setBusy(true);
    onError("");
    try {
      const res = await fetch("/api/streams/obs-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending_title: title, pending_game: game }),
      });
      const data = await res.json();
      if (res.status === 402 || data.code === "PRO_REQUIRED") {
        onProRequired();
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not save stream meta");
      setCreds({
        server: data.server,
        stream_key: data.stream_key,
        playback_url: data.playback_url,
        obs_clipboard: data.obs_clipboard,
      });
      setArmed(true);
      onStatus("Ready — start streaming in OBS. You’ll appear on the homepage automatically.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function rotateKey() {
    if (!confirm("Rotate stream key? Your old OBS key will stop working.")) return;
    setBusy(true);
    onError("");
    try {
      const res = await fetch("/api/streams/obs-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending_title: title, pending_game: game, rotate: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rotate failed");
      setCreds({
        server: data.server,
        stream_key: data.stream_key,
        playback_url: data.playback_url,
        obs_clipboard: data.obs_clipboard,
      });
      setArmed(false);
      onStatus("New stream key generated. Update OBS and click Ready again.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Rotate failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyObs() {
    if (!creds) return;
    try {
      await navigator.clipboard.writeText(creds.obs_clipboard);
      setCopied(true);
      onStatus("OBS settings copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError("Could not copy — select the fields manually.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2">
          <Monitor size={18} className="text-cyan" />
          <p className="text-sm font-bold">Your OBS / Streamlabs ingest</p>
        </div>
        <p className="mt-1 text-xs text-muted">
          Unique stream key linked to your account. When OBS pushes video, we flip you live on the homepage.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Server (RTMP ingest URL)</p>
            <p className="mt-1 break-all rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs text-cyan">
              {creds?.server || (busy ? "Loading…" : "—")}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Stream key</p>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-muted"
              >
                {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-1 break-all rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs">
              {creds
                ? showKey
                  ? creds.stream_key
                  : "•".repeat(Math.min(28, creds.stream_key.length))
                : "—"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!creds || busy}
            onClick={() => void copyObs()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-cyan px-4 py-3 text-sm font-bold text-obsidian disabled:opacity-40"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy OBS Settings"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void rotateKey()}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-white/15 px-3 py-3 text-xs font-bold text-muted"
            title="Rotate key"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-bold">3-step OBS setup</p>
        <ol className="mt-3 space-y-2.5 text-xs text-muted">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan/20 text-[10px] font-bold text-cyan">
              1
            </span>
            <span>
              Open <strong className="text-white">OBS Studio</strong> (or Streamlabs) →{" "}
              <strong className="text-white">Settings → Stream</strong>.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan/20 text-[10px] font-bold text-cyan">
              2
            </span>
            <span>
              Service = <strong className="text-white">Custom</strong>. Paste{" "}
              <strong className="text-white">Server</strong> + <strong className="text-white">Stream Key</strong>{" "}
              (or use Copy OBS Settings).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan/20 text-[10px] font-bold text-cyan">
              3
            </span>
            <span>
              Click <strong className="text-white">Ready for OBS</strong> below, then{" "}
              <strong className="text-white">Start Streaming</strong> in OBS — you go live on GamePlay Live
              automatically.
            </span>
          </li>
        </ol>
      </div>

      <button
        type="button"
        disabled={busy || !creds || !title.trim()}
        onClick={() => void savePending()}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold disabled:opacity-40",
          armed ? "border border-cyan/40 bg-cyan/15 text-cyan" : "btn-primary"
        )}
      >
        <Monitor size={18} />
        {armed ? "Armed — start streaming in OBS" : "Ready for OBS"}
      </button>
    </div>
  );
}
