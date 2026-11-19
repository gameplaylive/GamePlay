import { NextResponse } from "next/server";
import { requireAdminUser, requireServiceClient } from "@/lib/require-admin";
import { fcmConfigured, sendFcmToMany } from "@/lib/fcm-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!fcmConfigured()) {
    return NextResponse.json(
      { error: "Firebase FCM not configured (FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY)" },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    body?: string;
    image_url?: string;
    deep_link?: string;
  } | null;

  const title = body?.title?.trim();
  const text = body?.body?.trim();
  if (!title || !text) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }

  const service = requireServiceClient();
  if (!service) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { data: devices, error } = await service
    .from("push_devices")
    .select("token")
    .eq("enabled", true)
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const tokens = (devices || []).map((d) => d.token as string).filter(Boolean);

  const result = await sendFcmToMany(tokens, {
    title,
    body: text,
    imageUrl: body?.image_url?.trim() || null,
    url: body?.deep_link?.trim() || "/",
  });

  await service.from("push_campaigns").insert({
    title,
    body: text,
    image_url: body?.image_url?.trim() || null,
    deep_link: body?.deep_link?.trim() || "/",
    created_by: admin.id,
    sent_count: result.sent,
  });

  return NextResponse.json({ ok: true, recipients: tokens.length, ...result });
}
