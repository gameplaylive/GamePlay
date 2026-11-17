"use client";

import { Copy, MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

export function ShareModal({ open, onClose, url, title }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  const encoded = encodeURIComponent(url);
  const text = encodeURIComponent(`Watch on GamePlay Live: ${title}`);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div
        className="glass glow-border w-full max-w-md animate-in rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Share stream</h3>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-white/5" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 line-clamp-2 text-sm text-muted">{title}</p>
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`https://wa.me/?text=${text}%20${encoded}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border-glow bg-white/5 px-3 py-3 text-sm font-semibold hover:border-cyan/40"
          >
            <MessageCircle size={16} className="text-cyan" /> WhatsApp
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${encoded}&text=${text}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border-glow bg-white/5 px-3 py-3 text-sm font-semibold hover:border-cyan/40"
          >
            X / Twitter
          </a>
          <a
            href={`https://discord.com/channels/@me`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border-glow bg-white/5 px-3 py-3 text-sm font-semibold hover:border-purple/40"
          >
            Discord
          </a>
          <button
            onClick={() => void copy()}
            className="flex items-center justify-center gap-2 rounded-xl border border-border-glow bg-white/5 px-3 py-3 text-sm font-semibold hover:border-gold/40"
          >
            <Copy size={16} /> {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    </div>
  );
}

export async function shareContent(url: string, title: string) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url, text: `Watch on GamePlay Live: ${title}` });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
