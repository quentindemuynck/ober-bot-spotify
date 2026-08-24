import { getCachedSearchResult, setCachedSearchResult } from "../db/searchCache.js";
import { recordSearchCall } from "../db/searchQuota.js";
import { spotifyFetch } from "./client.js";
import type { ResolvedCandidate, SpotifySearchResult, SpotifyTrack } from "./types.js";

export interface SongCandidate {
  artist: string;
  title: string;
}

const SEARCH_LIMIT = 10; // Development Mode cap

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(feat\.?[^)]*\)/g, "")
    .replace(/\bfeat\.?.*/g, "")
    .replace(/\((remaster(ed)?|live|radio edit|mono|stereo)[^)]*\)/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateCacheKey(candidate: SongCandidate): string {
  return `${normalize(candidate.artist)}::${normalize(candidate.title)}`;
}

function tokenOverlapScore(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalize(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function scoreTrack(candidate: SongCandidate, track: SpotifyTrack): number {
  const titleScore = tokenOverlapScore(candidate.title, track.name);
  const artistNames = track.artists.map((a) => a.name).join(" ");
  const artistScore = tokenOverlapScore(candidate.artist, artistNames);
  return titleScore * 0.6 + artistScore * 0.4;
}

const MATCH_THRESHOLD = 0.5;

async function searchTracks(query: string): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q: query, type: "track", limit: String(SEARCH_LIMIT) });
  recordSearchCall();
  const result = await spotifyFetch<SpotifySearchResult>(`/search?${params.toString()}`);
  return result.tracks?.items ?? [];
}

function bestMatch(candidate: SongCandidate, results: SpotifyTrack[]): { track: SpotifyTrack; score: number } | null {
  let best: { track: SpotifyTrack; score: number } | null = null;
  for (const track of results) {
    const score = scoreTrack(candidate, track);
    if (!best || score > best.score) {
      best = { track, score };
    }
  }
  return best;
}

export async function resolveTrack(candidate: SongCandidate): Promise<ResolvedCandidate | null> {
  const cacheKey = candidateCacheKey(candidate);
  const cached = getCachedSearchResult(cacheKey);
  if (cached) {
    return cached.found ? { track: cached.track, score: 1, queriedAs: candidate } : null;
  }

  const structuredQuery = `track:"${candidate.title}" artist:"${candidate.artist}"`;
  const structuredResults = await searchTracks(structuredQuery);
  let best = bestMatch(candidate, structuredResults);

  // Retry with a looser plain-text query whenever the structured query came up empty OR its
  // best match isn't confident enough — not just on empty results — since this meaningfully
  // improves the match rate per candidate, which in turn means fewer AI-regeneration rounds
  // (and fewer total search calls) are needed to fill out a playlist.
  if (!best || best.score < MATCH_THRESHOLD) {
    const fallbackResults = await searchTracks(`${candidate.artist} ${candidate.title}`);
    const fallbackBest = bestMatch(candidate, fallbackResults);
    if (fallbackBest && (!best || fallbackBest.score > best.score)) {
      best = fallbackBest;
    }
  }

  if (!best || best.score < MATCH_THRESHOLD) {
    setCachedSearchResult(cacheKey, null);
    return null;
  }

  setCachedSearchResult(cacheKey, best.track);

  return {
    track: best.track,
    score: best.score,
    queriedAs: candidate,
  };
}

/** Makes one minimal, real search call to check whether Spotify search is currently reachable
 * (vs. mid-lockout from the Development Mode daily quota). Used by the status command. */
export async function probeSearchAvailability(): Promise<{ available: boolean; detail?: string }> {
  try {
    await searchTracks("a");
    return { available: true };
  } catch (err) {
    return { available: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
