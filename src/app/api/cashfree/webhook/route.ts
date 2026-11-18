import { NextResponse } from "next/server";
import { getCashfreeEnvConfig, verifyCashfreeWebhookSignature } from "@/lib/cashfree";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CashfreeWebhookBody = {
  type?: string;
  event?: string;
  data?: {
    subscription?: {
      subscription_id?: string;
      subscription_status?: string;
      subscription_meta?: { supabase_user_id?: string };
    };
    order?: {
      order_tags?: Record<string, string> | null;
    };
    payment?: { payment_status?: string };
  };
};

export async function POST(request: Request) {
  const { webhookSecret } = getCashfreeEnvConfig();
  if (!webhookSecret) {
    return NextResponse.json({ error: "CASHFREE_WEBHOOK_SECRET / CASHFREE_SECRET_KEY missing" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  if (!verifyCashfreeWebhookSignature(rawBody, signature, timestamp, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: CashfreeWebhookBody;
  try {
    payload = JSON.parse(rawBody) as CashfreeWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ received: true, skipped: true });

  const type = (payload.type || payload.event || "").toUpperCase();
  const subStatus = String(payload.data?.subscription?.subscription_status || "").toUpperCase();
  const payStatus = String(payload.data?.payment?.payment_status || "").toUpperCase();
  const subscriptionId = payload.data?.subscription?.subscription_id || null;

  let userId =
    payload.data?.subscription?.subscription_meta?.supabase_user_id ||
    payload.data?.order?.order_tags?.supabase_user_id ||
    null;

  if (!userId && subscriptionId) {
    const { data } = await service
      .from("profiles")
      .select("id")
      .eq("cashfree_subscription_id", subscriptionId)
      .maybeSingle();
    userId = data?.id || null;
  }

  if (!userId) return NextResponse.json({ received: true, unmatched: true });

  const cancelled =
    ["CANCELLED", "CUSTOMER_CANCELLED", "EXPIRED", "COMPLETED"].includes(subStatus) ||
    type.includes("CANCEL") ||
    type.includes("EXPIRE");

  const active =
    !cancelled &&
    (["ACTIVE", "BANK_APPROVAL_PENDING"].includes(subStatus) ||
      payStatus === "SUCCESS" ||
      type === "PAYMENT_SUCCESS_WEBHOOK" ||
      type.includes("SUBSCRIPTION_STATUS_CHANGED") ||
      type.includes("SUBSCRIPTION_AUTH_STATUS"));

  if (cancelled) {
    await service
      .from("profiles")
      .update({
        subscription_tier: "free",
        payment_provider: "cashfree",
        pro_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  } else if (active) {
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 1);
    await service
      .from("profiles")
      .update({
        subscription_tier: "pro",
        payment_provider: "cashfree",
        cashfree_subscription_id: subscriptionId,
        pro_expires_at: expires.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }

  return NextResponse.json({ received: true });
}
