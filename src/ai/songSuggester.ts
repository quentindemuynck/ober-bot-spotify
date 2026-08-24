import type { Brief } from "./schemas.js";
import { SongCandidatesSchema, type SongCandidates } from "./schemas.js";
import { structuredComplete } from "./structuredComplete.js";

export interface TasteProfile {
  sourcePlaylistName: string;
  sampleArtists: string[];
  sampleTracks: string[];
}

function formatExclusions(excludeTitles: string[]): string {
  if (excludeTitles.length === 0) return "";
  return `\n\nDo NOT suggest any of these songs again (already tried/excluded):\n${excludeTitles
    .map((t) => `- ${t}`)
    .join("\n")}`;
}

const CREATE_SYSTEM_PROMPT = `You are a music expert generating real, existing songs for a Spotify playlist.
Given a theme/brief, suggest specific songs (real artist + real title) that fit. Favor variety across artists
unless the theme calls for a narrow focus. Only suggest songs you are confident actually exist and were
released by the named artist — never invent song titles.`;

export async function generateCreateCandidates(
  brief: Brief,
  count: number,
  excludeTitles: string[] = []
): Promise<SongCandidates> {
  const userPrompt = `Theme: ${brief.theme}
Style hints: ${brief.styleHints.join(", ") || "none"}
Prefer songs the listener likely hasn't heard before: ${brief.preferUnfamiliar ? "yes" : "no"}
Suggest ${count} songs.${formatExclusions(excludeTitles)}`;

  return structuredComplete({
    schema: SongCandidatesSchema,
    schemaName: "song_candidates",
    systemPrompt: CREATE_SYSTEM_PROMPT,
    userPrompt,
  });
}

const SIMILAR_SYSTEM_PROMPT = `You are a music expert generating real, existing songs for a Spotify playlist
that should feel similar to a listener's existing taste profile, but must NOT just repeat what's already in
their playlist. Spotify no longer provides genre metadata, so infer the genre/vibe yourself from the
representative artists and sample tracks below, using your own music knowledge. Only suggest songs you are
confident actually exist and were released by the named artist — never invent song titles.`;

export async function generateSimilarCandidates(
  profile: TasteProfile,
  count: number,
  excludeTitles: string[] = []
): Promise<SongCandidates> {
  const userPrompt = `Source playlist: "${profile.sourcePlaylistName}"
Representative artists: ${profile.sampleArtists.join(", ") || "unknown"}
Sample tracks already in the playlist (do not resuggest these): ${profile.sampleTracks.join(", ") || "none"}

Suggest ${count} DIFFERENT songs that fit the same taste profile.${formatExclusions(excludeTitles)}`;

  return structuredComplete({
    schema: SongCandidatesSchema,
    schemaName: "song_candidates",
    systemPrompt: SIMILAR_SYSTEM_PROMPT,
    userPrompt,
  });
}
