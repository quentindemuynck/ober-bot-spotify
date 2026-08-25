import { z } from "zod";

export const LengthSchema = z.object({
  type: z.enum(["count", "duration_minutes"]),
  value: z.number().int().positive(),
});

export const BriefSchema = z.object({
  theme: z.string().min(1).describe("Short description of the playlist's vibe/theme/genre"),
  length: LengthSchema,
  preferUnfamiliar: z
    .boolean()
    .describe("True if the user wants mostly songs they likely haven't heard before"),
  styleHints: z.array(z.string()).describe("Extra genre/mood/era keywords extracted from the prompt"),
  requiredArtists: z
    .array(z.string())
    .describe(
      "Specific named artist(s) the user explicitly wants songs from (e.g. 'songs by X', 'my cousin Jane's " +
        "tracks', 'include Y'), as opposed to a genre/style. Empty if none named."
    ),
});
export type Brief = z.infer<typeof BriefSchema>;

export const SongCandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        artist: z.string().min(1),
        title: z.string().min(1),
        reason: z.string().min(1).describe("Why this fits the request, one short phrase"),
      })
    )
    .min(1),
});
export type SongCandidates = z.infer<typeof SongCandidatesSchema>;

export const ClustersSchema = z.object({
  clusters: z
    .array(
      z.object({
        name: z.string().min(1).describe("Short genre/vibe name for this cluster"),
        description: z.string().min(1),
        trackIds: z.array(z.string()).describe("Spotify track IDs assigned to this cluster"),
      })
    )
    .min(1),
});
export type Clusters = z.infer<typeof ClustersSchema>;

export const CreateIntentSchema = z.object({
  action: z.literal("create"),
  prompt: z.string().min(1).describe("The user's full natural-language playlist request"),
});

export const SimilarIntentSchema = z.object({
  action: z.literal("similar"),
  playlistUrl: z.string().min(1),
});

export const SplitIntentSchema = z.object({
  action: z.literal("split"),
  playlistUrl: z.string().min(1),
  count: z.number().int().min(2).max(10),
});

export const ExtendIntentSchema = z.object({
  action: z.literal("extend"),
  playlistUrl: z.string().min(1),
  count: z.number().int().min(1).max(50),
});

export const StatusIntentSchema = z.object({
  action: z.literal("status"),
});

export const ClarifyIntentSchema = z.object({
  action: z.literal("clarify"),
  question: z.string().min(1).describe("A short clarifying question to ask the user"),
});

export const UnsupportedIntentSchema = z.object({
  action: z.literal("unsupported"),
  reason: z.string().min(1),
});

export const IntentSchema = z.discriminatedUnion("action", [
  CreateIntentSchema,
  SimilarIntentSchema,
  SplitIntentSchema,
  ExtendIntentSchema,
  StatusIntentSchema,
  ClarifyIntentSchema,
  UnsupportedIntentSchema,
]);
export type Intent = z.infer<typeof IntentSchema>;
