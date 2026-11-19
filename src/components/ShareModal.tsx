"use client";

import { Copy, MessageCircle, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

export interface SharePayload {
  url: string;
  title: string;
  gameTitle?: string;
  streamerName?: string;
  thumbnailUrl?: string;
  isLive?: boolean;
  platform?: string;
}

interface ShareModalProps extends SharePayload {
  open: boolean;
  onClose: () => void;
}

/** Promo copy for WhatsApp / X / clipboard / native share. */
export function buildSharePromo(payload: SharePayload): string {
  const game = payload.gameTitle?.trim() || "Gaming";
  const streamer = payload.streamerName?.trim() || "a creator";
  const live = payload.isLive !== false;
  const line1 = live
    ? `🔥 LIVE now on GamePlay Live`
    : `🎮 Watch on GamePlay Live`;
  const line2 = `📺 ${game} · ${streamer}`;
  const line3 = payload.title?.trim() ? `✨ ${payload.title.trim()}` : "";
  const line4 = `👉 Watch now:`;
  return [line1, line2, line3, line4, payload.url].filter(Boolean).join("\n");
}

export function resolveShareThumbnail(
  payload: Pick<SharePayload, "thumbnailUrl" | "platform" | "url"> & { externalId?: string }
): string {
  const raw = payload.thumbnailUrl?.trim();
  if (raw) return raw.replace("{width}", "1280").replace("{height}", "720");
  try {
    const u = new URL(payload.url, "https://gameplaylive.live");
    const external = u.searchParams.get("external") || payload.externalId || "";
    const platform = payload.platform || u.searchParams.get("platform") || "";
    if (platform === "youtube" && external) {
      return `https://i.ytimg.com/vi/${external}/hqdefault.jpg`;
    }
    if (platform === "twitch" && external) {
      const login = external.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
      if (login) {
        return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-1280x720.jpg`;
      }
    }
  } catch {
    /* ignore */
  }
  return "/icons/icon-512.png";
}

export function ShareModal({
  open,
  onClose,
  url,
  title,
  gameTitle,
  streamerName,
  thumbnailUrl,
  isLive,
  platform,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [discordHint, setDiscordHint] = useState(false);

  const absoluteUrl = useMemo(() => {
    // Only resolve origin when modal is open (keeps SSR/client first paint identical)
    if (!open || /^https?:\/\//i.test(url)) return url;
    if (typeof window === "undefined") return url;
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  }, [url, open]);

  const payload: SharePayload = useMemo(
    () => ({
      url: absoluteUrl,
      title,
      gameTitle,
      streamerName,
      thumbnailUrl,
      isLive,
      platform,
    }),
    [absoluteUrl, title, gameTitle, streamerName, thumbnailUrl, isLive, platform]
  );

  const promo = useMemo(() => buildSharePromo(payload), [payload]);
  const thumb = useMemo(() => resolveShareThumbnail(payload), [payload]);
  const encodedPromo = encodeURIComponent(promo);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setDiscordHint(false);
    }
  }, [open]);

  if (!open) return null;

  async function copy() {
    await navigator.clipboard.writeText(promo);
    setCopied(true);
  }

  async function shareDiscord() {
    await navigator.clipboard.writeText(promo);
    setDiscordHint(true);
    window.open("https://discord.com/channels/@me", "_blank", "noopener,noreferrer");
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

        {/* Preview card — same banner WhatsApp/Discord will unfurl via Open Graph */}
        <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          <div className="relative aspect-[16/9]">
            <Image src={thumb} alt="" fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            {isLive !== false && (
              <span className="live-pulse absolute left-2 top-2 rounded bg-crimson px-1.5 py-0.5 text-[9px] font-black text-white">
                LIVE
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-cyan">
                {gameTitle || "GamePlay Live"}
              </p>
              <p className="line-clamp-2 text-sm font-bold text-white">{title}</p>
              <p className="truncate text-[11px] text-white/70">{streamerName}</p>
            </div>
          </div>
          <p className="border-t border-white/5 px-3 py-2 text-[10px] leading-relaxed text-muted">
            WhatsApp &amp; Discord show this banner as a link preview when friends open your message.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={`https://wa.me/?text=${encodedPromo}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border-glow bg-white/5 px-3 py-3 text-sm font-semibold hover:border-cyan/40"
          >
            <MessageCircle size={16} className="text-cyan" /> WhatsApp
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodedPromo}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border-glow bg-white/5 px-3 py-3 text-sm font-semibold hover:border-cyan/40"
          >
            X / Twitter
          </a>
          <button
            type="button"
            onClick={() => void shareDiscord()}
            className="flex items-center justify-center gap-2 rounded-xl border border-border-glow bg-white/5 px-3 py-3 text-sm font-semibold hover:border-purple/40"
          >
            Discord
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center justify-center gap-2 rounded-xl border border-border-glow bg-white/5 px-3 py-3 text-sm font-semibold hover:border-gold/40"
          >
            <Copy size={16} /> {copied ? "Copied!" : "Copy promo"}
          </button>
        </div>
        {discordHint && (
          <p className="mt-3 text-center text-[11px] text-cyan">
            Promo copied — paste it in Discord to share the banner preview.
          </p>
        )}
      </div>
    </div>
  );
}

export async function shareContent(payload: SharePayload | string, titleMaybe?: string) {
  const data: SharePayload =
    typeof payload === "string"
      ? { url: payload, title: titleMaybe || "GamePlay Live" }
      : payload;

  const text = buildSharePromo(data);

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      // Prefer text+url so WhatsApp opens a rich message; OG image comes from the watch URL.
      await navigator.share({
        title: `${data.gameTitle || "GamePlay Live"} · Watch now`,
        text,
        url: data.url,
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
