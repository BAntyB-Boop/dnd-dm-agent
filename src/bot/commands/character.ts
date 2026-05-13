import {
  ChatInputCommandInteraction, SlashCommandBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ComponentType, ButtonInteraction, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuInteraction, TextChannel,
} from "discord.js";
import {
  getCharacter, createCharacter, updateCharacterHp,
  updateCharacterAvatar, updateCharacterSkills,
  getAllCharacters, getActiveCampaign, getInventory, addInventoryItem,
  updateCharacterSubclass, updateCharacterASI, addMulticlassLevel, MulticlassEntry,
  getCharacterById, updateMulticlassSubclass,
} from "../../db/database.js";
import type { LevelUpEvent } from "../../agent/dm.js";
import fs from "fs";
import path from "path";
import { rollStats, getStartingHp, getModifier, formatModifier, getProficiencyBonus } from "../../game/dice.js";
import { broadcastEvent } from "../../web/index.js";
import {
  RACES, CLASSES, BACKGROUNDS, STANDARD_ARRAY,
  POINT_BUY_BUDGET, POINT_BUY_COSTS,
  StatName, STAT_NAMES, STAT_SHORT,
  SKILLS, CLASS_DEFAULT_SKILLS, BACKGROUND_SKILLS,
  SUBCLASSES, ASI_LEVELS, MULTICLASS_PREREQS, getSpellSlots,
  autoAssignStats, applyRacialBonuses, calcAcBase, calcPointBuyCost, validateManualStats,
} from "../../game/character-data.js";

// ── Session Store ─────────────────────────────────────────────────────────

interface CharCreationSession {
  campaignId: number;
  name: string;
  charClass: string;
  race: string;
  background: string;
  method: string;
  baseStats: Record<StatName, number>;
  rolledPool: number[]; // for roll method
  expiresAt: number;
}

const sessions = new Map<string, CharCreationSession>();

setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) {
    if (s.expiresAt < now) sessions.delete(k);
  }
}, 5 * 60 * 1000);

// ── Command Definition ────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName("char")
  .setDescription("Character management")
  .addSubcommand(s =>
    s.setName("create").setDescription("Create your character")
      .addStringOption(o => o.setName("name").setDescription("Character name").setRequired(true))
      .addStringOption(o =>
        o.setName("class").setDescription("Character class").setRequired(true)
          .addChoices(
            { name: "Barbarian (d12 HP)", value: "barbarian" },
            { name: "Bard (d8 HP, CHA caster)", value: "bard" },
            { name: "Cleric (d8 HP, WIS caster)", value: "cleric" },
            { name: "Druid (d8 HP, WIS caster)", value: "druid" },
            { name: "Fighter (d10 HP)", value: "fighter" },
            { name: "Monk (d8 HP)", value: "monk" },
            { name: "Paladin (d10 HP, CHA caster)", value: "paladin" },
            { name: "Ranger (d10 HP, WIS caster)", value: "ranger" },
            { name: "Rogue (d8 HP)", value: "rogue" },
            { name: "Sorcerer (d6 HP, CHA caster)", value: "sorcerer" },
            { name: "Warlock (d8 HP, CHA caster)", value: "warlock" },
            { name: "Wizard (d6 HP, INT caster)", value: "wizard" },
          )
      )
      .addStringOption(o =>
        o.setName("race").setDescription("Character race").setRequired(true)
          .addChoices(
            { name: "Human (+1 all stats)", value: "human" },
            { name: "High Elf (+2 DEX, +1 INT)", value: "high-elf" },
            { name: "Wood Elf (+2 DEX, +1 WIS, Speed 35)", value: "wood-elf" },
            { name: "Hill Dwarf (+2 CON, +1 WIS)", value: "hill-dwarf" },
            { name: "Mountain Dwarf (+2 STR, +2 CON)", value: "mountain-dwarf" },
            { name: "Lightfoot Halfling (+2 DEX, +1 CHA)", value: "lightfoot-halfling" },
            { name: "Stout Halfling (+2 DEX, +1 CON)", value: "stout-halfling" },
            { name: "Half-Elf (+2 CHA, +1 DEX/WIS)", value: "half-elf" },
            { name: "Half-Orc (+2 STR, +1 CON)", value: "half-orc" },
            { name: "Forest Gnome (+2 INT, +1 DEX)", value: "forest-gnome" },
            { name: "Rock Gnome (+2 INT, +1 CON)", value: "rock-gnome" },
            { name: "Tiefling (+2 CHA, +1 INT)", value: "tiefling" },
            { name: "Dragonborn (+2 STR, +1 CHA)", value: "dragonborn" },
          )
      )
      .addStringOption(o =>
        o.setName("method").setDescription("How to determine ability scores").setRequired(true)
          .addChoices(
            { name: "🎲 Roll (4d6 drop lowest)", value: "roll" },
            { name: "📊 Standard Array [15,14,13,12,10,8]", value: "standard" },
            { name: "🧮 Point Buy (27 points)", value: "pointbuy" },
            { name: "✏️ Manual (enter values yourself)", value: "manual" },
          )
      )
      .addStringOption(o =>
        o.setName("background").setDescription("Character background").setRequired(false)
          .addChoices(...BACKGROUNDS.map(b => ({ name: b, value: b })))
      )
      // Manual method options (Point Buy: 8–15 per stat, 27 point budget)
      .addIntegerOption(o => o.setName("str").setDescription("[Manual] Strength (8–15, point buy rules)").setMinValue(3).setMaxValue(18))
      .addIntegerOption(o => o.setName("dex").setDescription("[Manual] Dexterity (8–15, point buy rules)").setMinValue(3).setMaxValue(18))
      .addIntegerOption(o => o.setName("con").setDescription("[Manual] Constitution (8–15, point buy rules)").setMinValue(3).setMaxValue(18))
      .addIntegerOption(o => o.setName("int").setDescription("[Manual] Intelligence (8–15, point buy rules)").setMinValue(3).setMaxValue(18))
      .addIntegerOption(o => o.setName("wis").setDescription("[Manual] Wisdom (8–15, point buy rules)").setMinValue(3).setMaxValue(18))
      .addIntegerOption(o => o.setName("cha").setDescription("[Manual] Charisma (8–15, point buy rules)").setMinValue(3).setMaxValue(18))
  )
  .addSubcommand(s => s.setName("sheet").setDescription("View your full character sheet"))
  .addSubcommand(s =>
    s.setName("hp").setDescription("Update your HP")
      .addIntegerOption(o => o.setName("amount").setDescription("Delta HP (e.g. -5 for damage, +3 for healing)").setRequired(true))
  )
  .addSubcommand(s => s.setName("party").setDescription("View all party members"))
  .addSubcommand(s =>
    s.setName("icon").setDescription("Upload your character's icon/avatar (shown on web viewer)")
      .addAttachmentOption(o => o.setName("image").setDescription("Character icon (PNG/JPG/GIF/WEBP, max 2MB)").setRequired(true))
  )
  .addSubcommand(s =>
    s.setName("asi").setDescription("Apply Ability Score Improvement (use when leveling up)")
      .addStringOption(o =>
        o.setName("stat").setDescription("Stat to improve").setRequired(true)
          .addChoices(
            { name: "STR (Strength)", value: "strength" }, { name: "DEX (Dexterity)", value: "dexterity" },
            { name: "CON (Constitution)", value: "constitution" }, { name: "INT (Intelligence)", value: "intelligence" },
            { name: "WIS (Wisdom)", value: "wisdom" }, { name: "CHA (Charisma)", value: "charisma" },
          )
      )
      .addStringOption(o =>
        o.setName("stat2").setDescription("Second stat for +1/+1 split (leave empty for +2 to one stat)").setRequired(false)
          .addChoices(
            { name: "STR (Strength)", value: "strength" }, { name: "DEX (Dexterity)", value: "dexterity" },
            { name: "CON (Constitution)", value: "constitution" }, { name: "INT (Intelligence)", value: "intelligence" },
            { name: "WIS (Wisdom)", value: "wisdom" }, { name: "CHA (Charisma)", value: "charisma" },
          )
      )
  )
  .addSubcommand(s =>
    s.setName("multiclass").setDescription("Add a level in a new class (multiclass)")
      .addStringOption(o =>
        o.setName("class").setDescription("New class to add a level in").setRequired(true)
          .addChoices(
            { name: "Barbarian", value: "barbarian" }, { name: "Bard", value: "bard" },
            { name: "Cleric", value: "cleric" },       { name: "Druid", value: "druid" },
            { name: "Fighter", value: "fighter" },     { name: "Monk", value: "monk" },
            { name: "Paladin", value: "paladin" },     { name: "Ranger", value: "ranger" },
            { name: "Rogue", value: "rogue" },         { name: "Sorcerer", value: "sorcerer" },
            { name: "Warlock", value: "warlock" },     { name: "Wizard", value: "wizard" },
          )
      )
  );

