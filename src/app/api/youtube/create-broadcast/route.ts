import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Body {
  title?: string;
  game?: string;
  googleAccessToken?: string;
}

async function ytJson(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = (data.error as { message?: string } | undefined)?.message || text || res.statusText;
    throw new Error(`YouTube API error (${res.status}): ${err}`);
  }
  return data;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, is_banned, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_banned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as Body;
  const title = (body.title || "Gameplay Live stream").trim().slice(0, 100);
  const game = (body.game || "Other").trim();
  const description = `${game} live on GamePlay Live — screen stream from mobile.`;

  // Prefer explicit token from client (Google provider_token after YouTube scope consent)
  let accessToken = (body.googleAccessToken || "").trim();
  if (!accessToken) {
    const { data: sessionData } = await supabase.auth.getSession();
    accessToken = sessionData.session?.provider_token || "";
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Connect YouTube with Google first (YouTube scope required).",
        code: "YOUTUBE_AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }

  try {
    const broadcast = await ytJson(
      "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          snippet: {
            title,
            description,
            scheduledStartTime: new Date().toISOString(),
          },
          status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: false,
          },
          contentDetails: {
            enableAutoStart: true,
            enableAutoStop: true,
            monitorStream: { enableMonitorStream: false },
          },
        }),
      }
    );

    const stream = await ytJson(
      "https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn,status",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          snippet: {
            title: `${title} · ingest`,
            description,
          },
          cdn: {
            frameRate: "variable",
            ingestionType: "rtmp",
            resolution: "variable",
          },
        }),
      }
    );

    const broadcastId = String(broadcast.id || "");
    const streamId = String(stream.id || "");
    if (!broadcastId || !streamId) {
      throw new Error("YouTube did not return broadcast/stream ids");
    }

    await ytJson(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${encodeURIComponent(broadcastId)}&part=id,contentDetails,snippet,status&streamId=${encodeURIComponent(streamId)}`,
      accessToken,
      { method: "POST" }
    );

    const cdn = stream.cdn as
      | {
          ingestionInfo?: { streamName?: string; ingestionAddress?: string; rtmpsIngestionAddress?: string };
        }
      | undefined;
    const streamKey = cdn?.ingestionInfo?.streamName || "";
    const ingestionAddress =
      cdn?.ingestionInfo?.rtmpsIngestionAddress ||
      cdn?.ingestionInfo?.ingestionAddress ||
      "rtmps://a.rtmp.youtube.com/live2";
    const rtmpFullUrl = streamKey
      ? `${ingestionAddress.replace(/\/$/, "")}/${streamKey}`
      : "";

    return NextResponse.json({
      youtube_video_id: broadcastId,
      broadcast_id: broadcastId,
      stream_id: streamId,
      stream_key: streamKey,
      rtmp_url: rtmpFullUrl,
      ingestion_address: ingestionAddress,
      watch_url: `https://www.youtube.com/watch?v=${broadcastId}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create YouTube broadcast" },
      { status: 502 }
    );
  }
}
