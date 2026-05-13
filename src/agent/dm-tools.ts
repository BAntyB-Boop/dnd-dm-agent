// Shared tool executor, context builders, and rule file loading
// used by all DM provider implementations.

import fs from "fs";
import path from "path";
import {
  getAllCharacters, getAtmosphere, addStoryLog, getRecentStory,
  getSessionSummary, getSessionMessages, updateAtmosphere, updateCharacterXp,
  addInventoryItem, removeInventoryItem, getActiveCombat, Character,
  useSpellSlot, restoreAllSpellSlots, shortRestWarlockSlots, longRestHeal,
  getPreparedSpells,
} from "../db/database.js";
import type { CombatParticipant, AtmosphereState } from "../db/database.js";
import { rollDice } from "../game/dice.js";
import { startCombat, applyDamage, applyHealing, finishCombat, parseCombat } from "../game/combat.js";
import { CLASSES } from "../game/character-data.js";
import { isSpellPreparer } from "../game/abilities.js";
import {
  broadcast, setPendingRoll, setPendingPartyRoll,
  PendingRoll, PendingPartyRoll, PartyRollEntry,
  ToolResultSummary, LevelUpEvent,
} from "./dm-shared.js";

// ── XML tool call parser (shared by Groq and MiMo) ───────────────────────

export interface XmlToolCall { name: string; args: Record<string, unknown> }

export function extractXmlToolCalls(content: string): { calls: XmlToolCall[]; cleaned: string } {
  const calls: XmlToolCall[] = [];

  // Format A: <function=name>{JSON}</function>  or  <function(name){JSON}</function>
  const reA = /<function[=>(]?(\w+)[)]?\s*(\{[\s\S]*?\})\s*<\/function>/g;

  // Format B: <function=name>\n<parameter=key>value</parameter>...\n</function>
  const reB = /<function[=>(]?(\w+)[)]?[^>]*>([\s\S]*?)<\/function>/g;
  const reParam = /<parameter[=: ]*(\w+)[^>]*>([\s\S]*?)<\/parameter>/g;

  let cleaned = content;

  // Pass 1 — Format A (JSON body)
  cleaned = cleaned.replace(reA, (_, name: string, argsStr: string) => {
    try { calls.push({ name, args: JSON.parse(argsStr) }); } catch { /* malformed */ }
    return "";
  });

  // Pass 2 — Format B (<parameter=key> style)
  cleaned = cleaned.replace(reB, (match, name: string, body: string) => {
    if (body.trim().startsWith("{")) return match; // already handled by Format A
    const args: Record<string, unknown> = {};
    let m: RegExpExecArray | null;
    reParam.lastIndex = 0;
    while ((m = reParam.exec(body)) !== null) {
      const key = m[1];
      const raw = m[2].trim();
      try { args[key] = JSON.parse(raw); } catch { args[key] = raw; }
    }
    if (Object.keys(args).length > 0) calls.push({ name, args });
    return "";
  });

  // Strip Groq/MiMo safety filter warnings
  cleaned = cleaned
    .replace(/The request was rejected because it was considered high risk\.?\s*/gi, "")
    .trim();

  return { calls, cleaned };
}

// ── Rule files ────────────────────────────────────────────────────────────

interface LoadedRuleFile { filename: string; title: string; content: string; }

function loadAllRuleFiles(): LoadedRuleFile[] {
  const rulesDir = path.join(process.cwd(), "rules");
  const results: LoadedRuleFile[] = [];
  try {
    const files = fs.readdirSync(rulesDir).filter(f => /\.(txt|md)$/.test(f));
    const hasSrdCompact = files.includes("srd-compact.txt");
    for (const file of files) {
      if (file === "srd.txt" && hasSrdCompact) continue;
      try {
        const content = fs.readFileSync(path.join(rulesDir, file), "utf-8");
        const title = file.replace(/\.(txt|md)$/, "").replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
        results.push({ filename: file, title, content });
        console.log(`[DM] Loaded rule file: ${file} (${Math.round(content.length / 1024)}KB)`);
      } catch { console.warn(`[DM] Could not load ${file}`); }
    }
  } catch { console.warn("[DM] Rules directory not found"); }
  return results;
}

