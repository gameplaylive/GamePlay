import { NextResponse } from "next/server";
import { loadAdminAnalytics } from "@/lib/admin-analytics";
import { requireAdminUser, requireServiceClient } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = requireServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Service role missing" }, { status: 503 });
  }

  try {
    const analytics = await loadAdminAnalytics(service);
    return NextResponse.json(analytics, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analytics failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
