import { NextResponse } from "next/server";
import { createServiceClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  path?: string;
  client?: string;
  anon_id?: string;
  referrer?: string;
};

function normalizeClient(raw: unknown): "web" | "android" | "ios" | "other" {
  const c = String(raw || "web").toLowerCase();
  if (c === "android" || c === "ios" || c === "web") return c;
  return "other";
}

export async function POST(request: Request) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ ok: false, skipped: true, reason: "no_supabase" });
  }

  const path = String(body.path || "/").slice(0, 500) || "/";
  const client = normalizeClient(body.client);
  const anonId = String(body.anon_id || "").slice(0, 80) || null;
  const referrer = String(body.referrer || "").slice(0, 500) || null;
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 400) || null;

  let userId: string | null = null;
  try {
    const authClient = await createClient();
    if (authClient) {
      const {
        data: { user },
      } = await authClient.auth.getUser();
      userId = user?.id || null;
    }
  } catch {
    /* ignore */
  }

  const { error } = await service.from("analytics_page_views").insert({
    path,
    client,
    anon_id: anonId,
    user_id: userId,
    referrer,
    user_agent: userAgent,
  });

  if (error) {
    // Soft-skip until migration is applied
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      (error.message || "").toLowerCase().includes("does not exist")
    ) {
      return NextResponse.json({ ok: false, skipped: true, reason: "no_table" });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
