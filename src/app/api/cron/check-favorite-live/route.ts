import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { refreshPinnedCreators } from "@/lib/tracked-creators-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Shared live + recent-video cache for pinned creators (My Gamers).
 * Cloudflare cron ~every 10m — refreshes live status + recent VODs; fires FCM on offline→live.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platformParam = new URL(request.url).searchParams.get("platform") || "all";
  const platform =
    platformParam === "youtube" || platformParam === "twitch" ? platformParam : "all";

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, message: "Supabase not configured" });
  }

  const out = await refreshPinnedCreators(supabase, platform);
  return NextResponse.json({ ok: true, ...out });
}

export async function POST(request: Request) {
  return GET(request);
}
