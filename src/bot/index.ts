import { Client, GatewayIntentBits, Collection, Interaction, ChatInputCommandInteraction, ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { config } from "../config.js";
import * as rollCmd from "./commands/roll.js";
import * as charCmd from "./commands/character.js";
import * as combatCmd from "./commands/combat.js";
import * as dmCmd from "./commands/dm.js";
import * as campaignCmd from "./commands/campaign.js";
import * as mapCmd from "./commands/map.js";
import * as sessionCmd from "./commands/session.js";
import * as bugCmd from "./commands/bug.js";
import * as dm2Cmd from "./commands/dm2.js";
import * as restCmd from "./commands/rest.js";

const COMPONENT_HANDLERS: Record<string, (i: ButtonInteraction) => Promise<void>> = {
  char:     (i) => charCmd.handleComponent(i),
  campaign: (i) => campaignCmd.handleComponent(i),
  session:  (i) => sessionCmd.handleComponent(i),
  roll:     (i) => dmCmd.handleRollButton(i),
  proll:    (i) => dmCmd.handlePartyRollButton(i),
  roll2:    (i) => dm2Cmd.handleRollButton(i),
  proll2:   (i) => dm2Cmd.handlePartyRollButton(i),
};

interface Command {
  data: { name: string; toJSON: () => unknown };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands = new Collection<string, Command>();

for (const cmd of [rollCmd, charCmd, combatCmd, dmCmd, campaignCmd, mapCmd, sessionCmd, bugCmd, dm2Cmd, restCmd]) {
  commands.set(cmd.data.name, cmd as Command);
}

export function createBot(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ]
  });

  client.once("ready", () => {
    console.log(`[Bot] Logged in as ${client.user?.tag}`);
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    // Select menu interactions (levelup_sub_* and levelup_asi_*)
    if (interaction.isStringSelectMenu()) {
      const sel = interaction as StringSelectMenuInteraction;
      if (sel.customId.startsWith("levelup_")) {
        try {
          await charCmd.handleSelectMenu(sel);
        } catch (err) {
          console.error("[Bot] Error in levelup select:", err);
          if (!sel.replied && !sel.deferred) {
            await sel.reply({ content: "❌ Something went wrong.", ephemeral: true }).catch(console.error);
          }
        }
        return;
      }
    }

    // Button interactions — route by prefix (e.g. "char_confirm:..." → "char")
    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;
      const prefix = btn.customId.split("_")[0];
      const handler = COMPONENT_HANDLERS[prefix];
      if (handler) {
        try {
          await handler(btn);
        } catch (err) {
          console.error(`[Bot] Error in ${prefix} button:`, err);
          if (!btn.replied && !btn.deferred) {
            await btn.reply({ content: "❌ Something went wrong.", ephemeral: true }).catch(console.error);
          }
        }
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[Bot] Error in /${interaction.commandName}:`, err);
      const msg = "❌ Something went wrong. Try again.";
      if (interaction.deferred) {
        await interaction.editReply(msg).catch(console.error);
      } else if (!interaction.replied) {
        await interaction.reply({ content: msg, ephemeral: true }).catch(console.error);
      }
    }
  });

  return client;
}

export async function startBot(): Promise<void> {
  const client = createBot();
  await client.login(config.discord.token);
}
