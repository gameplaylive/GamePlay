import { NextResponse } from "next/server";
import {
  buildSubscriptionId,
  cashfreeCreateSubscription,
  getCashfreeEnvConfig,
} from "@/lib/cashfree";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/utils";

/** Create a Cashfree ₹99/mo Creator Pro subscription session (env-configured). */
export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { appId, secretKey, planId, env, configured } = getCashfreeEnvConfig();
  if (!configured) {
    return NextResponse.json(
      {
        error:
          "Cashfree is not configured. Set CASHFREE_APP_ID, CASHFREE_SECRET_KEY, and CASHFREE_PLAN_ID_INR in the environment.",
      },
      { status: 503 }
    );
  }

  const phone =
    (user.phone && user.phone.replace(/\D/g, "").slice(-10)) ||
    (typeof user.user_metadata?.phone === "string"
      ? String(user.user_metadata.phone).replace(/\D/g, "").slice(-10)
      : "") ||
    "9999999999";

  const subscriptionId = buildSubscriptionId(user.id);

  try {
    const created = await cashfreeCreateSubscription({
      subscriptionId,
      customerId: user.id.replace(/-/g, "").slice(0, 50),
      customerEmail: user.email || "user@gameplaylive.live",
      customerPhone: phone.length === 10 ? phone : "9999999999",
      customerName:
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        undefined,
      returnUrl: `${getAppUrl()}/pro?success=1&subscription_id={subscription_id}`,
      userId: user.id,
      planId,
      appId,
      secretKey,
      env,
      amountInr: 99,
    });

    return NextResponse.json({
      subscriptionId: created.subscriptionId,
      subscriptionSessionId: created.subscriptionSessionId,
      paymentSessionId: created.subscriptionSessionId,
      authLink: created.authLink,
      env,
      amountInr: 99,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 502 }
    );
  }
}
