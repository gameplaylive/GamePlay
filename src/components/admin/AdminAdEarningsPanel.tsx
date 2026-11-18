"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  network: "adsense" | "admob";
  earning_date: string;
  amount: number;
  currency: string;
  impressions: number;
  clicks: number;
  notes: string;
};

export function AdminAdEarningsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState({ adsense: 0, admob: 0, currency: "INR" });
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    network: "adsense" as "adsense" | "admob",
    earning_date: new Date().toISOString().slice(0, 10),
    amount: "",
    impressions: "",
    clicks: "",
    notes: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ad-earnings");
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed to load earnings");
      return;
    }
    setRows((data.rows || []) as Row[]);
    setTotals(data.totals || { adsense: 0, admob: 0, currency: "INR" });
    setMigrationRequired(Boolean(data.migration_required));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setMessage("");
    const res = await fetch("/api/admin/ad-earnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        network: form.network,
        earning_date: form.earning_date,
        amount: Number(form.amount || 0),
        impressions: Number(form.impressions || 0),
        clicks: Number(form.clicks || 0),
        notes: form.notes,
        currency: "INR",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Save failed");
      return;
    }
    setMessage("Earnings row saved");
    setForm((f) => ({ ...f, amount: "", impressions: "", clicks: "", notes: "" }));
    await load();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan">Monetization</p>
        <h2 className="font-display text-2xl font-bold text-white">AdSense &amp; AdMob earnings</h2>
        <p className="mt-1 text-sm text-muted">
          Google does not expose live earnings to publishers without AdSense/AdMob API OAuth. Log
          daily amounts from your Google dashboards here so the command center stays accurate.
        </p>
      </div>

      {migrationRequired && (
        <p className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-xs text-gold">
          Run migration{" "}
          <code className="text-white/80">supabase/migrations/20261118_ad_earnings.sql</code> in
          Supabase SQL Editor to enable storage.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-[#121826] p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted">AdSense total</p>
          <p className="mt-2 font-display text-2xl font-bold text-cyan">
            ₹{totals.adsense.toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-[#121826] p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted">AdMob total</p>
          <p className="mt-2 font-display text-2xl font-bold text-gold">
            ₹{totals.admob.toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-[#121826] p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted">Combined</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">
            ₹{(totals.adsense + totals.admob).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="glass grid gap-3 rounded-2xl p-4 md:grid-cols-2">
        <label className="text-sm">
          Network
          <select
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
            value={form.network}
            onChange={(e) =>
              setForm({ ...form, network: e.target.value as "adsense" | "admob" })
            }
          >
            <option value="adsense">AdSense (web)</option>
            <option value="admob">AdMob (Android)</option>
          </select>
        </label>
        <label className="text-sm">
          Date
          <input
            type="date"
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
            value={form.earning_date}
            onChange={(e) => setForm({ ...form, earning_date: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Amount (INR)
          <input
            type="number"
            step="0.01"
            min="0"
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Impressions
          <input
            type="number"
            min="0"
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
            value={form.impressions}
            onChange={(e) => setForm({ ...form, impressions: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Clicks
          <input
            type="number"
            min="0"
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
            value={form.clicks}
            onChange={(e) => setForm({ ...form, clicks: e.target.value })}
          />
        </label>
        <label className="text-sm md:col-span-2">
          Notes
          <input
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Copied from AdSense / AdMob reports"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-obsidian md:col-span-2"
        >
          Save earnings row
        </button>
      </div>

      {message && (
        <p className="rounded-xl border border-border-glow bg-white/5 px-4 py-2 text-sm text-cyan">
          {message}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border-glow">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-[10px] uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Network</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Impr.</th>
              <th className="px-3 py-2">Clicks</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border-glow/50">
                <td className="px-3 py-2">{r.earning_date}</td>
                <td className="px-3 py-2 uppercase">{r.network}</td>
                <td className="px-3 py-2">
                  ₹{Number(r.amount).toFixed(2)} {r.currency}
                </td>
                <td className="px-3 py-2">{r.impressions}</td>
                <td className="px-3 py-2">{r.clicks}</td>
                <td className="px-3 py-2 text-xs text-muted">{r.notes || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  No earnings logged yet. Paste daily totals from Google AdSense / AdMob.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
