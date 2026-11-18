"use client";

import { useEffect, useState } from "react";
import { Bell, Copy, Link2, Save, Trash2 } from "lucide-react";
import type { CommunityGame, StreamResolution } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRESETS_KEY = "gpl_creator_presets_v1";
const ALERTS_KEY = "gpl_creator_alerts_v1";

export interface StreamPreset {
  id: string;
  name: string;
  title: string;
  game: CommunityGame;
  resolution: StreamResolution;
}

interface AlertsConfig {
  discordWebhook: string;
  notifyOnLive: boolean;
}

interface Props {
  title: string;
  game: CommunityGame;
  resolution: StreamResolution;
  videoId: string | null;
  onApplyPreset: (p: StreamPreset) => void;
}

export function CreatorStudioTools({ title, game, resolution, videoId, onApplyPreset }: Props) {
  const [presets, setPresets] = useState<StreamPreset[]>([]);
  const [presetName, setPresetName] = useState("Rank push");
  const [alerts, setAlerts] = useState<AlertsConfig>({ discordWebhook: "", notifyOnLive: true });
  const [msg, setMsg] = useState("");
  const [alertBusy, setAlertBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (raw) setPresets(JSON.parse(raw) as StreamPreset[]);
      const a = localStorage.getItem(ALERTS_KEY);
      if (a) setAlerts(JSON.parse(a) as AlertsConfig);
    } catch {
      /* ignore */
    }
  }, []);

  function persistPresets(next: StreamPreset[]) {
    setPresets(next);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  }

  function savePreset() {
    const next: StreamPreset = {
      id: `p_${Date.now()}`,
      name: presetName.trim() || "Preset",
      title: title.trim(),
      game,
      resolution,
    };
    persistPresets([next, ...presets].slice(0, 8));
    setMsg("Preset saved");
  }

  function removePreset(id: string) {
    persistPresets(presets.filter((p) => p.id !== id));
  }

  function saveAlerts(next: AlertsConfig) {
    setAlerts(next);
    localStorage.setItem(ALERTS_KEY, JSON.stringify(next));
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMsg(`${label} copied`);
    } catch {
      setMsg("Copy failed");
    }
  }

  async function fireGoLiveAlert() {
    setAlertBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/creator/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          game,
          videoId,
          discordWebhook: alerts.discordWebhook || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Alert failed");
      setMsg(data.message || "Go Live alert sent");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Alert failed");
    } finally {
      setAlertBusy(false);
    }
  }

  const watchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
  const studioUrl = videoId
    ? `https://studio.youtube.com/video/${videoId}/livestreaming`
    : "https://studio.youtube.com/";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Save size={16} className="text-gold" />
          <h2 className="text-sm font-bold">Stream presets</h2>
        </div>
        <div className="flex gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-cyan/40"
            placeholder="Preset name"
          />
          <button
            type="button"
            onClick={savePreset}
            className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-bold text-gold"
          >
            Save current
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {presets.length === 0 && (
            <li className="text-[11px] text-muted">No presets yet — save title / game / resolution.</li>
          )}
          {presets.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => onApplyPreset(p)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-xs font-bold text-white">{p.name}</p>
                <p className="truncate text-[10px] text-muted">
                  {p.game} · {p.resolution} · {p.title}
                </p>
              </button>
              <button
                type="button"
                onClick={() => removePreset(p.id)}
                className="rounded-lg p-1.5 text-muted hover:text-crimson"
                aria-label="Delete preset"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Link2 size={16} className="text-cyan" />
          <h2 className="text-sm font-bold">Channel utilities</h2>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            disabled={!watchUrl}
            onClick={() => void copyText("Watch link", watchUrl)}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold",
              watchUrl
                ? "border-cyan/40 text-cyan hover:bg-cyan/10"
                : "border-white/10 text-muted opacity-50"
            )}
          >
            <Copy size={14} /> Copy YouTube watch link
          </button>
          <a
            href={studioUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold text-white hover:border-cyan/40"
          >
            Open YouTube Studio
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Bell size={16} className="text-crimson" />
          <h2 className="text-sm font-bold">Go Live alerts</h2>
        </div>
        <label className="block space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Discord webhook URL (optional)
          </span>
          <input
            value={alerts.discordWebhook}
            onChange={(e) => saveAlerts({ ...alerts, discordWebhook: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-cyan/40"
            placeholder="https://discord.com/api/webhooks/…"
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={alerts.notifyOnLive}
            onChange={(e) => saveAlerts({ ...alerts, notifyOnLive: e.target.checked })}
          />
          Send alert when I go live
        </label>
        <button
          type="button"
          disabled={alertBusy || !alerts.notifyOnLive}
          onClick={() => void fireGoLiveAlert()}
          className="mt-3 w-full rounded-xl bg-crimson/90 py-2.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {alertBusy ? "Sending…" : "Send test / Go Live alert"}
        </button>
      </section>

      {msg && <p className="text-center text-[11px] text-cyan">{msg}</p>}
    </div>
  );
}
