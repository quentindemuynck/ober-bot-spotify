import { config } from "dotenv";
import { z } from "zod";

// override: true ensures values in .env always win over stray/stale variables that may
// already be set in the shell or system environment (e.g. from another project).
config({ override: true });

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_GUILD_ID: z.string().optional(),

  SPOTIFY_CLIENT_ID: z.string().min(1, "SPOTIFY_CLIENT_ID is required"),
  SPOTIFY_CLIENT_SECRET: z.string().min(1, "SPOTIFY_CLIENT_SECRET is required"),
  SPOTIFY_REDIRECT_URI: z
    .string()
    .url()
    .refine(
      (url) => new URL(url).hostname === "127.0.0.1",
      "SPOTIFY_REDIRECT_URI must use the loopback IP literal 127.0.0.1 (not localhost)"
    ),

  AI_API_KEY: z.string().min(1, "AI_API_KEY is required"),
  // "-latest" aliases always point at Google's current model, avoiding breakage when a
  // pinned version (e.g. "gemini-2.5-flash") gets retired.
  AI_MODEL: z.string().default("gemini-flash-lite-latest"),
  // Defaults to Gemini's OpenAI-compatible endpoint (free tier). Override to point at OpenAI,
  // Groq, or any other OpenAI-compatible provider instead.
  AI_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com/v1beta/openai/"),

  DATABASE_PATH: z.string().default("./data/oberbot.sqlite3"),

  // Self-imposed cap on Spotify search calls per rolling 24h, kept below Spotify's real (and
  // undocumented — community reports put it around ~200) Development Mode quota so the bot
  // fails fast with a clear message instead of ever tripping a real 24h lockout again. Raise
  // with care: the closer this gets to the real threshold, the less safety margin you have.
  SEARCH_DAILY_BUDGET: z.coerce.number().int().positive().default(180),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
