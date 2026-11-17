import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/settings";

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, supabase };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const body = await request.json();
  const price = Number(body.pro_price_usd);
  const name = String(body.pro_plan_name || "GamePlay Live Pro");
  const description = String(body.pro_plan_description || "");

  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Service role missing" }, { status: 503 });

  let stripePriceId = "";
  const { stripe } = await getStripeClient();
  if (stripe) {
    const product = await stripe.products.create({ name, description });
    const priceObj = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(price * 100),
      currency: "usd",
      recurring: { interval: "month" },
    });
    stripePriceId = priceObj.id;
  }

  const { error } = await service
    .from("app_settings")
    .update({
      pro_price_usd: price,
      pro_plan_name: name,
      pro_plan_description: description,
      ...(stripePriceId ? { stripe_price_id: stripePriceId } : {}),
    })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, stripe_price_id: stripePriceId || null });
}
