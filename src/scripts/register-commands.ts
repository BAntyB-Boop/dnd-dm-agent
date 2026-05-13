import { REST, Routes } from "discord.js";
import { config } from "../config.js";
import * as rollCmd from "../bot/commands/roll.js";
import * as charCmd from "../bot/commands/character.js";
import * as combatCmd from "../bot/commands/combat.js";
import * as dmCmd from "../bot/commands/dm.js";
import * as campaignCmd from "../bot/commands/campaign.js";
import * as mapCmd from "../bot/commands/map.js";
import * as sessionCmd from "../bot/commands/session.js";
import * as bugCmd from "../bot/commands/bug.js";
import * as dm2Cmd from "../bot/commands/dm2.js";
import * as restCmd from "../bot/commands/rest.js";

const commands = [rollCmd, charCmd, combatCmd, dmCmd, campaignCmd, mapCmd, sessionCmd, bugCmd, dm2Cmd, restCmd].map(c => c.data.toJSON());

const rest = new REST({ version: "10" }).setToken(config.discord.token);

async function register() {
  try {
    console.log(`[Register] Registering ${commands.length} slash commands...`);

    const route = config.discord.guildId
      ? Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId)
      : Routes.applicationCommands(config.discord.clientId);

    await rest.put(route, { body: commands });

    const scope = config.discord.guildId ? `guild ${config.discord.guildId}` : "global";
    console.log(`[Register] Successfully registered commands to ${scope}`);
  } catch (err) {
    console.error("[Register] Failed:", err);
    process.exit(1);
  }
}

register();
