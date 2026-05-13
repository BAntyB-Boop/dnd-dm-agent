import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { rollDice, rollWithAdvantage, rollWithDisadvantage, rollStats } from "../../game/dice.js";

export const data = new SlashCommandBuilder()
  .setName("roll")
  .setDescription("Roll dice")
  .addStringOption(o => o.setName("dice").setDescription("Dice expression (e.g. 1d20+5, 2d6, 4d6kh3)").setRequired(false))
  .addStringOption(o =>
    o.setName("type")
      .setDescription("Roll type")
      .addChoices(
        { name: "Normal", value: "normal" },
        { name: "Advantage", value: "advantage" },
        { name: "Disadvantage", value: "disadvantage" },
        { name: "Roll Stats (4d6 drop lowest x6)", value: "stats" }
      )
      .setRequired(false)
  )
  .addStringOption(o => o.setName("reason").setDescription("What are you rolling for?").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const type = interaction.options.getString("type") ?? "normal";
  const expr = interaction.options.getString("dice");
  const reason = interaction.options.getString("reason");
  const user = interaction.user.username;

  if (type === "stats") {
    const stats = rollStats();
    const labels = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
    const lines = stats.map((s, i) => `**${labels[i]}**: ${s} (${s >= 16 ? "🟢" : s >= 13 ? "🟡" : "🔴"})`);
    await interaction.reply(`🎲 **${user}'s Ability Scores** (4d6 drop lowest)\n${lines.join("  |  ")}\n*Total: ${stats.reduce((a, b) => a + b, 0)}*`);
    return;
  }

  if (type === "advantage") {
    const result = rollWithAdvantage();
    const label = reason ? ` for **${reason}**` : "";
    const crit = result.isCritical ? " 🎯 **CRITICAL HIT!**" : result.isCriticalFail ? " 💨 **CRITICAL FAIL!**" : "";
    await interaction.reply(`🎲 **${user}** rolls with **Advantage**${label}\n${result.breakdown}${crit}`);
    return;
  }

  if (type === "disadvantage") {
    const result = rollWithDisadvantage();
    const label = reason ? ` for **${reason}**` : "";
    const crit = result.isCritical ? " 🎯 **CRITICAL HIT!**" : result.isCriticalFail ? " 💨 **CRITICAL FAIL!**" : "";
    await interaction.reply(`🎲 **${user}** rolls with **Disadvantage**${label}\n${result.breakdown}${crit}`);
    return;
  }

  const expression = expr ?? "1d20";
  try {
    const result = rollDice(expression);
    const label = reason ? ` for **${reason}**` : "";
    const crit = result.isCritical ? " 🎯 **CRITICAL!**" : result.isCriticalFail ? " 💨 **CRITICAL FAIL!**" : "";
    await interaction.reply(`🎲 **${user}** rolls \`${expression}\`${label}\n${result.breakdown}${crit}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid dice expression";
    await interaction.reply({ content: `❌ ${msg}`, ephemeral: true });
  }
}
