import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppSettingsFull } from "@/lib/settings";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const settings = await getAppSettingsFull();
  if (!settings.stripe_secret_key || !settings.stripe_webhook_secret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const stripe = new Stripe(settings.stripe_secret_key, {
    apiVersion: "2026-10-28.endive",
  });

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, settings.stripe_webhook_secret);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid signature" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ received: true, skipped: true });

  async function setTier(userId: string | undefined, tier: "free" | "pro") {
    if (!userId) return;
    await service!.from("profiles").update({ subscription_tier: tier, updated_at: new Date().toISOString() }).eq("id", userId);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await setTier(session.metadata?.supabase_user_id, "pro");
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const tier = sub.status === "active" || sub.status === "trialing" ? "pro" : "free";
      await setTier(sub.metadata?.supabase_user_id, tier);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await setTier(sub.metadata?.supabase_user_id, "free");
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
