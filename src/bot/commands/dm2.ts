import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from "discord.js";
import { getActiveCampaign } from "../../db/database.js";
import {
  getPendingRoll, clearPendingRoll, PendingRoll,
  getPendingPartyRoll, clearPendingPartyRoll, PendingPartyRoll,
  LevelUpEvent,
} from "../../agent/dm.js";
import { runMimoDm } from "../../agent/dm-mimo.js";
import { sendLevelUpPrompts, sendLevelUpPromptsToChannel } from "./character.js";
import { splitMessage } from "./dm.js";
import { rollDice } from "../../game/dice.js";

export const data = new SlashCommandBuilder()
  .setName("dm2")
  .setDescription("Speak to DM2 — powered by MiMo AI")
  .addStringOption(o =>
    o.setName("message")
      .setDescription("What do you say or do?")
      .setRequired(true)
  );

// ── Active party rolls tracked in-memory ─────────────────────────────────

interface ActivePartyRoll {
  partyRoll: PendingPartyRoll;
  channel: TextChannel;
  campaignId: number;
  messageId: string;
  timeout: ReturnType<typeof setTimeout>;
}

const activePartyRolls = new Map<string, ActivePartyRoll>();

// ── Slash command handler ─────────────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const campaign = getActiveCampaign();
  if (!campaign) {
    await interaction.reply({ content: "❌ No active campaign. Use `/campaign start` first.", ephemeral: true });
    return;
  }

  const userMessage = interaction.options.getString("message", true);
  const displayName = interaction.member && "displayName" in interaction.member
    ? (interaction.member as { displayName: string }).displayName
    : interaction.user.username;

  await interaction.deferReply();

  try {
    const response = await runMimoDm(campaign.id, `**${displayName}**: ${userMessage}`, interaction.user.id);

    await postNarrative(interaction, response.narrative);

    if (response.combatUpdate)      await interaction.followUp(response.combatUpdate);
    if (response.pendingRoll)       await sendRollButton(interaction, response.pendingRoll);
    if (response.pendingPartyRoll)  await sendPartyRollButtons(interaction, response.pendingPartyRoll);

    for (const evt of response.levelUpEvents) {
      await sendLevelUpPrompts(interaction, evt);
    }

    const failed = response.toolResults.filter(t => !t.success && t.tool !== "request_roll" && t.tool !== "request_party_roll");
    if (failed.length > 0) {
      await interaction.followUp({ content: failed.map(t => `⚠️ ${t.tool}: ${t.message}`).join("\n"), ephemeral: true });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[DM2] Error:", err);
    await interaction.editReply(`❌ DM2 encountered an error: ${msg}`);
  }
}

// ── Single roll button (prefix: roll2_) ───────────────────────────────────

async function sendRollButton(
  target: ChatInputCommandInteraction | ButtonInteraction,
  pending: PendingRoll
): Promise<void> {
  const { rollId, characterName, expression, purpose, dc, advantage } = pending;
  const advText = advantage === "advantage" ? " *(Adv)*" : advantage === "disadvantage" ? " *(Dis)*" : "";
  const dcText  = dc ? ` — DC ${dc}` : "";
  const label   = `🎲 ${characterName}: ${purpose} (${expression})${advText}${dcText}`.substring(0, 80);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`roll2_${rollId}`).setLabel(label).setStyle(ButtonStyle.Secondary)
  );
  await target.followUp({ content: "👇 กดเพื่อทอยลูกเต๋า (DM2):", components: [row] });
}

async function sendRollButtonToChannel(channel: TextChannel, pending: PendingRoll): Promise<void> {
  const { rollId, characterName, expression, purpose, dc, advantage } = pending;
  const advText = advantage === "advantage" ? " *(Adv)*" : advantage === "disadvantage" ? " *(Dis)*" : "";
  const label   = `🎲 ${characterName}: ${purpose} (${expression})${advText}${dc ? ` — DC ${dc}` : ""}`.substring(0, 80);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`roll2_${rollId}`).setLabel(label).setStyle(ButtonStyle.Secondary)
  );
  await channel.send({ content: "👇 กดเพื่อทอยลูกเต๋า (DM2):", components: [row] });
}

