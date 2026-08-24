import { getTokenState, updateAccessToken } from "../db/spotifyTokenStore.js";
import { logger } from "../util/logger.js";
import { sleep } from "../util/retry.js";
import { SpotifyApiError } from "../util/errors.js";
import { refreshAccessToken } from "./auth.js";

const API_BASE = "https://api.spotify.com/v1";
const EXPIRY_SAFETY_MARGIN_MS = 60_000;
const MAX_429_RETRIES = 4;
// Spotify can send an extended Retry-After (hours) if it's imposed a punitive throttle rather
// than a normal short rate limit. We're an interactive Discord bot, so waiting that long isn't
// viable — cap the wait and fail fast instead of hanging the whole command.
const MAX_RETRY_AFTER_MS = 30_000;

async function ensureAccessToken(): Promise<string> {
  const state = getTokenState();
  if (!state) {
    throw new SpotifyApiError(
      "No Spotify tokens found. Run `npm run login` once to authorize this app against your Spotify account."
    );
  }

  const isExpired =
    !state.accessToken ||
    !state.accessTokenExpiresAt ||
    state.accessTokenExpiresAt - EXPIRY_SAFETY_MARGIN_MS <= Date.now();

  if (!isExpired) {
    return state.accessToken as string;
  }

  return refreshAndPersist(state.refreshToken);
}

async function refreshAndPersist(refreshToken: string): Promise<string> {
  const tokenResponse = await refreshAccessToken(refreshToken);
  const expiresAt = Date.now() + tokenResponse.expires_in * 1000;
  updateAccessToken({
    accessToken: tokenResponse.access_token,
    accessTokenExpiresAt: expiresAt,
    refreshToken: tokenResponse.refresh_token,
  });
  return tokenResponse.access_token;
}


interface SpotifyFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** internal: tracks whether we've already retried once after a 401 */
  _retried401?: boolean;
  _retries429?: number;
}

export async function spotifyFetch<T>(path: string, options: SpotifyFetchOptions = {}): Promise<T> {
  const accessToken = await ensureAccessToken();
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401 && !options._retried401) {
    const state = getTokenState();
    if (state) {
      await refreshAndPersist(state.refreshToken);
    }
    return spotifyFetch<T>(path, { ...options, _retried401: true });
  }

  if (res.status === 429) {
    const retries = options._retries429 ?? 0;
    const retryAfterHeader = res.headers.get("Retry-After");
    const rawRetryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 1000 * 2 ** retries;

    const body = await res.clone().text().catch(() => "");
    let isQuotaExceeded = false;
    try {
      const parsed = JSON.parse(body) as { error?: { reason?: string } };
      isQuotaExceeded = parsed.error?.reason === "QUOTA_EXCEEDED";
    } catch {
      // body wasn't JSON; ignore
    }

    if (rawRetryAfterMs > MAX_RETRY_AFTER_MS) {
      logger.warn("Spotify rate limit wait exceeds cap, giving up on this request", {
        path,
        rawRetryAfterMs,
        isQuotaExceeded,
      });
      const hours = (rawRetryAfterMs / 3_600_000).toFixed(1);
      throw new SpotifyApiError(
        isQuotaExceeded
          ? `Spotify's daily quota for this endpoint is exhausted — try again in about ${hours}h.`
          : `Spotify asked us to wait ${Math.round(rawRetryAfterMs / 1000)}s before retrying — too long to wait, giving up.`,
        429
      );
    }

    if (retries >= MAX_429_RETRIES) {
      throw new SpotifyApiError("Spotify rate limit exceeded, giving up after retries", 429);
    }

    logger.warn("Spotify rate limited, backing off", { path, retryAfterMs: rawRetryAfterMs, retries });
    await sleep(rawRetryAfterMs);
    return spotifyFetch<T>(path, { ...options, _retries429: retries + 1 });
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } | string };
      if (parsed.error) {
        detail = typeof parsed.error === "string" ? parsed.error : parsed.error.message ?? body;
      }
    } catch {
      // body wasn't JSON; use as-is
    }
    throw new SpotifyApiError(
      `Spotify API error on ${path}: ${res.status}${detail ? ` — ${detail}` : ""}`,
      res.status,
      body
    );
  }

  return (await res.json()) as T;
}
