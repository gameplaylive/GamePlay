"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  formatWatchDuration,
  type AdminAnalyticsPayload,
  type GameEngagementRow,
  type ProSubscriberRow,
  type StreamLeaderboardRow,
} from "@/lib/admin-analytics";
import { cn } from "@/lib/utils";

type AnalyticsTab = "overview" | "subscribers" | "content" | "games";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#121826] to-[#0a0e16] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-white md:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function LeaderTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border-glow">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2.5 font-bold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-t border-border-glow/50 hover:bg-white/[0.02]">
              {cells.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  const expired = status === "expired";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
        active && "bg-cyan/15 text-cyan",
        expired && "bg-gold/15 text-gold",
        !active && !expired && "bg-white/10 text-muted"
      )}
    >
      {status}
    </span>
  );
}

function streamRows(list: StreamLeaderboardRow[]) {
  return list.map((s) => [
    <div key={`${s.stream_id}-t`}>
      <p className="font-semibold text-white/95">{s.stream_title || "Untitled"}</p>
      <p className="text-[11px] text-muted">
        {s.streamer_name} · {s.platform}
      </p>
    </div>,
    <span key={`${s.stream_id}-g`} className="text-cyan">
      {s.game_title || s.game_slug || "—"}
    </span>,
    <span key={`${s.stream_id}-c`}>{s.watch_count}</span>,
    <span key={`${s.stream_id}-d`}>{formatWatchDuration(s.total_watch_seconds)}</span>,
    <span key={`${s.stream_id}-a`}>
      {s.avg_minutes_per_session > 0
        ? `${s.avg_minutes_per_session}m`
        : s.viewer_count != null
          ? `${s.viewer_count.toLocaleString()} live`
          : "—"}
    </span>,
  ]);
}

export function AdminAnalyticsPanel() {
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const [data, setData] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/analytics");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load analytics");
        setData(null);
        return;
      }
      setData(json as AdminAnalyticsPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: { id: AnalyticsTab; label: string }[] = [
    { id: "overview", label: "User Overview" },
    { id: "subscribers", label: "Subscribers Menu" },
    { id: "content", label: "Most Watched" },
    { id: "games", label: "Game Engagement" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan">Analytics</p>
          <h2 className="font-display text-2xl font-bold text-white">Control Center</h2>
          <p className="mt-1 text-sm text-muted">
            Users, Creator Pro subscribers, watch leaderboards, and game-wise durations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-border-glow px-4 py-2 text-sm font-semibold text-muted hover:border-cyan hover:text-white"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
              tab === t.id
                ? "bg-cyan text-obsidian"
                : "border border-border-glow text-muted hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted">Loading analytics…</p>}
      {error && (
        <p className="rounded-xl border border-crimson/30 bg-crimson/10 px-4 py-2 text-sm text-crimson">
          {error}
        </p>
      )}

      {!loading && data && (
        <>
          {data.source === "proxy" && (
            <p className="rounded-xl border border-gold/25 bg-gold/5 px-4 py-2 text-xs text-gold">
              Showing catalog proxies (viewer counts) until watch-session telemetry accumulates.
              Apply{" "}
              <code className="text-white/80">supabase/migrations/20261118_admin_analytics.sql</code>{" "}
              then watch pages will feed real durations.
            </p>
          )}

          {tab === "overview" && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Registered users" value={data.overview.total_users} />
              <StatCard
                label="Active subscribers"
                value={data.overview.active_subscribers}
                hint="subscription_tier = pro"
              />
              <StatCard label="Live streams" value={data.overview.live_streams} />
              <StatCard
                label="Watch time"
                value={formatWatchDuration(data.overview.total_watch_seconds)}
                hint={`${data.overview.total_watch_sessions} sessions`}
              />
            </div>
          )}

          {tab === "subscribers" && (
            <SubscribersTable rows={data.subscribers} />
          )}

          {tab === "content" && (
            <div className="space-y-6">
              <section className="space-y-2">
                <h3 className="font-display text-lg font-bold">Top creators</h3>
                <LeaderTable
                  columns={["Creator", "Platform", "Watches", "Total time", "Avg / session"]}
                  empty="No creator watch data yet."
                  rows={data.top_creators.map((c) => [
                    <span key={c.streamer_name} className="font-semibold">
                      {c.streamer_name}
                    </span>,
                    <span key={`${c.streamer_name}-p`}>{c.platform || "—"}</span>,
                    <span key={`${c.streamer_name}-w`}>{c.watch_count}</span>,
                    <span key={`${c.streamer_name}-t`}>
                      {formatWatchDuration(c.total_watch_seconds)}
                    </span>,
                    <span key={`${c.streamer_name}-a`}>
                      {c.avg_minutes_per_session > 0
                        ? `${c.avg_minutes_per_session}m`
                        : c.live_viewers != null
                          ? `${c.live_viewers.toLocaleString()} viewers`
                          : "—"}
                    </span>,
                  ])}
                />
              </section>

              <section className="space-y-2">
                <h3 className="font-display text-lg font-bold">Top live matches / streams</h3>
                <LeaderTable
                  columns={["Stream", "Game", "Watches", "Total time", "Avg / live"]}
                  empty="No live watch data yet."
                  rows={streamRows(data.top_live)}
                />
              </section>

              <section className="space-y-2">
                <h3 className="font-display text-lg font-bold">Top video streams</h3>
                <LeaderTable
                  columns={["Video", "Game", "Watches", "Total time", "Avg / session"]}
                  empty="No video watch data yet."
                  rows={streamRows(data.top_videos)}
                />
              </section>
            </div>
          )}

          {tab === "games" && <GameEngagementTable rows={data.game_engagement} />}
        </>
      )}
    </div>
  );
}

