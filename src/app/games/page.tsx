"use client";

import Image from "next/image";
import Link from "next/link";
import { useApp } from "@/components/providers/AppProviders";

export default function GamesPage() {
  const { games } = useApp();

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 md:px-6 md:py-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan">Catalog</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Games</h1>
      <p className="mt-2 text-sm text-muted">Jump into live & latest for any title.</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {games.map((g) => (
          <Link
            key={g.id}
            href="/?tab=live"
            className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#0c101a] shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 hover:border-cyan/35"
          >
            <div className="relative aspect-[3/4]">
              <Image
                src={g.cover_image}
                alt={g.title}
                fill
                className="object-cover transition duration-500 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <p className="absolute bottom-2.5 left-2.5 right-2.5 font-display text-sm font-bold leading-tight">
                {g.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