// ── Execute ───────────────────────────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const campaign = getActiveCampaign();

  if (!campaign) {
    await interaction.reply({ content: "❌ No active campaign. Ask the DM to start one with `/campaign start`.", ephemeral: true });
    return;
  }

  const userId = interaction.user.id;
  const username = interaction.user.username;

  switch (subcommand) {
    case "create": return handleCreate(interaction, userId, username, campaign.id);
    case "sheet":  return handleSheet(interaction, userId, campaign.id);
    case "hp":     return handleHp(interaction, userId, campaign.id);
    case "party":  return handleParty(interaction, campaign.id);
    case "icon":       return handleIcon(interaction, userId, campaign.id);
    case "asi":        return handleASI(interaction, userId, campaign.id);
    case "multiclass": return handleMulticlass(interaction, userId, campaign.id);
  }
}

// ── Create Flow ───────────────────────────────────────────────────────────

async function handleCreate(
  interaction: ChatInputCommandInteraction,
  userId: string,
  username: string,
  campaignId: number
): Promise<void> {
  const existing = getCharacter(userId, campaignId);
  if (existing) {
    await interaction.reply({ content: `❌ You already have **${existing.name}** in this campaign.`, ephemeral: true });
    return;
  }

  const name       = interaction.options.getString("name", true);
  const charClass  = interaction.options.getString("class", true);
  const race       = interaction.options.getString("race", true);
  const method     = interaction.options.getString("method", true);
  const background = interaction.options.getString("background") ?? "Folk Hero";

  const classData = CLASSES[charClass];
  const raceData  = RACES[race];

  switch (method) {
    case "roll":     return startRollMethod(interaction, userId, username, campaignId, name, charClass, race, background);
    case "standard": return startStandardMethod(interaction, userId, username, campaignId, name, charClass, race, background);
    case "pointbuy": return startPointBuyMethod(interaction, userId, username, campaignId, name, charClass, race, background);
    case "manual":   return handleManualMethod(interaction, userId, username, campaignId, name, charClass, race, background);
  }
}

// ── Roll Method ───────────────────────────────────────────────────────────

async function startRollMethod(
  interaction: ChatInputCommandInteraction,
  userId: string, username: string, campaignId: number,
  name: string, charClass: string, race: string, background: string
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const pool = rollStats();
  const baseStats = autoAssignStats(pool, charClass);
  const finalStats = applyRacialBonuses(baseStats, race);

  sessions.set(userId, {
    campaignId, name, charClass, race, background,
    method: "roll", baseStats, rolledPool: pool,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const embed = buildPreviewEmbed(name, charClass, race, background, pool, finalStats, "🎲 Rolled 4d6 drop lowest — auto-assigned by class priority");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`char_confirm:${userId}`).setLabel("✅ Confirm").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`char_reroll:${userId}`).setLabel("🎲 Reroll").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`char_cancel:${userId}`).setLabel("✕ Cancel").setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ── Standard Array Method ─────────────────────────────────────────────────

