"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, LogOut, Mic, MicOff, Plus, Users, X } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import {
  SQUAD_GAMES,
  SQUAD_MODES,
  SQUAD_NOTE_MAX,
  type SquadPost,
  formatExpiresIn,
} from "@/lib/squads";
import { cn } from "@/lib/utils";

export function SquadFinder() {
  const { profile, signInWithGoogle, demoMode } = useApp();
  const [posts, setPosts] = useState<SquadPost[]>([]);
  const [gameFilter, setGameFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const qs = gameFilter !== "All" ? `?game=${encodeURIComponent(gameFilter)}` : "";
      const res = await fetch(`/api/squads${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.posts)) setPosts(data.posts as SquadPost[]);
    } catch {
      // keep last
    } finally {
      setLoading(false);
    }
  }, [gameFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  async function copyUid(post: SquadPost) {
    if (!post.in_game_id) return;
    try {
      await navigator.clipboard.writeText(post.in_game_id);
      setCopiedId(post.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore
    }
  }

  async function removePost(id: string) {
    if (!profile) return;
    const res = await fetch(`/api/squads?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function joinOrLeave(post: SquadPost, action: "join" | "leave") {
    if (!profile && !demoMode) {
      void signInWithGoogle("/?focus=squads");
      return;
    }
    setBusyId(post.id);
    try {
      const res = await fetch("/api/squads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: post.id }),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? (data.post as SquadPost) : p)));
      }
    } finally {
      setBusyId(null);
    }
  }

  function openPostModal() {
    if (!profile && !demoMode) {
      void signInWithGoogle("/?focus=squads");
      return;
    }
    setModalOpen(true);
  }

  const activePosts = useMemo(() => {
    void nowTick;
    const now = Date.now();
    return posts.filter((p) => new Date(p.expires_at).getTime() > now);
  }, [posts, nowTick]);

  return (
    <section
      id="squad-finder"
      className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#101522] via-[#0c101a] to-[#14101f]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Users size={12} className="shrink-0 text-gold" aria-hidden />
          <h2 className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
            Squad Finder
          </h2>
        </div>
        <button
          type="button"
          onClick={openPostModal}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gold/40 bg-gold/15 px-2.5 py-1 text-[10px] font-bold text-gold"
        >
          <Plus size={12} /> Post Squad
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 scrollbar-hide sm:px-4">
        {["All", ...SQUAD_GAMES].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGameFilter(g)}
            className={cn(
              "chip shrink-0 px-2.5 py-1 text-[10px] font-semibold",
              gameFilter === g ? "chip-active" : "border-border-glow bg-white/[0.03] text-muted"
            )}
          >
            {g === "Euro Truck Simulator 2" ? "ETS2" : g}
          </button>
        ))}
      </div>

      <div className="space-y-2 px-3 pb-3 sm:px-4">
        <p className="text-[10px] text-muted">
          1-tap Join · UID reveals after you join · slots fill until FULL · posts expire in 3h
        </p>

        {loading && <p className="py-4 text-center text-xs text-muted">Loading squads…</p>}

        {!loading && activePosts.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/25 px-4 py-6 text-center">
            <p className="text-sm text-muted">No active squad posts yet. Be the first to LFG.</p>
            <button
              type="button"
              onClick={openPostModal}
              className="btn-primary mt-3 rounded-full px-4 py-2 text-xs"
            >
              Post Squad
            </button>
          </div>
        )}

        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
          {activePosts.map((post) => {
            const isHost = profile?.id === post.user_id;
            return (
              <article
                key={post.id}
                className="flex w-[240px] shrink-0 flex-col rounded-xl border border-white/8 bg-black/30 p-2.5 backdrop-blur-sm"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="rounded bg-cyan/15 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-cyan">
                    {post.game}
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[8px] font-bold",
                      post.is_full ? "bg-crimson/20 text-crimson" : "bg-gold/15 text-gold"
                    )}
                  >
                    {post.is_full ? "FULL" : `${post.slots_filled}/${post.max_slots}`}
                  </span>
                </div>
                <p className="text-[12px] font-semibold text-white">{post.mode}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted">{post.creator_name || "Player"}</p>
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted">
                  {post.mic_required ? (
                    <>
                      <Mic size={12} className="text-emerald-400" /> Mic ON
                    </>
                  ) : (
                    <>
                      <MicOff size={12} className="text-muted" /> Mic optional
                    </>
                  )}
                </div>
                {post.note ? (
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/70">{post.note}</p>
                ) : null}
                <p className="mt-1.5 text-[9px] text-cyan/80">{formatExpiresIn(post.expires_at)}</p>

                {post.can_see_uid && post.in_game_id ? (
                  <button
                    type="button"
                    onClick={() => void copyUid(post)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-cyan/40 bg-cyan/10 px-2 py-1.5 text-[10px] font-bold text-cyan hover:bg-cyan/20"
                  >
                    {copiedId === post.id ? (
                      <>
                        <Check size={12} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy UID · {post.in_game_id}
                      </>
                    )}
                  </button>
                ) : null}

                {!isHost && !post.i_joined && !post.is_full && (
                  <button
                    type="button"
                    disabled={busyId === post.id}
                    onClick={() => void joinOrLeave(post, "join")}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-gold/40 bg-gold/15 px-2 py-1.5 text-[10px] font-bold text-gold disabled:opacity-60"
                  >
                    <Users size={12} /> Join Squad
                  </button>
                )}

                {!isHost && post.i_joined && (
                  <button
                    type="button"
                    disabled={busyId === post.id}
                    onClick={() => void joinOrLeave(post, "leave")}
                    className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-white/15 px-2 py-1.5 text-[10px] font-bold text-muted hover:text-crimson disabled:opacity-60"
                  >
                    <LogOut size={12} /> Leave Squad
                  </button>
                )}

                {!isHost && post.is_full && !post.i_joined && (
                  <p className="mt-2 text-center text-[9px] font-bold text-crimson">Squad FULL</p>
                )}

                {isHost && (
                  <button
                    type="button"
                    onClick={() => void removePost(post.id)}
                    className="mt-1 text-[9px] font-semibold text-muted hover:text-crimson"
                  >
                    Remove my post
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {modalOpen && (
        <PostSquadModal
          onClose={() => setModalOpen(false)}
          onCreated={(post) => {
            setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
            setModalOpen(false);
          }}
        />
      )}
    </section>
  );
}

function PostSquadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (post: SquadPost) => void;
}) {
  const [game, setGame] = useState<string>(SQUAD_GAMES[0]);
  const [mode, setMode] = useState<string>(SQUAD_MODES[0]);
  const [mic, setMic] = useState(true);
  const [inGameId, setInGameId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/squads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game,
          mode,
          mic_required: mic,
          in_game_id: inGameId,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not post squad");
        return;
      }
      onCreated(data.post as SquadPost);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
      <div className="glass glow-border w-full max-w-md rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold text-white">Post Squad</h3>
            <p className="mt-1 text-[11px] text-muted">
              Free for all signed-in players · UID stays hidden until teammates join
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-muted hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
          <label className="block text-[11px] font-semibold text-muted">
            Game
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-glow bg-[#101420] px-3 py-2.5 text-sm text-white outline-none"
            >
              {SQUAD_GAMES.map((g) => (
                <option key={g} value={g}>
                  {g === "Euro Truck Simulator 2" ? "Euro Truck Simulator 2 (ETS2)" : g}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[11px] font-semibold text-muted">
            Mode
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-glow bg-[#101420] px-3 py-2.5 text-sm text-white outline-none"
            >
              {SQUAD_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setMic((v) => !v)}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold",
              mic
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-muted"
            )}
          >
            {mic ? <Mic size={16} /> : <MicOff size={16} />}
            Mic {mic ? "required" : "optional"}
          </button>

          <label className="block text-[11px] font-semibold text-muted">
            In-game ID / IGN / Room code
            <input
              value={inGameId}
              onChange={(e) => setInGameId(e.target.value)}
              maxLength={48}
              required
              placeholder="e.g. Player#1234 or room 88421"
              className="mt-1 w-full rounded-xl border border-border-glow bg-[#101420] px-3 py-2.5 text-sm text-white outline-none"
            />
          </label>

          <label className="block text-[11px] font-semibold text-muted">
            Short note ({note.length}/{SQUAD_NOTE_MAX})
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, SQUAD_NOTE_MAX))}
              maxLength={SQUAD_NOTE_MAX}
              placeholder="Ranked push, chill vibes…"
              className="mt-1 w-full rounded-xl border border-border-glow bg-[#101420] px-3 py-2.5 text-sm text-white outline-none"
            />
          </label>

          <p className="text-[10px] leading-relaxed text-muted">
            Safety: no emails, phone numbers, WhatsApp, Telegram, or Discord links. Teammates join
            first, then see your UID.
          </p>

          {error && (
            <div className="rounded-xl border border-crimson/30 bg-crimson/10 px-3 py-2 text-[11px] text-crimson">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full rounded-2xl py-3 text-sm disabled:opacity-60"
          >
            {busy ? "Posting…" : "Post for 3 hours"}
          </button>
        </form>
      </div>
    </div>
  );
}
