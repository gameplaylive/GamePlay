import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendFcmToMany } from "@/lib/fcm-server";
import {
  maxSlotsForMode,
  shapeSquadPost,
  type SquadPost,
  validateSquadPayload,
} from "@/lib/squads";
import { getAppUrl } from "@/lib/utils";

const SELECT_COLS =
  "id, user_id, creator_name, game, mode, mic_required, in_game_id, note, expires_at, created_at, max_slots, slots_filled, joined_user_ids";

async function viewerId(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string | null;
}> {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id || null };
}

async function notifyHostJoined(hostUserId: string, joinerName: string, game: string) {
  const service = createServiceClient();
  if (!service) return;

  await service.from("in_app_notifications").insert({
    user_id: hostUserId,
    title: "Someone joined your squad",
    body: `${joinerName} joined your ${game} squad. Open Squad Finder to see slots.`,
    link_url: "/#squad-finder",
    is_read: false,
  });

  const { data: devices } = await service
    .from("push_devices")
    .select("token")
    .eq("user_id", hostUserId)
    .eq("enabled", true);
  const tokens = (devices || []).map((d) => String(d.token)).filter(Boolean);
  if (!tokens.length) return;

  await sendFcmToMany(tokens, {
    title: "Squad join",
    body: `${joinerName} joined your ${game} squad`,
    url: `${getAppUrl()}/#squad-finder`,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const game = searchParams.get("game")?.trim() || "";
  const { userId } = await viewerId();

  const supabase = createServiceClient() || (await createClient());
  if (!supabase) {
    return NextResponse.json({ posts: [] });
  }

  let query = supabase
    .from("squad_posts")
    .select(SELECT_COLS)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(60);

  if (game && game !== "All") {
    const g = game.toLowerCase();
    // ETS2 aliases → canonical title used in posts
    if (
      g === "ets2" ||
      g === "ets 2" ||
      g === "euro truck" ||
      g === "euro truck simulator" ||
      g === "euro truck simulator 2"
    ) {
      query = query.eq("game", "Euro Truck Simulator 2");
    } else {
      query = query.eq("game", game);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message, posts: [] }, { status: 500 });
  }

  const posts = (data || []).map((row) => shapeSquadPost(row as Record<string, unknown>, userId));
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const { supabase, userId } = await viewerId();
  if (!supabase || !userId) {
    return NextResponse.json({ error: "Sign in with Google to use Squad Finder." }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in with Google to use Squad Finder." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "create";

  if (action === "join" || action === "leave") {
    return handleMembership(supabase, user, action, body);
  }

  const validated = validateSquadPayload({
    game: typeof body.game === "string" ? body.game : "",
    mode: typeof body.mode === "string" ? body.mode : "",
    in_game_id: typeof body.in_game_id === "string" ? body.in_game_id : "",
    note: typeof body.note === "string" ? body.note : "",
    mic_required: body.mic_required !== false,
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const creatorName =
    (profile?.full_name || "").trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    (user.email || "").split("@")[0] ||
    "Player";

  const maxSlots = maxSlotsForMode(validated.data.mode);

  const { data, error } = await supabase
    .from("squad_posts")
    .insert({
      user_id: user.id,
      creator_name: creatorName.slice(0, 48),
      is_pro: false,
      game: validated.data.game,
      mode: validated.data.mode,
      mic_required: validated.data.mic_required,
      in_game_id: validated.data.in_game_id,
      note: validated.data.note,
      max_slots: maxSlots,
      slots_filled: 1,
      joined_user_ids: [],
      expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    })
    .select(SELECT_COLS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    post: shapeSquadPost(data as Record<string, unknown>, user.id),
  });
}

async function handleMembership(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  action: "join" | "leave",
  body: Record<string, unknown>
) {
  const postId = typeof body.id === "string" ? body.id : "";
  if (!postId) {
    return NextResponse.json({ error: "Missing squad id" }, { status: 400 });
  }

  const service = createServiceClient() || supabase;
  const { data: row, error: fetchErr } = await service
    .from("squad_posts")
    .select(SELECT_COLS)
    .eq("id", postId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Squad not found" }, { status: 404 });
  }

  if (new Date(String(row.expires_at)).getTime() <= Date.now()) {
    return NextResponse.json({ error: "This squad post has expired." }, { status: 410 });
  }

  const hostId = String(row.user_id);
  if (hostId === user.id) {
    return NextResponse.json({ error: "You’re already the host of this squad." }, { status: 400 });
  }

  let joined = Array.isArray(row.joined_user_ids) ? [...(row.joined_user_ids as string[])] : [];
  const maxSlots = Number(row.max_slots || maxSlotsForMode(String(row.mode)));

  if (action === "join") {
    if (joined.includes(user.id)) {
      return NextResponse.json({
        post: shapeSquadPost(row as Record<string, unknown>, user.id),
      });
    }
    if (1 + joined.length >= maxSlots) {
      return NextResponse.json({ error: "Squad is FULL." }, { status: 409 });
    }
    joined.push(user.id);
  } else {
    if (!joined.includes(user.id)) {
      return NextResponse.json({
        post: shapeSquadPost(row as Record<string, unknown>, user.id),
      });
    }
    joined = joined.filter((id) => id !== user.id);
  }

  const slotsFilled = 1 + joined.length;
  const { data: updated, error: updErr } = await service
    .from("squad_posts")
    .update({
      joined_user_ids: joined,
      slots_filled: slotsFilled,
    })
    .eq("id", postId)
    .select(SELECT_COLS)
    .single();

  if (updErr || !updated) {
    return NextResponse.json({ error: updErr?.message || "Update failed" }, { status: 500 });
  }

  if (action === "join") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const joinerName =
      (profile?.full_name || "").trim() ||
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      (user.user_metadata?.name as string | undefined)?.trim() ||
      (user.email || "").split("@")[0] ||
      "A player";
    void notifyHostJoined(hostId, joinerName, String(updated.game || "squad"));
  }

  return NextResponse.json({
    post: shapeSquadPost(updated as Record<string, unknown>, user.id) as SquadPost,
  });
}

export async function DELETE(request: Request) {
  const { supabase, userId } = await viewerId();
  if (!supabase || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("squad_posts").delete().eq("id", id).eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
