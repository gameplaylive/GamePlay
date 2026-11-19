"use client";

import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import type { PulseEvent } from "@/lib/types";
import { pulseTimeLabel } from "@/lib/events";
import { useApp } from "@/components/providers/AppProviders";
import { ensurePushSubscription } from "@/lib/push";
import { cn } from "@/lib/utils";

export function EventsPulseBar() {
  const { profile, signInWithGoogle } = useApp();
  // Start empty so SSR + first client paint match (avoids Date.now / locale hydration errors).
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [reminded, setReminded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/events/pulse");
        const data = await res.json();
        if (cancelled) return;
        if (data.events?.length) setEvents(data.events);
        else setEvents([]);
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const localRaw = localStorage.getItem("gameplay_live_event_reminders");
    const localIds = localRaw
      ? (JSON.parse(localRaw) as Array<{ event_id: string }>).map((r) => r.event_id)
      : [];
    setReminded(new Set(localIds));

    if (!profile) return;
    (async () => {
      try {
        const res = await fetch("/api/reminders");
        const data = await res.json();
        if (data.reminders?.length) {
          setReminded(
            new Set([
              ...localIds,
              ...data.reminders.map((r: { event_id: string }) => r.event_id),
            ])
          );
        }
      } catch {
        // ignore
      }
    })();
  }, [profile]);

  async function onRemind(event: PulseEvent) {
    if (!profile) {
      await signInWithGoogle("/");
      return;
    }
    if (reminded.has(event.id)) return;
    setBusyId(event.id);
    try {
      const push_subscription = await ensurePushSubscription();
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: event.id,
          event_title: event.title,
          event_type: event.event_type,
          stream_url: event.stream_url,
          event_start_time: event.start_time,
          push_subscription,
        }),
      });
      // Persist locally too (covers demo mode without Supabase Auth session)
      const raw = localStorage.getItem("gameplay_live_event_reminders");
      const local = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      if (!local.some((r) => r.event_id === event.id)) {
        local.unshift({
          id: crypto.randomUUID(),
          event_id: event.id,
          event_title: event.title,
          event_type: event.event_type,
          stream_url: event.stream_url,
          event_start_time: event.start_time,
          notified_48h: false,
          notified_24h: false,
          notified_30m: false,
          notified_live: false,
        });
        localStorage.setItem("gameplay_live_event_reminders", JSON.stringify(local));
      }
      if (res.ok || res.status === 401) {
        setReminded((prev) => new Set(prev).add(event.id));
        window.dispatchEvent(new CustomEvent("gpl:reminders-updated"));
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!events.length) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#101522] via-[#0c101a] to-[#14101f]">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson" />
          </span>
          <h2 className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
            Upcoming Events & Game Shows
          </h2>
        </div>
        <p className="hidden shrink-0 text-[10px] text-muted sm:block">News Pulse</p>
      </div>

      <div className="flex items-stretch gap-2.5 overflow-x-auto px-3 py-2.5 scrollbar-hide sm:px-4">
        {events.map((event) => {
          const set = reminded.has(event.id);
          return (
            <article
              key={event.id}
              className="flex w-[220px] shrink-0 flex-col rounded-xl border border-white/8 bg-black/25 p-2.5 backdrop-blur-sm sm:w-[240px]"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wide",
                    event.badge === "TOURNAMENT" && "bg-crimson/20 text-crimson",
                    event.badge === "GAME SHOW" && "bg-gold/20 text-gold",
                    event.badge === "UPCOMING GAMEPLAY" && "bg-purple/20 text-purple"
                  )}
                >
                  {event.badge}
                </span>
                {event.status === "LIVE" && (
                  <span className="live-pulse rounded bg-crimson px-1.5 py-0.5 text-[8px] font-black text-white">
                    LIVE
                  </span>
                )}
              </div>
              <h3 className="line-clamp-2 text-[12px] font-semibold leading-snug text-white">
                {event.title}
              </h3>
              <p className="mt-1 text-[10px] text-cyan">{event.game_name}</p>
              <p className="mt-0.5 text-[9px] text-muted">{pulseTimeLabel(event)}</p>
              <button
                type="button"
                disabled={set || busyId === event.id}
                onClick={() => void onRemind(event)}
                className={cn(
                  "mt-auto inline-flex w-full items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition",
                  set
                    ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                    : "border border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/20"
                )}
              >
                {set ? (
                  <>
                    <Check size={12} /> Reminder Set
                  </>
                ) : (
                  <>
                    <Bell size={12} /> {busyId === event.id ? "Saving…" : "Remind Me"}
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
