CREATE TABLE IF NOT EXISTS search_cache (
  normalized_key TEXT PRIMARY KEY,
  track_json TEXT NOT NULL,
  cached_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS search_call_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  called_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_call_log_called_at ON search_call_log (called_at);
