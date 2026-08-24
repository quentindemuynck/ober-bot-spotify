import type { SpotifyTrack } from "../../spotify/types.js";
import type { TasteProfile } from "../../ai/songSuggester.js";

const SAMPLE_ARTISTS_COUNT = 10;
const SAMPLE_TRACKS_COUNT = 20;

export function buildTasteProfile(playlistName: string, tracks: SpotifyTrack[]): TasteProfile {
  const artistNames = new Set<string>();
  for (const track of tracks) {
    for (const artist of track.artists) {
      artistNames.add(artist.name);
      if (artistNames.size >= SAMPLE_ARTISTS_COUNT) break;
    }
    if (artistNames.size >= SAMPLE_ARTISTS_COUNT) break;
  }

  const sampleTracks = tracks
    .slice(0, SAMPLE_TRACKS_COUNT)
    .map((t) => `${t.artists[0]?.name ?? "Unknown"} - ${t.name}`);

  return {
    sourcePlaylistName: playlistName,
    sampleArtists: [...artistNames],
    sampleTracks,
  };
}
