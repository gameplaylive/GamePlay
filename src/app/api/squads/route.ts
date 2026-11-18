import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  FREE_LIMIT_MESSAGE,
  FREE_SQUAD_POSTS_PER_DAY,
  type SquadPost,
  validateSquadPayload,
} from "@/lib/squads";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const game = searchParams.get("game")?.trim() || "";

  const supabase = createServiceClient() || (await createClient());
  if (!supabase) {
    return NextResponse.json({ posts: [], is_pro: false, free_posts_today: 0, free_limit: FREE_SQUAD_POSTS_PER_DAY });
  }

  let query = supabase
    .from("squad_posts")
    .select(
      "id, user_id, creator_name, is_pro, game, mode, mic_required, in_game_id, note, expires_at, created_at"
    )
    .gt("expires_at", new Date().toISOString())
    .order("is_pro", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);

  if (game && game !== "All") {
    query = query.eq("game", game);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message, posts: [] }, { status: 500 });
  }

  const posts = (data || []) as SquadPost[];

  // Optional quota hint for signed-in users (UI freemium banner)
  let is_pro = false;
  let free_posts_today = 0;
  const userClient = await createClient();
  if (userClient) {
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (user) {
      const { data: profile } = await userClient
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .maybeSingle();
      is_pro = profile?.subscription_tier === "pro";
      if (!is_pro) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from("squad_posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", since);
        free_posts_today = count || 0;
      }
    }
  }

  return NextResponse.json({
    posts,
    is_pro,
    free_posts_today,
    free_limit: FREE_SQUAD_POSTS_PER_DAY,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in with Google to post a squad." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
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
    .select("subscription_tier, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const isPro = profile?.subscription_tier === "pro";

  if (!isPro) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const service = createServiceClient() || supabase;
    const { count } = await service
      .from("squad_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);

    if ((count || 0) >= FREE_SQUAD_POSTS_PER_DAY) {
      return NextResponse.json({ error: FREE_LIMIT_MESSAGE, code: "FREE_LIMIT" }, { status: 429 });
    }
  }

  const creatorName =
    (profile?.full_name || "").trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    (user.email || "").split("@")[0] ||
    "Player";

  const { data, error } = await supabase
    .from("squad_posts")
    .insert({
      user_id: user.id,
      creator_name: creatorName.slice(0, 48),
      is_pro: isPro,
      game: validated.data.game,
      mode: validated.data.mode,
      mic_required: validated.data.mic_required,
      in_game_id: validated.data.in_game_id,
      note: validated.data.note,
      expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    })
    .select(
      "id, user_id, creator_name, is_pro, game, mode, mic_required, in_game_id, note, expires_at, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data as SquadPost });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("squad_posts").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