function SubscribersTable({ rows }: { rows: ProSubscriberRow[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold">Pro creators</h3>
        <p className="text-xs text-muted">{rows.length} subscriber{rows.length === 1 ? "" : "s"}</p>
      </div>
      <LeaderTable
        columns={["Creator", "Legacy sub ID", "Provider", "Expires", "Status"]}
        empty="No Pro subscribers yet."
        rows={rows.map((s) => [
          <div key={s.id}>
            <p className="font-semibold">{s.full_name || "—"}</p>
            <p className="text-[11px] text-muted">{s.email}</p>
          </div>,
          <code key={`${s.id}-cf`} className="text-[11px] text-cyan">
            {s.cashfree_subscription_id || "—"}
          </code>,
          <span key={`${s.id}-p`}>{s.payment_provider || "cashfree"}</span>,
          <span key={`${s.id}-e`} className="text-xs text-muted">
            {s.pro_expires_at ? new Date(s.pro_expires_at).toLocaleDateString() : "Open"}
          </span>,
          <StatusPill key={`${s.id}-st`} status={s.subscription_status} />,
        ])}
      />
    </div>
  );
}

function GameEngagementTable({ rows }: { rows: GameEngagementRow[] }) {
  return (
    <div className="space-y-2">
      <h3 className="font-display text-lg font-bold">Game-wise engagement</h3>
      <p className="text-sm text-muted">
        Most watched games, total durations, watch counts, and average minutes per session.
      </p>
      <LeaderTable
        columns={["Game", "Watches", "Unique viewers", "Total time", "Avg minutes"]}
        empty="No game engagement yet."
        rows={rows.map((g) => [
          <div key={g.game_slug}>
            <p className="font-semibold">{g.game_title}</p>
            <p className="text-[11px] text-muted">{g.game_slug}</p>
          </div>,
          <span key={`${g.game_slug}-w`}>{g.watch_count}</span>,
          <span key={`${g.game_slug}-u`}>{g.unique_viewers}</span>,
          <span key={`${g.game_slug}-t`}>{formatWatchDuration(g.total_watch_seconds)}</span>,
          <span key={`${g.game_slug}-a`}>
            {g.avg_minutes_per_session > 0 ? `${g.avg_minutes_per_session}m` : "—"}
          </span>,
        ])}
      />
    </div>
  );
}
