import { REST, Routes } from "discord.js";
import { env } from "../../config/env.js";
import { logger } from "../../util/logger.js";
import { playlistCommand } from "./playlistCommand.js";

export async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(env.DISCORD_TOKEN);
  const body = [playlistCommand.toJSON()];

  if (env.DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
      body,
    });
    logger.info("Registered guild slash commands", { guildId: env.DISCORD_GUILD_ID });
  } else {
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
    logger.info("Registered global slash commands (may take up to ~1 hour to propagate)");
  }
}
