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
  "acoustic"), as short strings.
- requiredArtists: any specific artist(s) by name the user explicitly wants songs from. Trigger on ANY
  phrasing that names a real artist and asks for their songs, not just "by" — e.g. "songs by X", "songs
  of X", "tracks from X", "X's music", "include X", "with X in it". This is for naming a particular real
  artist, not a genre/style word. If styleHints also mentions an artist name, still list it here too.
  Empty array if none named.`;

export async function parseBrief(prompt: string): Promise<Brief> {
  return structuredComplete({
    schema: BriefSchema,
    schemaName: "playlist_brief",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
  });
}