async function startStandardMethod(
  interaction: ChatInputCommandInteraction,
  userId: string, username: string, campaignId: number,
  name: string, charClass: string, race: string, background: string
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const baseStats = autoAssignStats(STANDARD_ARRAY, charClass);
  const finalStats = applyRacialBonuses(baseStats, race);

  sessions.set(userId, {
    campaignId, name, charClass, race, background,
    method: "standard", baseStats, rolledPool: STANDARD_ARRAY,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const embed = buildPreviewEmbed(name, charClass, race, background, STANDARD_ARRAY, finalStats, "📊 Standard Array [15,14,13,12,10,8] — assigned by class priority");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`char_confirm:${userId}`).setLabel("✅ Confirm").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`char_cancel:${userId}`).setLabel("✕ Cancel").setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ── Point Buy Method ──────────────────────────────────────────────────────

async function startPointBuyMethod(
  interaction: ChatInputCommandInteraction,
  userId: string, username: string, campaignId: number,
  name: string, charClass: string, race: string, background: string
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const baseStats: Record<StatName, number> = {
    strength: 8, dexterity: 8, constitution: 8,
    intelligence: 8, wisdom: 8, charisma: 8,
  };

  sessions.set(userId, {
    campaignId, name, charClass, race, background,
    method: "pointbuy", baseStats, rolledPool: [],
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  const { embed, rows } = buildPointBuyUI(userId, name, charClass, race, background, baseStats);
  await interaction.editReply({ embeds: [embed], components: rows });
}

function buildPointBuyUI(
  userId: string, name: string, charClass: string, race: string, background: string,
  baseStats: Record<StatName, number>
): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
  const spent = calcPointBuyCost(baseStats);
  const remaining = POINT_BUY_BUDGET - spent;
  const finalStats = applyRacialBonuses(baseStats, race);
  const raceData = RACES[race];
  const classData = CLASSES[charClass];

  const statLines = STAT_NAMES.map(s => {
    const base = baseStats[s];
    const final = finalStats[s];
    const bonus = raceData?.bonuses[s] ?? 0;
    const cost = POINT_BUY_COSTS[base] ?? 0;
    const mod = formatModifier(getModifier(final));
    const bonusStr = bonus > 0 ? ` (+${bonus} racial)` : "";
    return `**${STAT_SHORT[s]}** ${base}${bonusStr} → **${final}** (${mod}) [${cost} pts]`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🧮 Point Buy — ${name}`)
    .setDescription(
      `*${raceData?.display ?? race} ${classData?.name ?? charClass} | ${background}*\n\n` +
      statLines.join("\n") +
      `\n\n**Points remaining: ${remaining}/${POINT_BUY_BUDGET}**\n` +
      `Each stat starts at 8. Max 15 before racial bonuses.\n` +
      `Cost: 8(0) 9(1) 10(2) 11(3) 12(4) 13(5) 14(7) 15(9)`
    )
    .setColor(remaining >= 0 ? 0x4a70c8 : 0xc04040);

  // 3 rows: STR/DEX, CON/INT, WIS/CHA + confirm row
  const statPairs: [StatName, StatName][] = [
    ["strength", "dexterity"],
    ["constitution", "intelligence"],
    ["wisdom", "charisma"],
  ];

  const rows: ActionRowBuilder<ButtonBuilder>[] = statPairs.map(([s1, s2]) => {
    const canInc1 = baseStats[s1] < 15 && POINT_BUY_COSTS[baseStats[s1] + 1] !== undefined && remaining >= (POINT_BUY_COSTS[baseStats[s1] + 1]! - POINT_BUY_COSTS[baseStats[s1]]!);
    const canDec1 = baseStats[s1] > 8;
    const canInc2 = baseStats[s2] < 15 && POINT_BUY_COSTS[baseStats[s2] + 1] !== undefined && remaining >= (POINT_BUY_COSTS[baseStats[s2] + 1]! - POINT_BUY_COSTS[baseStats[s2]]!);
    const canDec2 = baseStats[s2] > 8;

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`char_pb_dec:${userId}:${s1}`)
        .setLabel(`${STAT_SHORT[s1]} ${baseStats[s1]} ▼`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canDec1),
      new ButtonBuilder()
        .setCustomId(`char_pb_inc:${userId}:${s1}`)
        .setLabel(`${STAT_SHORT[s1]} ${baseStats[s1]} ▲`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canInc1),
      new ButtonBuilder()
        .setCustomId(`char_pb_dec:${userId}:${s2}`)
        .setLabel(`${STAT_SHORT[s2]} ${baseStats[s2]} ▼`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canDec2),
      new ButtonBuilder()
        .setCustomId(`char_pb_inc:${userId}:${s2}`)
        .setLabel(`${STAT_SHORT[s2]} ${baseStats[s2]} ▲`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canInc2),
    );
  });

  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`char_confirm:${userId}`)
      .setLabel(`✅ Confirm (${remaining} pts left)`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`char_cancel:${userId}`)
      .setLabel("✕ Cancel")
      .setStyle(ButtonStyle.Danger),
  ));

  return { embed, rows };
}

// ── Manual Method ─────────────────────────────────────────────────────────

async function handleManualMethod(
  interaction: ChatInputCommandInteraction,
  userId: string, username: string, campaignId: number,
  name: string, charClass: string, race: string, background: string
): Promise<void> {
  const str  = interaction.options.getInteger("str")  ?? 10;
  const dex  = interaction.options.getInteger("dex")  ?? 10;
  const con  = interaction.options.getInteger("con")  ?? 10;
  const int_ = interaction.options.getInteger("int")  ?? 10;
  const wis  = interaction.options.getInteger("wis")  ?? 10;
  const cha  = interaction.options.getInteger("cha")  ?? 10;

  const baseStats: Record<StatName, number> = {
    strength: str, dexterity: dex, constitution: con,
    intelligence: int_, wisdom: wis, charisma: cha,
  };

  // Validate Point Buy rules before proceeding
  const validationError = validateManualStats(baseStats);
  if (validationError) {
    await interaction.reply({
      content: validationError + `\n\n*ใช้ \`/char create method:manual\` อีกครั้งพร้อมค่าที่แก้ไขแล้ว*`,
      ephemeral: true,
    });
    return;
  }

  const finalStats = applyRacialBonuses(baseStats, race);

  sessions.set(userId, {
    campaignId, name, charClass, race, background,
    method: "manual", baseStats, rolledPool: [str, dex, con, int_, wis, cha],
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const totalCost = calcPointBuyCost(baseStats);
  const embed = buildPreviewEmbed(
    name, charClass, race, background,
    [str, dex, con, int_, wis, cha], finalStats,
    `✏️ Manual entry — Point Buy cost: **${totalCost}/${POINT_BUY_BUDGET}** pts (${POINT_BUY_BUDGET - totalCost} remaining)`
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`char_confirm:${userId}`).setLabel("✅ Confirm").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`char_cancel:${userId}`).setLabel("✕ Cancel").setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// ── Shared UI Helpers ─────────────────────────────────────────────────────

function buildPreviewEmbed(
  name: string, charClass: string, race: string, background: string,
  pool: number[], finalStats: Record<StatName, number>, methodNote: string
): EmbedBuilder {
  const raceData  = RACES[race];
  const classData = CLASSES[charClass];
  const dex = finalStats.dexterity;
  const con = finalStats.constitution;
  const wis = finalStats.wisdom;
  const maxHp = getStartingHp(charClass, con);
  const ac = calcAcBase(charClass, dex, con, wis);

  const statLine = (s: StatName) => {
    const val = finalStats[s];
    const mod = formatModifier(getModifier(val));
    const bonus = raceData?.bonuses[s];
    const bonusStr = bonus ? ` *(+${bonus})*` : "";
    return `**${STAT_SHORT[s]}** ${val}${bonusStr} \`${mod}\``;
  };

  const lines = [
    `*${raceData?.display ?? race} ${classData?.name ?? charClass} | ${background}*`,
    ``,
    `**Rolled:** [${pool.join(", ")}]`,
    `${methodNote}`,
    ``,
    `${statLine("strength")}  ${statLine("dexterity")}  ${statLine("constitution")}`,
    `${statLine("intelligence")}  ${statLine("wisdom")}  ${statLine("charisma")}`,
    ``,
    `❤️ **HP:** ${maxHp}  🛡️ **AC:** ${ac}  ⚡ **Init:** ${formatModifier(getModifier(dex))}  🏃 **Speed:** ${raceData?.speed ?? 30}ft`,
    ``,
    `**Class Features:** ${classData?.level1Features.join(", ")}`,
    `**Racial Traits:** ${raceData?.traits.join(", ")}`,
  ];

  return new EmbedBuilder()
    .setTitle(`📜 ${name}`)
    .setDescription(lines.join("\n"))
    .setColor(0xc9a84c);
}

function finalizeCharacter(session: CharCreationSession, userId: string, username: string): { msg: string; charId: number } {
  const { campaignId, name, charClass, race, background, baseStats } = session;
  const finalStats = applyRacialBonuses(baseStats, race);
  const raceData = RACES[race];
  const dex = finalStats.dexterity;
  const con = finalStats.constitution;
  const wis = finalStats.wisdom;
  const maxHp = getStartingHp(charClass, con);
  const ac = calcAcBase(charClass, dex, con, wis);
  const speed = raceData?.speed ?? 30;

  const charId = createCharacter({
    campaign_id: campaignId,
    discord_user_id: userId,
    discord_username: username,
    name, class: charClass, race, background,
    level: 1, xp: 0,
    hp: maxHp, max_hp: maxHp, temp_hp: 0,
    ac, initiative_bonus: getModifier(dex), speed,
    strength:     finalStats.strength,
    dexterity:    finalStats.dexterity,
    constitution: finalStats.constitution,
    intelligence: finalStats.intelligence,
    wisdom:       finalStats.wisdom,
    charisma:     finalStats.charisma,
    gold: 10, silver: 0, copper: 0,
    spell_slots: JSON.stringify(getSpellSlots(charClass, 1)), conditions: "[]", notes: "",
    race_option: "",
    personality: "{}",
    prepared_spells: "[]",
  });

  const classSkills = CLASS_DEFAULT_SKILLS[charClass] ?? [];
  const bgSkills    = BACKGROUND_SKILLS[background] ?? [];
  updateCharacterSkills(charId, [...new Set([...classSkills, ...bgSkills])]);

  const classDataForItems = CLASSES[charClass];
  for (const item of classDataForItems?.startingItems ?? []) {
    addInventoryItem(charId, {
      name: item.name, description: item.description,
      quantity: item.quantity, type: item.type,
      value: item.value, weight: item.weight, equipped: item.equipped,
    });
  }

  sessions.delete(userId);

  const allChars = getAllCharacters(campaignId);
  broadcastEvent(campaignId, "party_update", allChars.map(c => ({
    id: c.id, name: c.name, class: c.class, race: c.race,
    level: c.level, hp: c.hp, max_hp: c.max_hp, ac: c.ac, is_player: true, avatar: c.avatar ?? "",
  })));

  const classData = CLASSES[charClass];
  const statLine = (s: StatName) => {
    const val = finalStats[s];
    return `${STAT_SHORT[s]} **${val}** \`${formatModifier(getModifier(val))}\``;
  };

  const msg = [
    `✨ **${name}** has joined the adventure!`,
    `*${raceData?.display ?? race} ${classData?.name ?? charClass} | ${background}*`,
    ``,
    `${statLine("strength")}  ${statLine("dexterity")}  ${statLine("constitution")}`,
    `${statLine("intelligence")}  ${statLine("wisdom")}  ${statLine("charisma")}`,
    ``,
    `❤️ HP: **${maxHp}/${maxHp}**  🛡️ AC: **${ac}**  ⚡ Init: **${formatModifier(getModifier(dex))}**  🏃 Speed: **${speed}ft**`,
    ``,
    `**Starting Equipment:** ${classData?.startingEquipment ?? "—"}`,
  ].join("\n");
  return { msg, charId };
}

// ── Component Interaction Handler (called from bot/index.ts) ──────────────

export async function handleComponent(interaction: ButtonInteraction): Promise<void> {
  const [action, ...parts] = interaction.customId.split(":");
  const targetUserId = parts[0];

  if (interaction.user.id !== targetUserId) {
    await interaction.reply({ content: "❌ This isn't your character creation.", ephemeral: true });
    return;
  }

  const session = sessions.get(targetUserId);

  if (action === "char_cancel") {
    sessions.delete(targetUserId);
    await interaction.update({ content: "Character creation cancelled.", embeds: [], components: [] });
    return;
  }

  if (!session) {
    await interaction.update({ content: "⌛ Session expired. Use `/char create` again.", embeds: [], components: [] });
    return;
  }

  if (action === "char_confirm") {
    const campaign = getActiveCampaign();
    if (!campaign) {
      await interaction.update({ content: "❌ No active campaign.", embeds: [], components: [] });
      return;
    }
    const { msg, charId } = finalizeCharacter(session, targetUserId, interaction.user.username);
    await interaction.update({ content: msg, embeds: [], components: [] });
    // Prompt subclass immediately for classes that unlock at Lv.1
    const subclassData = SUBCLASSES[session.charClass];
    if (subclassData?.unlockLevel === 1) {
      await sendSubclassMenu(interaction, charId, session.charClass, 1);
    }
    return;
  }

  if (action === "char_reroll") {
    const pool = rollStats();
    const baseStats = autoAssignStats(pool, session.charClass);
    const finalStats = applyRacialBonuses(baseStats, session.race);
    session.baseStats = baseStats;
    session.rolledPool = pool;
    session.expiresAt = Date.now() + 10 * 60 * 1000;

    const embed = buildPreviewEmbed(
      session.name, session.charClass, session.race, session.background,
      pool, finalStats, "🎲 Rerolled 4d6 drop lowest — auto-assigned by class priority"
    );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`char_confirm:${targetUserId}`).setLabel("✅ Confirm").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`char_reroll:${targetUserId}`).setLabel("🎲 Reroll").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`char_cancel:${targetUserId}`).setLabel("✕ Cancel").setStyle(ButtonStyle.Danger),
    );
    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

  if (action === "char_pb_inc" || action === "char_pb_dec") {
    const stat = parts[1] as StatName;
    const current = session.baseStats[stat];
    const inc = action === "char_pb_inc";

    if (inc && current < 15) {
      const nextCost = POINT_BUY_COSTS[current + 1];
      const curCost  = POINT_BUY_COSTS[current];
      const spent    = calcPointBuyCost(session.baseStats);
      if (nextCost !== undefined && curCost !== undefined) {
        const delta = nextCost - curCost;
        if (POINT_BUY_BUDGET - spent >= delta) {
          session.baseStats[stat] = current + 1;
        }
      }
    } else if (!inc && current > 8) {
      session.baseStats[stat] = current - 1;
    }

    session.expiresAt = Date.now() + 15 * 60 * 1000;
    const { embed, rows } = buildPointBuyUI(
      targetUserId, session.name, session.charClass, session.race, session.background, session.baseStats
    );
    await interaction.update({ embeds: [embed], components: rows });
    return;
  }
}

