import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/utils";
import type { EventReminder } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

type Stage = "48h" | "24h" | "30m" | "live";

function pickStage(mins: number, row: EventReminder): Stage | null {
  if (mins <= 0 && !row.notified_live) return "live";
  if (mins <= 30 && mins > 0 && !row.notified_30m) return "30m";
  if (mins <= 1440 && mins > 30 && !row.notified_24h) return "24h";
  // Spec: 2 days before window: <= 2880 and > 1440
  if (mins <= 2880 && mins > 1440 && !row.notified_48h) return "48h";
  return null;
}

function messageFor(stage: Stage, title: string) {
  switch (stage) {
    case "48h":
      return {
        title: "2 Days Left",
        body: `2 Days Left: ${title} starts in 48 hours!`,
      };
    case "24h":
      return {
        title: "Tomorrow",
        body: `Tomorrow: ${title} starts in 24 hours!`,
      };
    case "30m":
      return {
        title: "Starting in 30 Mins",
        body: `Starting in 30 Mins: Get ready for ${title}!`,
      };
    case "live":
      return {
        title: "LIVE NOW",
        body: `🔴 LIVE NOW: ${title} has started! Click to watch.`,
      };
  }
}

function flagFor(stage: Stage) {
  if (stage === "48h") return { notified_48h: true };
  if (stage === "24h") return { notified_24h: true };
  if (stage === "30m") return { notified_30m: true };
  return { notified_live: true };
}

async function sendWebPush(
  subscription: Record<string, unknown> | null | undefined,
  payload: { title: string; body: string; url: string }
) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@gameplaylive.app";
  if (!publicKey || !privateKey || !subscription) return false;

  try {
    const webpush = await import("web-push");
    webpush.setVapidDetails(subject, publicKey, privateKey);
    await webpush.sendNotification(subscription as never, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error("web push failed", e);
    return false;
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      message: "Supabase service role not configured — cron skipped",
    });
  }

  const { data: rows, error } = await service
    .from("event_reminders")
    .select("*")
    .eq("notified_live", false)
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const appUrl = getAppUrl();
  let sent = 0;

  for (const raw of rows || []) {
    const row = raw as EventReminder;
    const mins = (new Date(row.event_start_time).getTime() - Date.now()) / 60000;
    const stage = pickStage(mins, row);
    if (!stage) continue;

    const msg = messageFor(stage, row.event_title);
    const link =
      row.stream_url ||
      `${appUrl}/tournaments`;

    await service.from("in_app_notifications").insert({
      user_id: row.user_id,
      title: msg.title,
      body: msg.body,
      link_url: link,
      event_id: row.event_id,
      is_read: false,
    });

    await sendWebPush(row.push_subscription, {
      title: `GamePlay Live · ${msg.title}`,
      body: msg.body,
      url: link.startsWith("http") ? link : `${appUrl}${link}`,
    });

    // Optional email hook (logs only unless SMTP configured later)
    if (row.user_email) {
      console.info(`[reminder-email] to=${row.user_email} stage=${stage} title=${row.event_title}`);
    }

    await service.from("event_reminders").update(flagFor(stage)).eq("id", row.id);
    sent += 1;
  }

  return NextResponse.json({ ok: true, processed: sent, scanned: rows?.length || 0 });
}

export async function POST(request: Request) {
  return GET(request);
}
