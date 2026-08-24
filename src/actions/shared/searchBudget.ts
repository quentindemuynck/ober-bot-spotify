import {
  getNextBudgetFreeUpAt,
  getRecentSearchCallCount,
  SAFE_DAILY_SEARCH_BUDGET,
} from "../../db/searchQuota.js";
import { ValidationError } from "../../util/errors.js";

// Rough estimate of Spotify search calls needed per accepted track, given typical AI
// suggestion accuracy and the resolve fallback logic. Used only to warn proactively — actual
// usage varies with how well the AI's suggestions match real tracks.
const ESTIMATED_CALLS_PER_TRACK = 1.4;

function formatWait(freeUpAt: number | null): string {
  if (!freeUpAt) return "shortly";
  const minutes = Math.max(1, Math.round((freeUpAt - Date.now()) / 60_000));
  if (minutes < 60) return `~${minutes}m`;
  return `~${(minutes / 60).toFixed(1)}h`;
}

/**
 * Fails fast with a clear message if we're already near our self-imposed daily search budget,
 * or if the requested playlist size is unlikely to fit in what's left — instead of burning into
 * it and risking Spotify's real (and much worse — a full 24h lockout) quota enforcement.
 */
export function assertSearchBudgetAvailable(targetTrackCount?: number): void {
  const used = getRecentSearchCallCount();
  const remaining = SAFE_DAILY_SEARCH_BUDGET - used;

  if (remaining <= 0) {
    const wait = formatWait(getNextBudgetFreeUpAt());
    throw new ValidationError(
      `You've used ${used}/${SAFE_DAILY_SEARCH_BUDGET} of today's self-imposed Spotify search budget ` +
        `(kept below Spotify's real Development Mode quota to avoid a 24h lockout). Budget starts freeing ` +
        `up again in ${wait}, or use \`/playlist split\` in the meantime, which doesn't use search.`
    );
  }

  if (targetTrackCount) {
    const estimatedCalls = Math.ceil(targetTrackCount * ESTIMATED_CALLS_PER_TRACK);
    if (estimatedCalls > remaining) {
      const wait = formatWait(getNextBudgetFreeUpAt());
      const affordableTracks = Math.floor(remaining / ESTIMATED_CALLS_PER_TRACK);
      throw new ValidationError(
        `Requesting ~${targetTrackCount} tracks will likely need ~${estimatedCalls} Spotify search calls, ` +
          `but only ${remaining}/${SAFE_DAILY_SEARCH_BUDGET} are left in today's self-imposed budget. Try a ` +
          `smaller request (roughly ${affordableTracks} tracks or fewer fits right now), or wait ${wait} for ` +
          "more budget to free up."
      );
    }
  }
}
