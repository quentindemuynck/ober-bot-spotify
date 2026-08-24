import { type Interaction } from "discord.js";
import { checkQuotaStatus } from "../../actions/checkQuotaStatus.js";
import { runCreatePlaylist } from "../../actions/createPlaylist.js";
import { DEFAULT_EXTEND_COUNT, runExtendPlaylist } from "../../actions/extendPlaylist.js";
import { runSimilarPlaylist } from "../../actions/similarPlaylist.js";
import { runSplitPlaylist } from "../../actions/splitPlaylist.js";
import { logger } from "../../util/logger.js";
import {
  errorEmbed,
  extendResultEmbed,
  playlistResultEmbed,
  quotaStatusEmbed,
  splitResultEmbed,
} from "../formatting.js";

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "playlist") return;

  await interaction.deferReply();

  const onProgress = (accepted: number, target: number) => {
    interaction.editReply(`Working on it... ${accepted}/${target} tracks found so far.`).catch(() => {
      // best-effort progress update; a failure here shouldn't abort the command
    });
  };

  try {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      const prompt = interaction.options.getString("prompt", true);
      const result = await runCreatePlaylist(prompt, onProgress);
      await interaction.editReply({ content: null, embeds: [playlistResultEmbed("Playlist created", result)] });
      return;
    }

    if (subcommand === "similar") {
      const url = interaction.options.getString("url", true);
      const result = await runSimilarPlaylist(url, onProgress);
      await interaction.editReply({
        content: null,
        embeds: [playlistResultEmbed("Similar playlist created", result)],
      });
      return;
    }

    if (subcommand === "split") {
      const url = interaction.options.getString("url", true);
      const count = interaction.options.getInteger("count", true);
      const result = await runSplitPlaylist(url, count);
      await interaction.editReply({ content: null, embeds: [splitResultEmbed(result)] });
      return;
    }

    if (subcommand === "extend") {
      const url = interaction.options.getString("url", true);
      const count = interaction.options.getInteger("count") ?? DEFAULT_EXTEND_COUNT;
      const result = await runExtendPlaylist(url, count, onProgress);
      await interaction.editReply({ content: null, embeds: [extendResultEmbed(result)] });
      return;
    }

    if (subcommand === "status") {
      const status = await checkQuotaStatus();
      await interaction.editReply({ content: null, embeds: [quotaStatusEmbed(status)] });
      return;
    }
  } catch (err) {
    logger.error("Slash command failed", {
      command: interaction.commandName,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    const message = err instanceof Error ? err.message : "Unexpected error.";
    await interaction.editReply({ content: null, embeds: [errorEmbed(message)] });
  }
}
