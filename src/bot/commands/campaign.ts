import {
  ChatInputCommandInteraction, SlashCommandBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  EmbedBuilder, ButtonInteraction,
} from "discord.js";
import {
  createCampaign, getActiveCampaign, getCampaign,
  updateCampaignAdventure, getRecentStory, getAllCharacters,
  getAllCampaigns, setActiveCampaign, setCampaignLanguage,
} from "../../db/database.js";
import { loadAdventure, listAdventures } from "../../scripts/loader.js";
import { broadcastEvent } from "../../web/index.js";

export const data = new SlashCommandBuilder()
  .setName("campaign")
  .setDescription("Campaign management")
  .addSubcommand(s =>
    s.setName("start").setDescription("Start a new campaign")
      .addStringOption(o => o.setName("name").setDescription("Campaign name").setRequired(true))
      .addStringOption(o => o.setName("description").setDescription("Campaign description"))
      .addStringOption(o =>
        o.setName("language").setDescription("Language for the DM")
          .addChoices(
            { name: "Thai (ภาษาไทย)", value: "th" },
            { name: "English", value: "en" }
          )
      )
  )
  .addSubcommand(s =>
    s.setName("load").setDescription("Load an adventure script into the current campaign")
      .addStringOption(o => o.setName("adventure").setDescription("Adventure ID").setRequired(true))
  )
  .addSubcommand(s => s.setName("list").setDescription("Show all campaigns and switch between them"))
  .addSubcommand(s => s.setName("adventures").setDescription("Browse and load available adventures"))
  .addSubcommand(s =>
    s.setName("language").setDescription("Change the DM language for the current campaign")
      .addStringOption(o =>
        o.setName("lang").setDescription("Language").setRequired(true)
          .addChoices(
            { name: "🇹🇭 Thai (ภาษาไทย)", value: "th" },
            { name: "🇬🇧 English", value: "en" },
          )
      )
  )
  .addSubcommand(s => s.setName("status").setDescription("Show current campaign status"))
  .addSubcommand(s => s.setName("log").setDescription("Show recent story log"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case "start":      return handleStart(interaction);
    case "load":       return handleLoad(interaction);
    case "list":       return handleList(interaction);
    case "adventures": return handleAdventures(interaction);
    case "language":   return handleLanguage(interaction);
    case "status":     return handleStatus(interaction);
    case "log":        return handleLog(interaction);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────

async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  const name        = interaction.options.getString("name", true);
  const description = interaction.options.getString("description") ?? "";
  const language    = (interaction.options.getString("language") ?? "th") as "th" | "en";

  const campaignId = createCampaign(name, description, language);
  const langLabel  = language === "th" ? "🇹🇭 ภาษาไทย" : "🇬🇧 English";

  const embed = new EmbedBuilder()
    .setTitle(`🎲 Campaign Started — ${name}`)
    .setDescription(description || "*No description*")
    .addFields(
      { name: "Language", value: langLabel, inline: true },
      { name: "Campaign ID", value: String(campaignId), inline: true },
    )
    .setColor(0xc9a84c)
    .setFooter({ text: "Use /campaign adventures to pick an adventure, or /dm to start narrating" });

  broadcastEvent(campaignId, "init", buildInitPayload(campaignId));
  await interaction.reply({ embeds: [embed] });
}

// ── Load ──────────────────────────────────────────────────────────────────

async function handleLoad(interaction: ChatInputCommandInteraction): Promise<void> {
  const campaign = getActiveCampaign();
  if (!campaign) {
    await interaction.reply({ content: "❌ No active campaign. Use `/campaign start` first.", ephemeral: true });
    return;
  }

  const adventureId = interaction.options.getString("adventure", true);
  const adventure   = loadAdventure(adventureId);
  if (!adventure) {
    const available = listAdventures().join(", ");
    await interaction.reply({
      content: `❌ Adventure **${adventureId}** not found.\nAvailable: ${available || "none"}`,
      ephemeral: true,
    });
    return;
  }

  updateCampaignAdventure(campaign.id, adventureId, adventure);

  const embed = new EmbedBuilder()
    .setTitle(`📜 ${adventure.title ?? adventureId}`)
    .setDescription(adventure.synopsis ?? "*No synopsis*")
    .setColor(0x4a70c8)
    .setFooter({ text: "Use /dm to begin the adventure!" });

  await interaction.reply({ embeds: [embed] });
}

// ── List Campaigns ────────────────────────────────────────────────────────

async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const campaigns = getAllCampaigns();
  if (campaigns.length === 0) {
    await interaction.editReply("No campaigns yet. Use `/campaign start` to create one.");
    return;
  }

  const active = getActiveCampaign();

  const embed = new EmbedBuilder()
    .setTitle("🎲 Campaigns")
    .setColor(0xc9a84c)
    .setDescription("Select a campaign to switch to it.");

  for (const c of campaigns) {
    const chars = getAllCharacters(c.id);
    const isActive = c.id === active?.id;
    embed.addFields({
      name: `${isActive ? "▶️" : "  "} [${c.id}] ${c.name}`,
      value: [
        c.description ? `*${c.description}*` : "",
        `Adventure: ${c.adventure_id ?? "none"} | Players: ${chars.length} | Lang: ${c.language === "th" ? "🇹🇭" : "🇬🇧"}`,
        isActive ? "**Currently active**" : "",
      ].filter(Boolean).join("\n"),
    });
  }

  // Show switch buttons for inactive campaigns (max 4 buttons per row, 5 rows)
  const inactive = campaigns.filter(c => c.id !== active?.id).slice(0, 4);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (inactive.length > 0) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const c of inactive) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`campaign_switch:${c.id}:${interaction.user.id}`)
          .setLabel(`▶ ${c.name.slice(0, 20)}`)
          .setStyle(ButtonStyle.Primary)
      );
    }
    rows.push(row);
  }

  await interaction.editReply({ embeds: [embed], components: rows });
}

