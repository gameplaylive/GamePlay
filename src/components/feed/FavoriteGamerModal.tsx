"use client";

import Image from "next/image";
import { Search, X, UserPlus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { CreatorSearchResult, UserFavorite } from "@/lib/types";
import { useApp } from "@/components/providers/AppProviders";
import { FAVORITE_LIMITS } from "@/lib/default-games";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function FavoriteGamerModal({ open, onClose }: Props) {
  const { profile, favorites, setFavorites, demoMode, signInWithGoogle, openProModal } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CreatorSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [pinning, setPinning] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const isPro = profile?.subscription_tier === "pro";
  const limit = isPro ? FAVORITE_LIMITS.pro : FAVORITE_LIMITS.free;
  const used = favorites.length;
  const atLimit = used >= limit;

  const limitBanner = useMemo(() => {
    if (!atLimit) return null;
    if (isPro) {
      return `Maximum Limit Reached (${limit}/${limit}): Remove an existing gamer to add a new one.`;
    }
    return `Slot Limit Reached (${limit}/${limit}): Remove an existing gamer to add a new one, or upgrade to Pro for up to ${FAVORITE_LIMITS.pro} Favorite Gamers.`;
  }, [atLimit, isPro, limit]);

  if (!open) return null;

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setWarning("");
    try {
      const res = await fetch(`/api/favorites/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults((data.results as CreatorSearchResult[]) || []);
      if (data.warning) setWarning(data.warning);
      if (!data.results?.length) setError(data.error || "No creators found. Try another name.");
    } catch (e) {
      setResults([
        {
          platform: "youtube",
          channel_name: `${query.trim()} (YouTube)`,
          channel_id_or_username: `UC${Math.random().toString(36).slice(2, 12)}`,
          avatar_url: "https://www.youtube.com/s/desktop/6ca38bbe/img/favicon_144x144.png",
        },
        {
          platform: "twitch",
          channel_name: query.trim(),
          channel_id_or_username: query.trim().toLowerCase().replace(/\s+/g, ""),
          avatar_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png",
        },
      ]);
      setError(e instanceof Error ? e.message : "Using local preview results");
    } finally {
      setLoading(false);
    }
  }

  async function addFavorite(creator: CreatorSearchResult) {
    if (!profile) {
      await signInWithGoogle();
      return;
    }
    if (atLimit) {
      setError(limitBanner || "Slot limit reached");
      if (!isPro) {
        openProModal({
          highlight: "favorites",
          contextTitle: "Unlock up to 15 Favorite Gamers with Pro",
        });
      }
      return;
    }

    const key = `${creator.platform}:${creator.channel_id_or_username}`;
    setPinning(key);
    setError("");

    try {
      if (demoMode) {
        if (favorites.length >= limit) {
          setError(limitBanner || "Slot limit reached");
          return;
        }
        const entry: UserFavorite = {
          id: crypto.randomUUID(),
          user_id: profile.id,
          channel_name: creator.channel_name,
          platform: creator.platform,
          channel_id_or_username: creator.channel_id_or_username,
          avatar_url: creator.avatar_url,
          created_at: new Date().toISOString(),
        };
        const next = [
          entry,
          ...favorites.filter(
            (f) =>
              !(f.platform === entry.platform && f.channel_id_or_username === entry.channel_id_or_username)
          ),
        ].slice(0, limit);
        setFavorites(next);
        localStorage.setItem("gameplay_live_favorites", JSON.stringify(next));
        return;
      }

      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: creator.platform,
          channel_name: creator.channel_name,
          channel_id_or_username: creator.channel_id_or_username,
          avatar_url: creator.avatar_url,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "SLOT_LIMIT") {
          setError(data.message || limitBanner || "Slot limit reached");
          if (!isPro) {
            openProModal({
              highlight: "favorites",
              contextTitle: "Unlock up to 15 Favorite Gamers with Pro",
            });
          }
          return;
        }
        throw new Error(data.error || data.message || "Could not pin gamer");
      }
      if (data.favorite) {
        setFavorites([
          data.favorite as UserFavorite,
          ...favorites.filter((f) => f.id !== (data.favorite as UserFavorite).id),
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pin failed");
    } finally {
      setPinning(null);
    }
  }

  async function removeFavorite(id: string) {
    if (!demoMode) {
      await fetch("/api/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    }
    const next = favorites.filter((f) => f.id !== id);
    setFavorites(next);
    if (demoMode) localStorage.setItem("gameplay_live_favorites", JSON.stringify(next));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 sm:items-center" onClick={onClose}>
      <div
        className="glass glow-border flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-glow px-5 py-4">
          <div>
            <h3 className="font-display text-xl font-bold">Favorite Gamers</h3>
            <p className="text-xs text-muted">
              Search YouTube & Twitch together — Favorite Gamers: {used} / {limit} used
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {limitBanner && (
            <div className="rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2.5 text-xs text-gold">
              <p>{limitBanner}</p>
              {!isPro && (
                <button
                  type="button"
                  onClick={() =>
                    openProModal({
                      highlight: "favorites",
                      contextTitle: "Unlock up to 15 Favorite Gamers with Pro",
                    })
                  }
                  className="mt-2 text-[11px] font-bold underline"
                >
                  Upgrade to Pro
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void search()}
              placeholder="Name, @handle, or YouTube/Twitch URL…"
              className="flex-1 rounded-xl border border-border-glow bg-obsidian/60 px-3 py-2.5 text-sm outline-none focus:border-cyan"
            />
            <button
              onClick={() => void search()}
              disabled={loading}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
            >
              <Search size={16} /> {loading ? "…" : "Search"}
            </button>
          </div>
          {warning && <p className="text-xs text-gold">{warning}</p>}
          {error && <p className="text-xs text-crimson">{error}</p>}

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                Dual results · YouTube + Twitch
              </p>
              {results.map((r) => {
                const followed = favorites.some(
                  (f) => f.platform === r.platform && f.channel_id_or_username === r.channel_id_or_username
                );
                const pinKey = `${r.platform}:${r.channel_id_or_username}`;
                const disabled = followed || atLimit || pinning === pinKey;
                return (
                  <div
                    key={pinKey}
                    className="flex items-center gap-3 rounded-xl border border-border-glow bg-white/[0.03] p-3"
                  >
                    <Image
                      src={r.avatar_url || "/icons/icon-192.png"}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-full"
                      unoptimized
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.channel_name}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide",
                            r.platform === "youtube"
                              ? "bg-crimson/20 text-crimson"
                              : "bg-purple/20 text-purple"
                          )}
                        >
                          {r.platform === "youtube" ? "YouTube" : "Twitch"}
                        </span>
                        {r.is_live && (
                          <span className="text-[9px] font-bold uppercase text-crimson">Live</span>
                        )}
                      </div>
                    </div>
                    <button
                      disabled={disabled}
                      onClick={() => void addFavorite(r)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold",
                        followed
                          ? "border border-border-glow text-muted"
                          : atLimit
                            ? "border border-border-glow text-muted opacity-50"
                            : "bg-cyan text-obsidian"
                      )}
                    >
                      <UserPlus size={12} />
                      {followed ? "Pinned" : atLimit ? "Full" : pinning === pinKey ? "…" : "Pin Gamer"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Your pins ({used}/{limit})
            </p>
            {favorites.length === 0 && <p className="text-sm text-muted">No favorite gamers yet.</p>}
            {favorites.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border-glow p-3">
                <Image
                  src={f.avatar_url || "/icons/icon-192.png"}
                  alt=""
                  width={36}
                  height={36}
                  className="rounded-full"
                  unoptimized
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.channel_name}</p>
                  <p className="text-[10px] uppercase text-muted">{f.platform}</p>
                </div>
                <button
                  onClick={() => void removeFavorite(f.id)}
                  className="rounded-full p-2 text-crimson hover:bg-crimson/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