export async function handleRollButton(interaction: ButtonInteraction): Promise<void> {
  const rollId  = interaction.customId.replace(/^roll2_/, "");
  const pending = getPendingRoll(rollId);

  if (!pending) {
    await interaction.reply({ content: "❌ การทอยนี้หมดอายุหรือถูกใช้งานแล้ว", ephemeral: true });
    return;
  }

  if (pending.ownerDiscordId && pending.ownerDiscordId !== interaction.user.id) {
    await interaction.reply({
      content: `❌ ปุ่มนี้สำหรับ **${pending.characterName}** เท่านั้น — รอให้ <@${pending.ownerDiscordId}> กดเอง`,
      ephemeral: true,
    });
    return;
  }

  clearPendingRoll(rollId);
  await interaction.deferReply();

  const result      = rollExpression(pending.expression, pending.advantage);
  const critText    = result.isCritical ? " 💥 **CRITICAL HIT!**" : result.isCriticalFail ? " 💀 **CRITICAL FAIL!**" : "";
  const successText = pending.dc !== undefined
    ? ` — DC ${pending.dc}: **${result.total >= pending.dc ? "SUCCESS ✅" : "FAIL ❌"}**`
    : "";

  await interaction.editReply(
    `🎲 **${pending.characterName}** rolled **${pending.purpose}** (${pending.expression}): ${result.breakdown}${successText}${critText}`
  );

  const dmMsg = buildRollResultMessage(pending.characterName, pending.purpose, pending.expression, result, pending.dc);

  try {
    const dmResponse = await runMimoDm(pending.campaignId, dmMsg, interaction.user.id);
    await postNarrative(interaction, dmResponse.narrative);
    if (dmResponse.combatUpdate)     await interaction.followUp(dmResponse.combatUpdate);
    if (dmResponse.pendingRoll)      await sendRollButton(interaction, dmResponse.pendingRoll);
    if (dmResponse.pendingPartyRoll) await sendPartyRollButtons(interaction, dmResponse.pendingPartyRoll);
    for (const evt of dmResponse.levelUpEvents) await sendLevelUpPrompts(interaction, evt);
  } catch (err) {
    await interaction.followUp(`❌ DM2 error: ${err instanceof Error ? err.message : "Unknown"}`);
  }
}

// ── Party roll buttons (prefix: proll2_) ──────────────────────────────────

async function sendPartyRollButtons(
  target: ChatInputCommandInteraction | ButtonInteraction,
  partyRoll: PendingPartyRoll
): Promise<void> {
  const { groupId, purpose, expression, dc, advantage, mode, entries } = partyRoll;
  const advText   = advantage === "advantage" ? " (Advantage)" : advantage === "disadvantage" ? " (Disadvantage)" : "";
  const modeLabel: Record<PendingPartyRoll["mode"], string> = {
    group_check: "Group Check — ≥ครึ่งสำเร็จ = ทีมสำเร็จ",
    lowest_wins: "Worst Counts — คนแย่สุดตัดสินผล",
    individual:  "Individual — แยกนับรายคน",
  };
  const header = [
    `🎲 **Party Roll: ${purpose}** (${expression})${advText}${dc ? ` — DC ${dc}` : ""}`,
    `*${modeLabel[mode]}*`,
    "กดปุ่มของตัวละครคุณ:",
  ].join("\n");

  const buttons = entries.map((e, idx) =>
    new ButtonBuilder()
      .setCustomId(`proll2_${groupId}_${idx}`)
      .setLabel(`🎲 ${e.characterName}`)
      .setStyle(ButtonStyle.Secondary)
  );

  const rows    = buildButtonRows(buttons);
  const msg     = await target.followUp({ content: header, components: rows, fetchReply: true });
  const channel = target.channel as TextChannel;
  const timeout = setTimeout(() => void resolvePartyRoll(groupId, channel), 3 * 60 * 1000);

  activePartyRolls.set(groupId, {
    partyRoll, channel, campaignId: partyRoll.campaignId,
    messageId: (msg as { id: string }).id, timeout,
  });
}