// ── Browse Adventures ─────────────────────────────────────────────────────

async function handleAdventures(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const adventures = listAdventures();
  if (adventures.length === 0) {
    await interaction.editReply("📜 No adventures found. Add JSON files to the `adventures/` folder.");
    return;
  }

  const campaign = getActiveCampaign();
  const embed = new EmbedBuilder()
    .setTitle("📜 Available Adventures")
    .setColor(0x8050c8)
    .setDescription(campaign
      ? `Active campaign: **${campaign.name}** — click Load to set the adventure.`
      : "⚠️ No active campaign. Start one first with `/campaign start`."
    );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  for (let i = 0; i < adventures.length; i += 4) {
    const batch = adventures.slice(i, i + 4);
    const row = new ActionRowBuilder<ButtonBuilder>();

    for (const id of batch) {
      const adv = loadAdventure(id);
      const isLoaded = campaign?.adventure_id === id;

      embed.addFields({
        name: `${isLoaded ? "✅" : "📖"} ${adv?.title ?? id}`,
        value: adv?.synopsis
          ? adv.synopsis.slice(0, 100) + (adv.synopsis.length > 100 ? "…" : "")
          : "*No synopsis*",
      });

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`campaign_load:${id}:${interaction.user.id}`)
          .setLabel(isLoaded ? `✅ ${id.slice(0, 15)}` : `Load: ${id.slice(0, 15)}`)
          .setStyle(isLoaded ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(!campaign || isLoaded)
      );
    }
    rows.push(row);
  }

  await interaction.editReply({ embeds: [embed], components: rows });
}

// ── Language ──────────────────────────────────────────────────────────────

async function handleLanguage(interaction: ChatInputCommandInteraction): Promise<void> {
  const campaign = getActiveCampaign();
  if (!campaign) {
    await interaction.reply({ content: "❌ No active campaign.", ephemeral: true });
    return;
  }

  const lang = interaction.options.getString("lang", true) as "th" | "en";
  setCampaignLanguage(campaign.id, lang);

  const label = lang === "th" ? "🇹🇭 ภาษาไทย" : "🇬🇧 English";
  const note  = lang === "th"
    ? "DM จะตอบเป็นภาษาไทยเสมอ ไม่ว่าผู้เล่นจะพิมพ์ภาษาอะไรก็ตาม"
    : "The DM will always respond in English regardless of player input language.";

  await interaction.reply(`${label} — **${campaign.name}** language updated.\n${note}`);
}

// ── Status ────────────────────────────────────────────────────────────────

