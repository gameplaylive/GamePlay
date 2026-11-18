"use client";

import {
  BadgeCheck,
  Bell,
  Crown,
  Radio,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApp, type ProModalOptions } from "@/components/providers/AppProviders";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => {
      checkout: (opts: {
        paymentSessionId?: string;
        subscriptionSessionId?: string;
        redirectTarget?: "_self" | "_blank";
      }) => Promise<unknown>;
    };
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  options?: ProModalOptions;
}

/** Real working Creator Pro benefits — no multi-view grid, XP, or ad-free claims. */
const BENEFITS = [
  {
    icon: Radio,
    title: "Direct-to-YouTube Creator Studio & RTMP",
    desc: "Stream mobile games with 1-tap Google login, OBS ingest credentials, or Android screen capture.",
    accent: "text-[#C9A227]",
    chip: "bg-[#C9A227]/15",
  },
  {
    icon: UserPlus,
    title: "15 Favorite Gamer slots",
    desc: "Track up to 15 YouTube & Twitch creators (vs 5 on Free) with instant live status.",
    accent: "text-[#2F8F62]",
    chip: "bg-[#2F8F62]/15",
  },
  {
    icon: Bell,
    title: "Discord alerts & Pro chat badge",
    desc: "Notify your community via Discord webhooks when you go live, plus a Pro badge in chat and polls.",
    accent: "text-[#C9A227]",
    chip: "bg-[#C9A227]/15",
  },
  {
    icon: Users,
    title: "Unlimited Squad Finder posts",
    desc: "Unlimited Squad Finder posts & priority top pinning so teammates find you first.",
    accent: "text-[#2F8F62]",
    chip: "bg-[#2F8F62]/15",
  },
  {
    icon: BadgeCheck,
    title: "Homepage featuring",
    desc: "Community creators can surface on the GamePlay Live feed while you’re live.",
    accent: "text-[#C9A227]",
    chip: "bg-[#C9A227]/15",
  },
];

function contextualHeader(options?: ProModalOptions) {
  if (options?.contextTitle) return options.contextTitle;
  switch (options?.highlight) {
    case "go-live":
      return "Unlock Direct-to-YouTube Creator Studio with Creator Pro";
    case "favorites":
      return "Unlock 15 Favorite Gamer slots with Creator Pro";
    case "reminders":
      return "Unlock event reminders with Creator Pro";
    case "squads":
      return "Unlimited Squad Finder posts & priority top pinning";
    case "ads":
    case "default":
    default:
      return null;
  }
}

export function CreatorProModal({ open, onClose, options }: Props) {
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

  async function loadCashfreeSdk() {
    if (typeof window === "undefined") return;
    if (window.Cashfree) return;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-cashfree="1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Cashfree SDK failed to load")));
        return;
      }
      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.async = true;
      script.dataset.cashfree = "1";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Cashfree SDK failed to load"));
      document.body.appendChild(script);
    });
  }

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
      const res = await fetch("/api/cashfree/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");

      if (data.authLink) {
        window.location.href = data.authLink;
        return;
      }

      const sessionId = data.subscriptionSessionId || data.paymentSessionId;
      if (!sessionId) throw new Error("Missing Cashfree subscription session");

      await loadCashfreeSdk();
      if (!window.Cashfree) throw new Error("Cashfree SDK unavailable");

      const cashfree = window.Cashfree({
        mode: data.env === "production" ? "production" : "sandbox",
      });
      await cashfree.checkout({
        paymentSessionId: sessionId,
        subscriptionSessionId: sessionId,
        redirectTarget: "_self",
      });
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
      aria-labelledby="creator-pro-title"
    >
      <div
        className="pro-benefits-modal relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_10%_-10%,rgba(47,143,98,0.22),transparent_55%),radial-gradient(ellipse_70%_45%_at_100%_0%,rgba(201,162,39,0.2),transparent_50%),linear-gradient(165deg,#12160f_0%,#0c100e_45%,#14110c_100%)]" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full border border-[#F5F0E6]/10 bg-black/30 p-2 text-[#F5F0E6]/70 hover:bg-black/45 hover:text-[#F5F0E6]"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="relative overflow-y-auto px-5 pb-5 pt-6 sm:px-6 sm:pt-7">
          {context && (
            <p className="mb-3 rounded-full border border-[#C9A227]/35 bg-[#C9A227]/12 px-3 py-1.5 text-center text-[11px] font-bold tracking-wide text-[#E8D48A]">
              {context}
            </p>
          )}

          <div className="flex items-center gap-2 text-[#E8D48A]">
            <Crown size={18} className="text-[#C9A227]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em]">Creator Pro</span>
          </div>

          <h2
            id="creator-pro-title"
            className="mt-2 font-display text-[1.85rem] font-bold leading-tight tracking-tight text-[#F5F0E6] sm:text-[2.1rem]"
          >
            Go Live Studio & Creator Pro
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#D9D2C3]/85">
            Unlock the creator studio, 15 favorite slots, Squad Finder unlimited posts, Discord
            alerts, and Pro chat badge for{" "}
            <span className="font-semibold text-[#E8D48A]">₹99/month</span>.
          </p>

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

          <div className="mt-5 rounded-2xl border border-[#C9A227]/30 bg-gradient-to-br from-[#C9A227]/12 via-transparent to-[#2F8F62]/10 p-4">
            <p className="font-display text-3xl font-bold tracking-tight text-[#E8D48A]">
              ₹99
              <span className="text-base font-medium text-[#B8B0A0]"> / month</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#B8B0A0]">
              Billed monthly at ₹99/mo via Cashfree (UPI AutoPay, Cards &amp; NetBanking). Cancel
              anytime.
            </p>

            {error && <p className="mt-2 text-sm text-[#E07070]">{error}</p>}

            <button
              type="button"
              onClick={() => void checkout()}
              disabled={loading}
              className="pro-cta-glow mt-4 w-full rounded-2xl bg-gradient-to-r from-[#2F8F62] via-[#3FA572] to-[#C9A227] py-3.5 text-[15px] font-bold text-[#0B100C] transition hover:brightness-110 disabled:opacity-55"
            >
              {loading
                ? "Opening Cashfree…"
                : profile
                  ? "Subscribe with Cashfree — ₹99/mo"
                  : "Sign in to Subscribe — ₹99/mo"}
            </button>

            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-[#A89F8F] sm:text-[11px]">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#2F8F62]" />
              <span className="flex-1 text-left sm:text-center">
                Secure India payments powered by Cashfree. No Stripe / Google Play Billing.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated alias */
export { CreatorProModal as ProBenefitsModal };
export { CreatorProModal as ProUpgradeModal };
