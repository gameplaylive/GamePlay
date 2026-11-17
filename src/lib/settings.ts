import { createServiceClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/types";
import { MOCK_SETTINGS } from "@/lib/mock-data";

export async function getAppSettingsFull(): Promise<AppSettings> {
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      ...MOCK_SETTINGS,
      stripe_price_id: process.env.STRIPE_PRICE_ID || "",
      stripe_secret_key: process.env.STRIPE_SECRET_KEY || "",
      stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || "",
      youtube_api_key: process.env.YOUTUBE_API_KEY || "",
      twitch_client_id: process.env.TWITCH_CLIENT_ID || "",
      twitch_client_secret: process.env.TWITCH_CLIENT_SECRET || "",
    };
  }

  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  const row = data as AppSettings | null;

  return {
    id: 1,
    pro_price_usd: Number(row?.pro_price_usd ?? MOCK_SETTINGS.pro_price_usd),
    pro_plan_name: row?.pro_plan_name || MOCK_SETTINGS.pro_plan_name,
    pro_plan_description: row?.pro_plan_description || MOCK_SETTINGS.pro_plan_description,
    adsense_enabled: row?.adsense_enabled ?? true,
    adsense_publisher_id: row?.adsense_publisher_id || "",
    adsense_slot_id: row?.adsense_slot_id || "",
    last_sync_time: row?.last_sync_time ?? null,
    stripe_price_id: row?.stripe_price_id || process.env.STRIPE_PRICE_ID || "",
    stripe_secret_key: row?.stripe_secret_key || process.env.STRIPE_SECRET_KEY || "",
    stripe_webhook_secret: row?.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || "",
    youtube_api_key: row?.youtube_api_key || process.env.YOUTUBE_API_KEY || "",
    twitch_client_id: row?.twitch_client_id || process.env.TWITCH_CLIENT_ID || "",
    twitch_client_secret: row?.twitch_client_secret || process.env.TWITCH_CLIENT_SECRET || "",
  };
}

export async function getStripeClient() {
  const settings = await getAppSettingsFull();
  if (!settings.stripe_secret_key) return { stripe: null, settings };
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(settings.stripe_secret_key, {
    apiVersion: "2026-10-28.endive",
  });
  return { stripe, settings };
}
