"use client";

import { useState } from "react";

export function AdminPushPanel() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [deepLink, setDeepLink] = useState("/");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/push/admin-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          image_url: imageUrl || undefined,
          deep_link: deepLink || "/",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || "Send failed");
      } else {
        setResult(`Sent ${data.sent}/${data.recipients} (failed ${data.failed || 0})`);
        setTitle("");
        setBody("");
        setImageUrl("");
      }
    } catch {
      setResult("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass max-w-xl space-y-3 rounded-2xl p-5">
      <h2 className="font-display text-lg font-bold">Push Notifications</h2>
      <p className="text-sm text-muted">
        Send a promo to all devices that allowed notifications. Users also get 3 automatic digests
        per day (morning / evening / night) in their local timezone once Firebase is connected.
      </p>
      <label className="block text-sm">
        Title
        <input
          className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
          placeholder="BGMI Finals starting soon"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Short description
        <textarea
          className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
          rows={3}
          placeholder="Watch live on GamePlay Live"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Image URL (optional)
        <input
          className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
          placeholder="https://…"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Open link
        <input
          className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
          placeholder="/"
          value={deepLink}
          onChange={(e) => setDeepLink(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || !title.trim() || !body.trim()}
        onClick={() => void send()}
        className="rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-obsidian disabled:opacity-40"
      >
        {busy ? "Sending…" : "Send push to everyone"}
      </button>
      {result && <p className="text-sm text-cyan">{result}</p>}
    </div>
  );
}
