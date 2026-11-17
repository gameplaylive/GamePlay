import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EventReminder, PulseEventType } from "@/lib/types";

export const dynamic = "force-dynamic";

const memoryReminders = new Map<string, EventReminder[]>();

async function getUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) {
    return NextResponse.json({ reminders: [], notifications: [], unread: 0 });
  }

  if (!supabase || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const list = memoryReminders.get(user.id) || [];
    return NextResponse.json({ reminders: list, notifications: [], unread: 0, demo: true });
  }

  const [{ data: reminders }, { data: notifications }] = await Promise.all([
    supabase
      .from("event_reminders")
      .select("*")
      .eq("user_id", user.id)
      .order("event_start_time", { ascending: true }),
    supabase
      .from("in_app_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const unread = (notifications || []).filter((n) => !n.is_read).length;
  return NextResponse.json({
    reminders: reminders || [],
    notifications: notifications || [],
    unread,
  });
}

export async function POST(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json();

  if (body?.action === "mark_read") {
    if (!supabase) return NextResponse.json({ ok: true, demo: true });
    await supabase
      .from("in_app_notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    return NextResponse.json({ ok: true });
  }

  const event_id = String(body.event_id || "");
  const event_title = String(body.event_title || "");
  const event_type = String(body.event_type || "game_show") as PulseEventType;
  const stream_url = String(body.stream_url || "");
  const event_start_time = String(body.event_start_time || "");
  const push_subscription = body.push_subscription || null;

  if (!event_id || !event_title || !event_start_time) {
    return NextResponse.json({ error: "Missing event fields" }, { status: 400 });
  }

  const row = {
    user_id: user.id,
    user_email: user.email || null,
    push_subscription,
    event_id,
    event_title,
    event_type,
    stream_url,
    event_start_time,
  };

  if (!supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const list = memoryReminders.get(user.id) || [];
    const existing = list.find((r) => r.event_id === event_id);
    if (existing) {
      existing.push_subscription = push_subscription;
      return NextResponse.json({ reminder: existing, demo: true });
    }
    const created: EventReminder = {
      id: crypto.randomUUID(),
      ...row,
      notified_48h: false,
      notified_24h: false,
      notified_30m: false,
      notified_live: false,
      created_at: new Date().toISOString(),
    };
    memoryReminders.set(user.id, [created, ...list]);
    return NextResponse.json({ reminder: created, demo: true });
  }

  const { data, error } = await supabase
    .from("event_reminders")
    .upsert(row, { onConflict: "user_id,event_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: data });
}

export async function DELETE(request: Request) {
  const auth = await getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = auth.user.id;
  const eventId = new URL(request.url).searchParams.get("event_id");
  const id = new URL(request.url).searchParams.get("id");
  if (!eventId && !id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (!auth.supabase) {
    const list = memoryReminders.get(userId) ?? [];
    memoryReminders.set(
      userId,
      list.filter((r) => (id ? r.id !== id : r.event_id !== eventId))
    );
    return NextResponse.json({ ok: true, demo: true });
  }

  const del = auth.supabase.from("event_reminders").delete().eq("user_id", userId);
  const { error } = id
    ? await del.eq("id", id)
    : await del.eq("event_id", eventId as string);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
