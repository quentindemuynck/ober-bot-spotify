import { spotifyFetch } from "./client.js";
import type { SpotifyPage, SpotifyTrack } from "./types.js";

const SAVED_TRACKS_PAGE_LIMIT = 50;
const SAVED_TRACKS_MAX_PAGES = 6; // cap ~300 tracks for "known library" purposes

interface SavedTrackItem {
  track: SpotifyTrack;
}

export async function getSavedTracks(): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  const fields = "items(track(id,uri,name,duration_ms,artists(id,name))),next";
  let url: string | null =
    `/me/tracks?${new URLSearchParams({ limit: String(SAVED_TRACKS_PAGE_LIMIT), fields }).toString()}`;

  let pages = 0;
  while (url && pages < SAVED_TRACKS_MAX_PAGES) {
    const page: SpotifyPage<SavedTrackItem> = await spotifyFetch(url);
    for (const item of page.items) {
      if (item.track) tracks.push(item.track);
    }
    url = page.next;
    pages++;
  }

  return tracks;
}

export async function getTopTracks(): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ limit: "50", time_range: "long_term" });
  const page = await spotifyFetch<SpotifyPage<SpotifyTrack>>(`/me/top/tracks?${params.toString()}`);
  return page.items;
}

export interface TopArtist {
  id: string;
  name: string;
}

export async function getTopArtists(): Promise<TopArtist[]> {
  const params = new URLSearchParams({ limit: "50", time_range: "long_term" });
  const page = await spotifyFetch<SpotifyPage<TopArtist>>(`/me/top/artists?${params.toString()}`);
  return page.items;
}

interface RecentlyPlayedItem {
  track: SpotifyTrack;
}

export async function getRecentlyPlayed(): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ limit: "50" });
  const result = await spotifyFetch<{ items: RecentlyPlayedItem[] }>(
    `/me/player/recently-played?${params.toString()}`
  );
  return result.items.map((item) => item.track);
}
