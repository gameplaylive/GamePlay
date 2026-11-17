"use client";

import Image from "next/image";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { BrandLogo } from "@/components/BrandLogo";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function OnboardingModal() {
  const { games, profile, updateProfileLocal } = useApp();
  const [selected, setSelected] = useState<string[]>(profile?.favorite_games || []);
  const [saving, setSaving] = useState(false);

  function toggle(slug: string) {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function save() {
    if (selected.length === 0 || !profile) return;
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      await supabase.from("profiles").update({ favorite_games: selected, updated_at: new Date().toISOString() }).eq("id", profile.id);
    }
    updateProfileLocal({ favorite_games: selected });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-3 sm:items-center">
      <div className="glass glow-border max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5 animate-in sm:p-7">
        <div className="mb-3 flex items-center gap-2">
          <BrandLogo size="xs" href={null} />
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#9B5CFF]">Welcome to GamePlay Live</p>
        </div>
        <h2 className="font-display text-3xl font-bold">Pick your games</h2>
        <p className="mt-2 text-sm text-muted">Tap one or more titles. We&apos;ll personalize your Live & Latest feed.</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {games.map((game) => {
            const active = selected.includes(game.slug);
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => toggle(game.slug)}
                className={cn(
                  "relative overflow-hidden rounded-2xl border text-left transition",
                  active ? "border-cyan shadow-[0_0_24px_rgba(0,240,255,0.25)]" : "border-border-glow opacity-80"
                )}
              >
                <div className="relative aspect-[3/4]">
                  <Image src={game.cover_image} alt={game.title} fill className="object-cover" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <span className="absolute bottom-2 left-2 right-2 font-display text-sm font-bold">{game.title}</span>
                  {active && (
                    <span className="absolute right-2 top-2 rounded-full bg-cyan px-2 py-0.5 text-[10px] font-black text-obsidian">
                      PICKED
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <button
          disabled={selected.length === 0 || saving}
          onClick={() => void save()}
          className="btn-primary mt-6 w-full rounded-2xl py-3.5 text-base disabled:opacity-40"
        >
          {saving ? "Saving…" : "Start Watching"}
        </button>
      </div>
    </div>
  );
}
