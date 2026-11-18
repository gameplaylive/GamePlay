"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import { StreamCard } from "@/components/feed/StreamCard";
import { AdBanner } from "@/components/AdBanner";
import { FavoriteGamerModal } from "@/components/feed/FavoriteGamerModal";
import { FeaturedTournamentsStrip } from "@/components/tournaments/FeaturedTournamentsStrip";
import { EventsPulseBar } from "@/components/events/EventsPulseBar";
import { CommunityCreatorsRow } from "@/components/feed/CommunityCreatorsRow";
import { useApp } from "@/components/providers/AppProviders";
import { MOCK_STREAMS } from "@/lib/mock-data";
import type { CachedStream, FavoriteGamerStatus, HomeTab } from "@/lib/types";
import { LANGUAGES, cn, formatViewers } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";

export function HomeFeed() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as HomeTab) || "live";
  const { profile, games, favorites, updateProfileLocal, demoMode, signInWithGoogle } = useApp();
  const [streams, setStreams] = useState<CachedStream[]>(MOCK_STREAMS);
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [language, setLanguage] = useState(profile?.preferred_language || "All");
  const [editGames, setEditGames] = useState(false);
  const [favModal, setFavModal] = useState(false);
  const [favStatuses, setFavStatuses] = useState<FavoriteGamerStatus[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(false);

  useEffect(() => {
    if (profile?.preferred_language) setLanguage(profile.preferred_language);
  }, [profile?.preferred_language]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/streams/feed", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.streams) && data.streams.length) {
          setStreams(data.streams as CachedStream[]);
        }
      } catch {
        // Keep last good feed (don't overwrite with mock after a successful load)
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab !== "favorites") return;
    async function loadStatus() {
      setLoadingFavs(true);
      try {
        const res = await fetch("/api/favorites/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorites }),
        });
        const data = await res.json();
        if (res.ok && data.statuses) setFavStatuses(data.statuses);
        else {
          setFavStatuses(
            favorites.map((f) => ({
              ...f,
              is_live: false,
              latest_video_title: "Latest upload unavailable offline",
              latest_video_thumbnail: f.avatar_url,
            }))
          );
        }
      } catch {
        setFavStatuses(favorites.map((f) => ({ ...f, is_live: Math.random() > 0.5 })));
      } finally {
        setLoadingFavs(false);
      }
    }
    void loadStatus();
  }, [tab, favorites]);

  const favoriteSlugs = profile?.favorite_games || [];

  const filtered = useMemo(() => {
    let list = streams;
    if (tab === "live") list = list.filter((s) => s.content_type === "live");
    else if (tab === "trending")
      list = list.filter((s) => s.content_type === "trending" || s.content_type === "video");
    else list = [];

    if (gameFilter !== "all") list = list.filter((s) => s.game_slug === gameFilter);
    else if (favoriteSlugs.length && tab !== "trending")
      list = list.filter((s) => favoriteSlugs.includes(s.game_slug));

    if (language !== "All") list = list.filter((s) => s.language === language);

    if (tab === "trending") list = [...list].sort((a, b) => b.viewer_count - a.viewer_count);
    return list;
  }, [streams, tab, gameFilter, favoriteSlugs, language]);

  function setTab(next: HomeTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.push(`/?${params.toString()}`);
  }

  async function saveLanguage(value: string) {
    setLanguage(value);
    if (!profile) return;
    updateProfileLocal({ preferred_language: value });
    const supabase = createClient();
    if (supabase && !demoMode) {
      await supabase.from("profiles").update({ preferred_language: value }).eq("id", profile.id);
    }
  }

  async function saveGames(slugs: string[]) {
    if (!profile) return;
    updateProfileLocal({ favorite_games: slugs });
    const supabase = createClient();
    if (supabase && !demoMode) {
      await supabase.from("profiles").update({ favorite_games: slugs }).eq("id", profile.id);
    }
    setEditGames(false);
  }

  const pills = [
    { key: "all", label: "All My Games" },
    ...games
      .filter((g) => favoriteSlugs.includes(g.slug) || favoriteSlugs.length === 0)
      .map((g) => ({ key: g.slug, label: g.title })),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-3 overflow-x-hidden px-3 pb-10 pt-3 md:space-y-5 md:px-6 md:pt-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[1.35rem] font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            Tap in. <span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">Watch.</span> Share.
          </h1>
        </div>
        <button
          onClick={() => setFavModal(true)}
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-purple/40 bg-purple/20 px-2.5 py-1.5 text-[10px] font-bold text-white sm:gap-1.5 sm:px-3 sm:text-[11px]"
        >
          <UserPlus size={13} />
          <span className="hidden sm:inline">Manage Favorites</span>
          <span className="sm:hidden">Favs</span>
        </button>
      </div>

      <div className="glass flex rounded-2xl p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {(
          [
            ["live", "Live Now"],
            ["trending", "Trending"],
            ["favorites", "Favorites"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-xl px-2 py-2 text-[11px] font-bold tracking-wide transition sm:text-sm sm:py-2.5",
              tab === key ? "tab-active" : "text-muted hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "favorites" && (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {pills.map((p) => (
              <button
                key={p.key}
                onClick={() => setGameFilter(p.key)}
                className={cn(
                  "chip shrink-0 px-3 py-1.5 text-[11px] font-semibold",
                  gameFilter === p.key ? "chip-active" : "border-border-glow bg-white/[0.03] text-muted"
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setEditGames(true)}
              className="chip inline-flex shrink-0 items-center gap-1 border-dashed border-purple/45 bg-purple/10 px-3 py-1.5 text-[11px] font-semibold text-purple"
            >
              <Plus size={12} /> Edit
            </button>
            <select
              value={language}
              onChange={(e) => void saveLanguage(e.target.value)}
              aria-label="Filter by language"
              className="ml-auto shrink-0 rounded-full border border-border-glow bg-[#101420] px-3 py-1.5 text-[11px] outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l === "All" ? "Language · All" : l}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted">
              No streams match these filters yet. Try another game or language, or check back after
              the next feed sync.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Max 2 ads on home — only when original feed content is present */}
              <AdBanner variant="strip" label="Sponsored" />
              <div className="flex items-center justify-between gap-2 px-0.5">
                <p className="text-[11px] font-semibold text-muted">
                  {filtered.length} {tab === "live" ? "live" : "videos"}
                  {filtered.length > 7 ? " · scroll inside for more" : ""}
                </p>
              </div>
              {/* Fixed window ~7 cards visible; extra lives scroll inside (not endless page) */}
              <div className="max-h-[min(68vh,38rem)] overflow-y-auto overscroll-contain rounded-2xl border border-white/5 bg-black/20 p-2.5 scrollbar-thin md:max-h-[min(70vh,42rem)] md:p-3">
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
                  {filtered.map((stream) => (
                    <StreamCard key={stream.id} stream={stream} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <EventsPulseBar />

      {tab === "live" && <CommunityCreatorsRow />}

      <FeaturedTournamentsStrip />

      {filtered.length > 0 && tab !== "favorites" && (
        <AdBanner variant="strip" label="Sponsored" />
      )}

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-4 md:px-4">
        <h2 className="font-display text-base font-bold text-white">Why GamePlay Live?</h2>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted md:text-xs">
          <li>Official embeds only — creators keep ownership of their streams.</li>
          <li>India-first filters (games + language) for BGMI, Free Fire, and more.</li>
          <li>
            Creator Pro unlocks Go Live Studio, alerts, and ad-free browsing for ₹99/mo via Cashfree.
          </li>
        </ul>
      </section>

      {tab !== "favorites" && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-3 md:px-4">
          <h2 className="font-display text-sm font-bold text-white md:text-base">
            {tab === "live" ? "Live gameplay discovery" : "Latest & trending gameplay"}
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted md:text-xs">
            GamePlay Live curates public YouTube and Twitch streams for BGMI, Free Fire, Valorant,
            GTA V, Minecraft, Roblox, CS2, Dota 2, Fortnite, and Call of Duty. Filter by game or
            language, then open a single official player — we never rehost creator video.
          </p>
        </section>
      )}

      {tab === "favorites" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold">My Favorite Gamers</h2>
            <button onClick={() => setFavModal(true)} className="text-xs font-bold text-cyan">
              + Add gamer
            </button>
          </div>
          {loadingFavs && <p className="text-sm text-muted">Checking live status…</p>}
          {!loadingFavs && favorites.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-sm text-muted">Pin creators you love — we&apos;ll flag when they go live.</p>
              <button onClick={() => setFavModal(true)} className="btn-primary mt-4 rounded-full px-5 py-2.5 text-sm">
                Add Favorite Gamer
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
            {favStatuses.map((f) => (
              <div
                key={f.id}
                className="overflow-hidden rounded-2xl border border-white/5 bg-[#0c101a] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
              >
                <div className="relative aspect-[16/10] bg-black/40">
                  <Image
                    src={f.live_thumbnail || f.latest_video_thumbnail || f.avatar_url || "/icons/icon-512.png"}
                    alt={f.channel_name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
                  {f.is_live && (
                    <span className="live-pulse absolute left-1.5 top-1.5 rounded-md bg-crimson px-1.5 py-0.5 text-[9px] font-black text-white">
                      LIVE
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-1.5">
                    <p className="truncate text-[11px] font-semibold text-white">{f.channel_name}</p>
                    <p className="truncate text-[9px] text-white/55">
                      {f.is_live
                        ? `${f.live_title || "Live now"} · ${formatViewers(f.live_viewer_count || 0)}`
                        : f.latest_video_title || "Offline"}
                    </p>
                    {f.is_live && f.live_external_id && (
                      <Link
                        href={`/watch/fav-${f.platform}-${encodeURIComponent(f.channel_id_or_username)}?platform=${f.platform}&external=${encodeURIComponent(f.live_external_id)}&type=live&title=${encodeURIComponent(f.live_title || f.channel_name)}&streamer=${encodeURIComponent(f.channel_name)}`}
                        className="inline-block text-[9px] font-bold text-cyan"
                        onClick={(e) => {
                          if (!profile) {
                            e.preventDefault();
                            const path = `/watch/fav-${f.platform}-${encodeURIComponent(f.channel_id_or_username)}?platform=${f.platform}&external=${encodeURIComponent(f.live_external_id!)}&type=live&title=${encodeURIComponent(f.live_title || f.channel_name)}&streamer=${encodeURIComponent(f.channel_name)}`;
                            void signInWithGoogle(path);
                          }
                        }}
                      >
                        Watch live →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editGames && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
          <div className="glass glow-border w-full max-w-lg rounded-3xl p-5">
            <h3 className="font-display text-xl font-bold">Edit favorite games</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {games.map((g) => {
                const on = favoriteSlugs.includes(g.slug);
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      const next = on
                        ? favoriteSlugs.filter((s) => s !== g.slug)
                        : [...favoriteSlugs, g.slug];
                      updateProfileLocal({ favorite_games: next });
                    }}
                    className={cn(
                      "chip px-3 py-1.5 text-xs font-semibold",
                      on ? "chip-active" : "border-border-glow text-muted"
                    )}
                  >
                    {g.title}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => void saveGames(profile?.favorite_games || [])}
              className="btn-primary mt-5 w-full rounded-2xl py-3 text-sm"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <FavoriteGamerModal open={favModal} onClose={() => setFavModal(false)} />
    </div>
  );
}
