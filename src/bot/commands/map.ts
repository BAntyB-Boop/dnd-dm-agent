import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import {
  getActiveCampaign, updateAtmosphere, getAtmosphere,
  getAllCharacters, getActiveCombat, updateCombat,
} from "../../db/database.js";
import type { CombatParticipant } from "../../db/database.js";
import { broadcastEvent } from "../../web/index.js";
import { listMaps } from "../../scripts/loader.js";

export const data = new SlashCommandBuilder()
  .setName("map")
  .setDescription("Manage the map shown on the web viewer")
  .addSubcommand(s =>
    s.setName("set").setDescription("Show a map on the web viewer")
      .addStringOption(o => o.setName("name").setDescription("Map filename (without extension)").setRequired(true))
  )
  .addSubcommand(s => s.setName("clear").setDescription("Hide the current map"))
  .addSubcommand(s => s.setName("list").setDescription("List available maps"))
  .addSubcommand(s =>
    s.setName("pos").setDescription("Set a player character's position on the map (0.0=left/top, 1.0=right/bottom)")
      .addStringOption(o => o.setName("name").setDescription("Character name").setRequired(true))
      .addNumberOption(o => o.setName("x").setDescription("X position (0.0–1.0)").setRequired(true).setMinValue(0).setMaxValue(1))
      .addNumberOption(o => o.setName("y").setDescription("Y position (0.0–1.0)").setRequired(true).setMinValue(0).setMaxValue(1))
  )
  .addSubcommand(s =>
    s.setName("monsterpos").setDescription("Set a monster's position on the map (must be in active combat)")
      .addStringOption(o => o.setName("name").setDescription("Monster name").setRequired(true))
      .addNumberOption(o => o.setName("x").setDescription("X position (0.0–1.0)").setRequired(true).setMinValue(0).setMaxValue(1))
      .addNumberOption(o => o.setName("y").setDescription("Y position (0.0–1.0)").setRequired(true).setMinValue(0).setMaxValue(1))
  )
  .addSubcommand(s => s.setName("clearpos").setDescription("Clear all character and monster map positions"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const campaign = getActiveCampaign();

  if (!campaign) {
    await interaction.reply({ content: "❌ No active campaign.", ephemeral: true });
    return;
  }

  switch (subcommand) {
    case "set": {
      const name = interaction.options.getString("name", true);
      const maps = listMaps();
      if (!maps.includes(name)) {
        const available = maps.length > 0 ? maps.join(", ") : "none";
        await interaction.reply({
          content: `❌ Map '${name}' not found.\nAvailable: ${available}\n\nวางไฟล์รูปไว้ใน \`maps/\` folder (png, jpg, webp)`,
          ephemeral: true
        });
        return;
      }
      updateAtmosphere(campaign.id, { current_map: name });
      broadcastEvent(campaign.id, "atmosphere", getAtmosphere(campaign.id));
      await interaction.reply(`🗺️ Map **${name}** is now showing on the web viewer!`);
      break;
    }

    case "clear": {
      updateAtmosphere(campaign.id, { current_map: "" });
      broadcastEvent(campaign.id, "atmosphere", getAtmosphere(campaign.id));
      await interaction.reply("🗺️ Map hidden from web viewer.");
      break;
    }

    case "list": {
      const maps = listMaps();
      if (maps.length === 0) {
        await interaction.reply({
          content: "📂 No maps found.\n\nวางไฟล์รูปแผนที่ไว้ใน `maps/` folder (รองรับ .png, .jpg, .jpeg, .webp, .gif)",
          ephemeral: true
        });
        return;
      }
      await interaction.reply({
        content: `🗺️ **Available Maps** (${maps.length})\n${maps.map(m => `  • \`${m}\``).join("\n")}\n\nใช้ \`/map set <name>\` เพื่อแสดง`,
        ephemeral: true
      });
      break;
    }

    case "pos": {
      const name = interaction.options.getString("name", true);
      const x    = interaction.options.getNumber("x", true);
      const y    = interaction.options.getNumber("y", true);

      const chars = getAllCharacters(campaign.id);
      const char  = chars.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (!char) {
        const names = chars.map(c => c.name).join(", ") || "none";
        await interaction.reply({ content: `❌ Character '${name}' not found.\nParty: ${names}`, ephemeral: true });
        return;
      }

      const atm       = getAtmosphere(campaign.id);
      const positions = JSON.parse(atm?.player_positions || "{}") as Record<string, { x: number; y: number }>;
      positions[String(char.id)] = { x, y };
      updateAtmosphere(campaign.id, { player_positions: JSON.stringify(positions) });
      broadcastEvent(campaign.id, "atmosphere", getAtmosphere(campaign.id));

      await interaction.reply(`📍 **${char.name}** placed at (${Math.round(x * 100)}%, ${Math.round(y * 100)}%) on the map.`);
      break;
    }

    case "monsterpos": {
      const name = interaction.options.getString("name", true);
      const x    = interaction.options.getNumber("x", true);
      const y    = interaction.options.getNumber("y", true);

      const encounter = getActiveCombat(campaign.id);
      if (!encounter) {
        await interaction.reply({ content: "❌ No active combat.", ephemeral: true });
        return;
      }

      const participants: CombatParticipant[] = typeof encounter.participants === "string"
        ? JSON.parse(encounter.participants)
        : encounter.participants;

      const p = participants.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (!p) {
        const monsters = participants.filter(p => !p.is_player).map(p => p.name).join(", ") || "none";
        await interaction.reply({ content: `❌ Monster '${name}' not in combat.\nMonsters: ${monsters}`, ephemeral: true });
        return;
      }
      if (p.is_player) {
        await interaction.reply({ content: `❌ '${p.name}' is a player — use \`/map pos\` instead.`, ephemeral: true });
        return;
      }

      p.map_x = x;
      p.map_y = y;
      updateCombat(encounter.id, { participants });
      broadcastEvent(campaign.id, "combat_update", {
        active: true,
        round: encounter.round,
        current_turn_index: encounter.current_turn_index,
        participants,
      });

      await interaction.reply(`📍 **${p.name}** placed at (${Math.round(x * 100)}%, ${Math.round(y * 100)}%) on the map.`);
      break;
    }

    case "clearpos": {
      updateAtmosphere(campaign.id, { player_positions: "{}" });
      broadcastEvent(campaign.id, "atmosphere", getAtmosphere(campaign.id));
      await interaction.reply("🗺️ All character positions cleared from the map.");
      break;
    }
  }
}
