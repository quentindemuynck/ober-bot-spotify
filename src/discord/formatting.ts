import { EmbedBuilder, time as discordTime } from "discord.js";
import type { ExtendActionResult, PlaylistActionResult, SplitActionResult } from "../actions/types.js";
import type { QuotaStatus } from "../actions/checkQuotaStatus.js";

const BRAND_COLOR = 0x1db954; // Spotify green

export function playlistResultEmbed(title: string, result: PlaylistActionResult): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(title)
    .setURL(result.playlistUrl)
    .setDescription(`**${result.name}**\n${result.trackCount} track(s)`);

  if (result.sampleTracks.length > 0) {
    embed.addFields({ name: "Sample tracks", value: result.sampleTracks.map((t) => `• ${t}`).join("\n") });
  }

  if (result.shortfall) {
    embed.setFooter({
      text: "Couldn't find enough matching songs on Spotify to hit the full target — added what resolved cleanly.",
    });
  }

  return embed;
}

export function splitResultEmbed(result: SplitActionResult): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`Split "${result.sourcePlaylistName}" into ${result.playlists.length} playlists`);

  for (const p of result.playlists) {
    embed.addFields({
      name: `${p.name} (${p.trackCount} tracks)`,
      value: `[Open in Spotify](${p.playlistUrl})`,
    });
  }

  return embed;
}

export function extendResultEmbed(result: ExtendActionResult): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("Playlist extended")
    .setURL(result.playlistUrl)
    .setDescription(
      `**${result.name}**\nAdded ${result.addedCount} track(s) — ${result.totalCount} total now`
    );

  if (result.sampleTracks.length > 0) {
    embed.addFields({ name: "Added tracks", value: result.sampleTracks.map((t) => `• ${t}`).join("\n") });
  }

  if (result.shortfall) {
    embed.setFooter({
      text: "Couldn't find enough matching songs on Spotify to hit the full target — added what resolved cleanly.",
    });
  }

  return embed;
}

export function quotaStatusEmbed(status: QuotaStatus): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle("Spotify search quota status");

  const remaining = Math.max(0, status.limit - status.used);
  embed.addFields({
    name: "Self-imposed daily budget",
    value: `${status.used}/${status.limit} search calls used (${remaining} left) in the last 24h`,
  });

  if (status.nextFreeUpAt) {
    embed.addFields({
      name: "Next budget free-up",
      value: discordTime(Math.floor(status.nextFreeUpAt / 1000), "R"),
    });
  }

  if (status.live === null) {
    embed.addFields({
      name: "Live Spotify check",
      value: "Skipped — self-imposed budget is already exhausted, so it wouldn't matter either way.",
    });
  } else if (status.live.available) {
    embed.addFields({ name: "Live Spotify check", value: "✅ Spotify search is currently reachable." });
  } else {
    embed.addFields({
      name: "Live Spotify check",
      value: `❌ ${status.live.detail ?? "Spotify search is currently unavailable."}`,
    });
  }

  return embed;
}

export function errorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0xed4245).setTitle("Something went wrong").setDescription(message);
}

export function clarifyEmbed(question: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0xfaa61a).setTitle("Quick question").setDescription(question);
}
