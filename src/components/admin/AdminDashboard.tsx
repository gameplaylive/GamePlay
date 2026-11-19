"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers/AppProviders";
import { AdminAnalyticsPanel } from "@/components/admin/AdminAnalyticsPanel";
import { AdminAdEarningsPanel } from "@/components/admin/AdminAdEarningsPanel";
import { AdminTournamentsManager } from "@/components/tournaments/AdminTournamentsManager";
import { AdminPushPanel } from "@/components/admin/AdminPushPanel";
import { MOCK_GAMES, MOCK_SETTINGS, MOCK_STREAMS } from "@/lib/mock-data";
import type { AppSettings, Game, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Tab =
  | "live"
  | "tournaments"
  | "squads"
  | "push"
  | "later"
  | "analytics"
  | "ads"
  | "overview"
  | "pricing"
  | "users"
  | "games"
  | "vault";

function mask(value: string) {
  if (!value) return "";
  if (value.length < 8) return "••••••••";
  return `${value.slice(0, 4)}${"•".repeat(8)}${value.slice(-4)}`;
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
        ok ? "bg-cyan/15 text-cyan" : "bg-crimson/15 text-crimson"
      )}
    >
      {ok ? "Configured" : "Missing"}
    </span>
  );
}

export function AdminDashboard() {
  const { profile, loading, demoMode } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("live");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [games, setGames] = useState<Game[]>(MOCK_GAMES);
  const [userQuery, setUserQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [squadPosts, setSquadPosts] = useState<{ id: string; creator_name: string; game: string; mode: string }[]>([]);
  const [communityLive, setCommunityLive] = useState(0);
  const [kpis, setKpis] = useState({
    users: 0,
    pro: 0,
    games: MOCK_GAMES.length,
    live: MOCK_STREAMS.filter((s) => s.content_type === "live").length,
    videos: MOCK_STREAMS.filter((s) => s.content_type === "video").length,
    mrr: MOCK_SETTINGS.pro_price_usd,
  });

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/login");
      return;
    }
    if (profile.role !== "admin" && !demoMode) {
      router.replace("/");
    }
  }, [profile, loading, demoMode, router]);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    try {
      const [sRes, uRes, gRes, squadRes, communityRes] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/admin/users"),
        fetch("/api/admin/games"),
        fetch("/api/squads"),
        fetch("/api/streams/community"),
      ]);
      if (sRes.ok) {
        const data = await sRes.json();
        setSettings(data.settings as AppSettings);
      } else {
        setSettings({
          ...MOCK_SETTINGS,
          youtube_api_key: "",
          twitch_client_id: "",
          twitch_client_secret: "",
        });
      }
      if (uRes.ok) {
        const data = await uRes.json();
        const list = (data.users || []) as Profile[];
        setUsers(list);
        const pro = list.filter((u) => u.subscription_tier === "pro").length;
        setKpis((k) => ({
          ...k,
          users: list.length,
          pro,
          mrr: pro * Number(settings?.pro_price_usd || MOCK_SETTINGS.pro_price_usd),
        }));
      }
      if (gRes.ok) {
        const data = await gRes.json();
        if (data.games?.length) {
          setGames(data.games as Game[]);
          setKpis((k) => ({ ...k, games: data.games.filter((g: Game) => g.is_active).length }));
        }
      }
      if (squadRes.ok) {
        const data = await squadRes.json();
        setSquadPosts(Array.isArray(data.posts) ? data.posts : []);
      }
      if (communityRes.ok) {
        const data = await communityRes.json();
        setCommunityLive(Array.isArray(data.streams) ? data.streams.length : 0);
      }
    } catch {
      setSettings({
        ...MOCK_SETTINGS,
        youtube_api_key: "",
        twitch_client_id: "",
        twitch_client_secret: "",
      });
    }
  }

  async function syncNow() {
    setSyncing(true);
    setMessage("");
    try {
      const [a, b] = await Promise.all([fetch("/api/sync-streams", { method: "POST" }), fetch("/api/sync-trending", { method: "POST" })]);
      const da = await a.json();
      const db = await b.json();
      setMessage(`Sync done. Streams: ${JSON.stringify(da.results || da.message)}; Trending: ${db.count ?? db.message}`);
      await loadAll();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function savePricing() {
    if (!settings) return;
    const res = await fetch("/api/admin/update-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pro_price_usd: settings.pro_price_usd,
        pro_plan_name: settings.pro_plan_name,
        pro_plan_description: settings.pro_plan_description,
      }),
    });
    const data = await res.json();
    setMessage(res.ok ? `Pricing saved · ₹${data.amount ?? settings.pro_price_usd}/mo (Cashfree INR)` : data.error);
  }

  async function saveVault() {
    if (!settings) return;
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    setMessage(res.ok ? "Vault saved" : data.error);
  }

  async function patchUser(id: string, patch: Partial<Profile>) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    } else {
      const data = await res.json();
      setMessage(data.error || "Update failed");
    }
  }

  async function saveGame(game: Partial<Game> & { id?: string }) {
    const method = game.id ? "PATCH" : "POST";
    const res = await fetch("/api/admin/games", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(game),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    setMessage("Game saved");
    await loadAll();
  }

  if (loading || !profile) {
    return <div className="p-8 text-muted">Loading admin…</div>;
  }

  if (profile.role !== "admin" && !demoMode) {
    return <div className="p-8 text-crimson">Admin access required.</div>;
  }

  const primaryTabs: { id: Tab; label: string }[] = [
    { id: "live", label: "Live Streams" },
    { id: "tournaments", label: "Tournaments & Cups" },
    { id: "squads", label: "Squad Finder" },
    { id: "push", label: "Push Notifications" },
    { id: "later", label: "Later / Phase 2" },
  ];

  const phase2Tabs: { id: Tab; label: string }[] = [
    { id: "analytics", label: "Analytics" },
    { id: "ads", label: "Ad Earnings" },
    { id: "overview", label: "Sync" },
    { id: "users", label: "Users" },
    { id: "games", label: "Games" },
    { id: "vault", label: "API Vault" },
    { id: "pricing", label: "Legacy Pricing" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">Command Center</p>
          <h1 className="font-display text-3xl font-bold">Admin</h1>
          {demoMode && profile.role !== "admin" && (
            <p className="mt-1 text-sm text-gold">Demo preview — connect Supabase and set your role to admin for live controls.</p>
          )}
        </div>
        <Link
          href="/tournaments"
          className="rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-bold text-gold"
        >
          Public Cups →
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
        {primaryTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold",
              tab === t.id || (t.id === "later" && phase2Tabs.some((p) => p.id === tab))
                ? "bg-gold text-obsidian"
                : "border border-border-glow text-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && <p className="rounded-xl border border-border-glow bg-white/5 px-4 py-2 text-sm text-cyan">{message}</p>}

      {tab === "live" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Feed live", kpis.live],
              ["Creator linked", communityLive],
              ["Videos", kpis.videos],
              ["Users", kpis.users],
            ].map(([label, value]) => (
              <div key={label as string} className="glass rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
                <p className="mt-2 font-display text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="glass space-y-3 rounded-2xl p-5">
            <h2 className="font-display text-lg font-bold">Live Streams</h2>
            <p className="text-sm text-muted">
              Sync YouTube/Twitch discovery feeds. Creator-linked streams appear via Go Live (paste link).
            </p>
            <p className="text-xs text-muted">
              Last sync:{" "}
              {settings?.last_sync_time ? new Date(settings.last_sync_time).toLocaleString() : "Never"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void syncNow()}
                disabled={syncing}
                className="btn-primary rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync Live & Latest Now"}
              </button>
              <Link href="/go-live" className="rounded-xl border border-border-glow px-4 py-2.5 text-sm font-semibold">
                Open Go Live
              </Link>
            </div>
          </div>
        </div>
      )}

      {tab === "tournaments" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Create a cup and paste a YouTube/Twitch URL.{" "}
            <span className="text-white">Watch Live</span> only appears when that channel is actually
            broadcasting — no sample or offline links.
          </p>
          <AdminTournamentsManager embedded />
        </div>
      )}

      {tab === "squads" && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <h2 className="font-display text-lg font-bold">Squad Finder</h2>
            <p className="mt-1 text-sm text-muted">
              Active open squads right now: <span className="font-bold text-cyan">{squadPosts.length}</span>
            </p>
            <Link href="/#squad-finder" className="mt-3 inline-block text-sm font-bold text-cyan">
              View public Squad Finder →
            </Link>
          </div>
          <div className="space-y-2">
            {squadPosts.slice(0, 20).map((p) => (
              <div key={p.id} className="glass flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.creator_name}</p>
                  <p className="text-xs text-muted">
                    {p.game} · {p.mode}
                  </p>
                </div>
              </div>
            ))}
            {squadPosts.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted">
                No active squad posts.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "push" && <AdminPushPanel />}

      {tab === "later" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Phase 2 / ops tools — sponsors, boosts, vault, and deep analytics live here so the main
            tabs stay simple.
          </p>
          <div className="flex flex-wrap gap-2">
            {phase2Tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="rounded-full border border-border-glow px-4 py-2 text-sm font-semibold text-muted hover:text-white"
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-sm text-muted">
            <p className="font-semibold text-white/80">Later / Phase 2</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Sponsor / boost placements on homepage cards</li>
              <li>Paid pin for Squad Finder (kept off while app is free)</li>
              <li>Server push for tournament Notify Me</li>
            </ul>
          </div>
        </div>
      )}

      {tab === "analytics" && <AdminAnalyticsPanel />}

      {tab === "ads" && <AdminAdEarningsPanel />}

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              ["Users", kpis.users],
              ["Pro", kpis.pro],
              ["Games", kpis.games],
              ["Live", kpis.live],
              ["Videos", kpis.videos],
              ["MRR", `$${Number(kpis.mrr).toFixed(2)}`],
            ].map(([label, value]) => (
              <div key={label as string} className="glass rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
                <p className="mt-2 font-display text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-sm text-muted">
              Last sync: {settings?.last_sync_time ? new Date(settings.last_sync_time).toLocaleString() : "Never"}
            </p>
            <button
              onClick={() => void syncNow()}
              disabled={syncing}
              className="btn-primary mt-3 rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "Sync Live & Latest Now"}
            </button>
          </div>
        </div>
      )}

      {tab === "pricing" && settings && (
        <div className="glass max-w-xl space-y-3 rounded-2xl p-5">
          <label className="block text-sm">
            Plan name
            <input
              className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
              value={settings.pro_plan_name}
              onChange={(e) => setSettings({ ...settings, pro_plan_name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea
              className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
              rows={3}
              value={settings.pro_plan_description}
              onChange={(e) => setSettings({ ...settings, pro_plan_description: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Monthly price (INR ₹)
            <input
              type="number"
              min={1}
              step={1}
              className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
              value={settings.pro_price_usd}
              onChange={(e) => setSettings({ ...settings, pro_price_usd: Number(e.target.value) })}
            />
          </label>
          <p className="text-xs text-muted">Charged in India via Cashfree (UPI / cards / netbanking).</p>
          <button onClick={() => void savePricing()} className="rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-obsidian">
            Save pricing
          </button>
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-3">
          <input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void fetch(`/api/admin/users?q=${encodeURIComponent(userQuery)}`).then((r) => r.json()).then((d) => setUsers(d.users || []))}
            placeholder="Search users…"
            className="w-full max-w-md rounded-xl border border-border-glow bg-glass px-3 py-2 text-sm"
          />
          <div className="overflow-x-auto rounded-2xl border border-border-glow">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Banned</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border-glow/60">
                    <td className="px-3 py-2">
                      <p className="font-semibold">{u.full_name || "—"}</p>
                      <p className="text-xs text-muted">{u.email}</p>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() =>
                          void patchUser(u.id, {
                            subscription_tier: u.subscription_tier === "pro" ? "free" : "pro",
                          })
                        }
                        className="rounded-full border border-gold/40 px-3 py-1 text-xs text-gold"
                      >
                        {u.subscription_tier === "pro" ? "Revoke Pro" : "Grant Pro"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => void patchUser(u.id, { role: u.role === "admin" ? "user" : "admin" })}
                        className="rounded-full border border-cyan/40 px-3 py-1 text-xs text-cyan"
                      >
                        {u.role === "admin" ? "Demote" : "Promote"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => void patchUser(u.id, { is_banned: !u.is_banned })}
                        className="rounded-full border border-crimson/40 px-3 py-1 text-xs text-crimson"
                      >
                        {u.is_banned ? "Unban" : "Ban"}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-muted">
                      No users yet (connect Supabase Auth).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "games" && (
        <div className="space-y-4">
          <button
            onClick={() =>
              void saveGame({
                title: "New Game",
                slug: `game-${Date.now()}`,
                cover_image: "",
                twitch_game_id: "",
                youtube_query: "gameplay",
                is_active: true,
              })
            }
            className="btn-primary rounded-xl px-4 py-2 text-sm"
          >
            Add game
          </button>
          <div className="grid gap-3 md:grid-cols-2">
            {games.map((g) => (
              <div key={g.id} className="glass space-y-2 rounded-2xl p-4">
                <input
                  className="w-full rounded-lg border border-border-glow bg-obsidian/40 px-2 py-1.5 text-sm"
                  value={g.title}
                  onChange={(e) => setGames((prev) => prev.map((x) => (x.id === g.id ? { ...x, title: e.target.value } : x)))}
                />
                <input
                  className="w-full rounded-lg border border-border-glow bg-obsidian/40 px-2 py-1.5 text-sm"
                  value={g.slug}
                  onChange={(e) => setGames((prev) => prev.map((x) => (x.id === g.id ? { ...x, slug: e.target.value } : x)))}
                />
                <input
                  className="w-full rounded-lg border border-border-glow bg-obsidian/40 px-2 py-1.5 text-sm"
                  placeholder="Cover image URL"
                  value={g.cover_image}
                  onChange={(e) => setGames((prev) => prev.map((x) => (x.id === g.id ? { ...x, cover_image: e.target.value } : x)))}
                />
                <input
                  className="w-full rounded-lg border border-border-glow bg-obsidian/40 px-2 py-1.5 text-sm"
                  placeholder="Twitch game id"
                  value={g.twitch_game_id}
                  onChange={(e) => setGames((prev) => prev.map((x) => (x.id === g.id ? { ...x, twitch_game_id: e.target.value } : x)))}
                />
                <input
                  className="w-full rounded-lg border border-border-glow bg-obsidian/40 px-2 py-1.5 text-sm"
                  placeholder="YouTube query"
                  value={g.youtube_query}
                  onChange={(e) => setGames((prev) => prev.map((x) => (x.id === g.id ? { ...x, youtube_query: e.target.value } : x)))}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={g.is_active}
                      onChange={(e) => setGames((prev) => prev.map((x) => (x.id === g.id ? { ...x, is_active: e.target.checked } : x)))}
                    />
                    Active
                  </label>
                  <button onClick={() => void saveGame(g)} className="rounded-lg bg-cyan px-3 py-1.5 text-xs font-bold text-obsidian">
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "vault" && settings && (
        <div className="glass max-w-2xl space-y-4 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Streaming APIs</p>
          {(
            [
              ["youtube_api_key", "YOUTUBE_API_KEY"],
              ["twitch_client_id", "TWITCH_CLIENT_ID"],
              ["twitch_client_secret", "TWITCH_CLIENT_SECRET"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 flex items-center justify-between gap-2">
                <span>{label}</span>
                <StatusBadge ok={Boolean(settings[key])} />
              </span>
              <input
                type="password"
                autoComplete="off"
                placeholder={settings[key] ? mask(String(settings[key])) : "Paste secret…"}
                className="w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              />
            </label>
          ))}

          <p className="rounded-xl border border-cyan/20 bg-cyan/5 px-3 py-2 text-[11px] text-muted">
            Cashfree keys live in server env only:{" "}
            <code className="text-cyan">CASHFREE_APP_ID</code>,{" "}
            <code className="text-cyan">CASHFREE_SECRET_KEY</code>,{" "}
            <code className="text-cyan">CASHFREE_PLAN_ID_INR</code>,{" "}
            <code className="text-cyan">CASHFREE_WEBHOOK_SECRET</code>,{" "}
            <code className="text-cyan">CASHFREE_ENV</code>. Webhook:{" "}
            <code className="text-cyan">/api/cashfree/webhook</code>
          </p>

          <p className="pt-2 text-xs font-bold uppercase tracking-wider text-muted">AdSense (web / browser)</p>
          {(
            [
              ["adsense_publisher_id", "ADSENSE_PUBLISHER_ID (ca-pub-…)"],
              ["adsense_slot_id", "ADSENSE_SLOT_ID"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 flex items-center justify-between gap-2">
                <span>{label}</span>
                <StatusBadge ok={Boolean(settings[key])} />
              </span>
              <input
                type="password"
                autoComplete="off"
                placeholder={settings[key] ? mask(String(settings[key])) : "Paste…"}
                className="w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.adsense_enabled}
              onChange={(e) => setSettings({ ...settings, adsense_enabled: e.target.checked })}
            />
            AdSense enabled for free tier (web)
          </label>

          <p className="pt-2 text-xs font-bold uppercase tracking-wider text-muted">AdMob (Android app)</p>
          {(
            [
              ["admob_app_id", "ADMOB_APP_ID (ca-app-pub-…~…)"],
              ["admob_banner_unit_id", "ADMOB_BANNER_UNIT_ID (ca-app-pub-…/…)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 flex items-center justify-between gap-2">
                <span>{label}</span>
                <StatusBadge ok={Boolean(settings[key])} />
              </span>
              <input
                type="text"
                autoComplete="off"
                placeholder={settings[key] ? String(settings[key]) : "Paste from AdMob console…"}
                className="w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.admob_enabled !== false}
              onChange={(e) => setSettings({ ...settings, admob_enabled: e.target.checked })}
            />
            AdMob banners enabled for free tier (Android APK)
          </label>
          <p className="text-[11px] text-muted">
            After saving real AdMob IDs, also paste them into{" "}
            <code className="text-cyan">android-native</code> Manifest +{" "}
            <code className="text-cyan">strings.xml</code> before a Play Store build.
          </p>

          <button onClick={() => void saveVault()} className="rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-obsidian">
            Save vault
          </button>
        </div>
      )}
    </div>
  );
}
