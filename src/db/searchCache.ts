import { db } from "./db.js";
import type { SpotifyTrack } from "../spotify/types.js";

const FOUND_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days — track metadata rarely changes
// Shorter TTL for "not found" results: gives AI hallucinations / temporarily-unmatched songs a
// chance to resolve differently later, while still avoiding repeat wasted searches short-term.
const NOT_FOUND_TTL_MS = 14 * 24 * 60 * 60 * 1000;

interface SearchCacheRow {
  track_json: string | null;
  cached_at: number;
  found: number;
}

export type CachedSearchResult = { found: true; track: SpotifyTrack } | { found: false };

export function getCachedSearchResult(normalizedKey: string): CachedSearchResult | null {
  const row = db
    .prepare("SELECT * FROM search_cache WHERE normalized_key = ?")
    .get(normalizedKey) as SearchCacheRow | undefined;
  if (!row) return null;

  const ttl = row.found ? FOUND_TTL_MS : NOT_FOUND_TTL_MS;
  if (Date.now() - row.cached_at > ttl) return null;

  if (!row.found || !row.track_json) return { found: false };
  return { found: true, track: JSON.parse(row.track_json) as SpotifyTrack };
}

export function setCachedSearchResult(normalizedKey: string, track: SpotifyTrack | null): void {
  db.prepare(
    `INSERT INTO search_cache (normalized_key, track_json, cached_at, found) VALUES (?, ?, ?, ?)
     ON CONFLICT(normalized_key) DO UPDATE SET
       track_json = excluded.track_json, cached_at = excluded.cached_at, found = excluded.found`
  ).run(normalizedKey, track ? JSON.stringify(track) : null, Date.now(), track ? 1 : 0);
}
