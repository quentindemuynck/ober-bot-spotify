import { getNextBudgetFreeUpAt, getRecentSearchCallCount, SAFE_DAILY_SEARCH_BUDGET } from "../db/searchQuota.js";
import { probeSearchAvailability } from "../spotify/search.js";

export interface QuotaStatus {
  used: number;
  limit: number;
  nextFreeUpAt: number | null;
  live: { available: boolean; detail?: string } | null;
}

export async function checkQuotaStatus(): Promise<QuotaStatus> {
  const used = getRecentSearchCallCount();
  const nextFreeUpAt = getNextBudgetFreeUpAt();

  // Only probe Spotify directly if our own budget isn't already exhausted — otherwise we're
  // blocked either way, so there's no point spending a call to confirm it.
  const live = used < SAFE_DAILY_SEARCH_BUDGET ? await probeSearchAvailability() : null;

  return { used, limit: SAFE_DAILY_SEARCH_BUDGET, nextFreeUpAt, live };
}
