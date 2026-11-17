import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/settings";
import { getAppUrl } from "@/lib/utils";

export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { stripe, settings } = await getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY in Admin vault." },
      { status: 503 }
    );
  }

  const service = createServiceClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  let customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    if (service) {
      await service.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }
  }

  let priceId = settings.stripe_price_id;
  if (!priceId) {
    const product = await stripe.products.create({
      name: settings.pro_plan_name,
      description: settings.pro_plan_description,
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(Number(settings.pro_price_usd) * 100),
      currency: "usd",
      recurring: { interval: "month" },
    });
    priceId = price.id;
    if (service) {
      await service.from("app_settings").update({ stripe_price_id: priceId }).eq("id", 1);
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${getAppUrl()}/pro?success=1`,
    cancel_url: `${getAppUrl()}/pro?canceled=1`,
    metadata: { supabase_user_id: user.id },
    subscription_data: { metadata: { supabase_user_id: user.id } },
  });

  return NextResponse.json({ url: session.url });
}
