"use client";

import { useApp } from "@/components/providers/AppProviders";
import { BrandLogo } from "@/components/BrandLogo";

interface Props {
  nextPath: string;
  title?: string;
}

export function WatchLoginGate({ nextPath, title }: Props) {
  const { signInWithGoogle, loading, supabaseReady } = useApp();

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0c101a]">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(0,240,255,0.25), transparent 45%), radial-gradient(circle at 80% 70%, rgba(178,75,255,0.28), transparent 40%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <BrandLogo size="md" href={null} />
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan">Sign in required</p>
        <h2 className="max-w-md font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Continue with Google to watch
        </h2>
        {title && <p className="line-clamp-2 max-w-sm text-sm text-muted">{title}</p>}
        <button
          type="button"
          disabled={loading}
          onClick={() => void signInWithGoogle(nextPath)}
          className="mt-1 inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-sm font-bold text-[#07090f] shadow-[0_12px_40px_rgba(255,255,255,0.12)] transition hover:scale-[1.02] disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.9 26.7 37 24 37c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.5-6.5 6.6l6.2 5.2C38.4 36.9 44 31.2 44 24c0-1.2-.1-2.3-.4-3.5z" />
          </svg>
          Continue with Google
        </button>
        <p className="max-w-xs text-[11px] text-muted">
          {supabaseReady
            ? "Pick your Google account to unlock playback on GamePlay Live."
            : "Connect Supabase + Google OAuth for the real account picker. Demo unlock works until then."}
        </p>
      </div>
    </div>
  );
}