// ── Sheet ─────────────────────────────────────────────────────────────────

async function handleSheet(interaction: ChatInputCommandInteraction, userId: string, campaignId: number): Promise<void> {
  const char = getCharacter(userId, campaignId);
  if (!char) {
    await interaction.reply({ content: "❌ You don't have a character. Use `/char create` first.", ephemeral: true });
    return;
  }

  const prof       = getProficiencyBonus(char.level);
  const raceData   = RACES[char.race];
  const classData  = CLASSES[char.class];
  const skillProfs = new Set<string>(JSON.parse(char.skill_proficiencies || "[]") as string[]);
  const saveProfs  = new Set<StatName>(classData?.savingThrows ?? []);
  const items      = getInventory(char.id);
  const conditions = JSON.parse(char.conditions || "[]") as string[];

  const hpPct   = char.hp / char.max_hp;
  const hpEmoji = hpPct > 0.6 ? "🟢" : hpPct > 0.25 ? "🟡" : "🔴";

  const sv = (stat: StatName): number => {
    switch (stat) {
      case "strength":     return char.strength;
      case "dexterity":    return char.dexterity;
      case "constitution": return char.constitution;
      case "intelligence": return char.intelligence;
      case "wisdom":       return char.wisdom;
      case "charisma":     return char.charisma;
    }
  };

  // Ability scores
  const abLine = (s: StatName) =>
    `**${STAT_SHORT[s]}** ${sv(s)} \`${formatModifier(getModifier(sv(s)))}\``;
  const abilityScores =
    `${abLine("strength")}  ${abLine("dexterity")}  ${abLine("constitution")}\n` +
    `${abLine("intelligence")}  ${abLine("wisdom")}  ${abLine("charisma")}`;

  // Saving throws (2 rows of 3)
  const saveLine = (s: StatName) => {
    const bonus = getModifier(sv(s)) + (saveProfs.has(s) ? prof : 0);
    return `${saveProfs.has(s) ? "✦" : "◈"} ${STAT_SHORT[s]} \`${formatModifier(bonus)}\``;
  };
  const stLines = STAT_NAMES.map(saveLine);
  const savingThrows = `${stLines.slice(0, 3).join("  ")}\n${stLines.slice(3).join("  ")}`;

  // Skills (one per line, alphabetical)
  const skillLine = (name: string) => {
    const stat  = SKILLS[name] ?? "strength";
    const bonus = getModifier(sv(stat)) + (skillProfs.has(name) ? prof : 0);
    return `${skillProfs.has(name) ? "✦" : "◈"} ${name} \`${formatModifier(bonus)}\``;
  };
  const skillsValue = Object.keys(SKILLS).map(skillLine).join("\n");

  // Passive Perception
  const passivePerc = 10 + getModifier(char.wisdom) + (skillProfs.has("Perception") ? prof : 0);

  // Proficiencies
  const armorProf  = classData?.armorProficiencies?.length ? classData.armorProficiencies.join(", ") : "None";
  const weaponProf = classData?.weaponProficiencies?.join(", ") ?? "—";

  const multiclassEntries = JSON.parse(char.multiclass || "[]") as MulticlassEntry[];
  const totalLevel = char.level + multiclassEntries.reduce((s, m) => s + m.level, 0);
  const classLine = multiclassEntries.length > 0
    ? `${classData?.name ?? char.class} ${char.level} / ${multiclassEntries.map(m => `${CLASSES[m.class]?.name ?? m.class} ${m.level}${m.subclass ? ` [${m.subclass}]` : ""}`).join(" / ")}`
    : `${classData?.name ?? char.class}`;
  const subclassLine = char.subclass
    ? `\nSubclass: **${SUBCLASSES[char.class.toLowerCase()]?.options.find(o => o.id === char.subclass)?.name ?? char.subclass}**`
    : (SUBCLASSES[char.class.toLowerCase()] && SUBCLASSES[char.class.toLowerCase()].unlockLevel <= char.level ? "\n⚠️ Subclass not chosen — use `/char` if prompted" : "");

  const embed = new EmbedBuilder()
    .setTitle(`📜 ${char.name}`)
    .setDescription(
      `*${raceData?.display ?? char.race} ${classLine} | ${char.background} | Level ${totalLevel}*${subclassLine}\n` +
      `XP: **${char.xp}** · Prof: **+${prof}** · Speed: **${char.speed}ft** · Hit Die: **d${classData?.hitDie ?? 8}**`
    )
    .setColor(0xc9a84c)
    .addFields(
      { name: `${hpEmoji} HP`, value: `**${char.hp}**/${char.max_hp}${char.temp_hp > 0 ? ` (+${char.temp_hp} temp)` : ""}`, inline: true },
      { name: "🛡️ AC", value: `**${char.ac}**`, inline: true },
      { name: "⚡ Initiative", value: `**${formatModifier(char.initiative_bonus)}**`, inline: true },
      { name: "⚔️ Ability Scores", value: abilityScores },
      { name: "🛡 Saving Throws", value: savingThrows },
      { name: "🎯 Skills  ✦ proficient · ◈ not proficient", value: skillsValue },
      { name: "👁️ Passive Perception", value: `${passivePerc}`, inline: true },
      { name: "🗡️ Proficiencies", value: `Armor: ${armorProf}\nWeapons: ${weaponProf}` },
    );

  if (classData?.level1Features?.length) {
    embed.addFields({ name: "✨ Class Features", value: classData.level1Features.join("\n") });
  }
  if (raceData?.traits?.length) {
    embed.addFields({ name: "🧬 Racial Traits", value: raceData.traits.join("\n") });
  }

  if (classData?.spellcaster && classData.spellcastingStat) {
    const spellMod = getModifier(sv(classData.spellcastingStat));
    const spellDC  = 8 + prof + spellMod;
    const spellAtk = prof + spellMod;
    const slots    = JSON.parse(char.spell_slots || "{}") as Record<string, number>;
    const slotStr  = Object.entries(slots)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `Lv${k}: ${v}`)
      .join(" · ");
    embed.addFields({
      name: "📖 Spellcasting",
      value: `Stat: **${STAT_SHORT[classData.spellcastingStat]}** · Save DC: **${spellDC}** · Atk: **${formatModifier(spellAtk)}**\nSlots: ${slotStr || "None configured"}`,
    });
  }

  if (items.length > 0) {
    const typeEmoji: Record<string, string> = {
      weapon: "⚔️", armor: "🛡️", shield: "🛡️", ammo: "🏹",
      potion: "🧪", spell: "📖", gear: "🎒", tool: "🔧",
    };
    const equipped   = items.filter(i => i.equipped);
    const unequipped = items.filter(i => !i.equipped);
    const formatItem = (item: ReturnType<typeof getInventory>[number]) => {
      const emoji = typeEmoji[item.type] ?? "•";
      let line = `${emoji} **${item.name}**`;
      if (item.quantity > 1) line += ` ×${item.quantity}`;
      if (item.description) line += ` — ${item.description}`;
      return line;
    };
    const sections: string[] = [];
    if (equipped.length > 0)   sections.push(`**Equipped**\n${equipped.map(formatItem).join("\n")}`);
    if (unequipped.length > 0) sections.push(`**Pack**\n${unequipped.map(formatItem).join("\n")}`);
    embed.addFields({ name: `🎒 Inventory (${items.length} item${items.length !== 1 ? "s" : ""})`, value: sections.join("\n\n").slice(0, 1024) });
  }

  embed.addFields({ name: "💰 Currency", value: `**${char.gold}**gp · **${char.silver}**sp · **${char.copper}**cp`, inline: true });

  if (conditions.length > 0) {
    embed.addFields({ name: "⚠️ Conditions", value: conditions.join(", ") });
  }
  if (char.notes) {
    embed.addFields({ name: "📝 Notes", value: char.notes.slice(0, 1024) });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ── HP ────────────────────────────────────────────────────────────────────

async function handleHp(interaction: ChatInputCommandInteraction, userId: string, campaignId: number): Promise<void> {
  const char = getCharacter(userId, campaignId);
  if (!char) {
    await interaction.reply({ content: "❌ You don't have a character.", ephemeral: true });
    return;
  }

  const amount = interaction.options.getInteger("amount", true);
  const newHp  = Math.min(char.max_hp, Math.max(0, char.hp + amount));
  updateCharacterHp(char.id, newHp);

  broadcastEvent(campaignId, "party_update", getAllCharacters(campaignId).map(c => ({
    id: c.id, name: c.name, class: c.class, race: c.race,
    level: c.level, hp: c.hp, max_hp: c.max_hp, ac: c.ac, is_player: true, avatar: c.avatar ?? "",
  })));

  const hpEmoji  = newHp / char.max_hp > 0.6 ? "🟢" : newHp / char.max_hp > 0.25 ? "🟡" : "🔴";
  const deltaStr = amount >= 0 ? `+${amount}` : `${amount}`;

  await interaction.reply(`${hpEmoji} **${char.name}** HP: ${char.hp} → **${newHp}**/${char.max_hp} (${deltaStr})`);
}

// ── Icon Upload ───────────────────────────────────────────────────────────

async function handleIcon(interaction: ChatInputCommandInteraction, userId: string, campaignId: number): Promise<void> {
  const char = getCharacter(userId, campaignId);
  if (!char) {
    await interaction.reply({ content: "❌ You don't have a character. Use `/char create` first.", ephemeral: true });
    return;
  }

  const attachment = interaction.options.getAttachment("image", true);

  // Validate image type
  const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  if (!validTypes.includes(attachment.contentType ?? "")) {
    await interaction.reply({ content: "❌ Please upload an image file (PNG, JPG, GIF, or WEBP).", ephemeral: true });
    return;
  }

  // Validate size (2MB max)
  if (attachment.size > 2 * 1024 * 1024) {
    await interaction.reply({ content: "❌ Image must be under 2MB.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const ext = (attachment.contentType ?? "image/png").split("/")[1].replace("jpeg", "jpg");
  const filename = `${char.id}.${ext}`;
  const avatarsDir = path.join(process.cwd(), "avatars");
  if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

  try {
    const res = await fetch(attachment.url);
    const buf = Buffer.from(await res.arrayBuffer());
    // Remove any old avatar files for this character
    for (const existing of fs.readdirSync(avatarsDir)) {
      if (existing.startsWith(`${char.id}.`)) fs.unlinkSync(path.join(avatarsDir, existing));
    }
    fs.writeFileSync(path.join(avatarsDir, filename), buf);
  } catch {
    await interaction.editReply("❌ Failed to download the image. Please try again.");
    return;
  }

  updateCharacterAvatar(char.id, filename);

  // Broadcast updated party so web refreshes avatars
  const allChars = getAllCharacters(campaignId);
  broadcastEvent(campaignId, "party_update", allChars.map(c => ({
    id: c.id, name: c.name, class: c.class, race: c.race,
    level: c.level, hp: c.hp, max_hp: c.max_hp, ac: c.ac, is_player: true, avatar: c.avatar ?? "",
  })));

  await interaction.editReply({
    content: `✅ Avatar updated for **${char.name}**! It will appear on the web viewer.`,
  });
}

// ── Party ─────────────────────────────────────────────────────────────────

async function handleParty(interaction: ChatInputCommandInteraction, campaignId: number): Promise<void> {
  const chars = getAllCharacters(campaignId);
  if (chars.length === 0) {
    await interaction.reply("The party has no characters yet. Use `/char create` to join!");
    return;
  }

  const campaign = getActiveCampaign();
  const lines = [`## ⚔️ Party — *${campaign?.name ?? "Campaign"}*`, ""];
  chars.forEach(c => {
    const hpPct    = c.hp / c.max_hp;
    const hpEmoji  = hpPct > 0.6 ? "🟢" : hpPct > 0.25 ? "🟡" : "🔴";
    const raceData = RACES[c.race];
    const mc = JSON.parse(c.multiclass || "[]") as MulticlassEntry[];
    const totalLv = c.level + mc.reduce((s, m) => s + m.level, 0);
    lines.push(`${hpEmoji} **${c.name}** *(${raceData?.display ?? c.race} ${c.class} Lv.${totalLv})* — HP ${c.hp}/${c.max_hp} | AC ${c.ac}`);
  });

  await interaction.reply(lines.join("\n"));
}

// ── ASI ───────────────────────────────────────────────────────────────────

async function handleASI(interaction: ChatInputCommandInteraction, userId: string, campaignId: number): Promise<void> {
  const char = getCharacter(userId, campaignId);
  if (!char) { await interaction.reply({ content: "❌ No character found.", ephemeral: true }); return; }

  const stat1 = interaction.options.getString("stat", true) as StatName;
  const stat2 = interaction.options.getString("stat2") as StatName | null;

  if (stat2 && stat1 === stat2) {
    await interaction.reply({ content: "❌ Choose two different stats for +1/+1.", ephemeral: true }); return;
  }

  const statVal = (s: StatName): number =>
    ({ strength: char.strength, dexterity: char.dexterity, constitution: char.constitution,
       intelligence: char.intelligence, wisdom: char.wisdom, charisma: char.charisma })[s];

  if (stat2) {
    if (statVal(stat1) >= 20 || statVal(stat2) >= 20) {
      await interaction.reply({ content: "❌ Cannot increase a stat already at 20.", ephemeral: true }); return;
    }
    updateCharacterASI(char.id, stat1, 1, stat2, 1);
    await interaction.reply(
      `📈 **${char.name}** ASI: ${STAT_SHORT[stat1]} ${statVal(stat1)}→**${statVal(stat1)+1}**, ${STAT_SHORT[stat2]} ${statVal(stat2)}→**${statVal(stat2)+1}**`
    );
  } else {
    if (statVal(stat1) >= 20) {
      await interaction.reply({ content: `❌ ${STAT_SHORT[stat1]} is already at the maximum (20).`, ephemeral: true }); return;
    }
    updateCharacterASI(char.id, stat1, 2);
    await interaction.reply(`📈 **${char.name}** ASI: ${STAT_SHORT[stat1]} ${statVal(stat1)}→**${Math.min(20, statVal(stat1)+2)}**`);
  }
}

// ── Multiclass ────────────────────────────────────────────────────────────

async function handleMulticlass(interaction: ChatInputCommandInteraction, userId: string, campaignId: number): Promise<void> {
  const char = getCharacter(userId, campaignId);
  if (!char) { await interaction.reply({ content: "❌ No character found.", ephemeral: true }); return; }

  const newClass = interaction.options.getString("class", true);
  if (char.class.toLowerCase() === newClass) {
    await interaction.reply({ content: `❌ Already a ${char.class}. Level up normally instead.`, ephemeral: true }); return;
  }

  const statVal = (s: StatName): number =>
    ({ strength: char.strength, dexterity: char.dexterity, constitution: char.constitution,
       intelligence: char.intelligence, wisdom: char.wisdom, charisma: char.charisma })[s];

  for (const prereq of (MULTICLASS_PREREQS[newClass] ?? [])) {
    if (statVal(prereq.stat) < prereq.min) {
      await interaction.reply({ content: `❌ **${newClass}** requires ${STAT_SHORT[prereq.stat]} ≥ ${prereq.min} (yours: ${statVal(prereq.stat)}).`, ephemeral: true }); return;
    }
  }
  for (const prereq of (MULTICLASS_PREREQS[char.class.toLowerCase()] ?? [])) {
    if (statVal(prereq.stat) < prereq.min) {
      await interaction.reply({ content: `❌ Multiclassing from **${char.class}** requires ${STAT_SHORT[prereq.stat]} ≥ ${prereq.min}.`, ephemeral: true }); return;
    }
  }

  const existing: MulticlassEntry[] = JSON.parse(char.multiclass || "[]");
  const prevLevel = existing.find(e => e.class === newClass)?.level ?? 0;
  const { hpGain } = addMulticlassLevel(char.id, newClass);
  const newLevel = prevLevel + 1;
  const classData = CLASSES[newClass];

  await interaction.reply(`✨ **${char.name}** gained **${classData?.name ?? newClass} Lv.${newLevel}**! +${hpGain} max HP.`);

  const subclassData = SUBCLASSES[newClass];
  if (subclassData?.unlockLevel === newLevel && !existing.find(e => e.class === newClass)?.subclass) {
    await sendSubclassMenu(interaction, char.id, newClass, newLevel);
  }
}

// ── Subclass / ASI Select Menu builders ──────────────────────────────────

function buildSubclassRow(charId: number, charClass: string): ActionRowBuilder<StringSelectMenuBuilder> {
  const data = SUBCLASSES[charClass.toLowerCase()]!;
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`levelup_sub_${charId}_${charClass.toLowerCase()}`)
      .setPlaceholder(`Choose your ${data.label}...`)
      .addOptions(data.options.map(o => ({
        label: o.name.substring(0, 100),
        value: o.id,
        description: o.description.substring(0, 100),
      })))
  );
}

function buildASIRow(charId: number, stats: LevelUpEvent["currentStats"]): ActionRowBuilder<StringSelectMenuBuilder> {
  const statNames: StatName[] = ["strength","dexterity","constitution","intelligence","wisdom","charisma"];
  const options = statNames
    .filter(s => stats[s] < 20)
    .map(s => ({ label: `+2 ${STAT_SHORT[s]} (${stats[s]} → ${Math.min(20, stats[s]+2)})`, value: s, description: `Increase ${s} by 2` }));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`levelup_asi_${charId}`)
      .setPlaceholder("Choose +2 to one stat (or /char asi for +1/+1)...")
      .addOptions(options.length > 0 ? options : [{ label: "All stats at maximum (20)", value: "none" }])
  );
}

