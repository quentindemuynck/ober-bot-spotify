import { BriefSchema, type Brief } from "./schemas.js";
import { structuredComplete } from "./structuredComplete.js";

const SYSTEM_PROMPT = `You turn a free-text Spotify playlist request into a structured brief.

Extract:
- theme: the vibe/genre/occasion for the playlist, concise.
- length: either a target song count ("count") or a target duration in minutes ("duration_minutes").
  If the user gives neither, default to { type: "count", value: 20 }.
- preferUnfamiliar: true if the user asks for songs they "haven't heard", "new to me", "not already in my
  library", "deep cuts", "obscure", etc. Otherwise false.
- styleHints: any extra genre/mood/era/artist-adjacent keywords mentioned (e.g. "DnB", "90s", "workout",
  "acoustic"), as short strings.`;

export async function parseBrief(prompt: string): Promise<Brief> {
  return structuredComplete({
    schema: BriefSchema,
    schemaName: "playlist_brief",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
  });
}
