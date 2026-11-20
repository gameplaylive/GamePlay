import { createServiceClient } from "@/lib/supabase/server";
import { YOUTUBE_SEARCH_SOFT_CAP } from "@/lib/default-games";

/**
 * Google default Data API quota is 10,000 units/day.
 * Hard-stop at 9,500 so spikes never trip the real ceiling.
 *
 * Live Now cron: ~72 × search.list / day (every 20 min) ≈ 7,200 units.
 * Shared (fav search, tournaments, light calls): soft-capped — see
 * YOUTUBE_SEARCH_SOFT_CAP (20 × 100 = 2,000). Homepage Events pulse must
 * NOT call search.list (it was starving Live).
 */
export const YOUTUBE_DAILY_UNIT_BUDGET = 9_500;

/** Cost of one search.list */
export const YOUTUBE_SEARCH_LIST_COST = 100;

/** Documented Live reserve (cron). Enforced by soft-capping shared search.list. */
export const YOUTUBE_LIVE_RESERVE_UNITS = 7_200;

/** Typical playlistItems + videos.list pair for one pinned creator */
export const YOUTUBE_PIN_REFRESH_COST = 2;

export type QuotaPurpose = "live" | "shared";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function getQuotaToday(): Promise<{
  searchCalls: number;
  unitsEstimated: number;
  budget: number;
  remaining: number;
  liveReserve: number;
}> {
  const service = createServiceClient();
  const budget = YOUTUBE_DAILY_UNIT_BUDGET;
  if (!service) {
    return {
      searchCalls: 0,
      unitsEstimated: 0,
      budget,
      remaining: budget,
      liveReserve: YOUTUBE_LIVE_RESERVE_UNITS,
    };
  }
  const { data } = await service
    .from("youtube_quota_daily")
    .select("search_list_calls, units_estimated")
    .eq("day", todayKey())
    .maybeSingle();
  const searchCalls = Number(data?.search_list_calls || 0);
  const unitsEstimated = Number(data?.units_estimated || 0);
  return {
    searchCalls,
    unitsEstimated,
    budget,
    remaining: Math.max(0, budget - unitsEstimated),
    liveReserve: YOUTUBE_LIVE_RESERVE_UNITS,
  };
}

export async function getSearchCallsToday(): Promise<number> {
  const q = await getQuotaToday();
  return q.searchCalls;
}

/**
 * Hard unit gate against the daily budget.
 * `purpose` is reserved for callers/logging; Live cron should pass "live".
 * Shared search.list must ALSO pass canSpendSearchList() (soft cap).
 */
export async function canSpendUnits(
  units: number,
  _purpose: QuotaPurpose = "shared"
): Promise<{ ok: boolean; used: number; remaining: number; budget: number }> {
  const q = await getQuotaToday();
  return {
    ok: q.unitsEstimated + units <= q.budget,
    used: q.unitsEstimated,
    remaining: q.remaining,
    budget: q.budget,
  };
}

/**
 * Shared search.list only — keeps ~7,200+ units free for Live cron
 * by capping non-Live search.list count (YOUTUBE_SEARCH_SOFT_CAP).
 */
export async function canSpendSearchList(): Promise<{
  ok: boolean;
  used: number;
  cap: number;
  unitsOk: boolean;
  unitsUsed: number;
  unitsBudget: number;
}> {
  const used = await getSearchCallsToday();
  const units = await canSpendUnits(YOUTUBE_SEARCH_LIST_COST, "shared");
  return {
    ok: used < YOUTUBE_SEARCH_SOFT_CAP && units.ok,
    used,
    cap: YOUTUBE_SEARCH_SOFT_CAP,
    unitsOk: units.ok,
    unitsUsed: units.used,
    unitsBudget: units.budget,
  };
}

/** Atomic increment via RPC when available; else read/modify/write. */
async function bumpQuota(searchDelta: number, unitsDelta: number) {
  const service = createServiceClient();
  if (!service) return;
  const day = todayKey();

  const { error: rpcError } = await service.rpc("youtube_quota_add", {
    p_day: day,
    p_search: searchDelta,
    p_units: unitsDelta,
  });
  if (!rpcError) return;

  const { data } = await service
    .from("youtube_quota_daily")
    .select("*")
    .eq("day", day)
    .maybeSingle();

  if (!data) {
    await service.from("youtube_quota_daily").insert({
      day,
      search_list_calls: Math.max(0, searchDelta),
      units_estimated: Math.max(0, unitsDelta),
      updated_at: new Date().toISOString(),
    });
    return;
  }

  await service
    .from("youtube_quota_daily")
    .update({
      search_list_calls: Number(data.search_list_calls || 0) + searchDelta,
      units_estimated: Number(data.units_estimated || 0) + unitsDelta,
      updated_at: new Date().toISOString(),
    })
    .eq("day", day);
}

/** Increment shared search.list counter (+100 estimated units by default). */
export async function recordSearchListCall(
  count = 1,
  unitsPerCall = YOUTUBE_SEARCH_LIST_COST
) {
  await bumpQuota(count, count * unitsPerCall);
}

/**
 * Live Now cron search.list — counts units toward the daily budget but does
 * NOT increment search_list_calls (keeps the soft cap free for favorites /
 * tournament checks).
 */
export async function recordLiveSearchListCall(
  count = 1,
  unitsPerCall = YOUTUBE_SEARCH_LIST_COST
) {
  await bumpQuota(0, count * unitsPerCall);
}

/** Increment low-cost calls (channels.list / playlistItems / videos.list ≈ 1 unit each). */
export async function recordLightUnits(units: number) {
  if (units <= 0) return;
  await bumpQuota(0, units);
}
