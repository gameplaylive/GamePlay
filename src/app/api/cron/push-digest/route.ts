import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fcmConfigured, sendFcmToToken } from "@/lib/fcm-server";
import { activeDigestSlot, digestCopy, localParts } from "@/lib/push-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Hourly cron: for each enabled device, if local hour matches morning/evening/night
 * and we haven't sent that slot today, send the digest push.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!fcmConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "FCM not configured" });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no supabase" });
  }

  const { data: devices, error } = await service
    .from("push_devices")
    .select("id, token, timezone")
    .eq("enabled", true)
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  const now = new Date();

  for (const device of devices || []) {
    const tz = (device.timezone as string) || "UTC";
    const slot = activeDigestSlot(tz, now);
    if (!slot) {
      skipped += 1;
      continue;
    }
    const { date } = localParts(tz, now);

    const { data: existing } = await service
      .from("push_digest_log")
      .select("id")
      .eq("device_id", device.id)
      .eq("slot", slot)
      .eq("local_date", date)
      .maybeSingle();

    if (existing) {
      skipped += 1;
      continue;
    }

    const copy = digestCopy(slot);
    const result = await sendFcmToToken(device.token as string, {
      title: copy.title,
      body: copy.body,
      url: copy.url,
    });

    if (!result.ok) {
      skipped += 1;
      continue;
    }

    await service.from("push_digest_log").insert({
      device_id: device.id,
      slot,
      local_date: date,
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, sent, skipped, checked: (devices || []).length });
}
