import "./db/db.js"; // ensures DB is initialized/migrated before anything else
import { env } from "./config/env.js";
import { createDiscordClient } from "./discord/client.js";
import { registerCommands } from "./discord/commands/registerCommands.js";
import { handleInteractionCreate } from "./discord/handlers/interactionCreate.js";
import { registerMessageCreateHandler } from "./discord/handlers/messageCreate.js";
import { logger } from "./util/logger.js";

async function main() {
  await registerCommands();

  const client = createDiscordClient();

  client.once("clientReady", (readyClient) => {
    logger.info("Discord bot ready", { tag: readyClient.user.tag });
  });

  client.on("interactionCreate", (interaction) => {
    handleInteractionCreate(interaction).catch((err) => {
      logger.error("Unhandled interaction error", { error: err instanceof Error ? err.stack : String(err) });
    });
  });

  registerMessageCreateHandler(client);

  await client.login(env.DISCORD_TOKEN);
}

main().catch((err) => {
  logger.error("Fatal startup error", { error: err instanceof Error ? err.stack : String(err) });
  process.exit(1);
});
