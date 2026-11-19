"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { TournamentMatch } from "@/lib/types";
import { buildWatchPath, countdownLabel, formatLocalStart } from "@/lib/tournaments";
import { useApp } from "@/components/providers/AppProviders";
import { cn } from "@/lib/utils";

interface Props {
  match: TournamentMatch;
  compact?: boolean;
}

export function TournamentCard({ match, compact = false }: Props) {
  const { profile, signInWithGoogle } = useApp();
  const [notified, setNotified] = useState(false);
  const [busy, setBusy] = useState(false);
  const watchPath = buildWatchPath(match);
  const isLive = match.status === "LIVE";
  const isUpcoming = match.status === "UPCOMING";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile) {
        setNotified(false);
        return;
      }
      try {
        const res = await fetch("/api/tournaments/reminders", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && Array.isArray(data.ids)) {
          setNotified(data.ids.includes(match.id));
        }
      } catch {
        if (!cancelled) setNotified(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [match.id, profile]);

  async function toggleNotify() {
    if (!profile) {
      await signInWithGoogle("/tournaments");
      return;
    }
    setBusy(true);
    try {
      const next = !notified;
      const res = await fetch("/api/tournaments/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournament_id: match.id,
          enabled: next,
          tournament_title: match.match_title || match.tournament_name,
          game: match.game,
          start_time: match.start_time,
          watch_path: watchPath || null,
        }),
      });
      if (res.ok) setNotified(next);
    } finally {
      setBusy(false);
    }
  }

  async function onWatch(e: React.MouseEvent) {
    if (!watchPath) return;
    if (!profile) {
      e.preventDefault();
      await signInWithGoogle(watchPath);
    }
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-white/5 bg-[#0c101a] shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
        compact ? "min-w-[260px] max-w-[300px] shrink-0" : ""
      )}
    >
      <div className="space-y-3 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-md bg-cyan/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan">
            {match.game}
          </span>
          {isLive ? (
            <span className="live-pulse rounded-md bg-crimson px-2 py-0.5 text-[10px] font-black text-white">
              LIVE
            </span>
          ) : (
            <span className="rounded-md bg-purple/20 px-2 py-0.5 text-[10px] font-bold text-purple">
              {countdownLabel(match.start_time)}
            </span>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {match.tournament_name}
          </p>
          <h3 className="mt-1 font-display text-base font-bold leading-snug text-white">
            {match.match_title}
          </h3>
        </div>

        {(match.team_a || match.team_b) && (
          <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
            {match.team_a_logo && (
              <Image src={match.team_a_logo} alt="" width={22} height={22} className="rounded-full" unoptimized />
            )}
            <p className="min-w-0 flex-1 truncate text-xs font-semibold">
              {match.team_a || "TBD"} <span className="text-muted">vs</span> {match.team_b || "TBD"}
            </p>
            {match.team_b_logo && (
              <Image src={match.team_b_logo} alt="" width={22} height={22} className="rounded-full" unoptimized />
            )}
          </div>
        )}

        <p className="text-[11px] text-muted">{formatLocalStart(match.start_time)}</p>

        <div className="flex flex-wrap gap-2">
          {isLive && watchPath ? (
            <Link
              href={watchPath}
              onClick={onWatch}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-crimson px-3 py-2 text-xs font-bold text-white"
            >
              <Play size={13} fill="currentColor" /> Watch Live
            </Link>
          ) : isLive ? (
            <span className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-muted">
              Stream link pending
            </span>
          ) : isUpcoming ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleNotify()}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-60",
                notified
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-border-glow text-white hover:border-cyan/40"
              )}
            >
              <Bell size={13} /> {notified ? "Reminder On" : "Notify Me"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
