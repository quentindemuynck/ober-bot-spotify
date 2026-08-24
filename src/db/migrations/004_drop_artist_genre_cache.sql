-- Spotify removed the "genres" field from all artist-returning endpoints, making this cache
-- permanently empty. Dropped rather than left as dead schema.
DROP TABLE IF EXISTS artist_genre_cache;
