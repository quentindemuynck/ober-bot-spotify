// Trimmed to fields that actually survive Spotify Web API Development Mode restrictions
// (see: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)

export interface SpotifyArtistRef {
  id: string;
  name: string;
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: SpotifyArtistRef[];
  duration_ms: number;
}

// /playlists/{id}/items wraps each entry under "item" (generalized for tracks AND episodes,
// discriminated by "type"), unlike the deprecated /playlists/{id}/tracks endpoint which used "track".
export interface SpotifyPlaylistItem {
  item: (SpotifyTrack & { type: "track" | "episode" }) | null;
}

export interface SpotifyPlaylistMeta {
  id: string;
  name: string;
  description: string | null;
  // Renamed from "tracks" in Spotify's Feb 2026 Web API migration.
  items: { total: number };
}

export interface SpotifyPage<T> {
  items: T[];
  next: string | null;
  limit: number;
  offset: number;
  total: number;
}

export interface SpotifySearchResult {
  tracks: SpotifyPage<SpotifyTrack>;
}

export interface ResolvedCandidate {
  track: SpotifyTrack;
  score: number;
  queriedAs: { artist: string; title: string };
}
