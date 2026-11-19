"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import type { TournamentMatch } from "@/lib/types";
import { TournamentCard } from "@/components/tournaments/TournamentCard";

export function FeaturedTournamentsStrip() {
  const [matches, setMatches] = useState<TournamentMatch[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tournaments");
        const data = await res.json();
        if (cancelled) return;
        const featured = ((data.matches || []) as TournamentMatch[])
          .filter((m) => m.status === "LIVE" || m.status === "UPCOMING")
          .slice(0, 8);
        setMatches(featured);
      } catch {
        if (!cancelled) setMatches([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!matches.length) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-gold" />
          <h2 className="font-display text-base font-bold sm:text-lg">Featured Live & Upcoming</h2>
        </div>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-1 text-xs font-bold text-cyan hover:underline sm:text-sm"
        >
          View All Tournaments <ArrowRight size={14} />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {matches.map((m) => (
          <TournamentCard key={m.id} match={m} compact />
        ))}
      </div>
    </section>
  );
}
