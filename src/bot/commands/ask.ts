import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { runAsk } from "../../agent/ask.js";
import { config } from "../../config.js";
import { splitMessage } from "./dm.js";

export const data = new SlashCommandBuilder()
  .setName("ask")
  .setDescription("Ask the AI anything — D&D rules, lore, or general questions (no campaign needed)")
  .addStringOption(o =>
    o.setName("question")
      .setDescription("What do you want to know?")
      .setRequired(true)
      .setMaxLength(1000)
  )
  .addStringOption(o =>
    o.setName("language")
      .setDescription("Answer language (defaults to the bot's default)")
      .addChoices(
        { name: "ไทย", value: "th" },
        { name: "English", value: "en" },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const question = interaction.options.getString("question", true);
  const language = (interaction.options.getString("language") ?? config.defaultLanguage) as "th" | "en";

  await interaction.deferReply();

  try {
    const answer = await runAsk(question, language);
    const chunks = splitMessage(answer || "*(no answer)*");

    await interaction.editReply(`**❓ ${question}**`);
    for (const chunk of chunks) await interaction.followUp(chunk);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Ask] Error:", err);
    await interaction.editReply(`❌ AI error: ${msg}`);
  }
}
