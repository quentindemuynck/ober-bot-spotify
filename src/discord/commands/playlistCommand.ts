import { SlashCommandBuilder } from "discord.js";

export const playlistCommand = new SlashCommandBuilder()
  .setName("playlist")
  .setDescription("AI-powered Spotify playlist commands")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a new playlist from a natural-language description")
      .addStringOption((opt) =>
        opt.setName("prompt").setDescription("Describe the playlist you want").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("similar")
      .setDescription("Create a new playlist of songs similar to an existing playlist")
      .addStringOption((opt) =>
        opt.setName("url").setDescription("Spotify playlist URL").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("split")
      .setDescription("Split a playlist into N playlists by genre/vibe")
      .addStringOption((opt) =>
        opt.setName("url").setDescription("Spotify playlist URL").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("count")
          .setDescription("Number of playlists to split into (2-10)")
          .setMinValue(2)
          .setMaxValue(10)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("extend")
      .setDescription("Add more same-genre tracks to an existing playlist")
      .addStringOption((opt) =>
        opt.setName("url").setDescription("Spotify playlist URL").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("count")
          .setDescription("Number of tracks to add (default 10, max 50)")
          .setMinValue(1)
          .setMaxValue(50)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription("Check remaining Spotify search quota and whether it's currently available")
  );
