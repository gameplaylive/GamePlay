"use client";

import { FormEvent, useState } from "react";
import { LegalShell } from "@/components/legal/LegalShell";

const SUPPORT_EMAIL = "gameplayliveapp@gmail.com";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "");
    const email = String(form.get("email") || "");
    const message = String(form.get("message") || "");
    const subject = encodeURIComponent(`GamePlay Live support from ${name}`);
    const body = encodeURIComponent(`From: ${name} <${email}>\n\n${message}`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <LegalShell title="Contact Us">
      <p>
        Need help with Google sign-in, Go Live Studio, AdSense / AdMob verification, or general
        support? Email us directly or use the form below.
      </p>
      <p className="rounded-xl border border-cyan/20 bg-cyan/5 px-4 py-3 text-sm">
        Official support:{" "}
        <a className="font-semibold text-cyan" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      </p>
      <p className="text-sm text-muted">
        Publisher / site: gameplaylive.live · Operator: Cornerstone Studios
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label className="block text-sm">
          Name
          <input
            name="name"
            required
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Message
          <textarea
            name="message"
            required
            rows={5}
            className="mt-1 w-full rounded-xl border border-border-glow bg-obsidian/50 px-3 py-2"
          />
        </label>
        <button type="submit" className="btn-primary rounded-xl px-5 py-2.5 text-sm">
          Send via email
        </button>
        {sent && <p className="text-xs text-cyan">Opening your email client…</p>}
      </form>
    </LegalShell>
  );
}
