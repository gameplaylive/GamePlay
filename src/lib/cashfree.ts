import { createHmac, timingSafeEqual } from "crypto";

export type CashfreeEnv = "sandbox" | "production";

export function cashfreeApiBase(env: CashfreeEnv) {
  return env === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

/** Credentials + plan from environment only (never hardcode secrets). */
export function getCashfreeEnvConfig() {
  const appId = process.env.CASHFREE_APP_ID?.trim() || "";
  const secretKey = process.env.CASHFREE_SECRET_KEY?.trim() || "";
  const planId = process.env.CASHFREE_PLAN_ID_INR?.trim() || "";
  const webhookSecret =
    process.env.CASHFREE_WEBHOOK_SECRET?.trim() || secretKey;
  const env = (process.env.CASHFREE_ENV === "production" ? "production" : "sandbox") as CashfreeEnv;
  return {
    appId,
    secretKey,
    planId,
    webhookSecret,
    env,
    configured: Boolean(appId && secretKey && planId),
  };
}

export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string
): boolean {
  if (!signature || !timestamp || !secret) return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest("base64");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildSubscriptionId(userId: string) {
  const compact = userId.replace(/-/g, "").slice(0, 16);
  return `gpl_sub_${compact}_${Date.now()}`.slice(0, 50);
}

export async function cashfreeCreateSubscription(input: {
  subscriptionId: string;
  customerId: string;
  customerEmail: string;
  customerPhone: string;
  customerName?: string;
  returnUrl: string;
  userId: string;
  planId: string;
  appId: string;
  secretKey: string;
  env: CashfreeEnv;
  amountInr?: number;
}) {
  const amount = Math.max(1, Math.round(input.amountInr ?? 99));
  const res = await fetch(`${cashfreeApiBase(input.env)}/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2023-08-01",
      "x-client-id": input.appId,
      "x-client-secret": input.secretKey,
    },
    body: JSON.stringify({
      subscription_id: input.subscriptionId,
      customer_details: {
        customer_id: input.customerId,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
        customer_name: input.customerName || undefined,
      },
      plan_details: {
        plan_id: input.planId,
      },
      authorization_details: {
        authorization_amount: amount,
        authorization_amount_refund: false,
      },
      subscription_meta: {
        return_url: input.returnUrl,
        supabase_user_id: input.userId,
      },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    subscription_id?: string;
    subscription_session_id?: string;
    payment_session_id?: string;
    auth_link?: string;
    message?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new Error(data.message || data.code || "Cashfree create subscription failed");
  }

  const sessionId = data.subscription_session_id || data.payment_session_id;
  if (!sessionId && !data.auth_link) {
    throw new Error("Cashfree did not return a subscription session or auth link");
  }

  return {
    subscriptionId: data.subscription_id || input.subscriptionId,
    subscriptionSessionId: sessionId || "",
    authLink: data.auth_link || null,
  };
}
