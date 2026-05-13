import {
  ChatInputCommandInteraction, SlashCommandBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  EmbedBuilder, ButtonInteraction, ModalBuilder,
  TextInputBuilder, TextInputStyle, ModalSubmitInteraction,
} from "discord.js";
import { getActiveCampaign } from "../../db/database.js";
import {
  saveSession, listSavedSessions, loadSavedSession,
  deleteSavedSession, getSessionMessages, clearSessionMessages,
  getSavedSession,
} from "../../db/database.js";

export const data = new SlashCommandBuilder()
  .setName("session")
  .setDescription("Save and load conversation history")
  .addSubcommand(s =>
    s.setName("save").setDescription("Save the current conversation")
      .addStringOption(o => o.setName("name").setDescription("Save name (e.g. 'Session 1 - Tavern')").setRequired(true))
  )
  .addSubcommand(s => s.setName("load").setDescription("Browse and load a saved session"))
  .addSubcommand(s => s.setName("list").setDescription("List all saved sessions"))
  .addSubcommand(s => s.setName("new").setDescription("Start a fresh conversation (clears current history)"))
  .addSubcommand(s => s.setName("status").setDescription("Show current session info"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub      = interaction.options.getSubcommand();
  const campaign = getActiveCampaign();

  if (!campaign) {
    await interaction.reply({ content: "❌ No active campaign.", ephemeral: true });
    return;
  }

  switch (sub) {
    case "save":   return handleSave(interaction, campaign.id);
    case "load":   return handleLoad(interaction, campaign.id);
    case "list":   return handleList(interaction, campaign.id);
    case "new":    return handleNew(interaction, campaign.id);
    case "status": return handleStatus(interaction, campaign.id);
  }
}

// ── Save ──────────────────────────────────────────────────────────────────

async function handleSave(interaction: ChatInputCommandInteraction, campaignId: number): Promise<void> {
  const name     = interaction.options.getString("name", true);
  const messages = getSessionMessages(campaignId);

  if (messages.length === 0) {
    await interaction.reply({ content: "❌ No conversation to save yet. Start chatting with `/dm` first.", ephemeral: true });
    return;
  }

  const id = saveSession(campaignId, name);

  const embed = new EmbedBuilder()
    .setTitle("💾 Session Saved")
    .addFields(
      { name: "Name",     value: name,                         inline: true },
      { name: "Messages", value: `${messages.length} messages`, inline: true },
      { name: "Save ID",  value: `#${id}`,                     inline: true },
    )
    .setColor(0x3a9a50)
    .setFooter({ text: "Use /session load to restore this later" });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ── Load ──────────────────────────────────────────────────────────────────

async function handleLoad(interaction: ChatInputCommandInteraction, campaignId: number): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const saves = listSavedSessions(campaignId);
  if (saves.length === 0) {
    await interaction.editReply("📂 No saved sessions yet. Use `/session save <name>` to create one.");
    return;
  }

  const autosave  = saves.find(s => s.is_autosave === 1);
  const manuals   = saves.filter(s => s.is_autosave === 0).slice(0, 4);

  const embed = new EmbedBuilder()
    .setTitle("📂 Saved Sessions")
    .setDescription("Click **Load** to restore a session, or **🗑** to delete it.\n⚠️ Loading will replace the current conversation.")
    .setColor(0x4a70c8);

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // Show autosave first
  if (autosave) {
    embed.addFields({
      name: `🔄 Autosave — #${autosave.id}`,
      value: `${autosave.message_count} messages · Updated ${autosave.updated_at.substring(0, 16)}`,
    });
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`session_load:${autosave.id}:${interaction.user.id}`)
          .setLabel("▶ Load Autosave")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`session_delete:${autosave.id}:${interaction.user.id}`)
          .setLabel("🗑")
          .setStyle(ButtonStyle.Danger),
      )
    );
  }

  // Manual saves
  for (const s of manuals) {
    embed.addFields({
      name: `💾 #${s.id} — ${s.name}`,
      value: `${s.message_count} messages · Saved ${s.created_at.substring(0, 16)}`,
    });
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`session_load:${s.id}:${interaction.user.id}`)
          .setLabel(`▶ Load: ${s.name.slice(0, 22)}`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`session_delete:${s.id}:${interaction.user.id}`)
          .setLabel("🗑")
          .setStyle(ButtonStyle.Danger),
      )
    );
  }

  const total = saves.filter(s => s.is_autosave === 0).length;
  if (total > 4) {
    embed.setFooter({ text: `Showing 4 of ${total} manual saves. Use /session list to see all.` });
  }

  await interaction.editReply({ embeds: [embed], components: rows });
}

// ── List ──────────────────────────────────────────────────────────────────

