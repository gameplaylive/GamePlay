"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProviders";
import type { CustomTournament } from "@/lib/types";
import { cn } from "@/lib/utils";

const GAMES = ["BGMI", "Free Fire", "PUBG Mobile", "Other"] as const;

const emptyForm = {
  tournament_name: "",
  game: "BGMI",
  match_title: "",
  start_time: "",
  end_time: "",
  platform: "youtube" as "youtube" | "twitch",
  channel_id: "",
  fallback_stream_url: "",
  is_featured: true,
  mark_live_now: false,
};

interface ManagerProps {
  /** When true, hide outer page chrome (for embedding in /admin tabs). */
  embedded?: boolean;
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return "";
  return new Date(value).toISOString();
}

export function AdminTournamentsManager({ embedded = false }: ManagerProps) {
  const { profile, loading, demoMode } = useApp();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [password, setPassword] = useState("");
  const [tournaments, setTournaments] = useState<CustomTournament[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (profile?.role === "admin" || demoMode) {
      setAllowed(true);
    }
  }, [profile, loading, demoMode]);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed]);

  async function load() {
    const res = await fetch("/api/admin/tournaments");
    if (res.status === 403) {
      setAllowed(false);
      return;
    }
    const data = await res.json();
    if (res.ok) setTournaments(data.tournaments || []);
    else setMessage(data.error || "Failed to load");
  }

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock", password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unlock failed");
      return;
    }
    setAllowed(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    let start = form.start_time ? fromLocalInput(form.start_time) : "";
    let end = form.end_time ? fromLocalInput(form.end_time) : null;
    if (form.mark_live_now) {
      const now = Date.now();
      start = new Date(now - 5 * 60000).toISOString();
      end = new Date(now + 4 * 3600000).toISOString();
    }
    if (!start) {
      setBusy(false);
      setMessage("Start time is required (or toggle Mark Live Now).");
      return;
    }
    if (!form.fallback_stream_url.trim() && form.mark_live_now) {
      setBusy(false);
      setMessage("Add a YouTube/Twitch stream URL to go live.");
      return;
    }

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      tournament_name: form.tournament_name,
      game: form.game,
      match_title: form.match_title,
      start_time: start,
      end_time: end,
      platform: form.platform,
      channel_id: form.channel_id,
      fallback_stream_url: form.fallback_stream_url,
      is_featured: form.is_featured,
    };

    const res = await fetch("/api/admin/tournaments", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Save failed");
      return;
    }
    setMessage(editingId ? "Tournament updated" : "Tournament added");
    setForm(emptyForm);
    setEditingId(null);
    await load();
  }

  function startEdit(t: CustomTournament) {
    setEditingId(t.id);
    setForm({
      tournament_name: t.tournament_name,
      game: t.game,
      match_title: t.match_title || "",
      start_time: toLocalInput(t.start_time),
      end_time: toLocalInput(t.end_time),
      platform: t.platform,
      channel_id: t.channel_id || "",
      fallback_stream_url: t.fallback_stream_url || "",
      is_featured: t.is_featured,
      mark_live_now: false,
    });
  }

  async function goLiveNow(t: CustomTournament) {
    setBusy(true);
    setMessage("");
    const now = Date.now();
    const res = await fetch("/api/admin/tournaments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: t.id,
        start_time: new Date(now - 5 * 60000).toISOString(),
        end_time: new Date(now + 4 * 3600000).toISOString(),
        is_featured: true,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Could not mark live");
      return;
    }
    setMessage("Tournament marked LIVE");
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this tournament?")) return;
    const res = await fetch(`/api/admin/tournaments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Delete failed");
      return;
    }
    setMessage("Deleted");
    await load();
  }

  if (loading) {
    return <div className="p-8 text-muted">Loading…</div>;
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-10">
        <h1 className="font-display text-2xl font-bold">Tournament Admin</h1>
        <p className="text-sm text-muted">
          Sign in as an admin user, or unlock with <code className="text-cyan">ADMIN_PASSWORD</code>.
        </p>
        {!profile && (
          <button
            onClick={() => router.push("/login")}
            className="w-full rounded-xl border border-border-glow py-2.5 text-sm font-semibold"
          >
            Go to login
          </button>
        )}
        <form onSubmit={unlock} className="glass space-y-3 rounded-2xl p-5">
          <label className="block text-sm">
            Admin password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
            />
          </label>
          <button disabled={busy} className="btn-primary w-full rounded-xl py-2.5 text-sm disabled:opacity-50">
            Unlock
          </button>
          {message && <p className="text-sm text-crimson">{message}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", !embedded && "mx-auto max-w-5xl px-4 py-6 md:px-6")}>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Admin</p>
            <h1 className="font-display text-3xl font-bold">Tournaments Manager</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/tournaments" className="rounded-full border border-border-glow px-4 py-2 text-sm">
              Public view
            </Link>
            <Link href="/admin" className="rounded-full border border-gold/40 px-4 py-2 text-sm text-gold">
              Command Center
            </Link>
          </div>
        </div>
      )}

      {message && (
        <p className="rounded-xl border border-border-glow bg-white/5 px-4 py-2 text-sm text-cyan">{message}</p>
      )}

      <form onSubmit={save} className="glass grid gap-3 rounded-2xl p-5 md:grid-cols-2">
        <h2 className="md:col-span-2 font-display text-lg font-bold">
          {editingId ? "Edit tournament" : "Create tournament"}
        </h2>
        <label className="text-sm md:col-span-2">
          Tournament name
          <input
            required
            value={form.tournament_name}
            onChange={(e) => setForm({ ...form, tournament_name: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
            placeholder="BGIS 2026 Grand Finals"
          />
        </label>
        <label className="text-sm">
          Game
          <select
            value={form.game}
            onChange={(e) => setForm({ ...form, game: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
          >
            {GAMES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Match title
          <input
            value={form.match_title}
            onChange={(e) => setForm({ ...form, match_title: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
            placeholder="Day 3 - Finals"
          />
        </label>
        <label className="text-sm">
          Start time
          <input
            required
            type="datetime-local"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          End time
          <input
            type="datetime-local"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Platform
          <select
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value as "youtube" | "twitch" })}
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
          >
            <option value="youtube">YouTube</option>
            <option value="twitch">Twitch</option>
          </select>
        </label>
        <label className="text-sm">
          Official Channel ID / username
          <input
            value={form.channel_id}
            onChange={(e) => setForm({ ...form, channel_id: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
            placeholder="YouTube channel ID or Twitch login"
          />
        </label>
        <label className="text-sm md:col-span-2">
          Stream URL (YouTube / Twitch)
          <input
            value={form.fallback_stream_url}
            onChange={(e) => setForm({ ...form, fallback_stream_url: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
            placeholder="https://youtube.com/watch?v=... or https://twitch.tv/channel"
          />
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={form.mark_live_now}
            onChange={(e) => setForm({ ...form, mark_live_now: e.target.checked })}
          />
          Prefer live window (still requires the YouTube/Twitch channel to be actually live)
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={form.is_featured}
            onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
          />
          Pin to Featured
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button disabled={busy} className="btn-primary rounded-xl px-5 py-2.5 text-sm disabled:opacity-50">
            {editingId ? "Save changes" : "Add tournament"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="rounded-xl border border-border-glow px-4 py-2.5 text-sm"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold">Existing tournaments ({tournaments.length})</h2>
        {tournaments.map((t) => (
          <div
            key={t.id}
            className={cn(
              "glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between",
              t.is_featured && "border-gold/30"
            )}
          >
            <div className="min-w-0">
              <p className="font-semibold">{t.tournament_name}</p>
              <p className="text-xs text-muted">
                {t.game} · {t.match_title || "—"} · {new Date(t.start_time).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted">
                {t.platform} · channel: {t.channel_id || "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void goLiveNow(t)}
                className="rounded-full border border-crimson/40 px-3 py-1.5 text-xs font-bold text-crimson"
              >
                Go Live
              </button>
              <button
                onClick={() => startEdit(t)}
                className="rounded-full border border-cyan/40 px-3 py-1.5 text-xs font-bold text-cyan"
              >
                Edit
              </button>
              <button
                onClick={() => void remove(t.id)}
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold text-muted"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && (
          <p className="text-sm text-muted">No custom tournaments yet. Add one above.</p>
        )}
      </div>
    </div>
  );
}
