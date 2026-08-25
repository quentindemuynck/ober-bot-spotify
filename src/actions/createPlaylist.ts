import { parseBrief } from "../ai/briefParser.js";
import { generateCreateCandidates } from "../ai/songSuggester.js";
import { addTracksToPlaylist, createPlaylist as createSpotifyPlaylist } from "../spotify/playlists.js";
import { findArtistTracks } from "../spotify/search.js";
import type { SpotifyTrack } from "../spotify/types.js";
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

  // Explicitly-named artists (e.g. "songs by my cousin Jane Doe") are resolved directly against
  // Spotify search rather than left to the AI to suggest — the AI only knows artists it saw in
  // training data, so an unsigned/unfamous artist would otherwise never surface as a candidate at
  // all, even though their tracks are really searchable on Spotify.
  const requiredTracks = new Map<string, SpotifyTrack>();
  const artistsNotFound: string[] = [];
  for (const artistName of brief.requiredArtists) {
    const found = await findArtistTracks(artistName);
    if (found.length === 0) {
      artistsNotFound.push(artistName);
      continue;
    }
    for (const t of found) requiredTracks.set(t.id, t);
  }

  const requiredList = [...requiredTracks.values()].slice(0, targetCount);
  const remainingTarget = targetCount - requiredList.length;
  const requiredTitles = requiredList.map((t) => `${t.artists[0]?.name ?? ""} - ${t.name}`);

  const { tracks, shortfall } =
    remainingTarget > 0
      ? await resolveWithBackfill({
          targetCount: remainingTarget,
          generate: (excludeTitles, count) =>
            generateCreateCandidates(brief, count, [...excludeTitles, ...requiredTitles]),
          isAcceptable: knownSet ? (track) => !knownSet.isKnown(track) : undefined,
          onProgress,
        })
      : { tracks: [], shortfall: false };

  const combined = new Map<string, SpotifyTrack>();
  for (const t of requiredList) combined.set(t.id, t);
  for (const r of tracks) combined.set(r.track.id, r.track);
  const overallShortfall = shortfall || combined.size < targetCount;

  let selected = [...combined.values()];
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
    shortfall: overallShortfall,
    artistsNotFound: artistsNotFound.length > 0 ? artistsNotFound : undefined,
  };
}
