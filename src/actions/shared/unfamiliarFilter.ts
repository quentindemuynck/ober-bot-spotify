import { getRecentlyPlayed, getSavedTracks, getTopTracks } from "../../spotify/library.js";
import type { SpotifyTrack } from "../../spotify/types.js";

function normalizeKey(artist: string, title: string): string {
  return `${artist}|${title}`
    .toLowerCase()
    .replace(/[^a-z0-9|]/g, "")
    .trim();
}

export interface KnownTrackSet {
  isKnown(track: SpotifyTrack): boolean;
}

export async function buildKnownTrackSet(): Promise<KnownTrackSet> {
  const [saved, top, recent] = await Promise.all([
    getSavedTracks(),
    getTopTracks(),
    getRecentlyPlayed().catch(() => [] as SpotifyTrack[]), // recently-played can 403 if scope/history is empty
  ]);

  const knownIds = new Set<string>();
  const knownKeys = new Set<string>();

  for (const track of [...saved, ...top, ...recent]) {
    knownIds.add(track.id);
    const artistName = track.artists[0]?.name ?? "";
    knownKeys.add(normalizeKey(artistName, track.name));
  }

  return {
    isKnown(track: SpotifyTrack): boolean {
      if (knownIds.has(track.id)) return true;
      const artistName = track.artists[0]?.name ?? "";
      return knownKeys.has(normalizeKey(artistName, track.name));
    },
  };
}
