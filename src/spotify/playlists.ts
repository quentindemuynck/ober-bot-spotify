import { spotifyFetch } from "./client.js";
import type { SpotifyPage, SpotifyPlaylistItem, SpotifyPlaylistMeta, SpotifyTrack } from "./types.js";

const ADD_TRACKS_CHUNK_SIZE = 100;
const TRACKS_PAGE_LIMIT = 100;

export async function createPlaylist(name: string, description: string): Promise<SpotifyPlaylistMeta> {
  // POST /users/{user_id}/playlists was migrated to POST /me/playlists in Spotify's Feb 2026
  // Web API changes; the old endpoint now 403s for all Development Mode apps.
  return spotifyFetch<SpotifyPlaylistMeta>("/me/playlists", {
    method: "POST",
    body: JSON.stringify({ name, description, public: false }),
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function addTracksToPlaylist(playlistId: string, uris: string[]): Promise<void> {
  // /playlists/{id}/tracks is deprecated in favor of /playlists/{id}/items (Feb 2026 migration).
  for (const batch of chunk(uris, ADD_TRACKS_CHUNK_SIZE)) {
    await spotifyFetch(`/playlists/${playlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: batch }),
    });
  }
}

export async function getPlaylistMeta(playlistId: string): Promise<SpotifyPlaylistMeta> {
  // "tracks" was renamed to "items" on the playlist object in the same Feb 2026 migration.
  const params = new URLSearchParams({ fields: "id,name,description,items.total" });
  return spotifyFetch<SpotifyPlaylistMeta>(`/playlists/${playlistId}?${params.toString()}`);
}

export async function getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  // /playlists/{id}/tracks is deprecated in favor of /playlists/{id}/items (Feb 2026 migration),
  // which also wraps each entry under "item" (generalized for tracks/episodes) instead of "track".
  const fields = "items(item(id,uri,name,duration_ms,artists(id,name),type)),next,limit,offset,total";
  let url: string | null =
    `/playlists/${playlistId}/items?${new URLSearchParams({
      limit: String(TRACKS_PAGE_LIMIT),
      fields,
    }).toString()}`;

  while (url) {
    const page: SpotifyPage<SpotifyPlaylistItem> = await spotifyFetch(url);
    for (const entry of page.items) {
      if (entry.item && entry.item.type === "track") tracks.push(entry.item);
    }
    url = page.next;
  }

  return tracks;
}

export function extractPlaylistId(urlOrUri: string): string | null {
  const uriMatch = urlOrUri.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
  if (uriMatch) return uriMatch[1] ?? null;

  try {
    const url = new URL(urlOrUri);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("playlist");
    if (idx !== -1 && parts[idx + 1]) {
      return parts[idx + 1] ?? null;
    }
  } catch {
    // not a valid URL
  }

  return null;
}