async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const campaign = getActiveCampaign();
  if (!campaign) {
    await interaction.reply({ content: "❌ No active campaign.", ephemeral: true });
    return;
  }

  const chars = getAllCharacters(campaign.id);
  const langLabel = campaign.language === "th" ? "🇹🇭 Thai" : "🇬🇧 English";

  const embed = new EmbedBuilder()
    .setTitle(`🎲 ${campaign.name}`)
    .setDescription(campaign.description || "*No description*")
    .addFields(
      { name: "Language", value: langLabel, inline: true },
      { name: "Adventure", value: campaign.adventure_id ? `📜 ${campaign.adventure_id}` : "None loaded", inline: true },
      { name: "Campaign ID", value: String(campaign.id), inline: true },
      {
        name: `Party (${chars.length} members)`,
        value: chars.length > 0
          ? chars.map(c => `🧙 **${c.name}** — ${c.race} ${c.class} Lv.${c.level} | HP ${c.hp}/${c.max_hp}`).join("\n")
          : "*No characters yet. Use `/char create` to join!*",
      }
    )
    .setColor(0xc9a84c);

  await interaction.reply({ embeds: [embed] });
}

// ── Log ───────────────────────────────────────────────────────────────────

async function handleLog(interaction: ChatInputCommandInteraction): Promise<void> {
  const campaign = getActiveCampaign();
  if (!campaign) {
    await interaction.reply({ content: "❌ No active campaign.", ephemeral: true });
    return;
  }

  const entries = getRecentStory(campaign.id, 10);
  if (entries.length === 0) {
    await interaction.reply({ content: "📖 No story logged yet.", ephemeral: true });
    return;
  }

  const typeEmoji: Record<string, string> = {
    narrative: "📖", combat: "⚔️", discovery: "🔍",
    npc_interaction: "💬", quest: "📜", death: "💀", levelup: "⬆️",
  };

  const embed = new EmbedBuilder()
    .setTitle(`📚 Story Log — ${campaign.name}`)
    .setColor(0x4a70c8)
    .setDescription(
      [...entries].reverse()
        .map(e => `${typeEmoji[e.type] ?? "•"} \`${e.created_at.substring(0, 16)}\` ${e.content}`)
        .join("\n")
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ── Component Handler (called from bot/index.ts) ──────────────────────────

export async function handleComponent(interaction: ButtonInteraction): Promise<void> {
  const [action, param, targetUserId] = interaction.customId.split(":");

  if (interaction.user.id !== targetUserId) {
    await interaction.reply({ content: "❌ This isn't your menu.", ephemeral: true });
    return;
  }

  if (action === "campaign_switch") {
    const campaignId = parseInt(param);
    const campaign   = getCampaign(campaignId);
    if (!campaign) {
      await interaction.update({ content: "❌ Campaign not found.", embeds: [], components: [] });
      return;
    }

    setActiveCampaign(campaignId);
    broadcastEvent(campaignId, "init", buildInitPayload(campaignId));

    const embed = new EmbedBuilder()
      .setTitle(`▶️ Switched to — ${campaign.name}`)
      .setDescription(campaign.description || "*No description*")
      .addFields(
        { name: "Adventure", value: campaign.adventure_id ?? "None", inline: true },
        { name: "Language", value: campaign.language === "th" ? "🇹🇭 Thai" : "🇬🇧 English", inline: true },
      )
      .setColor(0x3a9a50)
      .setFooter({ text: "The web viewer has updated. Players can use /char commands now." });

    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  if (action === "campaign_load") {
    const adventureId = param;
    const campaign    = getActiveCampaign();
    if (!campaign) {
      await interaction.update({ content: "❌ No active campaign.", embeds: [], components: [] });
      return;
    }

    const adventure = loadAdventure(adventureId);
    if (!adventure) {
      await interaction.update({ content: `❌ Adventure ${adventureId} not found.`, embeds: [], components: [] });
      return;
    }

    updateCampaignAdventure(campaign.id, adventureId, adventure);

    const embed = new EmbedBuilder()
      .setTitle(`📜 Loaded — ${adventure.title ?? adventureId}`)
      .setDescription(adventure.synopsis ?? "*No synopsis*")
      .setColor(0x4a70c8)
      .setFooter({ text: "Use /dm to begin the adventure!" });

    await interaction.update({ embeds: [embed], components: [] });
    return;
  }
}

// ── Helper ────────────────────────────────────────────────────────────────

function buildInitPayload(campaignId: number) {
  const campaign    = getCampaign(campaignId);
  const characters  = getAllCharacters(campaignId);
  return {
    campaign: campaign ? { id: campaign.id, name: campaign.name } : null,
    characters: characters.map(c => ({
      id: c.id, name: c.name, class: c.class, race: c.race,
      level: c.level, hp: c.hp, max_hp: c.max_hp, ac: c.ac, is_player: true,
    })),
    combat: { active: false },
  };
}
