import { env } from "../config/env.js";
import { db } from "./db.js";

// Spotify's Development Mode search quota isn't officially documented, but community reports
// put the daily ceiling around ~200 requests/24h before a full 24h lockout on the endpoint.
// We self-limit well below that (tunable via SEARCH_DAILY_BUDGET) so we fail fast with a clear
// message instead of ever tripping Spotify's actual enforcement again.
const WINDOW_MS = 24 * 60 * 60 * 1000;
export const SAFE_DAILY_SEARCH_BUDGET = env.SEARCH_DAILY_BUDGET;

export function recordSearchCall(): void {
  db.prepare("INSERT INTO search_call_log (called_at) VALUES (?)").run(Date.now());
}

export function getRecentSearchCallCount(): number {
  const cutoff = Date.now() - WINDOW_MS;
  db.prepare("DELETE FROM search_call_log WHERE called_at < ?").run(cutoff);
  const row = db.prepare("SELECT COUNT(*) as count FROM search_call_log").get() as { count: number };
  return row.count;
}

/** Timestamp (ms) the oldest tracked call will age out of the rolling 24h window, freeing up
 * budget — or null if there's no tracked usage right now. */
export function getNextBudgetFreeUpAt(): number | null {
  getRecentSearchCallCount(); // prunes expired rows first
  const row = db.prepare("SELECT MIN(called_at) as oldest FROM search_call_log").get() as {
    oldest: number | null;
  };
  return row.oldest ? row.oldest + WINDOW_MS : null;
}
