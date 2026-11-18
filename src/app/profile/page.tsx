"use client";

import Image from "next/image";
import Link from "next/link";
import { useApp } from "@/components/providers/AppProviders";

export default function ProfilePage() {
  const { profile, signOut, signInWithGoogle, favorites, demoMode, openProModal } = useApp();

  if (!profile) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">Profile</h1>
        <p className="mt-2 text-sm text-muted">Sign in with Google to sync favorites and Pro.</p>
        <button onClick={() => void signInWithGoogle()} className="btn-primary mt-6 rounded-2xl px-6 py-3 text-sm">
          Continue with Google
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-8 md:px-6">
      <div className="glass flex items-center gap-4 rounded-3xl p-5">
        <Image
          src={profile.avatar_url || "/icons/icon-192.png"}
          alt=""
          width={64}
          height={64}
          className="rounded-full border border-border-glow"
          unoptimized
        />
        <div>
          <h1 className="font-display text-2xl font-bold">{profile.full_name || "Player"}</h1>
          <p className="text-sm text-muted">{profile.email}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase">
            <span className="rounded-full bg-white/10 px-2 py-0.5">{profile.subscription_tier}</span>
            {profile.role === "admin" && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-gold">admin</span>}
            {demoMode && <span className="rounded-full bg-purple/20 px-2 py-0.5 text-purple">demo</span>}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 text-sm">
        <p className="font-semibold">Favorite games</p>
        <p className="mt-1 text-muted">{profile.favorite_games?.join(", ") || "None yet"}</p>
        <p className="mt-4 font-semibold">Pinned gamers</p>
        <p className="mt-1 text-muted">{favorites.length ? favorites.map((f) => f.channel_name).join(", ") : "None yet"}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {profile.subscription_tier !== "pro" && (
          <button
            onClick={() => openProModal({ highlight: "default" })}
            className="rounded-full bg-gradient-to-r from-[#2F8F62] to-[#C9A227] px-4 py-2 text-sm font-bold text-[#0B100C]"
          >
            Subscribe to Pro
          </button>
        )}
        {profile.role === "admin" && (
          <Link href="/admin" className="rounded-full border border-gold/40 px-4 py-2 text-sm text-gold">
            Admin
          </Link>
        )}
        <button onClick={() => void signOut()} className="rounded-full border border-border-glow px-4 py-2 text-sm text-muted">
          Sign out
        </button>
      </div>
    </div>
  );
}
