import { generateSimilarCandidates } from "../ai/songSuggester.js";
import {
  addTracksToPlaylist,
  createPlaylist as createSpotifyPlaylist,
  extractPlaylistId,
  getPlaylistMeta,
  getPlaylistTracks,
} from "../spotify/playlists.js";
import { ValidationError } from "../util/errors.js";
import { assertSearchBudgetAvailable } from "./shared/searchBudget.js";
import { resolveWithBackfill } from "./shared/resolveCandidates.js";
import { buildTasteProfile } from "./shared/tasteProfile.js";
import { playlistUrlFor, sampleTrackLabels, type PlaylistActionResult } from "./types.js";

const MIN_TARGET = 10;
const MAX_TARGET = 30;

export async function runSimilarPlaylist(
  playlistUrlOrId: string,
  onProgress?: (accepted: number, target: number) => void
): Promise<PlaylistActionResult> {
  assertSearchBudgetAvailable();
  const sourceId = extractPlaylistId(playlistUrlOrId) ?? playlistUrlOrId;
  if (!sourceId || sourceId.length < 10) {
    throw new ValidationError(
      `"${playlistUrlOrId}" doesn't look like a valid Spotify playlist URL. Try something like https://open.spotify.com/playlist/...`
    );
  }

  const [meta, sourceTracks] = await Promise.all([
    getPlaylistMeta(sourceId),
    getPlaylistTracks(sourceId),
  ]);

  const profile = buildTasteProfile(meta.name, sourceTracks);
  const targetCount = Math.min(Math.max(sourceTracks.length, MIN_TARGET), MAX_TARGET);
  assertSearchBudgetAvailable(targetCount);
  const sourceTrackIds = new Set(sourceTracks.map((t) => t.id));

  const { tracks, shortfall } = await resolveWithBackfill({
    targetCount,
    generate: (excludeTitles, count) => generateSimilarCandidates(profile, count, excludeTitles),
    isAcceptable: (track) => !sourceTrackIds.has(track.id),
    onProgress,
  });

  const selected = tracks.map((r) => r.track);
  const name = `${meta.name} — Similar Mix`;
  const playlist = await createSpotifyPlaylist(
    name,
    "Created with Ober by Wanton"
  );

  if (selected.length > 0) {
    await addTracksToPlaylist(
      playlist.id,
      selected.map((t) => t.uri)
    );
  }

  return {
    playlistId: playlist.id,
    playlistUrl: playlistUrlFor(playlist.id),
    name: playlist.name,
    trackCount: selected.length,
    sampleTracks: sampleTrackLabels(selected),
    shortfall,
  };
}
