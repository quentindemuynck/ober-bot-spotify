import { ClustersSchema, type Clusters } from "./schemas.js";
import { structuredComplete } from "./structuredComplete.js";

export interface TrackForClustering {
  trackId: string;
  title: string;
  artist: string;
}

const SYSTEM_PROMPT = `You split a Spotify playlist's tracks into a fixed number of genre/vibe-based groups.
Spotify no longer provides genre metadata, so infer each track's genre/vibe yourself from the artist and
title, using your own music knowledge. Every track ID given to you MUST appear in exactly one cluster's
trackIds array — do not drop any track and do not duplicate a track across clusters. Give each cluster a
short, descriptive genre/vibe name.`;

export async function clusterTracks(tracks: TrackForClustering[], n: number): Promise<Clusters> {
  const trackList = tracks.map((t) => `${t.trackId} | ${t.artist} - ${t.title}`).join("\n");

  const userPrompt = `Split these ${tracks.length} tracks into exactly ${n} groups by genre/vibe.

${trackList}`;

  return structuredComplete({
    schema: ClustersSchema,
    schemaName: "clusters",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  });
}
