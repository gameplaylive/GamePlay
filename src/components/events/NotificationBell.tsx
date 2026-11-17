"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Trash2, X } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import type { EventReminder, InAppNotification } from "@/lib/types";
import { nextAlertMilestone } from "@/lib/events";
import { formatLocalStart } from "@/lib/tournaments";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { profile, signInWithGoogle } = useApp();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"alerts" | "reminders">("reminders");
  const [reminders, setReminders] = useState<EventReminder[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const localRaw = localStorage.getItem("gameplay_live_event_reminders");
    const localReminders = (localRaw ? JSON.parse(localRaw) : []) as EventReminder[];

    if (!profile) {
      setReminders(localReminders);
      setNotifications([]);
      setUnread(0);
      return;
    }
    try {
      const res = await fetch("/api/reminders");
      const data = await res.json();
      const server = (data.reminders || []) as EventReminder[];
      const merged = [...server];
      for (const lr of localReminders) {
        if (!merged.some((r) => r.event_id === lr.event_id)) merged.push(lr);
      }
      setReminders(merged);
      setNotifications(data.notifications || []);
      setUnread(Number(data.unread || 0));
    } catch {
      setReminders(localReminders);
    }
  }, [profile]);

  useEffect(() => {
    void load();
    const onUpdate = () => void load();
    window.addEventListener("gpl:reminders-updated", onUpdate);
    const t = window.setInterval(() => void load(), 60000);
    return () => {
      window.removeEventListener("gpl:reminders-updated", onUpdate);
      window.clearInterval(t);
    };
  }, [load]);

  async function cancelReminder(r: EventReminder) {
    await fetch(`/api/reminders?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
    const raw = localStorage.getItem("gameplay_live_event_reminders");
    if (raw) {
      const list = (JSON.parse(raw) as EventReminder[]).filter(
        (x) => x.id !== r.id && x.event_id !== r.event_id
      );
      localStorage.setItem("gameplay_live_event_reminders", JSON.stringify(list));
    }
    await load();
  }

  async function markAllRead() {
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read" }),
    });
    await load();
  }

  async function onOpen() {
    if (!profile) {
      await signInWithGoogle();
      return;
    }
    setOpen(true);
    await load();
    if (unread > 0) await markAllRead();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void onOpen()}
        className="relative rounded-full border border-white/10 p-2 text-white/80 transition hover:border-cyan/40 hover:text-cyan"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson px-1 text-[9px] font-black text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/40"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0c101a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <p className="font-display text-sm font-bold">Notifications</p>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 text-muted hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex border-b border-white/5 p-1">
              <button
                onClick={() => setTab("reminders")}
                className={cn(
                  "flex-1 rounded-xl py-2 text-xs font-bold",
                  tab === "reminders" ? "bg-white/10 text-cyan" : "text-muted"
                )}
              >
                My Reminders ({reminders.length})
              </button>
              <button
                onClick={() => setTab("alerts")}
                className={cn(
                  "flex-1 rounded-xl py-2 text-xs font-bold",
                  tab === "alerts" ? "bg-white/10 text-cyan" : "text-muted"
                )}
              >
                Alerts ({notifications.length})
              </button>
            </div>

            <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
              {tab === "reminders" &&
                reminders.map((r) => (
                  <div key={r.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <p className="line-clamp-2 text-sm font-semibold">{r.event_title}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">
                      {r.event_type.replace("_", " ")} · {formatLocalStart(r.event_start_time)}
                    </p>
                    <p className="mt-1 text-[11px] text-cyan">{nextAlertMilestone(r)}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {r.stream_url ? (
                        <Link href={r.stream_url} className="text-[11px] font-bold text-purple" target="_blank">
                          Open source
                        </Link>
                      ) : (
                        <span />
                      )}
                      <button
                        onClick={() => void cancelReminder(r)}
                        className="inline-flex items-center gap-1 rounded-full border border-crimson/40 px-2 py-1 text-[10px] font-bold text-crimson"
                      >
                        <Trash2 size={11} /> Cancel
                      </button>
                    </div>
                  </div>
                ))}

              {tab === "reminders" && reminders.length === 0 && (
                <p className="px-2 py-8 text-center text-sm text-muted">
                  No reminders yet. Tap <span className="text-cyan">Remind Me</span> on the news pulse.
                </p>
              )}

              {tab === "alerts" &&
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link_url || "/"}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl border border-white/5 bg-white/[0.03] p-3 hover:border-cyan/30"
                  >
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="mt-1 text-xs text-muted">{n.body}</p>
                  </Link>
                ))}

              {tab === "alerts" && notifications.length === 0 && (
                <p className="px-2 py-8 text-center text-sm text-muted">No alerts yet.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
