import pLimit from "p-limit";
import { getRecentSearchCallCount, SAFE_DAILY_SEARCH_BUDGET } from "../../db/searchQuota.js";
import { resolveTrack, type SongCandidate } from "../../spotify/search.js";
import type { ResolvedCandidate, SpotifyTrack } from "../../spotify/types.js";
import type { SongCandidates } from "../../ai/schemas.js";
import { logger } from "../../util/logger.js";

const RESOLVE_CONCURRENCY = 5;
// Kept modest since resolveTrack's improved fallback logic (retrying low-confidence matches, not
// just empty ones) raises the per-candidate accept rate — less overgeneration is needed to reach
// the target, which directly means fewer wasted Spotify search calls on a scarce daily quota.
const OVERGENERATION_FACTOR = 1.3;
// Keep each AI generation call small: a single request for hundreds of songs is slow, prone to
// truncation/invalid JSON, and gives no visibility into progress. Batching keeps each call fast
// and lets us report progress between batches.
const MAX_BATCH_SIZE = 40;
const MAX_ITERATIONS = 12;
// If several iterations in a row accept nothing new, something systemic is wrong (e.g. Spotify
// search is down/quota-locked) — stop immediately instead of continuing to burn real Spotify
// requests (and our own budget) on a search that will never succeed.
const MAX_CONSECUTIVE_EMPTY_ITERATIONS = 2;

export interface ResolveWithBackfillParams {
  targetCount: number;
  generate: (excludeTitles: string[], count: number) => Promise<SongCandidates>;
  isAcceptable?: (track: SpotifyTrack) => boolean;
  onProgress?: (accepted: number, target: number) => void;
}

export interface ResolveWithBackfillResult {
  tracks: ResolvedCandidate[];
  shortfall: boolean;
  attemptedCount: number;
}

function candidateKey(c: SongCandidate): string {
  return `${c.artist} - ${c.title}`;
}

export async function resolveWithBackfill(
  params: ResolveWithBackfillParams
): Promise<ResolveWithBackfillResult> {
  const { targetCount, generate, isAcceptable, onProgress } = params;
  const accepted = new Map<string, ResolvedCandidate>();
  const triedTitles: string[] = [];
  let attemptedCount = 0;
  let consecutiveEmptyIterations = 0;

  for (let iteration = 1; iteration <= MAX_ITERATIONS && accepted.size < targetCount; iteration++) {
    // Re-check the budget every iteration, not just once upfront — a single command can otherwise
    // blow through the entire daily budget (and hammer Spotify's real quota) if every candidate
    // keeps failing to resolve.
    if (getRecentSearchCallCount() >= SAFE_DAILY_SEARCH_BUDGET) {
      logger.warn("resolveWithBackfill stopping: search budget exhausted mid-run", {
        accepted: accepted.size,
        targetCount,
      });
      break;
    }

    const remaining = targetCount - accepted.size;
    const batchSize = Math.min(Math.ceil(remaining * OVERGENERATION_FACTOR), MAX_BATCH_SIZE);

    const { candidates } = await generate(triedTitles, batchSize);
    attemptedCount += candidates.length;
    for (const c of candidates) triedTitles.push(candidateKey(c));

    const limit = pLimit(RESOLVE_CONCURRENCY);
    const resolved = await Promise.all(
      candidates.map((c) => limit(() => resolveTrack(c).catch(() => null)))
    );

    const acceptedBefore = accepted.size;
    for (const r of resolved) {
      if (!r) continue;
      if (accepted.has(r.track.id)) continue;
      if (isAcceptable && !isAcceptable(r.track)) continue;
      accepted.set(r.track.id, r);
      if (accepted.size >= targetCount) break;
    }

    if (accepted.size === acceptedBefore) {
      consecutiveEmptyIterations++;
      if (consecutiveEmptyIterations >= MAX_CONSECUTIVE_EMPTY_ITERATIONS) {
        logger.warn("resolveWithBackfill stopping: no new tracks resolved in consecutive iterations", {
          iteration,
          accepted: accepted.size,
          targetCount,
        });
        onProgress?.(accepted.size, targetCount);
        break;
      }
    } else {
      consecutiveEmptyIterations = 0;
    }

    logger.debug("resolveWithBackfill iteration complete", {
      iteration,
      batchSize,
      accepted: accepted.size,
      targetCount,
    });
    onProgress?.(accepted.size, targetCount);
  }

  const tracks = [...accepted.values()].slice(0, targetCount);
  return { tracks, shortfall: tracks.length < targetCount, attemptedCount };
}
