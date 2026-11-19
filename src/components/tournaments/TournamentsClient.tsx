"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import type { TournamentMatch } from "@/lib/types";
import { AdBanner } from "@/components/AdBanner";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { cn } from "@/lib/utils";

const GAME_FILTERS = ["All Games", "BGMI", "Free Fire", "Valorant", "CS2", "LoL", "Dota 2"] as const;
type StatusTab = "LIVE" | "UPCOMING";

export function TournamentsClient() {
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [game, setGame] = useState<(typeof GAME_FILTERS)[number]>("All Games");
  const [status, setStatus] = useState<StatusTab>("LIVE");
  const [loading, setLoading] = useState(true);
  const [pandaConfigured, setPandaConfigured] = useState(false);
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/tournaments");
        const data = await res.json();
        if (cancelled) return;
        const list = (data.matches || []) as TournamentMatch[];
        setMatches(list);
        setPandaConfigured(Boolean(data.pandascore_configured));
        const live = Number(data.live_count || list.filter((m) => m.status === "LIVE").length);
        setLiveCount(live);
        setStatus(live > 0 ? "LIVE" : "UPCOMING");
      } catch {
        if (!cancelled) {
          setMatches([]);
          setLiveCount(0);
          setStatus("UPCOMING");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (m.status !== status) return false;
      if (game === "All Games") return true;
      return m.game.toLowerCase() === game.toLowerCase() || m.game.toLowerCase().includes(game.toLowerCase());
    });
  }, [matches, game, status]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 py-5 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
            <Trophy size={12} /> Esports Centre
            {liveCount > 0 && (
              <span className="relative ml-1 inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-crimson" />
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Tournaments</h1>
          <p className="mt-1 text-sm text-muted">
            Live cups only when the official stream is actually on air. Upcoming shows scheduled
            matches — no sample placeholders.
            {!pandaConfigured && " · Add PANDASCORE_API_KEY for PC esports brackets."}
          </p>
        </div>
      </div>

      {filtered.length > 0 && <AdBanner variant="strip" label="Sponsored" />}

      <div className="glass flex rounded-2xl p-1">
        {(["LIVE", "UPCOMING"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatus(tab)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wide sm:text-sm",
              status === tab ? "tab-active" : "text-muted hover:text-white"
            )}
          >
            {tab === "LIVE" ? `Live Now (${liveCount})` : "Upcoming"}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
        {GAME_FILTERS.map((g) => (
          <button
            key={g}
            onClick={() => setGame(g)}
            className={cn(
              "chip shrink-0 px-3 py-1.5 text-[11px] font-semibold",
              game === g ? "chip-active" : "border-border-glow bg-white/[0.03] text-muted"
            )}
          >
            {g}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted">Loading tournaments…</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => (
          <TournamentCard key={m.id} match={m} />
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted">
          {status === "LIVE"
            ? "No tournaments are live on an official stream right now. Check Upcoming."
            : "No upcoming tournaments for this filter yet."}
        </div>
      )}
    </div>
  );
}
