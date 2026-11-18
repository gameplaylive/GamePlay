import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function timeAgo(date: string | null): string {
  if (!date) return "NEW";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_PROJECT")
  );
}

/** India-first language filter for the homepage feed */
export const LANGUAGES = [
  "All",
  "Hindi",
  "English",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Spanish",
  "Portuguese",
  "Korean",
  "Japanese",
] as const;

/** Best-effort language tag from stream title/description (no extra API quota). */
export function detectStreamLanguage(title: string, description = ""): string {
  const text = `${title} ${description}`;
  const lower = text.toLowerCase();
  if (/[\u0900-\u097F]/.test(text) || /\b(hindi|हिंदी|हिन्दी)\b/.test(lower)) return "Hindi";
  if (/[\u0B80-\u0BFF]/.test(text) || /\btamil\b/.test(lower)) return "Tamil";
  if (/[\u0C00-\u0C7F]/.test(text) || /\btelugu\b/.test(lower)) return "Telugu";
  if (/[\u0C80-\u0CFF]/.test(text) || /\bkannada\b/.test(lower)) return "Kannada";
  if (/[\u0D00-\u0D7F]/.test(text) || /\bmalayalam\b/.test(lower)) return "Malayalam";
  if (/[\u0980-\u09FF]/.test(text) || /\bbengali\b/.test(lower)) return "Bengali";
  if (/\bmarathi\b/.test(lower)) return "Marathi";
  if (/\b(spanish|español|espanol)\b/.test(lower)) return "Spanish";
  if (/\b(portuguese|português|brasileiro)\b/.test(lower)) return "Portuguese";
  if (/[\uAC00-\uD7AF]/.test(text) || /\bkorean\b/.test(lower)) return "Korean";
  if (/[\u3040-\u30FF]/.test(text) || /\bjapanese\b/.test(lower)) return "Japanese";
  return "English";
}
