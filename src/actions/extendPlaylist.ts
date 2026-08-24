import { generateSimilarCandidates } from "../ai/songSuggester.js";
import {
  addTracksToPlaylist,
  extractPlaylistId,
  getPlaylistMeta,
  getPlaylistTracks,
} from "../spotify/playlists.js";
import { ValidationError } from "../util/errors.js";
import { assertSearchBudgetAvailable } from "./shared/searchBudget.js";
import { resolveWithBackfill } from "./shared/resolveCandidates.js";
import { buildTasteProfile } from "./shared/tasteProfile.js";
import { playlistUrlFor, sampleTrackLabels, type ExtendActionResult } from "./types.js";

export const DEFAULT_EXTEND_COUNT = 10;

export async function runExtendPlaylist(
  playlistUrlOrId: string,
  count: number = DEFAULT_EXTEND_COUNT,
  onProgress?: (accepted: number, target: number) => void
): Promise<ExtendActionResult> {
  if (count < 1 || count > 50) {
    throw new ValidationError("The number of tracks to add must be between 1 and 50.");
  }

  const playlistId = extractPlaylistId(playlistUrlOrId) ?? playlistUrlOrId;
  if (!playlistId || playlistId.length < 10) {
    throw new ValidationError(
      `"${playlistUrlOrId}" doesn't look like a valid Spotify playlist URL. Try something like https://open.spotify.com/playlist/...`
    );
  }

  assertSearchBudgetAvailable(count);

  const [meta, existingTracks] = await Promise.all([
    getPlaylistMeta(playlistId),
    getPlaylistTracks(playlistId),
  ]);

  const profile = buildTasteProfile(meta.name, existingTracks);
  const existingTrackIds = new Set(existingTracks.map((t) => t.id));

  const { tracks, shortfall } = await resolveWithBackfill({
    targetCount: count,
    generate: (excludeTitles, batchCount) => generateSimilarCandidates(profile, batchCount, excludeTitles),
    isAcceptable: (track) => !existingTrackIds.has(track.id),
    onProgress,
  });

  const selected = tracks.map((r) => r.track);
  if (selected.length > 0) {
    await addTracksToPlaylist(
      playlistId,
      selected.map((t) => t.uri)
    );
  }

  return {
    playlistId,
    playlistUrl: playlistUrlFor(playlistId),
    name: meta.name,
    addedCount: selected.length,
    totalCount: existingTracks.length + selected.length,
    sampleTracks: sampleTrackLabels(selected),
    shortfall,
  };
}
