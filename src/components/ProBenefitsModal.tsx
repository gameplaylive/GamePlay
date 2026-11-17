"use client";

import {
  Bell,
  Crown,
  Grid2X2,
  Pin,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApp, type ProModalOptions } from "@/components/providers/AppProviders";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  options?: ProModalOptions;
}

const BENEFITS = [
  {
    icon: Grid2X2,
    title: "2×2 Multi-View Grid & Audio Focus",
    desc: "Stream up to 4 matches simultaneously and mix audio channels seamlessly.",
    accent: "text-[#2F8F62]",
    chip: "bg-[#2F8F62]/15",
  },
  {
    icon: Radio,
    title: "Direct-to-YouTube Mobile Creator Studio",
    desc: "Stream mobile games (BGMI, Free Fire, etc.) straight to YouTube with 1-tap Google login and zero OBS setup.",
    accent: "text-[#C9A227]",
    chip: "bg-[#C9A227]/15",
  },
  {
    icon: Pin,
    title: "15 Favorite Gamer Slots",
    desc: "Track up to 15 YouTube & Twitch creators (vs. 5 on Free) with smart live notifications.",
    accent: "text-[#2F8F62]",
    chip: "bg-[#2F8F62]/15",
  },
  {
    icon: Trophy,
    title: "1.5× Prediction XP & Global Leaderboards",
    desc: "Earn 50% more XP in daily esports prediction contests for monthly Pro badge rewards.",
    accent: "text-[#C9A227]",
    chip: "bg-[#C9A227]/15",
  },
  {
    icon: Sparkles,
    title: "100% Ad-Free Experience",
    desc: "Zero display banners or sponsor interruptions across all streams and tabs.",
    accent: "text-[#2F8F62]",
    chip: "bg-[#2F8F62]/15",
  },
  {
    icon: Bell,
    title: "4-Stage Smart Event Reminders",
    desc: "Never miss a major tournament with automated alerts at 48h, 24h, 30m, and LIVE.",
    accent: "text-[#C9A227]",
    chip: "bg-[#C9A227]/15",
  },
] as const;

function contextualHeader(options?: ProModalOptions): string | null {
  if (options?.contextTitle) return options.contextTitle;
  switch (options?.highlight) {
    case "go-live":
      return "Unlock Direct-to-YouTube Creator Studio with Pro";
    case "favorites":
      return "Unlock up to 15 Favorite Gamers with Pro";
    case "multi-view":
      return "Unlock 2×2 Multi-View Grid with Pro";
    case "ads":
      return "Go 100% Ad-Free with Gameplay Live Pro";
    case "reminders":
      return "Unlock 4-Stage Smart Event Reminders with Pro";
    default:
      return null;
  }
}

