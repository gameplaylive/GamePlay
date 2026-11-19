"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Radio, Trophy, Users, UserPlus } from "lucide-react";
import type { MouseEvent } from "react";
import { StreamCard } from "@/components/feed/StreamCard";
import { AdBanner } from "@/components/AdBanner";
import { FavoriteGamerModal } from "@/components/feed/FavoriteGamerModal";
import { FeaturedTournamentsStrip } from "@/components/tournaments/FeaturedTournamentsStrip";
import { EventsPulseBar } from "@/components/events/EventsPulseBar";
import { CommunityCreatorsRow } from "@/components/feed/CommunityCreatorsRow";
import { SquadFinder } from "@/components/squads/SquadFinder";
import { useApp } from "@/components/providers/AppProviders";
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
  const [streams, setStreams] = useState<CachedStream[]>([]);
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [language, setLanguage] = useState(profile?.preferred_language || "All");
  const [editGames, setEditGames] = useState(false);
  const [favModal, setFavModal] = useState(false);
  const [favStatuses, setFavStatuses] = useState<FavoriteGamerStatus[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [squadCount, setSquadCount] = useState(0);

  useEffect(() => {
    if (profile?.preferred_language) setLanguage(profile.preferred_language);
  }, [profile?.preferred_language]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/squads");
        const data = await res.json();
        if (!cancelled) setSquadCount(Array.isArray(data.posts) ? data.posts.length : 0);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (focus === "squads" || (typeof window !== "undefined" && window.location.hash === "#squad-finder")) {
      requestAnimationFrame(() => {
        document.getElementById("squad-finder")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/streams/feed", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.streams)) {
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
    if (!favorites.length) {
      setFavStatuses([]);
      return;
    }
    // Prefetch on My Gamers tab, and lightly when favorites change so the header live badge works.
    const eager = tab === "favorites";
    let cancelled = false;
    async function loadStatus() {
      if (eager) setLoadingFavs(true);
      try {
        const res = await fetch("/api/favorites/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorites }),
        });
        const data = await res.json();
        if (cancelled) return;
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
        if (!cancelled) {
          setFavStatuses(
            favorites.map((f) => ({
              ...f,
              is_live: false,
              latest_video_title: "Status unavailable",
              latest_video_thumbnail: f.avatar_url,
            }))
          );
        }
      } finally {
        if (!cancelled && eager) setLoadingFavs(false);
      }
    }
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [tab, favorites]);

  const favoriteSlugs = profile?.favorite_games || [];

  const filtered = useMemo(() => {
    let list = streams;
    if (tab === "live") list = list.filter((s) => s.content_type === "live");
    else if (tab === "trending")
      list = list.filter((s) => s.content_type === "trending" || s.content_type === "video");
    else list = [];

    // Only narrow by game when a specific chip is selected — never hide the whole
    // live feed just because the user has onboarding favorite_games (that made
    // logged-in users see an empty feed while guests saw everything).
    if (gameFilter !== "all") list = list.filter((s) => s.game_slug === gameFilter);

    if (language !== "All") {
      const langFiltered = list.filter((s) => s.language === language);
      // Don't wipe a specific game (e.g. BGMI) when language preference mismatches.
      if (langFiltered.length > 0 || gameFilter === "all") list = langFiltered;
    }

    if (tab === "trending") {
      list = [...list].sort((a, b) => b.viewer_count - a.viewer_count);
    } else if (tab === "live") {
      // Alternate Twitch / YouTube so one platform doesn't dominate the grid.
      list = interleaveByPlatform(list);
    }
    return list;
  }, [streams, tab, gameFilter, language]);

  const myGamersLiveFirst = useMemo(() => {
    return [...favStatuses].sort((a, b) => Number(b.is_live) - Number(a.is_live));
  }, [favStatuses]);

  const liveGamerCount = useMemo(
    () => favStatuses.filter((f) => f.is_live).length,
    [favStatuses]
  );

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
    { key: "all", label: "All Games" },
    ...games
      .filter((g) => favoriteSlugs.includes(g.slug) || favoriteSlugs.length === 0)
      .map((g) => ({ key: g.slug, label: g.title })),
  ];

  function goLiveClick(e: MouseEvent) {
    if (!profile) {
      e.preventDefault();
      void signInWithGoogle("/go-live");
    }
  }

  const liveSectionTitle = tab === "trending" ? "Trending Gameplay" : "Live Now";

  return (
    <div className="mx-auto max-w-7xl space-y-3 overflow-x-hidden px-3 pb-10 pt-3 md:space-y-5 md:px-6 md:pt-5">
      <div className="space-y-2">
        <h1 className="font-display text-[1.35rem] font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Tap in. <span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">Watch.</span> Share.
        </h1>
        <div className="flex w-full flex-nowrap items-center gap-1 sm:gap-1.5">
          <Link
            href="/go-live"
            onClick={goLiveClick}
            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-0.5 rounded-full border border-white/15 bg-white/[0.06] px-1 text-[9px] font-bold text-white transition hover:border-crimson/45 hover:bg-crimson/15 sm:gap-1 sm:px-2 sm:text-[11px]"
          >
            <Radio size={11} className="shrink-0 text-crimson" />
            <span className="truncate">Go Live</span>
          </Link>
          <button
            type="button"
            onClick={() => setFavModal(true)}
            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-0.5 rounded-full border border-white/15 bg-white/[0.06] px-1 text-[9px] font-bold text-white transition hover:border-purple/45 hover:bg-purple/15 sm:gap-1 sm:px-2 sm:text-[11px]"
          >
            <UserPlus size={11} className="shrink-0 text-purple" />
            <span className="truncate">Favs</span>
          </button>
          <button
            type="button"
            onClick={() => {
              document.getElementById("squad-finder")?.scrollIntoView({ behavior: "smooth", block: "start" });
              if (typeof window !== "undefined") {
                window.history.replaceState(null, "", "/#squad-finder");
              }
            }}
            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-0.5 rounded-full border border-white/15 bg-white/[0.06] px-1 text-[9px] font-bold text-white transition hover:border-cyan/45 hover:bg-cyan/15 sm:gap-1 sm:px-2 sm:text-[11px]"
          >
            <Users size={11} className="shrink-0 text-cyan" />
            <span className="truncate">
              Squads{squadCount > 0 ? ` (${squadCount})` : ""}
            </span>
          </button>
          <Link
            href="/tournaments"
            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-0.5 rounded-full border border-white/15 bg-white/[0.06] px-1 text-[9px] font-bold text-white transition hover:border-amber-300/45 hover:bg-amber-400/10 sm:gap-1 sm:px-2 sm:text-[11px]"
          >
            <Trophy size={11} className="shrink-0 text-amber-300" />
            <span className="truncate">Tourneys</span>
          </Link>
        </div>
      </div>

      <div className="glass flex rounded-2xl p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {(
          [
            ["live", "Live Now"],
            ["trending", "Trending"],
            ["favorites", "My Gamers"],
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

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#101522] via-[#0c101a] to-[#14101f]">
            <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2 sm:px-4">
              <div className="flex min-w-0 items-center gap-2">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson" />
                </span>
                <h2 className="inline-flex items-center gap-1.5 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
                  <Radio size={12} className="shrink-0 text-crimson" aria-hidden />
                  {liveSectionTitle}
                </h2>
              </div>
              <p className="shrink-0 text-[10px] text-muted">
                {filtered.length} {tab === "live" ? "live" : "videos"}
                {filtered.length > 7 ? " · scroll for more" : ""}
              </p>
            </div>

            <div className="space-y-2 p-2.5 sm:p-3">
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-black/25 px-4 py-8 text-center text-sm text-muted">
                  No streams match these filters yet. Try another game or language, or check back
                  after the next feed sync.
                </div>
              ) : (
                <>
                  <AdBanner variant="strip" label="Sponsored" />
                  <div className="max-h-[min(68vh,38rem)] overflow-y-auto overscroll-contain rounded-xl border border-white/5 bg-black/20 p-2.5 scrollbar-thin md:max-h-[min(70vh,42rem)] md:p-3">
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
                      {filtered.map((stream) => (
                        <StreamCard key={stream.id} stream={stream} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      )}

      {tab === "favorites" && (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#101522] via-[#0c101a] to-[#14101f]">
          <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <Users size={12} className="shrink-0 text-cyan" aria-hidden />
              <h2 className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
                My Gamers
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setFavModal(true)}
              className="shrink-0 text-[10px] font-bold text-cyan"
            >
              + Add gamer
            </button>
          </div>
          <div className="space-y-3 p-2.5 sm:p-3">
            {loadingFavs && <p className="text-sm text-muted">Checking who&apos;s live…</p>}
            {!loadingFavs && favorites.length === 0 && (
              <div className="rounded-xl border border-white/5 bg-black/25 px-4 py-8 text-center">
                <p className="text-sm text-muted">
                  Save creators with Favs — then tap a gamer to open their live or latest cached
                  video.
                </p>
                <button
                  type="button"
                  onClick={() => setFavModal(true)}
                  className="btn-primary mt-4 rounded-full px-5 py-2.5 text-sm"
                >
                  Add Favorite Gamer
                </button>
              </div>
            )}
            {!loadingFavs && favorites.length > 0 && liveGamerCount === 0 && (
              <p className="px-1 text-[11px] text-muted">
                None of your gamers are live right now — showing saved creators below.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
              {myGamersLiveFirst.map((f) => (
                <Link
                  key={f.id}
                  href={`/gamer/${encodeURIComponent(f.id)}`}
                  className="overflow-hidden rounded-2xl border border-white/5 bg-[#0c101a] text-left shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:border-cyan/35"
                >
                  <div className="relative aspect-[16/10] bg-black/40">
                    <Image
                      src={
                        f.live_thumbnail ||
                        f.latest_video_thumbnail ||
                        f.avatar_url ||
                        "/icons/icon-512.png"
                      }
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
                          : f.latest_video_title || "Tap to open"}
                      </p>
                      <span className="inline-block text-[9px] font-bold text-cyan">Profile →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Squad Finder sits under Live / My Gamers; events & tournaments stay secondary */}
      <div id="squad-finder">
        <SquadFinder />
      </div>
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
            Free for everyone — Go Live Studio, Favorite Gamers, Squad Finder, and alerts with a
            Google sign-in.
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

/** Twitch, YouTube, Twitch, YouTube… (remainder appended in original order). */
function interleaveByPlatform(streams: CachedStream[]): CachedStream[] {
  const twitch: CachedStream[] = [];
  const youtube: CachedStream[] = [];
  const other: CachedStream[] = [];

  for (const s of streams) {
    if (s.platform === "twitch") twitch.push(s);
    else if (s.platform === "youtube") youtube.push(s);
    else other.push(s);
  }

  const out: CachedStream[] = [];
  const max = Math.max(twitch.length, youtube.length);
  for (let i = 0; i < max; i++) {
    if (i < twitch.length) out.push(twitch[i]);
    if (i < youtube.length) out.push(youtube[i]);
  }
  return out.concat(other);
}
