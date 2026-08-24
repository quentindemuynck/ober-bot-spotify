# OberBotSpotify

An AI-driven Discord bot for managing Spotify playlists. An LLM does the "thinking" (song
suggestions, taste-profile matching, genre clustering) since Spotify's own Recommendations /
Audio Features / Related Artists endpoints are no longer available to new apps. Uses Google
Gemini's free tier by default, but works with any OpenAI-compatible provider.

## Commands

- `/playlist create "<prompt>"` — e.g. `/playlist create "2 hours of chill DnB but mostly songs I haven't heard"`
- `/playlist similar <spotify playlist url>` — build a *new, separate* playlist of songs similar to an existing one
- `/playlist extend <spotify playlist url> [count]` — add more same-genre tracks directly into an *existing* playlist (default 10, max 50)
- `/playlist split <spotify playlist url> <count>` — split a playlist into N playlists by genre/vibe
- `/playlist status` — check remaining Spotify search quota and whether it's currently reachable

You can also just @-mention the bot with a free-text request instead of using slash commands. If your
request is ambiguous, the bot will ask a clarifying question before doing anything.

## Setup

### 1. Spotify Developer Dashboard

1. Create a new app at https://developer.spotify.com/dashboard.
2. Add a redirect URI of `http://127.0.0.1:8888/callback` (must be the loopback IP literal
   `127.0.0.1`, not `localhost` — Spotify requirement).
3. Make sure the Spotify account you'll authorize has an active **Premium** subscription
   (required for Development Mode apps).
4. Copy the **Client ID** and **Client Secret** into `.env`.

### 2. Discord Developer Portal

1. Create an application at https://discord.com/developers/applications, then add a Bot.
2. Copy the bot token into `DISCORD_TOKEN`, and the Application ID into `DISCORD_CLIENT_ID`.
3. Under Bot settings, enable the **Message Content Intent** (required to read @mentions).
4. Use the OAuth2 URL Generator with scopes `bot` + `applications.commands` and permissions
   Send Messages / Embed Links / Read Message History, then invite the bot to a server.
5. Copy that server's ID into `DISCORD_GUILD_ID` for fast (near-instant) command registration
   during development. Leave it unset for global registration (takes up to ~1 hour to propagate).

### 3. AI provider (Gemini, free)

1. Get a free API key at https://aistudio.google.com/apikey — no credit card required.
2. Put it in `AI_API_KEY`. `AI_MODEL` and `AI_BASE_URL` are already set to Gemini's free-tier
   flash model and its OpenAI-compatible endpoint by default.
3. To use a different provider instead (OpenAI, Groq, etc.), just override `AI_BASE_URL` and
   `AI_MODEL` to point at that provider's OpenAI-compatible endpoint and put its key in
   `AI_API_KEY` — no code changes needed.

Note: Gemini's free tier is rate-limited (currently ~15 requests/minute, 1,500/day on Flash) —
plenty for personal use, but a `/playlist create` or `/playlist split` on a large playlist makes
several calls in a row, so you may occasionally hit a rate limit on heavy use.

### 4. Install, configure, and log in

```bash
npm install
cp .env.example .env   # then fill in the values above
npm run login           # one-time Spotify OAuth login (opens a browser)
```

### 5. Run

```bash
npm run dev     # development, auto-restarts on changes
# or
npm run build && npm start   # production
```

## Notes

- **Spotify Development Mode has a hidden daily quota** (roughly 200 requests/24h on some
  endpoints, e.g. search) separate from the normal short rate limit — blow past it and Spotify
  locks that endpoint out for your whole app for ~24 hours, with no way to clear it early. This
  is most likely to happen from rapid repeated testing (e.g. re-running a large `/playlist
  create` many times back-to-back). If you see errors mentioning "daily quota" or "too long to
  wait, giving up," just wait it out — `/playlist split` doesn't use search, so it's unaffected
  and safe to test with in the meantime. Use `/playlist status` anytime to check your self-imposed
  budget and do a live check of whether Spotify search is currently reachable.
- The bot self-limits to `SEARCH_DAILY_BUDGET` (default 180) search calls/24h, safely below that
  ~200 danger zone, and fails fast with a clear message instead of risking the real lockout.
  Tune it in `.env` if you want more headroom — the closer to 200, the less safety margin.
- Single-Spotify-account only — the bot always acts on whichever account you authorize via
  `npm run login`. There's no per-Discord-user account linking.
- Data (SQLite DB holding your Spotify refresh token and an artist-genre cache) is stored at
  `./data/oberbot.sqlite3` by default — back this up if you don't want to redo the login step.
- To run persistently later (e.g. on a home server), use a process manager like `pm2` or a
  systemd unit around `npm start` — no code changes needed, it's a standard env-var-driven
  Node process.