async function sendSubclassMenu(
  target: ChatInputCommandInteraction | ButtonInteraction,
  charId: number, charClass: string, level: number,
): Promise<void> {
  const data = SUBCLASSES[charClass.toLowerCase()];
  if (!data) return;
  await target.followUp({ content: `🎊 Level ${level}! Choose your **${data.label}**:`, components: [buildSubclassRow(charId, charClass)] });
}

// ── Exported level-up prompt helpers (called from dm.ts) ──────────────────

export async function sendLevelUpPrompts(
  target: ChatInputCommandInteraction | ButtonInteraction,
  evt: LevelUpEvent,
): Promise<void> {
  const hpText = evt.hpGain > 0 ? ` · +${evt.hpGain} max HP` : "";
  await target.followUp(`🎉 **${evt.characterName}** reached **Level ${evt.newLevel}**!${hpText}`);
  if (evt.needsSubclass) {
    const data = SUBCLASSES[evt.charClass.toLowerCase()];
    if (data) await target.followUp({ content: `🎊 Choose your **${data.label}**:`, components: [buildSubclassRow(evt.charId, evt.charClass)] });
  }
  if (evt.needsASI) {
    await target.followUp({ content: `📈 **${evt.characterName}** — Choose **Ability Score Improvement** (+2 to one stat, or \`/char asi\` for +1/+1):`, components: [buildASIRow(evt.charId, evt.currentStats)] });
  }
}

