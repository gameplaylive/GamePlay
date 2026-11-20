"use client";

import Image from "next/image";
import Link from "next/link";
import { AdBanner } from "@/components/AdBanner";
import { useApp } from "@/components/providers/AppProviders";
import { DEFAULT_GAMES, sortByDefaultGameOrder } from "@/lib/default-games";

const GUIDES: Record<string, string> = {
  gta: "GTA V, GTA VI, roleplay, heists — all Grand Theft Auto lives in one place.",
  bgmi: "India’s battlegrounds — scrims, rank push, and tournament watch parties.",
  "free-fire": "Fast mobile battle royale lives popular across India and SEA.",
  valorant: "Tactical FPS ranked grind, VCT watchalongs, and aim training.",
  minecraft: "SMP survival, hardcore challenges, and creative showcases.",
  roblox: "Experiences from Brookhaven to Blox Fruits — creator-led lives.",
  cs2: "Competitive Counter-Strike faceit and tournament streams.",
  "dota-2": "Pro circuits and pub stomps from the ancient battlefield.",
  fortnite: "Zero build, ranked, and creative maps from top builders.",
  "call-of-duty": "Warzone, multiplayer, and COD Mobile action.",
  "euro-truck-simulator-2": "Long-haul convoys, TruckersMP, and chill ETS2 road trips.",
};

export default function GamesPage() {
  const { games } = useApp();
  const catalog = (() => {
    const bySlug = new Map(games.map((g) => [g.slug, g]));
    for (const g of DEFAULT_GAMES) {
      if (!bySlug.has(g.slug)) {
        bySlug.set(g.slug, {
          id: g.id,
          title: g.title,
          slug: g.slug,
          cover_image: g.cover_image,
          twitch_game_id: g.twitch_game_id,
          youtube_query: g.youtube_query,
          is_active: true,
        });
      }
    }
    return sortByDefaultGameOrder([...bySlug.values()]);
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-5 md:px-6 md:py-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan">Catalog</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Games</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Pick a title to jump into GamePlay Live&apos;s curated YouTube and Twitch discovery feed.
          Each category guide below explains what you&apos;ll typically find — then we open the
          official platform player when you watch.
        </p>
      </div>

      {catalog.length > 0 && <AdBanner variant="strip" label="Sponsored" />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {catalog.map((g) => {
          const label = g.slug === "euro-truck-simulator-2" ? "ETS2" : g.title;
          return (
            <Link
              key={g.id}
              href="/?tab=live"
              className="group overflow-hidden rounded-2xl border border-white/5 bg-[#0c101a] shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 hover:border-cyan/35"
            >
              <div className="relative aspect-[3/4]">
                <Image
                  src={g.cover_image}
                  alt={label}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 space-y-1 p-2.5">
                  <p className="font-display text-sm font-bold leading-tight">{label}</p>
                  <p className="line-clamp-2 text-[10px] leading-snug text-white/65">
                    {GUIDES[g.slug] || "Live gameplay and latest videos from this title."}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {catalog.length > 0 && <AdBanner variant="strip" label="Sponsored" />}
    </div>
  );
}
