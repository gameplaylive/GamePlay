import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    game?: string;
    videoId?: string | null;
    discordWebhook?: string;
  };

  const title = String(body.title || "Live now").trim();
  const game = String(body.game || "Game").trim();
  const videoId = body.videoId ? String(body.videoId) : "";
  const watch = videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
  const content = [
    `🔴 **${profile?.full_name || profile?.email || "Creator"} is LIVE**`,
    `${game} · ${title}`,
    watch || "Watch on GamePlay Live",
  ].join("\n");

  const webhooks = [
    body.discordWebhook?.trim(),
    process.env.DISCORD_WEBHOOK_URL?.trim(),
  ].filter(Boolean) as string[];

  if (webhooks.length === 0) {
    return NextResponse.json({
      ok: true,
      message:
        "No Discord webhook configured. Add one in studio alerts or set DISCORD_WEBHOOK_URL.",
    });
  }

  const results = await Promise.allSettled(
    webhooks.map((url) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
    )
  );

  const ok = results.some((r) => r.status === "fulfilled" && (r.value as Response).ok);
  if (!ok) {
    return NextResponse.json({ error: "Discord webhook failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: "Go Live alert sent" });
}