export async function sendLevelUpPromptsToChannel(
  channel: TextChannel,
  evt: LevelUpEvent,
): Promise<void> {
  const hpText = evt.hpGain > 0 ? ` · +${evt.hpGain} max HP` : "";
  await channel.send(`🎉 **${evt.characterName}** reached **Level ${evt.newLevel}**!${hpText}`);
  if (evt.needsSubclass) {
    const data = SUBCLASSES[evt.charClass.toLowerCase()];
    if (data) await channel.send({ content: `🎊 Choose your **${data.label}**:`, components: [buildSubclassRow(evt.charId, evt.charClass)] });
  }
  if (evt.needsASI) {
    await channel.send({ content: `📈 **${evt.characterName}** — Choose **Ability Score Improvement** (+2 to one stat, or \`/char asi\` for +1/+1):`, components: [buildASIRow(evt.charId, evt.currentStats)] });
  }
}

// ── Select Menu handler (exported for bot/index.ts) ───────────────────────

export async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const parts = interaction.customId.split("_");
  if (parts[0] !== "levelup") return;

  const charId = parseInt(parts[2]);
  const char = getCharacterById(charId);
  if (!char) { await interaction.reply({ content: "❌ Character not found.", ephemeral: true }); return; }
  if (char.discord_user_id !== interaction.user.id) {
    await interaction.reply({ content: `❌ This menu is for **${char.name}**'s player only.`, ephemeral: true }); return;
  }

  if (parts[1] === "sub") {
    const charClass = parts[3] ?? char.class.toLowerCase();
    const chosen = interaction.values[0];
    const data = SUBCLASSES[charClass];
    const option = data?.options.find(o => o.id === chosen);
    const displayName = option?.name ?? chosen;

    // Primary class or multiclass?
    if (charClass === char.class.toLowerCase()) {
      updateCharacterSubclass(charId, chosen);
    } else {
      updateMulticlassSubclass(charId, charClass, chosen);
    }
    await interaction.update({ content: `✅ **${char.name}** — ${data?.label ?? "Subclass"}: **${displayName}**`, components: [] });
  }

  if (parts[1] === "asi") {
    const chosen = interaction.values[0];
    if (chosen === "none") { await interaction.update({ content: "All stats are already at maximum.", components: [] }); return; }
    const stat = chosen as StatName;
    const currentVal = (char as unknown as Record<string, number>)[stat] ?? 10;
    updateCharacterASI(charId, stat, 2);
    await interaction.update({ content: `✅ **${char.name}** ASI: **${STAT_SHORT[stat]}** ${currentVal}→**${Math.min(20, currentVal+2)}**`, components: [] });
  }
}
