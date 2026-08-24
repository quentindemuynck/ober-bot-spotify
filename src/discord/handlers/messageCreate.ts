import { type Client, type Message } from "discord.js";
import { classifyIntent } from "../../ai/intentParser.js";
import { checkQuotaStatus } from "../../actions/checkQuotaStatus.js";
import { runCreatePlaylist } from "../../actions/createPlaylist.js";
import { runExtendPlaylist } from "../../actions/extendPlaylist.js";
import { runSimilarPlaylist } from "../../actions/similarPlaylist.js";
import { runSplitPlaylist } from "../../actions/splitPlaylist.js";
import { logger } from "../../util/logger.js";
import {
  clarifyEmbed,
  errorEmbed,
  extendResultEmbed,
  playlistResultEmbed,
  quotaStatusEmbed,
  splitResultEmbed,
} from "../formatting.js";
import {
  clearPendingClarification,
  getPendingClarification,
  setPendingClarification,
} from "../clarification.js";

function stripMention(content: string, clientId: string): string {
  return content.replace(new RegExp(`<@!?${clientId}>`, "g"), "").trim();
}

export function registerMessageCreateHandler(client: Client): void {
  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (!client.user || !message.mentions.has(client.user)) return;

    const text = stripMention(message.content, client.user.id);
    if (!text) {
      await message.reply("Mention me with a request, e.g. `@OberBot make me a chill DnB playlist`.");
      return;
    }

    const pendingOriginal = getPendingClarification(message.channelId, message.author.id);
    const combinedText = pendingOriginal
      ? `${pendingOriginal}\n(follow-up answer: ${text})`
      : text;
    clearPendingClarification(message.channelId, message.author.id);

    const statusMessage = await message.reply("Working on it...");

    const onProgress = (accepted: number, target: number) => {
      statusMessage.edit(`Working on it... ${accepted}/${target} tracks found so far.`).catch(() => {
        // best-effort progress update; a failure here shouldn't abort the command
      });
    };

    try {
      const intent = await classifyIntent(combinedText);

      switch (intent.action) {
        case "create": {
          const result = await runCreatePlaylist(intent.prompt, onProgress);
          await statusMessage.edit({ content: null, embeds: [playlistResultEmbed("Playlist created", result)] });
          break;
        }
        case "similar": {
          const result = await runSimilarPlaylist(intent.playlistUrl, onProgress);
          await statusMessage.edit({
            content: null,
            embeds: [playlistResultEmbed("Similar playlist created", result)],
          });
          break;
        }
        case "split": {
          const result = await runSplitPlaylist(intent.playlistUrl, intent.count);
          await statusMessage.edit({ content: null, embeds: [splitResultEmbed(result)] });
          break;
        }
        case "extend": {
          const result = await runExtendPlaylist(intent.playlistUrl, intent.count, onProgress);
          await statusMessage.edit({ content: null, embeds: [extendResultEmbed(result)] });
          break;
        }
        case "status": {
          const status = await checkQuotaStatus();
          await statusMessage.edit({ content: null, embeds: [quotaStatusEmbed(status)] });
          break;
        }
        case "clarify": {
          setPendingClarification(message.channelId, message.author.id, combinedText);
          await statusMessage.edit({ content: null, embeds: [clarifyEmbed(intent.question)] });
          break;
        }
        case "unsupported": {
          await statusMessage.edit({
            content: null,
            embeds: [
              errorEmbed(`I can only create, extend, split, or find similar playlists. ${intent.reason}`),
            ],
          });
          break;
        }
      }
    } catch (err) {
      logger.error("Mention handling failed", {
        error: err instanceof Error ? err.stack ?? err.message : String(err),
      });
      const errMessage = err instanceof Error ? err.message : "Unexpected error.";
      await statusMessage.edit({ content: null, embeds: [errorEmbed(errMessage)] });
    }
  });
}