export async function handlePartyRollButton(interaction: ButtonInteraction): Promise<void> {
  const parts   = interaction.customId.split("_");
  const groupId = parts[1];
  const charIdx = parseInt(parts[2]);
  const active  = activePartyRolls.get(groupId);

  if (!active) {
    await interaction.reply({ content: "❌ การทอยนี้หมดอายุแล้ว", ephemeral: true });
    return;
  }

  const entry = active.partyRoll.entries[charIdx];
  if (!entry) {
    await interaction.reply({ content: "❌ ไม่พบตัวละครนี้", ephemeral: true });
    return;
  }

  if (entry.discordUserId !== interaction.user.id) {
    await interaction.reply({
      content: `❌ ปุ่มนี้สำหรับ **${entry.characterName}** — <@${entry.discordUserId}> เท่านั้น`,
      ephemeral: true,
    });
    return;
  }

  if (entry.rolled) {
    await interaction.reply({ content: `✅ **${entry.characterName}** ทอยไปแล้ว: **${entry.result}**`, ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const { partyRoll } = active;
  const result = rollExpression(partyRoll.expression, partyRoll.advantage);

  entry.rolled         = true;
  entry.result         = result.total;
  entry.breakdown      = result.breakdown;
  entry.isCritical     = result.isCritical;
  entry.isCriticalFail = result.isCriticalFail;

  const critText    = result.isCritical ? " 💥 **CRIT!**" : result.isCriticalFail ? " 💀 **FAIL!**" : "";
  const successText = partyRoll.dc !== undefined
    ? ` — DC ${partyRoll.dc}: **${result.total >= partyRoll.dc ? "SUCCESS ✅" : "FAIL ❌"}**`
    : "";

  await interaction.editReply(
    `🎲 **${entry.characterName}** rolled **${partyRoll.purpose}**: ${result.breakdown}${successText}${critText}`
  );

  try {
    const updatedButtons = partyRoll.entries.map((e, idx) =>
      new ButtonBuilder()
        .setCustomId(`proll2_${groupId}_${idx}`)
        .setLabel(e.rolled ? `✅ ${e.characterName}` : `🎲 ${e.characterName}`)
        .setStyle(e.rolled ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(e.rolled)
    );
    const origMsg = await active.channel.messages.fetch(active.messageId);
    await origMsg.edit({ components: buildButtonRows(updatedButtons) });
  } catch { /* ignore */ }

  if (partyRoll.entries.every(e => e.rolled)) {
    clearTimeout(active.timeout);
    activePartyRolls.delete(groupId);
    await resolvePartyRoll(groupId, active.channel);
  }
}

async function resolvePartyRoll(groupId: string, channel: TextChannel): Promise<void> {
  const active = activePartyRolls.get(groupId);
  if (active) { clearTimeout(active.timeout); activePartyRolls.delete(groupId); }

  const partyRoll = active?.partyRoll ?? getPendingPartyRoll(groupId);
  if (!partyRoll) return;
  clearPendingPartyRoll(groupId);

  const { entries, purpose, expression, dc, mode, campaignId } = partyRoll;
  const rolled    = entries.filter(e => e.rolled);
  const notRolled = entries.filter(e => !e.rolled);

  const resultLines = entries.map(e => {
    if (!e.rolled) return `${e.characterName}: ไม่ได้ทอย (หมดเวลา)`;
    const dcResult = dc !== undefined ? ` — DC ${dc}: ${e.result! >= dc ? "SUCCESS" : "FAIL"}` : "";
    return `${e.characterName}: ${e.breakdown} = ${e.result}${dcResult}`;
  });

  let verdict = "";
  if (rolled.length > 0) {
    const totals = rolled.map(e => e.result!);
    if (mode === "group_check" && dc !== undefined) {
      const successes = rolled.filter(e => e.result! >= dc).length;
      const majority  = Math.ceil(rolled.length / 2);
      verdict = `Group Check: ${successes}/${rolled.length} succeeded — Party **${successes >= majority ? "SUCCEEDS ✅" : "FAILS ❌"}**`;
    } else if (mode === "lowest_wins") {
      const worst     = Math.min(...totals);
      const worstChar = rolled.find(e => e.result === worst)!;
      const worstResult = dc !== undefined ? ` — DC ${dc}: **${worst >= dc ? "SUCCESS ✅" : "FAIL ❌"}**` : "";
      verdict = `Worst roll: **${worstChar.characterName}** = **${worst}**${worstResult}`;
    }
  }

  const dmMessage = [
    `[Party Roll Results — ${purpose} (${expression})]`,
    ...resultLines,
    verdict ? `\n${verdict}` : "",
    notRolled.length > 0 ? `ไม่ได้ทอย: ${notRolled.map(e => e.characterName).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  try {
    const dmResponse = await runMimoDm(campaignId, dmMessage);
    const chunks = splitMessage(dmResponse.narrative || "*(DM2 continues...)*");
    for (const chunk of chunks) await channel.send(chunk);
    if (dmResponse.combatUpdate)     await channel.send(dmResponse.combatUpdate);
    if (dmResponse.pendingRoll)      await sendRollButtonToChannel(channel, dmResponse.pendingRoll);
    if (dmResponse.pendingPartyRoll) {
      // send party roll to channel inline
      const { groupId: gid, purpose: p, expression: ex, dc: d, advantage: adv, mode: m, entries: en } = dmResponse.pendingPartyRoll;
      const advT = adv === "advantage" ? " (Advantage)" : adv === "disadvantage" ? " (Disadvantage)" : "";
      const hdr  = `🎲 **Party Roll: ${p}** (${ex})${advT}${d ? ` — DC ${d}` : ""}\nกดปุ่มของตัวละครคุณ:`;
      const btns = en.map((e, idx) =>
        new ButtonBuilder().setCustomId(`proll2_${gid}_${idx}`).setLabel(`🎲 ${e.characterName}`).setStyle(ButtonStyle.Secondary)
      );
      const msg2 = await channel.send({ content: hdr, components: buildButtonRows(btns) });
      const t2   = setTimeout(() => void resolvePartyRoll(gid, channel), 3 * 60 * 1000);
      activePartyRolls.set(gid, { partyRoll: dmResponse.pendingPartyRoll, channel, campaignId, messageId: msg2.id, timeout: t2 });
    }
    for (const evt of dmResponse.levelUpEvents) await sendLevelUpPromptsToChannel(channel, evt);
  } catch (err) {
    await channel.send(`❌ DM2 error: ${err instanceof Error ? err.message : "Unknown"}`);
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────

function rollExpression(expression: string, advantage: "normal" | "advantage" | "disadvantage") {
  if (advantage === "normal") return rollDice(expression);
  const modMatch = expression.match(/^1?d20([+-]\d+)?$/i);
  const modifier = modMatch?.[1] ? parseInt(modMatch[1]) : 0;
  const r1 = Math.floor(Math.random() * 20) + 1;
  const r2 = Math.floor(Math.random() * 20) + 1;
  const kept    = advantage === "advantage" ? Math.max(r1, r2) : Math.min(r1, r2);
  const dropped = advantage === "advantage" ? Math.min(r1, r2) : Math.max(r1, r2);
  const total   = kept + modifier;
  const modStr  = modifier !== 0 ? (modifier > 0 ? ` +${modifier}` : ` ${modifier}`) : "";
  const label   = advantage === "advantage" ? "Adv" : "Dis";
  return {
    expression, rolls: [kept], modifier, total,
    breakdown: `[~~${dropped}~~, **${kept}**]${modStr} = **${total}** (${label})`,
    isCritical:     kept === 20 && !modifier,
    isCriticalFail: kept === 1  && !modifier,
  };
}

function buildRollResultMessage(
  characterName: string, purpose: string, expression: string,
  result: { total: number; breakdown: string; isCritical?: boolean; isCriticalFail?: boolean },
  dc?: number
): string {
  const dcPart   = dc !== undefined ? `, DC ${dc} — ${result.total >= dc ? "SUCCESS" : "FAIL"}` : "";
  const critPart = result.isCritical ? ", CRITICAL HIT" : result.isCriticalFail ? ", CRITICAL FAIL" : "";
  return `[Roll Result] ${characterName} rolled ${purpose} (${expression}): total = ${result.total}${dcPart}${critPart}`;
}

function buildButtonRows(buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

async function postNarrative(
  target: ChatInputCommandInteraction | ButtonInteraction,
  narrative: string
): Promise<void> {
  const chunks = splitMessage(narrative || "*(DM2 ponders...)*");
  await target.editReply(chunks[0]);
  for (let i = 1; i < chunks.length; i++) await target.followUp(chunks[i]);
}