export function ProBenefitsModal({ open, onClose, options }: Props) {
  const { profile, signInWithGoogle, updateProfileLocal, demoMode } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setError("");
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const context = contextualHeader(options);

  async function checkout() {
    setError("");
    if (!profile) {
      await signInWithGoogle();
      return;
    }
    if (demoMode) {
      updateProfileLocal({ subscription_tier: "pro" });
      onClose();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[#07090f]/80 p-3 backdrop-blur-md sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-benefits-title"
    >
      <div
        className="pro-benefits-modal relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cream / green / gold atmosphere (scoped to modal) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_10%_-10%,rgba(47,143,98,0.22),transparent_55%),radial-gradient(ellipse_70%_45%_at_100%_0%,rgba(201,162,39,0.2),transparent_50%),linear-gradient(165deg,#12160f_0%,#0c100e_45%,#14110c_100%)]" />
        <div className="pointer-events-none absolute -right-16 top-8 h-40 w-40 rounded-full bg-[#C9A227]/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-24 h-36 w-36 rounded-full bg-[#2F8F62]/25 blur-3xl" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full border border-[#F5F0E6]/10 bg-black/30 p-2 text-[#F5F0E6]/70 hover:bg-black/45 hover:text-[#F5F0E6]"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="relative overflow-y-auto px-5 pb-5 pt-6 sm:px-6 sm:pt-7">
          {/* 1. Header & value prop */}
          {context && (
            <p className="mb-3 rounded-full border border-[#C9A227]/35 bg-[#C9A227]/12 px-3 py-1.5 text-center text-[11px] font-bold tracking-wide text-[#E8D48A]">
              {context}
            </p>
          )}

          <div className="flex items-center gap-2 text-[#E8D48A]">
            <Crown size={18} className="text-[#C9A227]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em]">Subscription</span>
          </div>

          <h2
            id="pro-benefits-title"
            className="mt-2 font-display text-[1.85rem] font-bold leading-tight tracking-tight text-[#F5F0E6] sm:text-[2.1rem]"
          >
            Gameplay Live Pro{" "}
            <span aria-hidden className="inline-block">
              🚀
            </span>
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#D9D2C3]/85">
            Unlock the ultimate streaming & viewing experience for just{" "}
            <span className="font-semibold text-[#E8D48A]">₹99/month</span>. Zero ads, unlimited
            multi-view, and direct mobile-to-YouTube broadcasting.
          </p>

          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {[
              { label: "Best Value", icon: Zap },
              { label: "Zero Server Lag", icon: ShieldCheck },
              { label: "Creator Approved", icon: Crown },
            ].map(({ label, icon: Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full border border-[#F5F0E6]/12 bg-[#F5F0E6]/06 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#F5F0E6]/90"
              >
                <Icon size={11} className="text-[#2F8F62]" />
                {label}
              </span>
            ))}
          </div>

          {/* 2. Benefits */}
          <ul className="mt-5 space-y-2.5">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <li
                  key={b.title}
                  className="flex gap-3 rounded-2xl border border-[#F5F0E6]/08 bg-[#F5F0E6]/[0.03] p-3"
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      b.chip,
                      b.accent
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-snug text-[#F5F0E6]">{b.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[#B8B0A0]">{b.desc}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* 3. Pricing + CTA */}
          <div className="mt-5 rounded-2xl border border-[#C9A227]/30 bg-gradient-to-br from-[#C9A227]/12 via-transparent to-[#2F8F62]/10 p-4">
            <p className="font-display text-3xl font-bold tracking-tight text-[#E8D48A]">
              ₹99
              <span className="text-base font-medium text-[#B8B0A0]"> / month</span>
            </p>
            <p className="mt-1 text-[11px] text-[#B8B0A0]">
              Billed monthly via Google Play Billing / In-App Purchase or Stripe.
            </p>

            {error && <p className="mt-2 text-sm text-[#E07070]">{error}</p>}

            <button
              type="button"
              onClick={() => void checkout()}
              disabled={loading}
              className="pro-cta-glow mt-4 w-full rounded-2xl bg-gradient-to-r from-[#2F8F62] via-[#3FA572] to-[#C9A227] py-3.5 text-[15px] font-bold text-[#0B100C] transition hover:brightness-110 disabled:opacity-55"
            >
              {loading
                ? "Opening checkout…"
                : profile
                  ? "Upgrade to Pro Now — ₹99/mo"
                  : "Sign in to Upgrade — ₹99/mo"}
            </button>

            <p className="mt-3 flex items-start gap-1.5 text-center text-[10px] leading-relaxed text-[#A89F8F] sm:text-[11px]">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#2F8F62]" />
              <span className="flex-1 text-left sm:text-center">
                Cancel anytime directly from your account settings. Secure checkout.
              </span>
            </p>
            {demoMode && (
              <p className="mt-1 text-center text-[10px] text-[#A89F8F]">
                Demo mode: unlocks Pro locally without payment.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Prefer ProBenefitsModal — kept as alias for existing imports */
export { ProBenefitsModal as ProUpgradeModal };
