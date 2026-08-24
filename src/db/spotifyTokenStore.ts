import { db } from "./db.js";

interface SpotifyTokenRow {
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: number | null;
  spotify_user_id: string;
}

export interface SpotifyTokenState {
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  spotifyUserId: string;
}

function rowToState(row: SpotifyTokenRow): SpotifyTokenState {
  return {
    refreshToken: row.refresh_token,
    accessToken: row.access_token,
    accessTokenExpiresAt: row.access_token_expires_at,
    spotifyUserId: row.spotify_user_id,
  };
}

export function getTokenState(): SpotifyTokenState | null {
  const row = db.prepare("SELECT * FROM spotify_tokens WHERE id = 1").get() as
    | SpotifyTokenRow
    | undefined;
  return row ? rowToState(row) : null;
}

export function saveInitialTokens(params: {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  spotifyUserId: string;
}) {
  db.prepare(
    `INSERT INTO spotify_tokens (id, refresh_token, access_token, access_token_expires_at, spotify_user_id)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       refresh_token = excluded.refresh_token,
       access_token = excluded.access_token,
       access_token_expires_at = excluded.access_token_expires_at,
       spotify_user_id = excluded.spotify_user_id`
  ).run(params.refreshToken, params.accessToken, params.accessTokenExpiresAt, params.spotifyUserId);
}

export function updateAccessToken(params: {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken?: string;
}) {
  if (params.refreshToken) {
    db.prepare(
      `UPDATE spotify_tokens SET access_token = ?, access_token_expires_at = ?, refresh_token = ? WHERE id = 1`
    ).run(params.accessToken, params.accessTokenExpiresAt, params.refreshToken);
  } else {
    db.prepare(
      `UPDATE spotify_tokens SET access_token = ?, access_token_expires_at = ? WHERE id = 1`
    ).run(params.accessToken, params.accessTokenExpiresAt);
  }
}
