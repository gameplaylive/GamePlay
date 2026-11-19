"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Gamepad2, Home, Clapperboard, Users, UserRound, Trophy } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { BrandLogo } from "@/components/BrandLogo";
import { NotificationBell } from "@/components/events/NotificationBell";
import { cn } from "@/lib/utils";

const items = [
  {
    href: "/?tab=live",
    label: "Live",
    icon: Home,
    match: (p: string, t: string | null) => p === "/" && (t === "live" || !t),
  },
  {
    href: "/?tab=trending",
    label: "Latest",
    icon: Clapperboard,
    match: (p: string, t: string | null) => p === "/" && (t === "trending" || t === "favorites"),
  },
  {
    href: "/tournaments",
    label: "Tournaments",
    icon: Trophy,
    match: (p: string) => p.startsWith("/tournaments"),
  },
  {
    href: "/games",
    label: "Games",
    icon: Gamepad2,
    match: (p: string) => p.startsWith("/games"),
  },
  {
    href: "/#squad-finder",
    label: "Squads",
    icon: Users,
    match: (p: string) => p === "/" /* highlight only via hash handled loosely */,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: UserRound,
    match: (p: string) => p.startsWith("/profile") || p.startsWith("/login"),
  },
];

function LiveDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="relative ml-0.5 inline-flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson" />
    </span>
  );
}

function NavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const { profile, signInWithGoogle } = useApp();
  const [hasLiveTournament, setHasLiveTournament] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tournaments");
        const data = await res.json();
        if (!cancelled) setHasLiveTournament(Number(data.live_count || 0) > 0);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mobile dock keeps 5 slots — drop Games so Live / Latest / Cups / Squads / Profile fit
  const mobileItems = items.filter((i) => i.label !== "Games");

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#07090f]/80 backdrop-blur-2xl md:hidden">
        <div className="flex h-12 w-full max-w-[100vw] items-center gap-1 overflow-hidden px-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <BrandLogo size="xs" withWordmark priority className="!h-7 !max-w-[7rem]" />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            {profile ? (
              <Link
                href="/profile"
                className="rounded-full border border-white/15 px-2 py-1 text-[10px] font-bold text-white/90"
              >
                Profile
              </Link>
            ) : (
              <button
                onClick={() => void signInWithGoogle()}
                className="btn-primary rounded-full px-2 py-1 text-[10px]"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <header className="sticky top-0 z-40 hidden border-b border-white/5 bg-[#07090f]/75 backdrop-blur-2xl md:block">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-6">
          <BrandLogo size="sm" withWordmark priority />
          <nav className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] p-1">
            {items.map((item) => {
              const active =
                item.label === "Squads"
                  ? false
                  : item.match(pathname, tab);
              const Icon = item.icon;
              const isTournaments = item.label === "Tournaments";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition lg:px-4",
                    active ? "bg-white/10 text-cyan" : "text-muted hover:text-white",
                    isTournaments && !active && "text-gold/90"
                  )}
                >
                  <Icon size={15} />
                  {item.label}
                  {isTournaments && <LiveDot show={hasLiveTournament} />}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {profile?.role === "admin" && (
              <Link
                href="/admin/tournaments"
                className="rounded-full border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold"
              >
                Tourney Admin
              </Link>
            )}
            {profile?.role === "admin" && (
              <Link
                href="/admin"
                className="rounded-full border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold"
              >
                Admin
              </Link>
            )}
            {profile ? (
              <Link
                href="/profile"
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/90 hover:border-cyan/40"
              >
                {profile.full_name?.split(" ")[0] || "Profile"}
              </Link>
            ) : (
              <button
                onClick={() => void signInWithGoogle()}
                className="btn-primary rounded-full px-4 py-2 text-sm"
              >
                Continue with Google
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="mobile-dock fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/10 bg-[#0b0f18]/92 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
        <div className="mx-auto flex h-[58px] max-w-lg items-center justify-around">
          {mobileItems.map((item) => {
            const active =
              item.label === "Squads" ? false : item.match(pathname, tab);
            const Icon = item.icon;
            const isTournaments = item.label === "Tournaments";
            const label =
              isTournaments ? "Cups" : item.label === "Squads" ? "Squads" : item.label;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[9px] font-bold uppercase tracking-wide",
                  active ? "text-cyan" : "text-muted"
                )}
              >
                <span className="relative">
                  <Icon size={18} />
                  {isTournaments && (
                    <span className="absolute -right-1 -top-0.5">
                      <LiveDot show={hasLiveTournament} />
                    </span>
                  )}
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function NavBar() {
  return (
    <Suspense fallback={<div className="h-12 md:h-[68px]" />}>
      <NavInner />
    </Suspense>
  );
}
