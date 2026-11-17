import { createServiceClient } from "@/lib/supabase/server";
import { YOUTUBE_SEARCH_SOFT_CAP } from "@/lib/default-games";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function getSearchCallsToday(): Promise<number> {
  const service = createServiceClient();
  if (!service) return 0;
  const { data } = await service
    .from("youtube_quota_daily")
    .select("search_list_calls")
    .eq("day", todayKey())
    .maybeSingle();
  return Number(data?.search_list_calls || 0);
}

export async function canSpendSearchList(): Promise<{ ok: boolean; used: number; cap: number }> {
  const used = await getSearchCallsToday();
  return { ok: used < YOUTUBE_SEARCH_SOFT_CAP, used, cap: YOUTUBE_SEARCH_SOFT_CAP };
}

/** Increment search.list counter (+100 estimated units). */
export async function recordSearchListCall(count = 1, unitsPerCall = 100) {
  const service = createServiceClient();
  if (!service) return;
  const day = todayKey();
  const { data } = await service
    .from("youtube_quota_daily")
    .select("*")
    .eq("day", day)
    .maybeSingle();

  if (!data) {
    await service.from("youtube_quota_daily").insert({
      day,
      search_list_calls: count,
      units_estimated: count * unitsPerCall,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  await service
    .from("youtube_quota_daily")
    .update({
      search_list_calls: Number(data.search_list_calls || 0) + count,
      units_estimated: Number(data.units_estimated || 0) + count * unitsPerCall,
      updated_at: new Date().toISOString(),
    })
    .eq("day", day);
}

/** Increment low-cost calls (channels.list / playlistItems / videos.list ≈ 1 unit each). */
export async function recordLightUnits(units: number) {
  const service = createServiceClient();
  if (!service) return;
  const day = todayKey();
  const { data } = await service
    .from("youtube_quota_daily")
    .select("*")
    .eq("day", day)
    .maybeSingle();

  if (!data) {
    await service.from("youtube_quota_daily").insert({
      day,
      search_list_calls: 0,
      units_estimated: units,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  await service
    .from("youtube_quota_daily")
    .update({
      units_estimated: Number(data.units_estimated || 0) + units,
      updated_at: new Date().toISOString(),
    })
    .eq("day", day);
}
