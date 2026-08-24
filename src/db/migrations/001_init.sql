CREATE TABLE IF NOT EXISTS spotify_tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  access_token_expires_at INTEGER,
  spotify_user_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artist_genre_cache (
  artist_id TEXT PRIMARY KEY,
  genres TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