export const ALL_RULE_FILES = loadAllRuleFiles();

export function loadAvailableMaps(): string[] {
  const mapsDir = path.join(process.cwd(), "maps");
  if (!fs.existsSync(mapsDir)) return [];
  try {
    return fs.readdirSync(mapsDir).filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f)).sort();
  } catch { return []; }
}

export const AVAILABLE_MAPS = loadAvailableMaps();

export function searchRulesText(query: string, maxResults = 6): string {
  if (ALL_RULE_FILES.length === 0) return "No rule files loaded.";
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
  if (keywords.length === 0) return "Please provide search keywords.";

  const scored: { score: number; text: string; source: string }[] = [];
  for (const ruleFile of ALL_RULE_FILES) {
    const sections = ruleFile.content.split(/\n{2,}/);
    for (const section of sections) {
      const trimmed = section.trim();
      if (trimmed.length < 30) continue;
      const lower = trimmed.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        score += (lower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
      }
      if (score > 0) scored.push({ score, text: trimmed, source: ruleFile.filename });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return `No rules found matching: "${query}"`;
  return scored.slice(0, maxResults).map(r => `**[${r.source}]**\n${r.text}`).join("\n\n---\n\n");
}

// ── Context constants ─────────────────────────────────────────────────────

export const CLASS_SAVING_THROWS: Record<string, string[]> = {
  fighter: ["STR", "CON"], wizard: ["INT", "WIS"], cleric: ["WIS", "CHA"],
  rogue: ["DEX", "INT"], ranger: ["STR", "DEX"], paladin: ["WIS", "CHA"],
  barbarian: ["STR", "CON"], bard: ["DEX", "CHA"], druid: ["INT", "WIS"],
  monk: ["STR", "DEX"], sorcerer: ["CON", "CHA"], warlock: ["WIS", "CHA"],
};

export const STAT_KEYS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
export const STAT_SHORT_DM = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

// ── Context builders ──────────────────────────────────────────────────────

export function buildLocalContext(campaignId: number): string {
  const parts: string[] = [];
  const atm = getAtmosphere(campaignId);
  if (atm) {
    parts.push(`[Current Location: ${atm.location} | Time: ${atm.time_of_day} | Weather: ${atm.weather} | Mood: ${atm.mood}]`);
    if (atm.scene) parts.push(`[Scene: ${atm.scene}]`);
  }
  const recentLog = getRecentStory(campaignId, 5);
  if (recentLog.length > 0) {
    const logLines = [...recentLog].reverse().map(e => `• ${e.type}: ${e.content}`);
    parts.push(`[Recent Events]\n${logLines.join("\n")}`);
  }
  const summary = getSessionSummary(campaignId);
  if (summary) parts.push(`[Session Summary so far]\n${summary}`);
  return parts.join("\n\n");
}

const COMBAT_SIGNAL_RE = new RegExp(
  // English
  "\\bcombat\\b|\\battack|\\binitiative\\b|\\bround\\s*\\d|\\bdamage\\b|\\bhit\\s*points\\b|\\broll.*attack|\\bstart.?combat" +
  "|⚔️|🗡️|🏹|💥|🎯" +
  // Thai — fighting actions and descriptions
  "|การต่อสู้|ต่อสู้|โจมตี|ร่ายคาถา|ยิงธนู|ฟัน|แทง|ใช้เวท|ใช้ spell|ร่าย|พลังงาน|ลูกธนู|ดาบ|อาวุธ" +
  "|ศัตรู|มอนสเตอร์|ซอมบี้|โครงกระดูก|ศพ|undead|zombie|skeleton" +
  "|initiative|Round \\d|ลำดับการต่อสู้|เทิร์น|ตาของ",
  "i"
);

export function buildCombatContext(campaignId: number): string {
  const encounter = getActiveCombat(campaignId);

  if (!encounter) {
    // Check last 5 messages (both player and DM) for combat signals
    const recent = getSessionMessages(campaignId);
    const last5 = recent.slice(-5).map(m => m.content).join(" ");
    if (COMBAT_SIGNAL_RE.test(last5)) {
      return [
        "⚠️ SYSTEM ALERT: No active combat in database.",
        "Recent messages indicate combat is happening but start_combat tool was NEVER called.",
        "You MUST call start_combat NOW with all participants and their initiative rolls.",
        "DO NOT write any combat narrative until start_combat is called.",
      ].join(" ");
    }
    return "";
  }

  const participants = parseCombat(encounter);
  const lines = [`Active Combat (Round ${encounter.round}):`];
  participants.forEach((p, i) => {
    const arrow = i === encounter.current_turn_index ? "→ " : "  ";
    lines.push(`${arrow}${p.name}: ${p.hp}/${p.max_hp} HP, AC ${p.ac}${p.conditions.length ? ` [${p.conditions.join(", ")}]` : ""}`);
  });
  return lines.join("\n");
}

export function buildPartyContext(campaignId: number): string {
  const chars = getAllCharacters(campaignId);
  if (chars.length === 0) return "";
  const lines = ["Party:"];
  chars.forEach(c => {
    const multiclass = JSON.parse(c.multiclass || "[]") as { class: string; level: number }[];
    const classDisplay = multiclass.length > 0
      ? `${c.class} ${c.level}/${multiclass.map(m => `${m.class} ${m.level}`).join("/")}`
      : `${c.class} Lv.${c.level}`;
    const subclassDisplay = c.subclass ? ` [${c.subclass}]` : "";
    lines.push(`  ${c.name} (${c.race} ${classDisplay}${subclassDisplay}): ${c.hp}/${c.max_hp} HP, AC ${c.ac}`);
    const statVals = [c.strength, c.dexterity, c.constitution, c.intelligence, c.wisdom, c.charisma];
    const mods = statVals.map((val, i) => {
      const mod = Math.floor(((val ?? 10) - 10) / 2);
      return `${STAT_SHORT_DM[i]}${mod >= 0 ? "+" : ""}${mod}`;
    });
    lines.push(`    Stats: ${mods.join(", ")}`);
    try {
      const profs: string[] = JSON.parse(c.skill_proficiencies || "[]");
      if (profs.length > 0) lines.push(`    Skills: ${profs.join(", ")}`);
    } catch { /* skip */ }
    const saves = CLASS_SAVING_THROWS[c.class.toLowerCase()] ?? [];
    if (saves.length > 0) lines.push(`    Saving Throws: ${saves.join(", ")}`);
    const slots: Record<string, number> = {};
    try { Object.assign(slots, JSON.parse(c.spell_slots || "{}")); } catch { /* skip */ }
    const slotEntries = Object.entries(slots).filter(([, v]) => v > 0);
    if (slotEntries.length > 0) {
      lines.push(`    Spell Slots remaining: ${slotEntries.map(([k, v]) => `L${k}:${v}`).join(" ")}`);
    } else if (Object.keys(slots).length > 0) {
      lines.push(`    Spell Slots: NONE remaining`);
    }
    try {
      const p: Record<string, string> = JSON.parse(c.personality || "{}");
      const pParts: string[] = [];
      if (p.traits)     pParts.push(`Traits: ${p.traits}`);
      if (p.ideals)     pParts.push(`Ideals: ${p.ideals}`);
      if (p.bonds)      pParts.push(`Bonds: ${p.bonds}`);
      if (p.flaws)      pParts.push(`Flaws: ${p.flaws}`);
      if (p.appearance) pParts.push(`Appearance: ${p.appearance}`);
      if (p.backstory)  pParts.push(`Backstory: ${p.backstory}`);
      if (pParts.length > 0) lines.push(`    Personality — ${pParts.join(" | ")}`);
    } catch { /* skip */ }

    // Prepared spells — per class (Wizard / Cleric / Druid / Paladin, main + multiclass)
    {
      const mcEnts: Array<{ class: string }> =
        (() => { try { return JSON.parse(c.multiclass || "[]"); } catch { return []; } })();
      const preparerClasses = [c.class, ...mcEnts.map(m => m.class)].filter(isSpellPreparer);
      if (preparerClasses.length > 0) {
        const preparedByClass = getPreparedSpells(c.id);
        for (const cls of preparerClasses) {
          const list = preparedByClass[cls.toLowerCase()] ?? [];
          if (list.length > 0) {
            lines.push(`    ${cls} prepared (${list.length}): ${list.join(", ")}`);
          } else {
            lines.push(`    ${cls} prepared: NONE — must prepare spells on long rest`);
          }
        }
      }
    }
  });
  return lines.join("\n");
}

export function buildAdventureContext(adventureDataJson: string): string {
  try {
    const data = JSON.parse(adventureDataJson);
    if (!data || typeof data !== "object") return "";
    const parts: string[] = [];
    if (data.title) parts.push(`**${data.title}**`);
    if (data.synopsis) parts.push(data.synopsis);
    if (data.current_scene) parts.push(`Current Scene: ${data.current_scene}`);
    if (data.key_npcs) parts.push(`Key NPCs: ${JSON.stringify(data.key_npcs)}`);
    if (data.locations) parts.push(`Locations: ${JSON.stringify(data.locations)}`);
    return parts.join("\n");
  } catch { return ""; }
}

// ── Level-up helper ───────────────────────────────────────────────────────

export function makeLevelUpEvent(
  char: Character,
  result: { newLevel: number; hpGain: number; needsSubclass: boolean; needsASI: boolean }
): LevelUpEvent {
  return {
    charId: char.id,
    characterName: char.name,
    discordUserId: char.discord_user_id,
    charClass: char.class,
    newLevel: result.newLevel,
    hpGain: result.hpGain,
    needsSubclass: result.needsSubclass,
    needsASI: result.needsASI,
    currentStats: {
      strength: char.strength, dexterity: char.dexterity, constitution: char.constitution,
      intelligence: char.intelligence, wisdom: char.wisdom, charisma: char.charisma,
    },
  };
}

// ── Tool executor ─────────────────────────────────────────────────────────

export async function executeTool(
  campaignId: number,
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolResultSummary> {
  try {
    switch (toolName) {
      case "update_atmosphere": {
        const update: Partial<AtmosphereState> = {};
        if (input.scene) update.scene = input.scene as string;
        if (input.mood) update.mood = input.mood as string;
        if (input.location) update.location = input.location as string;
        if (input.time_of_day) update.time_of_day = input.time_of_day as string;
        if (input.weather) update.weather = input.weather as string;
        if (input.lighting) update.lighting = input.lighting as string;
        if (input.sounds) update.sounds = input.sounds as unknown as string;
        if (input.active_effects) update.active_effects = input.active_effects as unknown as string;
        if (input.current_map !== undefined) update.current_map = input.current_map as string;
        if (input.player_x !== undefined) update.player_x = input.player_x as number;
        if (input.player_y !== undefined) update.player_y = input.player_y as number;
        updateAtmosphere(campaignId, update);
        broadcast(campaignId, "atmosphere", { ...update, campaignId });
        return { tool: toolName, success: true, message: `Atmosphere updated: ${input.scene ?? input.location ?? input.mood}` };
      }

      case "start_combat": {
        const rawParticipants = input.participants as CombatParticipant[];
        const participants = rawParticipants.map(p => ({ ...p, conditions: p.conditions ?? [], took_turn: false }));
        const combatId = startCombat(campaignId, participants);
        broadcast(campaignId, "combat_start", { campaignId, combatId });
        updateAtmosphere(campaignId, { mood: "tense" });
        // Broadcast full combat state so web overlay populates immediately
        const sorted = [...participants].sort((a, b) => b.initiative - a.initiative);
        broadcast(campaignId, "combat_update", {
          active: true, round: 1, current_turn_index: 0, participants: sorted,
        });
        const orderStr = sorted.map((p, i) => `${i + 1}. ${p.name} (initiative ${p.initiative})`).join(", ");
        return { tool: toolName, success: true, message: `Combat started. ACTUAL turn order (use this in narrative): ${orderStr}` };
      }

      case "apply_damage": {
        const result = applyDamage(campaignId, input.target_name as string, input.damage as number, input.damage_type as string);
        if (!result) return { tool: toolName, success: false, message: `Target '${input.target_name}' not found in combat` };
        const msg = result.died
          ? `${input.target_name} took ${input.damage} damage and has fallen! (${result.participant.hp}/${result.participant.max_hp} HP)`
          : `${input.target_name} took ${input.damage} damage (${result.participant.hp}/${result.participant.max_hp} HP remaining)`;
        broadcast(campaignId, "hp_update", { name: input.target_name, hp: result.participant.hp, max_hp: result.participant.max_hp, died: result.died });
        return { tool: toolName, success: true, message: msg };
      }

      case "apply_healing": {
        const healed = applyHealing(campaignId, input.target_name as string, input.amount as number);
        if (!healed) return { tool: toolName, success: false, message: `Target '${input.target_name}' not found` };
        broadcast(campaignId, "hp_update", { name: input.target_name, hp: healed.hp, max_hp: healed.max_hp, died: false });
        return { tool: toolName, success: true, message: `${input.target_name} healed for ${input.amount} HP (${healed.hp}/${healed.max_hp} HP)` };
      }

      case "end_combat": {
        finishCombat(campaignId);
        broadcast(campaignId, "combat_end", { campaignId, outcome: input.outcome });
        let xpMsg = `Combat ended: ${input.outcome}`;
        const totalXp = input.xp_reward as number | undefined;
        const combatLevelUpEvents: LevelUpEvent[] = [];
        if (totalXp && totalXp > 0) {
          const characters = getAllCharacters(campaignId);
          if (characters.length > 0) {
            const xpEach = Math.floor(totalXp / characters.length);
            const xpResults: string[] = [];
            for (const char of characters) {
              const result = updateCharacterXp(char.id, xpEach);
              const lvlMsg = result.leveledUp ? ` (LEVEL UP → ${result.newLevel}! +${result.hpGain} max HP)` : "";
              xpResults.push(`${char.name}: +${xpEach}${lvlMsg}`);
              broadcast(campaignId, "xp_award", { name: char.name, amount: xpEach, newLevel: result.newLevel, leveledUp: result.leveledUp, hpGain: result.hpGain });
              if (result.leveledUp) combatLevelUpEvents.push(makeLevelUpEvent(char, result));
            }
            xpMsg += `. XP split ${xpEach} each (${totalXp} total): ${xpResults.join(", ")}`;
          }
          addStoryLog(campaignId, "combat", `Combat ended: ${input.outcome}. XP reward: ${totalXp}`);
        } else {
          addStoryLog(campaignId, "combat", `Combat ended: ${input.outcome}`);
        }
        return { tool: toolName, success: true, message: xpMsg, levelUpEvents: combatLevelUpEvents.length > 0 ? combatLevelUpEvents : undefined };
      }

      case "award_xp": {
        const characters = getAllCharacters(campaignId);
        const char = characters.find(c => c.name.toLowerCase() === (input.character_name as string).toLowerCase());
        if (!char) return { tool: toolName, success: false, message: `Character '${input.character_name}' not found` };
        const result = updateCharacterXp(char.id, input.amount as number);
        const levelMsg = result.leveledUp ? ` 🎉 LEVEL UP! Now level ${result.newLevel}! (+${result.hpGain} max HP)` : "";
        broadcast(campaignId, "xp_award", { name: input.character_name, amount: input.amount, newLevel: result.newLevel, leveledUp: result.leveledUp, hpGain: result.hpGain });
        const levelUpEvents = result.leveledUp ? [makeLevelUpEvent(char, result)] : undefined;
        return { tool: toolName, success: true, message: `${input.character_name} gained ${input.amount} XP (total: ${result.newXp})${levelMsg}`, levelUpEvents };
      }

      case "add_story_log": {
        addStoryLog(campaignId, input.type as string, input.content as string);
        return { tool: toolName, success: true, message: `Story logged: [${input.type}] ${(input.content as string).substring(0, 60)}...` };
      }

      case "roll_dice": {
        const result = rollDice(input.expression as string);
        const isSecret = (input.secret as boolean) ?? false;
        if (!isSecret) {
          broadcast(campaignId, "dice_roll", { expression: input.expression, result: result.total, breakdown: result.breakdown, purpose: input.purpose });
        }
        return { tool: toolName, success: true, message: `${input.purpose}: ${result.breakdown} (total: ${result.total})${isSecret ? " [secret]" : ""}` };
      }

      case "request_roll": {
        const rollId = Math.random().toString(36).slice(2, 10);
        const charName = input.character_name as string;
        const chars = getAllCharacters(campaignId);
        const owner = chars.find(c => c.name.toLowerCase() === charName.toLowerCase());
        const pendingRoll: PendingRoll = {
          rollId, campaignId, characterName: charName,
          expression: input.expression as string,
          purpose: input.purpose as string,
          dc: input.dc as number | undefined,
          advantage: ((input.advantage as string) ?? "normal") as PendingRoll["advantage"],
          ownerDiscordId: owner?.discord_user_id,
        };
        setPendingRoll(rollId, pendingRoll);
        return {
          tool: toolName, success: true,
          message: `Roll request sent. Waiting for ${pendingRoll.characterName} to roll ${pendingRoll.expression} for ${pendingRoll.purpose}.`,
          pendingRoll,
        };
      }

      case "request_party_roll": {
        const groupId = Math.random().toString(36).slice(2, 10);
        const chars = getAllCharacters(campaignId);
        if (chars.length === 0) return { tool: toolName, success: false, message: "No characters in the party." };
        const entries: PartyRollEntry[] = chars.map(c => ({ characterName: c.name, discordUserId: c.discord_user_id, rolled: false }));
        const pendingPartyRoll: PendingPartyRoll = {
          groupId, campaignId,
          expression: input.expression as string,
          purpose: input.purpose as string,
          dc: input.dc as number | undefined,
          advantage: ((input.advantage as string) ?? "normal") as PendingPartyRoll["advantage"],
          mode: ((input.mode as string) ?? "individual") as PendingPartyRoll["mode"],
          entries,
        };
        setPendingPartyRoll(groupId, pendingPartyRoll);
        return {
          tool: toolName, success: true,
          message: `Party roll request sent for ${entries.length} characters (${entries.map(e => e.characterName).join(", ")}).`,
          pendingPartyRoll,
        };
      }

      case "add_item": {
        const characters = getAllCharacters(campaignId);
        const char = characters.find(c => c.name.toLowerCase() === (input.character_name as string).toLowerCase());
        if (!char) return { tool: toolName, success: false, message: `Character '${input.character_name}' not found` };
        addInventoryItem(char.id, {
          name: input.item_name as string,
          description: (input.description as string) ?? "",
          quantity: (input.quantity as number) ?? 1,
          type: (input.item_type as string) ?? "misc",
          value: (input.value as number) ?? 0,
          weight: (input.weight as number) ?? 0,
          equipped: 0,
        });
        broadcast(campaignId, "inventory_update", { character: char.name, action: "add", item: input.item_name });
        return { tool: toolName, success: true, message: `${input.character_name} received: ${input.item_name} x${(input.quantity as number) ?? 1}` };
      }

      case "remove_item": {
        const characters = getAllCharacters(campaignId);
        const char = characters.find(c => c.name.toLowerCase() === (input.character_name as string).toLowerCase());
        if (!char) return { tool: toolName, success: false, message: `Character '${input.character_name}' not found` };
        const removed = removeInventoryItem(char.id, input.item_name as string, input.quantity as number | undefined);
        if (!removed) return { tool: toolName, success: false, message: `Item '${input.item_name}' not found in ${input.character_name}'s inventory` };
        broadcast(campaignId, "inventory_update", { character: char.name, action: "remove", item: input.item_name });
        return { tool: toolName, success: true, message: `${input.character_name} lost/used: ${input.item_name}${input.quantity ? ` x${input.quantity}` : ""}` };
      }

      case "use_spell_slot": {
        const chars = getAllCharacters(campaignId);
        const char = chars.find(c => c.name.toLowerCase() === (input.character_name as string).toLowerCase());
        if (!char) return { tool: toolName, success: false, message: `Character '${input.character_name}' not found` };

        // Prepared-spell validation for Wizard / Cleric / Druid / Paladin (main + multiclass)
        const spellName = (input.spell_name as string ?? "").trim();
        const mcEntries: Array<{ class: string }> =
          (() => { try { return JSON.parse(char.multiclass || "[]"); } catch { return []; } })();
        const anyPreparer = isSpellPreparer(char.class) ||
          mcEntries.some(mc => isSpellPreparer(mc.class));
        if (spellName && anyPreparer) {
          const preparedByClass = getPreparedSpells(char.id);
          const allPrepared = Object.values(preparedByClass).flat();
          if (allPrepared.length > 0) {
            const isCantrip = (input.slot_level as number) === 0;
            const spellPrepared = allPrepared.some(p => p.toLowerCase() === spellName.toLowerCase());
            if (!isCantrip && !spellPrepared) {
              const summary = Object.entries(preparedByClass)
                .map(([cls, list]) => `${cls}: ${list.join(", ")}`)
                .join(" | ");
              return {
                tool: toolName, success: false,
                message: `${input.character_name} has not prepared "${spellName}". Prepared — ${summary}. They must prepare this spell during a long rest first.`,
              };
            }
          }
        }

        const result = useSpellSlot(char.id, input.slot_level as number);
        if (!result) return { tool: toolName, success: false, message: `${input.character_name} has no level ${input.slot_level} spell slot remaining — cannot cast ${input.spell_name}` };
        broadcast(campaignId, "spell_slot_used", { character: input.character_name, level: input.slot_level, remaining: result.remaining, spell: input.spell_name });
        return { tool: toolName, success: true, message: `${input.character_name} cast ${input.spell_name} using a level ${input.slot_level} slot. Level ${input.slot_level} slots remaining: ${result.remaining}` };
      }

      case "long_rest": {
        longRestHeal(campaignId);
        restoreAllSpellSlots(campaignId);
        const chars = getAllCharacters(campaignId);
        broadcast(campaignId, "long_rest", { description: (input.description as string) ?? "Long rest" });
        broadcast(campaignId, "party_update", chars.map(c => ({
          id: c.id, name: c.name, class: c.class, race: c.race,
          level: c.level, hp: c.max_hp, max_hp: c.max_hp, ac: c.ac, is_player: true, avatar: c.avatar ?? "",
          spell_slots: (() => { try { return JSON.parse(c.spell_slots || "{}"); } catch { return {}; } })(),
        })));
        const summary = chars.map(c => `${c.name}: ${c.max_hp}/${c.max_hp} HP (full)`).join(", ");
        addStoryLog(campaignId, "narrative", `Long rest: ${(input.description as string) ?? "Party rested for the night"}`);
        return { tool: toolName, success: true, message: `Long rest complete. All HP and spell slots restored. ${summary}` };
      }

      case "short_rest": {
        const restoredWarlocks = shortRestWarlockSlots(campaignId);
        broadcast(campaignId, "short_rest", { description: (input.description as string) ?? "Short rest" });
        const warlockMsg = restoredWarlocks.length > 0 ? ` Warlock Pact Magic slots restored for: ${restoredWarlocks.join(", ")}.` : "";
        addStoryLog(campaignId, "narrative", `Short rest: ${(input.description as string) ?? "Party took a short rest"}`);
        return { tool: toolName, success: true, message: `Short rest complete.${warlockMsg} Players may spend Hit Dice to recover HP — call apply_healing for any HP recovered.` };
      }

      case "search_rules": {
        const result = searchRulesText(input.query as string);
        return { tool: toolName, success: true, message: result };
      }

      default:
        return { tool: toolName, success: false, message: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { tool: toolName, success: false, message: `Error in ${toolName}: ${msg}` };
  }
}