async function handleList(interaction: ChatInputCommandInteraction, campaignId: number): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const saves = listSavedSessions(campaignId);
  if (saves.length === 0) {
    await interaction.editReply("📂 No saved sessions yet.");
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📂 All Saved Sessions (${saves.length})`)
    .setColor(0x4a70c8)
    .setDescription(
      saves.map(s =>
        `**#${s.id}** — ${s.name}\n` +
        `  📝 ${s.message_count} messages · 🕐 ${s.created_at.substring(0, 16)}`
      ).join("\n\n")
    )
    .setFooter({ text: "Use /session load to restore a session" });

  await interaction.editReply({ embeds: [embed] });
}

// ── New ───────────────────────────────────────────────────────────────────

async function handleNew(interaction: ChatInputCommandInteraction, campaignId: number): Promise<void> {
  const messages = getSessionMessages(campaignId);

  if (messages.length === 0) {
    await interaction.reply({ content: "✅ Already a fresh session — no messages to clear.", ephemeral: true });
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`session_new_confirm:${campaignId}:${interaction.user.id}`)
      .setLabel("✅ Yes, clear history")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`session_new_cancel:0:${interaction.user.id}`)
      .setLabel("✕ Cancel")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    content: `⚠️ This will clear **${messages.length} messages** from the current session.\nConsider saving first with \`/session save\`.\n\nAre you sure?`,
    components: [row],
    ephemeral: true,
  });
}

// ── Status ────────────────────────────────────────────────────────────────

async function handleStatus(interaction: ChatInputCommandInteraction, campaignId: number): Promise<void> {
  const messages  = getSessionMessages(campaignId);
  const saves     = listSavedSessions(campaignId);
  const autosave  = saves.find(s => s.is_autosave === 1);
  const manuals   = saves.filter(s => s.is_autosave === 0);
  const latestMan = manuals[0];

  const embed = new EmbedBuilder()
    .setTitle("📋 Session Status")
    .addFields(
      { name: "Current session", value: `${messages.length} messages in memory`, inline: true },
      { name: "Manual saves",    value: `${manuals.length} saves`,               inline: true },
    )
    .setColor(0xc9a84c);

  if (autosave) {
    embed.addFields({
      name: "🔄 Autosave",
      value: `${autosave.message_count} messages · Last updated ${autosave.updated_at.substring(0, 16)}`,
    });
  } else {
    embed.addFields({ name: "🔄 Autosave", value: "Not yet — starts after first `/dm` response" });
  }

  if (latestMan) {
    embed.addFields({
      name: "💾 Latest manual save",
      value: `**#${latestMan.id}** — ${latestMan.name}\n${latestMan.message_count} messages · ${latestMan.created_at.substring(0, 16)}`,
    });
  }

  embed.setFooter({ text: "/session save — manual save · /session load — restore · /session new — fresh start" });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ── Component Handler ─────────────────────────────────────────────────────

export async function handleComponent(interaction: ButtonInteraction): Promise<void> {
  const [action, param, targetUserId] = interaction.customId.split(":");

  if (interaction.user.id !== targetUserId) {
    await interaction.reply({ content: "❌ This isn't your menu.", ephemeral: true });
    return;
  }

  const campaign = getActiveCampaign();
  if (!campaign) {
    await interaction.update({ content: "❌ No active campaign.", embeds: [], components: [] });
    return;
  }

  if (action === "session_load") {
    const sessionId = parseInt(param);
    const save      = getSavedSession(sessionId);
    if (!save) {
      await interaction.update({ content: "❌ Save not found.", embeds: [], components: [] });
      return;
    }

    const count = loadSavedSession(campaign.id, sessionId);

    const embed = new EmbedBuilder()
      .setTitle(`▶ Session Loaded — ${save.name}`)
      .setDescription(`Restored **${count} messages** into the current session.\nThe DM will continue from this point.`)
      .setColor(0x3a9a50)
      .setFooter({ text: "Use /dm to continue the conversation" });

    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  if (action === "session_delete") {
    const sessionId = parseInt(param);
    const save      = getSavedSession(sessionId);
    if (!save) {
      await interaction.update({ content: "❌ Save not found.", embeds: [], components: [] });
      return;
    }

    deleteSavedSession(sessionId);

    await interaction.update({
      content: `🗑 Deleted save **#${sessionId} — ${save.name}**.`,
      embeds: [],
      components: [],
    });
    return;
  }

  if (action === "session_new_confirm") {
    const campaignId = parseInt(param);
    clearSessionMessages(campaignId);

    await interaction.update({
      content: "✅ Session cleared. The DM will start fresh on your next `/dm` message.",
      components: [],
    });
    return;
  }

  if (action === "session_new_cancel") {
    await interaction.update({ content: "Cancelled.", components: [] });
    return;
  }
}
