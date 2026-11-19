import { createServiceClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/types";
import { MOCK_SETTINGS } from "@/lib/mock-data";

function emptySecrets(partial?: Partial<AppSettings>): AppSettings {
  return {
    ...MOCK_SETTINGS,
    youtube_api_key: process.env.YOUTUBE_API_KEY || "",
    twitch_client_id: process.env.TWITCH_CLIENT_ID || "",
    twitch_client_secret: process.env.TWITCH_CLIENT_SECRET || "",
    ...partial,
  };
}

export async function getAppSettingsFull(): Promise<AppSettings> {
  const supabase = createServiceClient();
  if (!supabase) return emptySecrets();

  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  const row = data as Partial<AppSettings> | null;

  return {
    id: 1,
    pro_price_usd: Number(row?.pro_price_usd ?? MOCK_SETTINGS.pro_price_usd),
    pro_plan_name: row?.pro_plan_name || MOCK_SETTINGS.pro_plan_name,
    pro_plan_description: row?.pro_plan_description || MOCK_SETTINGS.pro_plan_description,
    adsense_enabled: row?.adsense_enabled ?? true,
    adsense_publisher_id:
      row?.adsense_publisher_id ||
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ||
      "",
    adsense_slot_id:
      row?.adsense_slot_id || process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID || "",
    admob_enabled: row?.admob_enabled ?? true,
    admob_app_id: row?.admob_app_id || "",
    admob_banner_unit_id: row?.admob_banner_unit_id || "",
    last_sync_time: row?.last_sync_time ?? null,
    youtube_api_key: row?.youtube_api_key || process.env.YOUTUBE_API_KEY || "",
    twitch_client_id: row?.twitch_client_id || process.env.TWITCH_CLIENT_ID || "",
    twitch_client_secret: row?.twitch_client_secret || process.env.TWITCH_CLIENT_SECRET || "",
  };
}
