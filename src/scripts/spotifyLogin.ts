import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import open from "open";
import { env } from "../config/env.js";
import { buildAuthorizeUrl, exchangeCodeForTokens, SPOTIFY_SCOPES } from "../spotify/auth.js";
import { saveInitialTokens } from "../db/spotifyTokenStore.js";
import { spotifyFetch } from "../spotify/client.js";

interface MeResponse {
  id: string;
  display_name: string | null;
}

async function main() {
  const redirectUrl = new URL(env.SPOTIFY_REDIRECT_URI);
  const port = Number(redirectUrl.port || 80);
  const state = randomBytes(16).toString("hex");

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, `http://${redirectUrl.hostname}:${port}`);

      if (url.pathname !== redirectUrl.pathname) {
        res.writeHead(404).end();
        return;
      }

      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const returnedCode = url.searchParams.get("code");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/plain" }).end(`Spotify authorization failed: ${error}`);
        server.close();
        reject(new Error(`Spotify authorization failed: ${error}`));
        return;
      }

      if (returnedState !== state || !returnedCode) {
        res.writeHead(400, { "Content-Type": "text/plain" }).end("Invalid state or missing code.");
        server.close();
        reject(new Error("Invalid state or missing authorization code."));
        return;
      }

      res
        .writeHead(200, { "Content-Type": "text/plain" })
        .end("Spotify authorization complete. You can close this tab and return to the terminal.");
      server.close();
      resolve(returnedCode);
    });

    server.listen(port, redirectUrl.hostname, () => {
      const authorizeUrl = buildAuthorizeUrl(state);
      console.log(`Opening browser for Spotify authorization...\nIf it doesn't open automatically, visit:\n${authorizeUrl}\n`);
      open(authorizeUrl).catch(() => {
        // best-effort; the user can still click the printed URL
      });
    });

    server.on("error", reject);
  });

  console.log("Exchanging authorization code for tokens...");
  const tokenResponse = await exchangeCodeForTokens(code);

  if (!tokenResponse.refresh_token) {
    throw new Error("Spotify did not return a refresh token. Try again and make sure you approve all requested scopes.");
  }

  console.log(`Granted scopes: ${tokenResponse.scope}`);
  for (const required of SPOTIFY_SCOPES.split(" ")) {
    if (!tokenResponse.scope.split(" ").includes(required)) {
      console.warn(`  WARNING: missing expected scope "${required}"`);
    }
  }

  const accessTokenExpiresAt = Date.now() + tokenResponse.expires_in * 1000;

  // Temporarily store tokens so spotifyFetch can use them to resolve /me.
  saveInitialTokens({
    refreshToken: tokenResponse.refresh_token,
    accessToken: tokenResponse.access_token,
    accessTokenExpiresAt,
    spotifyUserId: "pending",
  });

  const me = await spotifyFetch<MeResponse>("/me");

  saveInitialTokens({
    refreshToken: tokenResponse.refresh_token,
    accessToken: tokenResponse.access_token,
    accessTokenExpiresAt,
    spotifyUserId: me.id,
  });

  console.log(`Spotify login complete. Authorized as ${me.display_name ?? me.id} (${me.id}).`);
  console.log("You can now start the bot with `npm run dev`.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Spotify login failed:", err);
  process.exit(1);
});
