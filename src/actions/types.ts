export interface PlaylistSummary {
  playlistId: string;
  playlistUrl: string;
  name: string;
  trackCount: number;
  sampleTracks: string[];
}

export interface PlaylistActionResult extends PlaylistSummary {
  shortfall: boolean;
}

export interface SplitActionResult {
  sourcePlaylistName: string;
  playlists: PlaylistSummary[];
}

export interface ExtendActionResult {
  playlistId: string;
  playlistUrl: string;
  name: string;
  addedCount: number;
  totalCount: number;
  sampleTracks: string[];
  shortfall: boolean;
}

export function playlistUrlFor(playlistId: string): string {
  return `https://open.spotify.com/playlist/${playlistId}`;
}

export function sampleTrackLabels(tracks: { name: string; artists: { name: string }[] }[], count = 5): string[] {
  return tracks.slice(0, count).map((t) => `${t.artists[0]?.name ?? "Unknown"} - ${t.name}`);
}
