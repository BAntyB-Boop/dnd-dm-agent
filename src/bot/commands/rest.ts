import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
  getActiveCampaign, getAllCharacters, getCharacter, updateCharacterHp,
  longRestHeal, restoreAllSpellSlots, shortRestWarlockSlots,
} from "../../db/database.js";
import { getSpellSlots, CLASSES } from "../../game/character-data.js";
import { broadcast } from "../../agent/dm-shared.js";
import { rollDice } from "../../game/dice.js";

export const data = new SlashCommandBuilder()
  .setName("rest")
  .setDescription("Take a rest to recover HP and resources")
  .addSubcommand(s =>
    s.setName("long").setDescription("Long rest: fully restore HP and all spell slots (8 hours)")
  )
  .addSubcommand(s =>
    s.setName("short").setDescription("Short rest: restore Warlock slots; optionally spend Hit Dice for HP (1 hour)")
      .addIntegerOption(o =>
        o.setName("hit_dice")
          .setDescription("How many Hit Dice to spend for HP recovery (max = your level)")
          .setRequired(false)
          .setMinValue(1)
      )
  )
  .addSubcommand(s =>
    s.setName("slots").setDescription("View your current spell slot status")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const campaign = getActiveCampaign();
  if (!campaign) {
    await interaction.reply({ content: "❌ No active campaign.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case "long": {
      await interaction.deferReply();

      longRestHeal(campaign.id);
      restoreAllSpellSlots(campaign.id);
      const chars = getAllCharacters(campaign.id);

      broadcast(campaign.id, "long_rest", { description: "Party took a long rest" });
      broadcast(campaign.id, "party_update", chars.map(c => ({
        id: c.id, name: c.name, class: c.class, race: c.race,
        level: c.level, hp: c.max_hp, max_hp: c.max_hp, ac: c.ac, is_player: true, avatar: c.avatar ?? "",
        spell_slots: (() => { try { return JSON.parse(c.spell_slots || "{}"); } catch { return {}; } })(),
      })));

      const embed = new EmbedBuilder()
        .setTitle("🌙 Long Rest Complete")
        .setColor(0x5865F2)
        .setDescription("The party rests for 8 hours. All wounds are healed and magic is fully restored.");

      for (const c of chars) {
        const slots = (() => { try { return JSON.parse(c.spell_slots || "{}") as Record<string, number>; } catch { return {}; } })();
        const slotStr = Object.entries(slots).filter(([, v]) => v > 0).map(([k, v]) => `L${k}×${v}`).join(" ");
        const spellLine = slotStr ? `\n📖 ${slotStr}` : "";
        embed.addFields({
          name: c.name,
          value: `❤️ ${c.max_hp}/${c.max_hp} HP${spellLine}`,
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [embed] });
      break;
    }

    case "short": {
      await interaction.deferReply();

      const restoredWarlocks = shortRestWarlockSlots(campaign.id);
      const hdCount = interaction.options.getInteger("hit_dice") ?? 0;

      let hpLines: string[] = [];

      if (hdCount > 0) {
        const char = getCharacter(interaction.user.id, campaign.id);
        if (!char) {
          await interaction.editReply("❌ You don't have a character. Hit Dice spending skipped.");
          break;
        }

        const classData = CLASSES[char.class.toLowerCase()];
        const hitDie = classData?.hitDie ?? 8;
        const conMod = Math.floor((char.constitution - 10) / 2);
        const actualHD = Math.min(hdCount, char.level);

        let totalHeal = 0;
        const rolls: string[] = [];
        for (let i = 0; i < actualHD; i++) {
          const modStr = conMod >= 0 ? `+${conMod}` : String(conMod);
          const roll = rollDice(`1d${hitDie}${modStr}`);
          totalHeal += Math.max(0, roll.total);
          rolls.push(roll.breakdown);
        }

        const newHp = Math.min(char.max_hp, char.hp + totalHeal);
        updateCharacterHp(char.id, newHp);
        hpLines.push(`**${char.name}** spent ${actualHD}d${hitDie}: ${rolls.join(", ")} = **+${totalHeal} HP** (${newHp}/${char.max_hp})`);
      }

      broadcast(campaign.id, "short_rest", { description: "Party took a short rest" });

      const embed = new EmbedBuilder()
        .setTitle("☀️ Short Rest Complete")
        .setColor(0xF0A500)
        .setDescription("The party rests for an hour.");

      if (restoredWarlocks.length > 0) {
        embed.addFields({ name: "🔮 Warlock Pact Magic Restored", value: restoredWarlocks.join(", ") });
      }
      if (hpLines.length > 0) {
        embed.addFields({ name: "❤️ Hit Dice Spent", value: hpLines.join("\n") });
      }

      embed.setFooter({ text: "Other characters can use /rest short hit_dice:<n> to spend their own Hit Dice" });

      await interaction.editReply({ embeds: [embed] });
      break;
    }

    case "slots": {
      const char = getCharacter(interaction.user.id, campaign.id);
      if (!char) {
        await interaction.reply({ content: "❌ You don't have a character in this campaign.", ephemeral: true });
        return;
      }

      const classData = CLASSES[char.class.toLowerCase()];
      if (!classData?.spellcaster) {
        await interaction.reply({ content: `ℹ️ **${char.name}** (${char.class}) is not a spellcaster and has no spell slots.`, ephemeral: true });
        return;
      }

      const current: Record<string, number> = (() => { try { return JSON.parse(char.spell_slots || "{}"); } catch { return {}; } })();
      const max = getSpellSlots(char.class, char.level);

      const lines = Object.entries(max)
        .filter(([, v]) => v > 0)
        .map(([k]) => {
          const cur = current[k] ?? 0;
          const mx = max[k];
          const filled = "🔷".repeat(cur) + "⬜".repeat(mx - cur);
          return `Level ${k}: ${filled} (${cur}/${mx})`;
        });

      const embed = new EmbedBuilder()
        .setTitle(`📖 ${char.name}'s Spell Slots`)
        .setColor(0x9B59B6)
        .setDescription(lines.join("\n") || "No spell slots available at this level.");

      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }
  }
}
