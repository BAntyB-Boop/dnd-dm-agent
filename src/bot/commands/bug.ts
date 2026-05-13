import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getActiveCampaign, getCharacter, getInventory, getSessionMessages, getActiveCombat } from "../../db/database.js";

const BUG_DIR = "./bug-reports";

function pad(n: number) { return String(n).padStart(2, "0"); }

function timestamp(): { display: string; file: string } {
  const d = new Date();
  const display = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const file    = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return { display, file };
}

export const data = new SlashCommandBuilder()
  .setName("bug")
  .setDescription("Report a bug or unexpected behavior to the DM")
  .addStringOption(o =>
    o.setName("description")
      .setDescription("What happened? What did you expect?")
      .setRequired(true)
      .setMaxLength(500)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const description = interaction.options.getString("description", true);
  const userId      = interaction.user.id;
  const username    = interaction.user.username;
  const ts          = timestamp();

  const campaign  = getActiveCampaign();
  const char      = campaign ? getCharacter(userId, campaign.id) : null;
  const items     = char     ? getInventory(char.id) : [];
  const messages  = campaign ? getSessionMessages(campaign.id) : [];
  const combat    = campaign ? getActiveCombat(campaign.id) : null;

  // Build report text
  const lines: string[] = [
    `=== BUG REPORT ===`,
    `Timestamp : ${ts.display}`,
    `User      : ${username} (id: ${userId})`,
    `Campaign  : ${campaign ? `"${campaign.name}" (id: ${campaign.id})` : "none"}`,
    ``,
    `=== DESCRIPTION ===`,
    description,
    ``,
    `=== CHARACTER STATE ===`,
  ];

  if (char) {
    lines.push(
      `Name      : ${char.name}`,
      `Class     : ${char.class} | Race: ${char.race} | Level: ${char.level}`,
      `HP        : ${char.hp}/${char.max_hp}  AC: ${char.ac}  Gold: ${char.gold}g`,
      `Stats     : STR ${char.strength} DEX ${char.dexterity} CON ${char.constitution} INT ${char.intelligence} WIS ${char.wisdom} CHA ${char.charisma}`,
      `Inventory : ${items.length} item(s)${items.length > 0 ? " — " + items.map(i => `${i.name}${i.equipped ? " [E]" : ""}`).join(", ") : ""}`,
    );
  } else {
    lines.push("No character found for this user in the active campaign.");
  }

  lines.push(
    ``,
    `=== COMBAT STATE ===`,
    combat ? `Active combat — round ${combat.round}, turn index ${combat.current_turn_index}` : "No active combat",
    ``,
    `=== RECENT SESSION (last 5 messages) ===`,
  );

  const recent = messages.slice(-5);
  if (recent.length === 0) {
    lines.push("No session messages.");
  } else {
    for (const m of recent) {
      const role  = m.role === "user" ? `[Player]` : `[DM]   `;
      const text  = m.content.replace(/\n/g, " ").slice(0, 200);
      lines.push(`${role} ${text}`);
    }
  }

  lines.push(``, `=== END OF REPORT ===`);

  // Write file
  try {
    mkdirSync(BUG_DIR, { recursive: true });
    const filename = `bug_${ts.file}_${userId}.txt`;
    writeFileSync(join(BUG_DIR, filename), lines.join("\n"), "utf-8");
    console.log(`[Bug] Report saved: ${filename}`);
    await interaction.reply({
      content: `✅ **Bug report saved!**\nFile: \`${filename}\`\n\nThank you for reporting, ${username}. The issue has been logged for review.`,
      ephemeral: true,
    });
  } catch (err) {
    console.error("[Bug] Failed to write report:", err);
    await interaction.reply({ content: "❌ Failed to save bug report. Please try again.", ephemeral: true });
  }
}
