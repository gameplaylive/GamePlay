import { NextResponse } from "next/server";
import { requireAdminUser, requireServiceClient } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = requireServiceClient();
  if (!service) return NextResponse.json({ error: "Service role missing" }, { status: 503 });

  const { data, error } = await service
    .from("ad_earnings")
    .select("*")
    .order("earning_date", { ascending: false })
    .limit(120);

  if (error) {
    // Table may not be migrated yet
    if (error.message?.includes("does not exist") || error.code === "42P01" || error.code === "PGRST205") {
      return NextResponse.json({
        rows: [],
        totals: { adsense: 0, admob: 0, currency: "INR" },
        migration_required: true,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data || [];
  const adsense = rows
    .filter((r) => r.network === "adsense")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const admob = rows
    .filter((r) => r.network === "admob")
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  return NextResponse.json({
    rows,
    totals: { adsense, admob, currency: "INR" },
    migration_required: false,
  });
}

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = requireServiceClient();
  if (!service) return NextResponse.json({ error: "Service role missing" }, { status: 503 });

  const body = await request.json();
  const network = String(body.network || "");
  if (network !== "adsense" && network !== "admob") {
    return NextResponse.json({ error: "network must be adsense or admob" }, { status: 400 });
  }

  const earning_date = String(body.earning_date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(earning_date)) {
    return NextResponse.json({ error: "earning_date required (YYYY-MM-DD)" }, { status: 400 });
  }

  const row = {
    network,
    earning_date,
    amount: Number(body.amount || 0),
    currency: String(body.currency || "INR"),
    impressions: Number(body.impressions || 0),
    clicks: Number(body.clicks || 0),
    notes: String(body.notes || "").slice(0, 500),
  };

  const { data, error } = await service
    .from("ad_earnings")
    .upsert(row, { onConflict: "network,earning_date,currency" })
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}
