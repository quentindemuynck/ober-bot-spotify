import { clusterTracks, type TrackForClustering } from "../ai/clusterer.js";
import {
  addTracksToPlaylist,
  createPlaylist as createSpotifyPlaylist,
  extractPlaylistId,
  getPlaylistMeta,
  getPlaylistTracks,
} from "../spotify/playlists.js";
import type { SpotifyTrack } from "../spotify/types.js";
import { ValidationError } from "../util/errors.js";
import { logger } from "../util/logger.js";
import { playlistUrlFor, sampleTrackLabels, type SplitActionResult } from "./types.js";

export async function runSplitPlaylist(
  playlistUrlOrId: string,
  n: number
): Promise<SplitActionResult> {
  if (n < 2 || n > 10) {
    throw new ValidationError("The number of splits must be between 2 and 10.");
  }

  const sourceId = extractPlaylistId(playlistUrlOrId) ?? playlistUrlOrId;
  if (!sourceId || sourceId.length < 10) {
    throw new ValidationError(
      `"${playlistUrlOrId}" doesn't look like a valid Spotify playlist URL. Try something like https://open.spotify.com/playlist/...`
    );
  }

  const [meta, tracks] = await Promise.all([getPlaylistMeta(sourceId), getPlaylistTracks(sourceId)]);

  if (tracks.length < n) {
    throw new ValidationError(
      `"${meta.name}" only has ${tracks.length} track(s), which isn't enough to split into ${n} playlists.`
    );
  }

  const trackById = new Map<string, SpotifyTrack>(tracks.map((t) => [t.id, t]));

  // Spotify no longer exposes genre metadata, so the AI infers genre/vibe purely from artist +
  // title (its own music knowledge), the same way /playlist create does.
  const clusteringInput: TrackForClustering[] = tracks.map((t) => ({
    trackId: t.id,
    title: t.name,
    artist: t.artists[0]?.name ?? "Unknown",
  }));

  const aiResult = await clusterTracks(clusteringInput, n);

  // Take exactly the number of clusters requested; if the model returned more/fewer,
  // normalize by padding with empty named clusters or truncating extras' tracks into the last one.
  const clusters = aiResult.clusters.slice(0, n).map((c) => ({
    name: c.name,
    description: c.description,
    trackIds: [] as string[],
  }));
  while (clusters.length < n) {
    clusters.push({ name: `Group ${clusters.length + 1}`, description: "", trackIds: [] });
  }

  const assigned = new Set<string>();
  aiResult.clusters.slice(0, n).forEach((c, idx) => {
    for (const trackId of c.trackIds) {
      if (!trackById.has(trackId) || assigned.has(trackId)) continue;
      const cluster = clusters[idx];
      if (!cluster) continue;
      cluster.trackIds.push(trackId);
      assigned.add(trackId);
    }
  });

  // Local fallback for any tracks the model dropped or duplicated away: without genre metadata
  // to score against, just balance them into the smallest cluster so far.
  const unassigned = tracks.filter((t) => !assigned.has(t.id));
  if (unassigned.length > 0) {
    logger.warn("Split clustering left tracks unassigned, applying local fallback", {
      count: unassigned.length,
    });
  }
  for (const track of unassigned) {
    let smallest = clusters[0];
    for (const cluster of clusters) {
      if (!smallest || cluster.trackIds.length < smallest.trackIds.length) smallest = cluster;
    }
    smallest?.trackIds.push(track.id);
    assigned.add(track.id);
  }

  const playlists = [];
  for (const cluster of clusters) {
    if (cluster.trackIds.length === 0) continue;
    const clusterTracksList = cluster.trackIds
      .map((id) => trackById.get(id))
      .filter((t): t is SpotifyTrack => Boolean(t));

    const playlist = await createSpotifyPlaylist(
      `${meta.name} — ${cluster.name}`,
      "Created with Ober by Wanton"
    );
    await addTracksToPlaylist(
      playlist.id,
      clusterTracksList.map((t) => t.uri)
    );

    playlists.push({
      playlistId: playlist.id,
      playlistUrl: playlistUrlFor(playlist.id),
      name: playlist.name,
      trackCount: clusterTracksList.length,
      sampleTracks: sampleTrackLabels(clusterTracksList),
    });
  }

  return { sourcePlaylistName: meta.name, playlists };
}
