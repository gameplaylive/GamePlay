import { NextResponse } from "next/server";
import { cashfreeApiBase, getCashfreeEnvConfig } from "@/lib/cashfree";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** Confirm Cashfree subscription after return_url and activate Creator Pro. */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    subscriptionId?: string;
    orderId?: string;
  };
  const subscriptionId = String(body.subscriptionId || body.orderId || "").trim();
  if (!subscriptionId) {
    return NextResponse.json({ error: "subscriptionId required" }, { status: 400 });
  }

  const { appId, secretKey, env, configured } = getCashfreeEnvConfig();
  if (!configured) {
    return NextResponse.json({ error: "Cashfree not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${cashfreeApiBase(env)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": appId,
          "x-client-secret": secretKey,
        },
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      subscription_status?: string;
      subscription_id?: string;
      message?: string;
    };
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "Cashfree get subscription failed" },
        { status: 502 }
      );
    }

    const status = String(data.subscription_status || "").toUpperCase();
    const active = ["ACTIVE", "BANK_APPROVAL_PENDING", "ON_HOLD"].includes(status);
    if (!active) {
      return NextResponse.json({ ok: false, status: data.subscription_status || "UNKNOWN" });
    }

    const service = createServiceClient();
    if (service) {
      const expires = new Date();
      expires.setMonth(expires.getMonth() + 1);
      await service
        .from("profiles")
        .update({
          subscription_tier: "pro",
          payment_provider: "cashfree",
          cashfree_subscription_id: data.subscription_id || subscriptionId,
          pro_expires_at: expires.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    return NextResponse.json({ ok: true, status, tier: "pro" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verify failed" },
      { status: 502 }
    );
  }
}
