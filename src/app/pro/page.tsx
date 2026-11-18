"use client";

import { useApp } from "@/components/providers/AppProviders";
import { Bell, Crown, Radio, Sparkles, Trophy } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function ProInner() {
  const { profile, openProModal, refreshProfile } = useApp();
  const sp = useSearchParams();
  const success = sp.get("success");
  const subscriptionId = sp.get("subscription_id") || sp.get("order_id");
  const isPro = profile?.subscription_tier === "pro";
  const [verifyMsg, setVerifyMsg] = useState("");

  useEffect(() => {
    if (!success || !subscriptionId || !profile) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/cashfree/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          await refreshProfile();
          setVerifyMsg("Payment confirmed — Creator Pro is active.");
        } else {
          setVerifyMsg(
            data.status
              ? `Subscription status: ${data.status}. If you paid, Pro activates via Cashfree webhook shortly.`
              : data.error || "Could not confirm payment yet."
          );
        }
      } catch {
        if (!cancelled) setVerifyMsg("Could not verify payment yet. Refresh in a moment.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [success, subscriptionId, profile, refreshProfile]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-[#F5F0E6]/12 bg-gradient-to-br from-[#12160f] via-[#0c100e] to-[#14110c] p-8 shadow-[0_24px_64px_rgba(0,0,0,0.45)]">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#C9A227]/20 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-[#2F8F62]/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[#E8D48A]">
            <Crown size={18} />
            <span className="text-xs font-bold uppercase tracking-[0.25em]">Creator Pro</span>
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold text-[#F5F0E6]">
            Go Live Studio & Creator Pro
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#D9D2C3]/85">
            Unlock the creator studio, Go Live alerts, homepage featuring, and ad-free browsing for
            ₹99/month via Cashfree.
          </p>
          <p className="mt-6 font-display text-5xl font-bold text-[#E8D48A]">
            ₹99
            <span className="text-lg font-medium text-[#B8B0A0]">/mo</span>
          </p>
          <ul className="mt-6 space-y-3 text-sm text-[#F5F0E6]/90">
            <li className="flex items-center gap-2">
              <Radio className="text-[#C9A227]" size={16} /> Go Live Studio (mobile + OBS)
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="text-[#2F8F62]" size={16} /> Stream presets & channel utilities
            </li>
            <li className="flex items-center gap-2">
              <Bell className="text-[#C9A227]" size={16} /> Discord / Go Live alerts
            </li>
            <li className="flex items-center gap-2">
              <Trophy className="text-[#2F8F62]" size={16} /> Homepage community featuring
            </li>
          </ul>
          {(success || verifyMsg) && (
            <p className="mt-4 text-sm text-[#3FA572]">
              {verifyMsg || "Welcome — confirming your Cashfree subscription…"}
            </p>
          )}
          {isPro ? (
            <p className="mt-6 inline-flex rounded-full border border-[#C9A227]/50 px-4 py-2 text-sm font-bold text-[#E8D48A]">
              You&apos;re Creator Pro
            </p>
          ) : (
            <button
              onClick={() => openProModal({ highlight: "go-live" })}
              className="pro-cta-glow mt-6 rounded-2xl bg-gradient-to-r from-[#2F8F62] via-[#3FA572] to-[#C9A227] px-6 py-3.5 font-bold text-[#0B100C]"
            >
              Subscribe with Cashfree — ₹99/mo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProPage() {
  return (
    <Suspense>
      <ProInner />
    </Suspense>
  );
}
