import { parseBrief } from "../ai/briefParser.js";
import { generateCreateCandidates } from "../ai/songSuggester.js";
import { addTracksToPlaylist, createPlaylist as createSpotifyPlaylist } from "../spotify/playlists.js";
import { assertSearchBudgetAvailable } from "./shared/searchBudget.js";
import { resolveWithBackfill } from "./shared/resolveCandidates.js";
import { buildKnownTrackSet } from "./shared/unfamiliarFilter.js";
import { playlistUrlFor, sampleTrackLabels, type PlaylistActionResult } from "./types.js";

const AVG_TRACK_MINUTES = 3.5;

function estimateTargetCount(length: { type: "count" | "duration_minutes"; value: number }): number {
  if (length.type === "count") return length.value;
  return Math.max(5, Math.ceil(length.value / AVG_TRACK_MINUTES));
}

export async function runCreatePlaylist(
  prompt: string,
  onProgress?: (accepted: number, target: number) => void
): Promise<PlaylistActionResult> {
  assertSearchBudgetAvailable();
  const brief = await parseBrief(prompt);
  const targetCount = estimateTargetCount(brief.length);
  assertSearchBudgetAvailable(targetCount);

  const knownSet = brief.preferUnfamiliar ? await buildKnownTrackSet() : null;

  const { tracks, shortfall } = await resolveWithBackfill({
    targetCount,
    generate: (excludeTitles, count) => generateCreateCandidates(brief, count, excludeTitles),
    isAcceptable: knownSet ? (track) => !knownSet.isKnown(track) : undefined,
    onProgress,
  });

  let selected = tracks.map((r) => r.track);
  if (brief.length.type === "duration_minutes") {
    const targetMs = brief.length.value * 60_000;
    let cumulativeMs = 0;
    const trimmed = [];
    for (const track of selected) {
      if (cumulativeMs >= targetMs) break;
      trimmed.push(track);
      cumulativeMs += track.duration_ms;
    }
    selected = trimmed.length > 0 ? trimmed : selected;
  }

  const name = brief.theme.length > 90 ? `${brief.theme.slice(0, 87)}...` : brief.theme;
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
