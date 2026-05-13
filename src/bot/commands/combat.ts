import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getActiveCampaign, getAllCharacters, getActiveCombat } from "../../db/database.js";
import {
  startCombat, nextTurn, applyDamage, applyHealing,
  finishCombat, getCombatSummary, monsterAttack
} from "../../game/combat.js";
import { rollDice, rollInitiative, getModifier } from "../../game/dice.js";
import type { CombatParticipant } from "../../db/database.js";

export const data = new SlashCommandBuilder()
  .setName("combat")
  .setDescription("Combat management")
  .addSubcommand(s =>
    s.setName("status").setDescription("Show current combat status")
  )
  .addSubcommand(s =>
    s.setName("next").setDescription("Advance to next turn")
  )
  .addSubcommand(s =>
    s.setName("attack").setDescription("Make an attack roll")
      .addStringOption(o => o.setName("target").setDescription("Target name").setRequired(true))
      .addIntegerOption(o => o.setName("attack_bonus").setDescription("Your attack bonus").setRequired(true))
      .addStringOption(o => o.setName("damage_dice").setDescription("Damage dice (e.g. 1d8+3)").setRequired(true))
      .addStringOption(o => o.setName("damage_type").setDescription("Damage type").setRequired(false))
  )
  .addSubcommand(s =>
    s.setName("heal").setDescription("Apply healing")
      .addStringOption(o => o.setName("target").setDescription("Target name").setRequired(true))
      .addIntegerOption(o => o.setName("amount").setDescription("HP to restore").setRequired(true))
  )
  .addSubcommand(s =>
    s.setName("end").setDescription("End combat (DM only)")
  )
  .addSubcommand(s =>
    s.setName("reset").setDescription("Force-clear stuck/stale combat state (no XP awarded)")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const campaign = getActiveCampaign();

  if (!campaign) {
    await interaction.reply({ content: "❌ No active campaign.", ephemeral: true });
    return;
  }

  switch (subcommand) {
    case "status": {
      const encounter = getActiveCombat(campaign.id);
      if (!encounter) {
        await interaction.reply({ content: "No active combat.", ephemeral: true });
        return;
      }
      await interaction.reply(getCombatSummary(campaign.id));
      break;
    }

    case "next": {
      const result = nextTurn(campaign.id);
      if (!result) {
        await interaction.reply({ content: "❌ No active combat or no living participants.", ephemeral: true });
        return;
      }

      const { participant, round, isNewRound } = result;
      const roundNotice = isNewRound ? `\n🔔 **Round ${round} begins!**` : "";
      const playerTag = participant.discord_user_id ? ` <@${participant.discord_user_id}>` : "";
      const icon = participant.is_player ? "🧙" : "👾";

      await interaction.reply(
        `${roundNotice}\n${icon} It's **${participant.name}**'s turn!${playerTag}\n` +
        `*(${participant.hp}/${participant.max_hp} HP, AC ${participant.ac})*\n\n` +
        getCombatSummary(campaign.id)
      );
      break;
    }

    case "attack": {
      const encounter = getActiveCombat(campaign.id);
      if (!encounter) {
        await interaction.reply({ content: "❌ No active combat.", ephemeral: true });
        return;
      }

      const targetName = interaction.options.getString("target", true);
      const attackBonus = interaction.options.getInteger("attack_bonus", true);
      const damageDice = interaction.options.getString("damage_dice", true);
      const damageType = interaction.options.getString("damage_type") ?? "piercing";
      const attacker = interaction.user.username;

      const attackRoll = rollDice(`1d20${attackBonus >= 0 ? "+" : ""}${attackBonus}`);
      const isCrit = attackRoll.isCritical ?? false;
      const isCritFail = attackRoll.isCriticalFail ?? false;

      // Find target AC from combat
      const { parseCombat } = await import("../../game/combat.js");
      const participants = parseCombat(encounter);
      const target = participants.find(p => p.name.toLowerCase() === targetName.toLowerCase());

      if (!target) {
        await interaction.reply({ content: `❌ Target '${targetName}' not found in combat.`, ephemeral: true });
        return;
      }

      const hit = isCrit || (!isCritFail && attackRoll.total >= target.ac);
      let damage = 0;
      let dmgBreakdown = "";

      if (hit) {
        const dmgExpr = isCrit ? `${damageDice}+${damageDice}` : damageDice;
        const dmgResult = rollDice(dmgExpr);
        damage = Math.max(1, dmgResult.total);
        dmgBreakdown = dmgResult.breakdown;

        const result = applyDamage(campaign.id, targetName, damage, damageType);
        const deathLine = result?.died ? `\n💀 **${targetName} has fallen!**` : result ? `\n*${targetName}: ${result.participant.hp}/${result.participant.max_hp} HP*` : "";

        const critLine = isCrit ? "🎯 **CRITICAL HIT!** " : "";
        await interaction.reply(
          `⚔️ **${attacker}** attacks **${targetName}**!\n` +
          `Attack: ${attackRoll.breakdown} vs AC ${target.ac} — **HIT!**\n` +
          `${critLine}Damage: ${dmgBreakdown} = **${damage} ${damageType}**${deathLine}`
        );
      } else {
        const missLine = isCritFail ? "💨 **CRITICAL MISS!**" : `❌ **Miss!** (rolled ${attackRoll.total} vs AC ${target.ac})`;
        await interaction.reply(
          `⚔️ **${attacker}** attacks **${targetName}**!\n` +
          `Attack: ${attackRoll.breakdown} — ${missLine}`
        );
      }
      break;
    }

    case "heal": {
      const targetName = interaction.options.getString("target", true);
      const amount = interaction.options.getInteger("amount", true);

      const healed = applyHealing(campaign.id, targetName, amount);
      if (!healed) {
        await interaction.reply({ content: `❌ '${targetName}' not found in combat.`, ephemeral: true });
        return;
      }

      await interaction.reply(`✨ **${targetName}** healed for **${amount} HP** (${healed.hp}/${healed.max_hp} HP)`);
      break;
    }

    case "end": {
      const encounter = getActiveCombat(campaign.id);
      if (!encounter) {
        await interaction.reply({ content: "❌ No active combat to end.", ephemeral: true });
        return;
      }

      finishCombat(campaign.id);
      await interaction.reply("⚔️ **Combat has ended!** The dust settles...");
      break;
    }

    case "reset": {
      const encounter = getActiveCombat(campaign.id);
      if (!encounter) {
        await interaction.reply({ content: "ℹ️ No active combat found — nothing to reset.", ephemeral: true });
        return;
      }

      const { parseCombat } = await import("../../game/combat.js");
      const participants = parseCombat(encounter);
      const summary = participants.map(p => `${p.is_player ? "🧙" : "👾"} ${p.name}`).join(", ");

      finishCombat(campaign.id);
      await interaction.reply(
        `🔄 **Combat reset!** Cleared stale combat state (Round ${encounter.round}, Turn index ${encounter.current_turn_index})\n` +
        `Participants removed: ${summary}\n` +
        `*No XP was awarded. Use \`/dm\` to let the DM start a new combat when ready.*`
      );
      break;
    }
  }
}
