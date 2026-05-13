export type StatName = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";
export const STAT_NAMES: StatName[] = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
export const STAT_SHORT: Record<StatName, string> = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA"
};

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
};

// ── Races ─────────────────────────────────────────────────────────────────

export interface RaceData {
  name: string;
  display: string;
  bonuses: Partial<Record<StatName, number>>;
  speed: number;
  traits: string[];
  size: string;
}

export const RACES: Record<string, RaceData> = {
  "human":            { name: "human",           display: "Human",             bonuses: { strength:1, dexterity:1, constitution:1, intelligence:1, wisdom:1, charisma:1 }, speed:30, size:"Medium", traits:["Extra Language", "Extra Skill Proficiency"] },
  "high-elf":         { name: "high-elf",         display: "High Elf",          bonuses: { dexterity:2, intelligence:1 },  speed:30, size:"Medium", traits:["Darkvision 60ft", "Fey Ancestry", "Trance", "Keen Senses", "+1 Cantrip (Wizard list)"] },
  "wood-elf":         { name: "wood-elf",         display: "Wood Elf",          bonuses: { dexterity:2, wisdom:1 },        speed:35, size:"Medium", traits:["Darkvision 60ft", "Fey Ancestry", "Trance", "Mask of the Wild", "Fleet of Foot"] },
  "hill-dwarf":       { name: "hill-dwarf",       display: "Hill Dwarf",        bonuses: { constitution:2, wisdom:1 },     speed:25, size:"Medium", traits:["Darkvision 60ft", "Dwarven Resilience", "Stonecunning", "Dwarven Toughness (+1 HP/level)"] },
  "mountain-dwarf":   { name: "mountain-dwarf",   display: "Mountain Dwarf",    bonuses: { strength:2, constitution:2 },   speed:25, size:"Medium", traits:["Darkvision 60ft", "Dwarven Resilience", "Stonecunning", "Armor Training"] },
  "lightfoot-halfling":{ name:"lightfoot-halfling",display:"Lightfoot Halfling", bonuses: { dexterity:2, charisma:1 },      speed:25, size:"Small",  traits:["Lucky (reroll 1s)", "Brave", "Halfling Nimbleness", "Naturally Stealthy"] },
  "stout-halfling":   { name: "stout-halfling",   display: "Stout Halfling",    bonuses: { dexterity:2, constitution:1 },  speed:25, size:"Small",  traits:["Lucky (reroll 1s)", "Brave", "Halfling Nimbleness", "Stout Resilience (poison resistance)"] },
  "half-elf":         { name: "half-elf",         display: "Half-Elf",          bonuses: { charisma:2, dexterity:1, wisdom:1 }, speed:30, size:"Medium", traits:["Darkvision 60ft", "Fey Ancestry", "+2 Skill Proficiencies"] },
  "half-orc":         { name: "half-orc",         display: "Half-Orc",          bonuses: { strength:2, constitution:1 },   speed:30, size:"Medium", traits:["Darkvision 60ft", "Menacing (Intimidation prof.)", "Relentless Endurance", "Savage Attacks"] },
  "forest-gnome":     { name: "forest-gnome",     display: "Forest Gnome",      bonuses: { intelligence:2, dexterity:1 },  speed:25, size:"Small",  traits:["Darkvision 60ft", "Gnome Cunning (Adv. on Int/Wis/Cha vs magic)", "Natural Illusionist", "Speak with Animals"] },
  "rock-gnome":       { name: "rock-gnome",       display: "Rock Gnome",        bonuses: { intelligence:2, constitution:1 },speed:25, size:"Small",  traits:["Darkvision 60ft", "Gnome Cunning", "Artificer Lore", "Tinker"] },
  "tiefling":         { name: "tiefling",         display: "Tiefling",          bonuses: { charisma:2, intelligence:1 },   speed:30, size:"Medium", traits:["Darkvision 60ft", "Hellish Resistance (fire)", "Infernal Legacy (Thaumaturgy/Hellish Rebuke/Darkness)"] },
  "dragonborn":       { name: "dragonborn",       display: "Dragonborn",        bonuses: { strength:2, charisma:1 },       speed:30, size:"Medium", traits:["Draconic Ancestry", "Breath Weapon (chosen element)", "Damage Resistance (chosen element)"] },
};

// ── Race sub-options (choices required at character creation) ─────────────

export interface RaceSubOption {
  id: string;
  label: string;
  desc: string;  // e.g. damage type · shape · save
}

export interface RaceOptionGroup {
  label: string;           // e.g. "Draconic Ancestry"
  choices: RaceSubOption[];
}

export const RACE_OPTIONS: Record<string, RaceOptionGroup> = {
  dragonborn: {
    label: "Draconic Ancestry",
    choices: [
      { id: "black",  label: "⬛ Black",  desc: "Acid · 5×30ft line · Dex save" },
      { id: "blue",   label: "🔵 Blue",   desc: "Lightning · 5×30ft line · Dex save" },
      { id: "brass",  label: "🟤 Brass",  desc: "Fire · 5×30ft line · Dex save" },
      { id: "bronze", label: "🟠 Bronze", desc: "Lightning · 5×30ft line · Dex save" },
      { id: "copper", label: "🟫 Copper", desc: "Acid · 5×30ft line · Dex save" },
      { id: "gold",   label: "⭐ Gold",   desc: "Fire · 15ft cone · Dex save" },
      { id: "green",  label: "🟢 Green",  desc: "Poison · 15ft cone · Con save" },
      { id: "red",    label: "🔴 Red",    desc: "Fire · 15ft cone · Dex save" },
      { id: "silver", label: "⚪ Silver", desc: "Cold · 15ft cone · Con save" },
      { id: "white",  label: "🤍 White",  desc: "Cold · 15ft cone · Con save" },
    ],
  },
};

// ── Classes ───────────────────────────────────────────────────────────────

export interface StartingItem {
  name: string;
  type: "weapon" | "armor" | "gear" | "ammo" | "focus" | "shield";
  quantity: number;
  description: string;  // weapon: "1d8 slashing • versatile (1d10)", armor: "AC 16"
  value: number;        // gp
  weight: number;       // lb
  equipped: 0 | 1;
}

export interface ClassData {
  name: string;
  hitDie: number;
  primaryStats: StatName[];
  savingThrows: StatName[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  startingEquipment: string;
  startingItems: StartingItem[];
  level1Features: string[];
  spellcaster: boolean;
  spellcastingStat?: StatName;
}

export const CLASSES: Record<string, ClassData> = {
  barbarian: {
    name: "barbarian", hitDie: 12, primaryStats: ["strength","constitution","dexterity"],
    savingThrows: ["strength","constitution"],
    armorProficiencies: ["Light","Medium","Shields"],
    weaponProficiencies: ["Simple weapons","Martial weapons"],
    startingEquipment: "Greataxe or martial melee weapon, 2 handaxes, explorer's pack, 4 javelins",
    startingItems: [
      { name: "Greataxe",      type: "weapon", quantity: 1, description: "1d12 slashing • heavy, two-handed",          value: 30, weight: 7,  equipped: 1 },
      { name: "Handaxe",       type: "weapon", quantity: 2, description: "1d6 slashing • light, thrown (20/60 ft)",    value: 5,  weight: 2,  equipped: 0 },
      { name: "Javelin",       type: "weapon", quantity: 4, description: "1d6 piercing • thrown (30/120 ft)",          value: 1,  weight: 2,  equipped: 0 },
      { name: "Explorer's Pack", type: "gear", quantity: 1, description: "Backpack, bedroll, rations (10), rope, etc.", value: 10, weight: 59, equipped: 0 },
    ],
    level1Features: ["Rage (2/long rest, +2 damage)", "Unarmored Defense (10 + DEX + CON)"],
    spellcaster: false
  },
  bard: {
    name: "bard", hitDie: 8, primaryStats: ["charisma","dexterity","constitution"],
    savingThrows: ["dexterity","charisma"],
    armorProficiencies: ["Light"],
    weaponProficiencies: ["Simple weapons","Hand crossbows","Longswords","Rapiers","Shortswords"],
    startingEquipment: "Rapier or longsword, diplomat's or entertainer's pack, leather armor, dagger",
    startingItems: [
      { name: "Rapier",        type: "weapon", quantity: 1, description: "1d8 piercing • finesse",                     value: 25, weight: 2,  equipped: 1 },
      { name: "Dagger",        type: "weapon", quantity: 1, description: "1d4 piercing • finesse, light, thrown (20/60 ft)", value: 2, weight: 1, equipped: 0 },
      { name: "Leather Armor", type: "armor",  quantity: 1, description: "AC 11+DEX",                                  value: 10, weight: 10, equipped: 1 },
      { name: "Diplomat's Pack", type: "gear", quantity: 1, description: "Chest, fine clothes, ink, paper, etc.",       value: 39, weight: 36, equipped: 0 },
    ],
    level1Features: ["Spellcasting (CHA)", "Bardic Inspiration 1d6 (CHA mod/long rest)"],
    spellcaster: true, spellcastingStat: "charisma"
  },
  cleric: {
    name: "cleric", hitDie: 8, primaryStats: ["wisdom","constitution","strength"],
    savingThrows: ["wisdom","charisma"],
    armorProficiencies: ["Light","Medium","Shields"],
    weaponProficiencies: ["Simple weapons"],
    startingEquipment: "Mace or warhammer, scale mail or leather, light crossbow + 20 bolts, priest's pack, shield, holy symbol",
    startingItems: [
      { name: "Mace",          type: "weapon", quantity: 1, description: "1d6 bludgeoning",                            value: 5,  weight: 4,  equipped: 1 },
      { name: "Scale Mail",    type: "armor",  quantity: 1, description: "AC 14+DEX (max +2)",                         value: 50, weight: 45, equipped: 1 },
      { name: "Shield",        type: "shield", quantity: 1, description: "+2 AC",                                      value: 10, weight: 6,  equipped: 1 },
      { name: "Light Crossbow",type: "weapon", quantity: 1, description: "1d8 piercing • range 80/320 ft, two-handed", value: 25, weight: 5,  equipped: 0 },
      { name: "Bolts",         type: "ammo",   quantity: 20, description: "Ammunition for crossbow",                   value: 1,  weight: 1,  equipped: 0 },
      { name: "Holy Symbol",   type: "focus",  quantity: 1, description: "Divine spellcasting focus",                  value: 5,  weight: 1,  equipped: 1 },
      { name: "Priest's Pack", type: "gear",   quantity: 1, description: "Backpack, blanket, candles, rations, etc.",  value: 19, weight: 24, equipped: 0 },
    ],
    level1Features: ["Spellcasting (WIS)", "Divine Domain (chosen subclass)", "Channel Divinity (1/rest)"],
    spellcaster: true, spellcastingStat: "wisdom"
  },
  druid: {
    name: "druid", hitDie: 8, primaryStats: ["wisdom","constitution","intelligence"],
    savingThrows: ["intelligence","wisdom"],
    armorProficiencies: ["Light","Medium","Shields (non-metal)"],
    weaponProficiencies: ["Clubs","Daggers","Darts","Javelins","Maces","Quarterstaffs","Scimitars","Sickles","Slings","Spears"],
    startingEquipment: "Wooden shield, scimitar or melee weapon, leather armor, explorer's pack, druidic focus",
    startingItems: [
      { name: "Scimitar",      type: "weapon", quantity: 1, description: "1d6 slashing • finesse, light",              value: 25, weight: 3,  equipped: 1 },
      { name: "Wooden Shield", type: "shield", quantity: 1, description: "+2 AC",                                      value: 10, weight: 6,  equipped: 1 },
      { name: "Leather Armor", type: "armor",  quantity: 1, description: "AC 11+DEX",                                  value: 10, weight: 10, equipped: 1 },
      { name: "Druidic Focus", type: "focus",  quantity: 1, description: "Nature spellcasting focus",                  value: 1,  weight: 1,  equipped: 1 },
      { name: "Explorer's Pack", type: "gear", quantity: 1, description: "Backpack, bedroll, rations (10), rope, etc.", value: 10, weight: 59, equipped: 0 },
    ],
    level1Features: ["Spellcasting (WIS)", "Druidic (secret language)"],
    spellcaster: true, spellcastingStat: "wisdom"
  },
  fighter: {
    name: "fighter", hitDie: 10, primaryStats: ["strength","constitution","dexterity"],
    savingThrows: ["strength","constitution"],
    armorProficiencies: ["Light","Medium","Heavy","Shields"],
    weaponProficiencies: ["Simple weapons","Martial weapons"],
    startingEquipment: "Chain mail or leather + longbow + 20 arrows, martial weapon + shield or two martial weapons, light crossbow + 20 bolts or 2 handaxes, dungeoneer's or explorer's pack",
    startingItems: [
      { name: "Longsword",     type: "weapon", quantity: 1, description: "1d8 slashing • versatile (1d10)",            value: 15, weight: 3,  equipped: 1 },
      { name: "Shield",        type: "shield", quantity: 1, description: "+2 AC",                                      value: 10, weight: 6,  equipped: 1 },
      { name: "Chain Mail",    type: "armor",  quantity: 1, description: "AC 16 • disadvantage on Stealth",            value: 75, weight: 55, equipped: 1 },
      { name: "Light Crossbow",type: "weapon", quantity: 1, description: "1d8 piercing • range 80/320 ft, two-handed", value: 25, weight: 5,  equipped: 0 },
      { name: "Bolts",         type: "ammo",   quantity: 20, description: "Ammunition for crossbow",                   value: 1,  weight: 1,  equipped: 0 },
      { name: "Dungeoneer's Pack", type: "gear", quantity: 1, description: "Backpack, crowbar, hammer, torches, rations, etc.", value: 12, weight: 61, equipped: 0 },
    ],
    level1Features: ["Fighting Style (chosen)", "Second Wind (1d10+level HP, 1/short rest)"],
    spellcaster: false
  },
  monk: {
    name: "monk", hitDie: 8, primaryStats: ["dexterity","wisdom","constitution"],
    savingThrows: ["strength","dexterity"],
    armorProficiencies: [],
    weaponProficiencies: ["Simple weapons","Shortswords"],
    startingEquipment: "Shortsword or simple weapon, dungeoneer's pack or explorer's pack, 10 darts",
    startingItems: [
      { name: "Shortsword",    type: "weapon", quantity: 1, description: "1d6 piercing • finesse, light",              value: 10, weight: 2,  equipped: 1 },
      { name: "Dart",          type: "weapon", quantity: 10, description: "1d4 piercing • finesse, thrown (20/60 ft)", value: 0,  weight: 0,  equipped: 0 },
      { name: "Dungeoneer's Pack", type: "gear", quantity: 1, description: "Backpack, crowbar, hammer, torches, rations, etc.", value: 12, weight: 61, equipped: 0 },
    ],
    level1Features: ["Unarmored Defense (10 + DEX + WIS)", "Martial Arts (1d4 unarmed, bonus unarmed attack)"],
    spellcaster: false
  },
  paladin: {
    name: "paladin", hitDie: 10, primaryStats: ["strength","charisma","constitution"],
    savingThrows: ["wisdom","charisma"],
    armorProficiencies: ["Light","Medium","Heavy","Shields"],
    weaponProficiencies: ["Simple weapons","Martial weapons"],
    startingEquipment: "Martial weapon + shield or two martial weapons, 5 javelins or simple melee weapon, priest's pack or explorer's pack, chain mail, holy symbol",
    startingItems: [
      { name: "Longsword",     type: "weapon", quantity: 1, description: "1d8 slashing • versatile (1d10)",            value: 15, weight: 3,  equipped: 1 },
      { name: "Shield",        type: "shield", quantity: 1, description: "+2 AC",                                      value: 10, weight: 6,  equipped: 1 },
      { name: "Chain Mail",    type: "armor",  quantity: 1, description: "AC 16 • disadvantage on Stealth",            value: 75, weight: 55, equipped: 1 },
      { name: "Javelin",       type: "weapon", quantity: 5, description: "1d6 piercing • thrown (30/120 ft)",          value: 1,  weight: 2,  equipped: 0 },
      { name: "Holy Symbol",   type: "focus",  quantity: 1, description: "Divine spellcasting focus",                  value: 5,  weight: 1,  equipped: 1 },
      { name: "Priest's Pack", type: "gear",   quantity: 1, description: "Backpack, blanket, candles, rations, etc.",  value: 19, weight: 24, equipped: 0 },
    ],
    level1Features: ["Divine Sense (1 + CHA mod/day)", "Lay on Hands (5 HP pool/long rest)"],
    spellcaster: true, spellcastingStat: "charisma"
  },
  ranger: {
    name: "ranger", hitDie: 10, primaryStats: ["dexterity","wisdom","constitution"],
    savingThrows: ["strength","dexterity"],
    armorProficiencies: ["Light","Medium","Shields"],
    weaponProficiencies: ["Simple weapons","Martial weapons"],
    startingEquipment: "Scale mail or leather armor, two shortswords or two simple melee weapons, dungeoneer's or explorer's pack, longbow + quiver of 20 arrows",
    startingItems: [
      { name: "Shortsword",    type: "weapon", quantity: 2, description: "1d6 piercing • finesse, light",              value: 10, weight: 2,  equipped: 1 },
      { name: "Longbow",       type: "weapon", quantity: 1, description: "1d8 piercing • range 150/600 ft, two-handed",value: 50, weight: 2,  equipped: 0 },
      { name: "Arrows",        type: "ammo",   quantity: 20, description: "Ammunition for bow",                        value: 1,  weight: 1,  equipped: 0 },
      { name: "Scale Mail",    type: "armor",  quantity: 1, description: "AC 14+DEX (max +2)",                         value: 50, weight: 45, equipped: 1 },
      { name: "Dungeoneer's Pack", type: "gear", quantity: 1, description: "Backpack, crowbar, hammer, torches, rations, etc.", value: 12, weight: 61, equipped: 0 },
    ],
    level1Features: ["Favored Enemy (2 types)", "Natural Explorer (1 favored terrain)"],
    spellcaster: true, spellcastingStat: "wisdom"
  },
  rogue: {
    name: "rogue", hitDie: 8, primaryStats: ["dexterity","charisma","intelligence"],
    savingThrows: ["dexterity","intelligence"],
    armorProficiencies: ["Light"],
    weaponProficiencies: ["Simple weapons","Hand crossbows","Longswords","Rapiers","Shortswords"],
    startingEquipment: "Rapier or shortsword, shortbow + quiver of 20 arrows or shortsword, burglar's/dungeoneer's/explorer's pack, leather armor, 2 daggers, thieves' tools",
    startingItems: [
      { name: "Rapier",        type: "weapon", quantity: 1, description: "1d8 piercing • finesse",                     value: 25, weight: 2,  equipped: 1 },
      { name: "Shortbow",      type: "weapon", quantity: 1, description: "1d6 piercing • range 80/320 ft, two-handed", value: 25, weight: 2,  equipped: 0 },
      { name: "Arrows",        type: "ammo",   quantity: 20, description: "Ammunition for bow",                        value: 1,  weight: 1,  equipped: 0 },
      { name: "Dagger",        type: "weapon", quantity: 2, description: "1d4 piercing • finesse, light, thrown (20/60 ft)", value: 2, weight: 1, equipped: 0 },
      { name: "Leather Armor", type: "armor",  quantity: 1, description: "AC 11+DEX",                                  value: 10, weight: 10, equipped: 1 },
      { name: "Thieves' Tools",type: "gear",   quantity: 1, description: "Lockpicking & trap disarming tools",         value: 25, weight: 1,  equipped: 0 },
      { name: "Burglar's Pack",type: "gear",   quantity: 1, description: "Backpack, ball bearings, string, bell, candles, etc.", value: 16, weight: 47, equipped: 0 },
    ],
    level1Features: ["Expertise (2 skills, double proficiency)", "Sneak Attack 1d6", "Thieves' Cant"],
    spellcaster: false
  },
  sorcerer: {
    name: "sorcerer", hitDie: 6, primaryStats: ["charisma","constitution","dexterity"],
    savingThrows: ["constitution","charisma"],
    armorProficiencies: [],
    weaponProficiencies: ["Daggers","Darts","Slings","Quarterstaffs","Light crossbows"],
    startingEquipment: "Light crossbow + 20 bolts or simple weapon, component pouch or arcane focus, dungeoneer's or explorer's pack, 2 daggers",
    startingItems: [
      { name: "Light Crossbow",type: "weapon", quantity: 1, description: "1d8 piercing • range 80/320 ft, two-handed", value: 25, weight: 5,  equipped: 0 },
      { name: "Bolts",         type: "ammo",   quantity: 20, description: "Ammunition for crossbow",                   value: 1,  weight: 1,  equipped: 0 },
      { name: "Dagger",        type: "weapon", quantity: 2, description: "1d4 piercing • finesse, light, thrown (20/60 ft)", value: 2, weight: 1, equipped: 1 },
      { name: "Component Pouch", type: "focus", quantity: 1, description: "Arcane spellcasting focus",                 value: 25, weight: 2,  equipped: 1 },
      { name: "Dungeoneer's Pack", type: "gear", quantity: 1, description: "Backpack, crowbar, hammer, torches, rations, etc.", value: 12, weight: 61, equipped: 0 },
    ],
    level1Features: ["Spellcasting (CHA)", "Sorcerous Origin (subclass chosen at Lv1)", "Font of Magic (Sorcery Points at Lv2)"],
    spellcaster: true, spellcastingStat: "charisma"
  },
  warlock: {
    name: "warlock", hitDie: 8, primaryStats: ["charisma","constitution","dexterity"],
    savingThrows: ["wisdom","charisma"],
    armorProficiencies: ["Light"],
    weaponProficiencies: ["Simple weapons"],
    startingEquipment: "Light crossbow + 20 bolts or simple weapon, component pouch or arcane focus, scholar's or dungeoneer's pack, leather armor, any simple weapon, 2 daggers",
    startingItems: [
      { name: "Light Crossbow",type: "weapon", quantity: 1, description: "1d8 piercing • range 80/320 ft, two-handed", value: 25, weight: 5,  equipped: 0 },
      { name: "Bolts",         type: "ammo",   quantity: 20, description: "Ammunition for crossbow",                   value: 1,  weight: 1,  equipped: 0 },
      { name: "Dagger",        type: "weapon", quantity: 2, description: "1d4 piercing • finesse, light, thrown (20/60 ft)", value: 2, weight: 1, equipped: 1 },
      { name: "Leather Armor", type: "armor",  quantity: 1, description: "AC 11+DEX",                                  value: 10, weight: 10, equipped: 1 },
      { name: "Component Pouch", type: "focus", quantity: 1, description: "Arcane spellcasting focus",                 value: 25, weight: 2,  equipped: 1 },
      { name: "Scholar's Pack", type: "gear",  quantity: 1, description: "Backpack, book, ink, parchment, sand, knife, etc.", value: 40, weight: 11, equipped: 0 },
    ],
    level1Features: ["Otherworldly Patron (subclass)", "Pact Magic (short rest spell slots)", "Eldritch Blast cantrip"],
    spellcaster: true, spellcastingStat: "charisma"
  },
  wizard: {
    name: "wizard", hitDie: 6, primaryStats: ["intelligence","constitution","dexterity"],
    savingThrows: ["intelligence","wisdom"],
    armorProficiencies: [],
    weaponProficiencies: ["Daggers","Darts","Slings","Quarterstaffs","Light crossbows"],
    startingEquipment: "Quarterstaff or dagger, component pouch or arcane focus, scholar's or explorer's pack, spellbook",
    startingItems: [
      { name: "Quarterstaff",  type: "weapon", quantity: 1, description: "1d6 bludgeoning • versatile (1d8)",          value: 2,  weight: 4,  equipped: 1 },
      { name: "Dagger",        type: "weapon", quantity: 1, description: "1d4 piercing • finesse, light, thrown (20/60 ft)", value: 2, weight: 1, equipped: 0 },
      { name: "Component Pouch", type: "focus", quantity: 1, description: "Arcane spellcasting focus",                 value: 25, weight: 2,  equipped: 1 },
      { name: "Spellbook",     type: "gear",   quantity: 1, description: "Contains wizard spells (6 Lv1 spells)",      value: 50, weight: 3,  equipped: 1 },
      { name: "Scholar's Pack", type: "gear",  quantity: 1, description: "Backpack, book, ink, parchment, sand, knife, etc.", value: 40, weight: 11, equipped: 0 },
    ],
    level1Features: ["Spellcasting (INT)", "Arcane Recovery (1/day, regain spell slots on short rest)"],
    spellcaster: true, spellcastingStat: "intelligence"
  }
};

// ── Skills ───────────────────────────────────────────────────────────────

export const SKILLS: Record<string, StatName> = {
  "Acrobatics":      "dexterity",
  "Animal Handling": "wisdom",
  "Arcana":          "intelligence",
  "Athletics":       "strength",
  "Deception":       "charisma",
  "History":         "intelligence",
  "Insight":         "wisdom",
  "Intimidation":    "charisma",
  "Investigation":   "intelligence",
  "Medicine":        "wisdom",
  "Nature":          "intelligence",
  "Perception":      "wisdom",
  "Performance":     "charisma",
  "Persuasion":      "charisma",
  "Religion":        "intelligence",
  "Sleight of Hand": "dexterity",
  "Stealth":         "dexterity",
  "Survival":        "wisdom",
};

// Default skill proficiencies auto-assigned by class at character creation
export const CLASS_DEFAULT_SKILLS: Record<string, string[]> = {
  barbarian: ["Athletics", "Intimidation"],
  bard:      ["Perception", "Performance", "Persuasion"],
  cleric:    ["Insight", "Religion"],
  druid:     ["Nature", "Perception"],
  fighter:   ["Athletics", "Intimidation"],
  monk:      ["Acrobatics", "Stealth"],
  paladin:   ["Athletics", "Persuasion"],
  ranger:    ["Perception", "Stealth", "Survival"],
  rogue:     ["Acrobatics", "Deception", "Stealth", "Sleight of Hand"],
  sorcerer:  ["Arcana", "Persuasion"],
  warlock:   ["Arcana", "Deception"],
  wizard:    ["Arcana", "History"],
};

// Two skill proficiencies granted by each background (PHB)
export const BACKGROUND_SKILLS: Record<string, string[]> = {
  "Acolyte":       ["Insight", "Religion"],
  "Charlatan":     ["Deception", "Sleight of Hand"],
  "Criminal":      ["Deception", "Stealth"],
  "Entertainer":   ["Acrobatics", "Performance"],
  "Folk Hero":     ["Animal Handling", "Survival"],
  "Guild Artisan": ["Insight", "Persuasion"],
  "Hermit":        ["Medicine", "Religion"],
  "Noble":         ["History", "Persuasion"],
  "Outlander":     ["Athletics", "Survival"],
  "Sage":          ["Arcana", "History"],
  "Sailor":        ["Athletics", "Perception"],
  "Soldier":       ["Athletics", "Intimidation"],
  "Urchin":        ["Sleight of Hand", "Stealth"],
};

// ── Backgrounds ───────────────────────────────────────────────────────────

export const BACKGROUNDS = [
  "Acolyte","Charlatan","Criminal","Entertainer","Folk Hero",
  "Guild Artisan","Hermit","Noble","Outlander","Sage",
  "Sailor","Soldier","Urchin"
];

// ── Stat Validation ───────────────────────────────────────────────────────

export function validateManualStats(stats: Record<StatName, number>): string | null {
  const tooHigh = STAT_NAMES.filter(s => stats[s] > 15);
  const tooLow  = STAT_NAMES.filter(s => stats[s] < 8);

  if (tooHigh.length > 0 || tooLow.length > 0) {
    const lines = [
      "❌ **Stats out of range** — Manual method follows **Point Buy rules**: each stat must be **8–15** before racial bonuses.\n",
    ];
    if (tooHigh.length > 0)
      lines.push(`🔺 **Too high** (max 15): ${tooHigh.map(s => `${STAT_SHORT[s]} **${stats[s]}**`).join("  ·  ")}`);
    if (tooLow.length > 0)
      lines.push(`🔻 **Too low** (min 8): ${tooLow.map(s => `${STAT_SHORT[s]} **${stats[s]}**`).join("  ·  ")}`);
    lines.push(
      "",
      "💡 **ทางเลือก:**",
      "• ปรับ stat ให้อยู่ในช่วง **8–15** และไม่เกิน **27 point budget**",
      "• ใช้ **🎲 Roll** เพื่อทอยเต๋าแบบไม่จำกัด (3–18 ต่อ stat)",
      "• ใช้ **🧮 Point Buy** เพื่อปรับแบบ interactive ทีละค่า",
    );
    return lines.join("\n");
  }

  const cost = calcPointBuyCost(stats);
  if (cost > POINT_BUY_BUDGET) {
    const over = cost - POINT_BUY_BUDGET;
    const breakdown = STAT_NAMES
      .map(s => `${STAT_SHORT[s]} ${stats[s]} *(${POINT_BUY_COSTS[stats[s]]}pts)*`)
      .join("  ·  ");

    // Greedy fix: repeatedly lower the stat with the highest cost-per-step
    const working = { ...stats };
    const fixes: string[] = [];
    let rem = over;
    while (rem > 0) {
      let bestStat: StatName | null = null;
      let bestSaves = 0;
      for (const s of STAT_NAMES) {
        if (working[s] <= 8) continue;
        const saves = (POINT_BUY_COSTS[working[s]] ?? 0) - (POINT_BUY_COSTS[working[s] - 1] ?? 0);
        if (saves > bestSaves) { bestSaves = saves; bestStat = s; }
      }
      if (!bestStat) break;
      const prev = working[bestStat];
      working[bestStat]--;
      rem -= bestSaves;
      fixes.push(`  • ลด **${STAT_SHORT[bestStat]}** ${prev} → **${working[bestStat]}** (ประหยัด ${bestSaves}pt${bestSaves !== 1 ? "s" : ""})`);
    }

    return [
      `❌ **เกิน Point Buy budget ${over}pt${over !== 1 ? "s" : ""}** — ใช้ไป **${cost}/${POINT_BUY_BUDGET}** points\n`,
      `**ต้นทุนแต่ละ stat:** ${breakdown}\n`,
      `💡 **วิธีแก้ไข (ต้องประหยัดอีก ${over}pts):**`,
      ...fixes,
      "",
      "หรือเปลี่ยนไปใช้ **📊 Standard Array** [15, 14, 13, 12, 10, 8] แทน — ไม่ต้องคิด budget",
    ].join("\n");
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function calcAcBase(charClass: string, dex: number, con?: number, wis?: number): number {
  const dexMod = Math.floor((dex - 10) / 2);
  if (charClass === "barbarian" && con !== undefined) {
    return 10 + dexMod + Math.floor((con - 10) / 2);
  }
  if (charClass === "monk" && wis !== undefined) {
    return 10 + dexMod + Math.floor((wis - 10) / 2);
  }
  // Default: leather armor (11 + DEX) for light-armor classes, chain mail (16) for heavy
  const heavyClasses = ["fighter","paladin","cleric"];
  const mediumClasses = ["ranger","druid","barbarian"];
  if (heavyClasses.includes(charClass)) return 16; // chain mail
  if (mediumClasses.includes(charClass)) return Math.min(14, 13 + dexMod); // scale mail
  return 11 + dexMod; // leather
}

export function applyRacialBonuses(
  base: Record<StatName, number>,
  race: string
): Record<StatName, number> {
  const raceData = RACES[race];
  if (!raceData) return base;
  const result = { ...base };
  for (const [stat, bonus] of Object.entries(raceData.bonuses)) {
    result[stat as StatName] = (result[stat as StatName] ?? 10) + (bonus ?? 0);
  }
  return result;
}

export function autoAssignStats(rolled: number[], charClass: string): Record<StatName, number> {
  const classData = CLASSES[charClass];
  const priority = classData?.primaryStats ?? STAT_NAMES;
  const remaining = [...STAT_NAMES];
  const sorted = [...rolled].sort((a, b) => b - a);
  const result: Partial<Record<StatName, number>> = {};

  // Assign in priority order
  for (const stat of priority) {
    if (remaining.includes(stat)) {
      result[stat] = sorted.shift()!;
      remaining.splice(remaining.indexOf(stat), 1);
    }
  }
  // Assign remaining
  for (const stat of remaining) {
    result[stat] = sorted.shift()!;
  }
  return result as Record<StatName, number>;
}

export function calcPointBuyCost(stats: Record<StatName, number>): number {
  return STAT_NAMES.reduce((total, stat) => {
    const cost = POINT_BUY_COSTS[stats[stat]];
    return total + (cost ?? 0);
  }, 0);
}

export function isValidPointBuy(stats: Record<StatName, number>): boolean {
  const cost = calcPointBuyCost(stats);
  const allInRange = STAT_NAMES.every(s => stats[s] >= 8 && stats[s] <= 15);
  return cost <= POINT_BUY_BUDGET && allInRange;
}

// ── Subclasses ────────────────────────────────────────────────────────────

export interface SubclassOption { id: string; name: string; description: string }
export interface SubclassData { unlockLevel: number; label: string; options: SubclassOption[] }

export const SUBCLASSES: Record<string, SubclassData> = {
  barbarian: { unlockLevel: 3, label: "Primal Path", options: [
    { id: "berserker",         name: "Path of the Berserker",    description: "Frenzy: extra bonus-action attack while Raging" },
    { id: "totem-warrior",     name: "Path of the Totem Warrior", description: "Spirit animal powers (Bear/Eagle/Wolf)" },
    { id: "ancestral-guardian",name: "Ancestral Guardians",       description: "Spiritual protectors reduce enemy attacks on allies" },
    { id: "storm-herald",      name: "Storm Herald",              description: "Aura of storm (Arctic/Desert/Sea) while Raging" },
  ]},
  bard: { unlockLevel: 3, label: "Bard College", options: [
    { id: "lore",    name: "College of Lore",    description: "Bonus skills, Cutting Words reaction" },
    { id: "valor",   name: "College of Valor",   description: "Combat inspiration, medium armor & shields" },
    { id: "glamour", name: "College of Glamour", description: "Mantle of Inspiration, fey magic" },
    { id: "swords",  name: "College of Swords",  description: "Extra Attack, Blade Flourishes" },
  ]},
  cleric: { unlockLevel: 1, label: "Divine Domain", options: [
    { id: "life",      name: "Life Domain",      description: "Healing specialist, Heavy Armor" },
    { id: "light",     name: "Light Domain",     description: "Radiance of the Dawn, Warding Flare" },
    { id: "war",       name: "War Domain",       description: "War Priest bonus attacks, Heavy Armor" },
    { id: "knowledge", name: "Knowledge Domain", description: "Channel Divinity skill expertise" },
    { id: "nature",    name: "Nature Domain",    description: "Acolyte of Nature, Heavy Armor" },
    { id: "tempest",   name: "Tempest Domain",   description: "Thunderbolt Strike, Heavy Armor" },
    { id: "trickery",  name: "Trickery Domain",  description: "Blessing of the Trickster, Invoke Duplicity" },
  ]},
  druid: { unlockLevel: 2, label: "Druid Circle", options: [
    { id: "land",     name: "Circle of the Land",     description: "Bonus spells by terrain, Natural Recovery" },
    { id: "moon",     name: "Circle of the Moon",     description: "Combat Wild Shape, powerful beast forms" },
    { id: "shepherd", name: "Circle of the Shepherd", description: "Summon spirit totems" },
    { id: "spores",   name: "Circle of Spores",       description: "Halo of Spores, fungal infusion" },
  ]},
  fighter: { unlockLevel: 3, label: "Martial Archetype", options: [
    { id: "champion",        name: "Champion",           description: "Improved Critical (19-20), Remarkable Athlete" },
    { id: "battle-master",   name: "Battle Master",      description: "Superiority Dice combat maneuvers" },
    { id: "eldritch-knight", name: "Eldritch Knight",    description: "Limited Wizard spells, War Magic" },
    { id: "arcane-archer",   name: "Arcane Archer",      description: "Magical Arcane Shot options" },
    { id: "cavalier",        name: "Cavalier",           description: "Mounted combat specialist" },
  ]},
  monk: { unlockLevel: 3, label: "Monastic Tradition", options: [
    { id: "open-hand",      name: "Way of the Open Hand",    description: "Knock prone, push, deny reactions on hits" },
    { id: "shadow",         name: "Way of Shadow",           description: "Ki-powered spells, Cloak of Shadows" },
    { id: "four-elements",  name: "Way of the Four Elements",description: "Elemental disciplines using ki" },
    { id: "drunken-master", name: "Way of the Drunken Master",description: "Unpredictable movement, bonus Disengage" },
    { id: "kensei",         name: "Way of the Kensei",       description: "Chosen weapons become monk weapons" },
  ]},
  paladin: { unlockLevel: 3, label: "Sacred Oath", options: [
    { id: "devotion",   name: "Oath of Devotion",   description: "Sacred Weapon, Turn the Unholy" },
    { id: "ancients",   name: "Oath of the Ancients",description: "Nature's Wrath, Turn the Faithless" },
    { id: "vengeance",  name: "Oath of Vengeance",  description: "Vow of Enmity, Relentless Avenger" },
    { id: "conquest",   name: "Oath of Conquest",   description: "Conquering Presence, Guided Strike" },
    { id: "redemption", name: "Oath of Redemption", description: "Emissary of Peace, Rebuke the Violent" },
  ]},
  ranger: { unlockLevel: 3, label: "Ranger Archetype", options: [
    { id: "hunter",         name: "Hunter",          description: "Hunter's Prey, Defensive Tactics" },
    { id: "beast-master",   name: "Beast Master",    description: "Ranger's Companion bonded beast" },
    { id: "gloom-stalker",  name: "Gloom Stalker",   description: "Umbral Sight, first-round bonus attack" },
    { id: "horizon-walker", name: "Horizon Walker",  description: "Detect Portal, planar warrior" },
    { id: "monster-slayer", name: "Monster Slayer",  description: "Hunter's Sense, Slayer's Prey" },
  ]},
  rogue: { unlockLevel: 3, label: "Roguish Archetype", options: [
    { id: "thief",            name: "Thief",            description: "Fast Hands, Second-Story Work" },
    { id: "assassin",         name: "Assassin",          description: "Assassinate (auto-crit surprised foes)" },
    { id: "arcane-trickster", name: "Arcane Trickster",  description: "Limited Wizard spells, Mage Hand Legerdemain" },
    { id: "swashbuckler",     name: "Swashbuckler",      description: "Fancy Footwork, Rakish Audacity" },
    { id: "inquisitive",      name: "Inquisitive",       description: "Ear for Deceit, Eye for Detail" },
  ]},
  sorcerer: { unlockLevel: 1, label: "Sorcerous Origin", options: [
    { id: "draconic",    name: "Draconic Bloodline", description: "Dragon ancestor, extra HP, natural armor" },
    { id: "wild-magic",  name: "Wild Magic",         description: "Wild Magic Surge, Tides of Chaos" },
    { id: "divine-soul", name: "Divine Soul",        description: "Access Cleric spells, Favored by the Gods" },
    { id: "shadow",      name: "Shadow Magic",       description: "Eyes of the Dark, Strength of the Grave" },
    { id: "storm",       name: "Storm Sorcery",      description: "Wind Speaker, Tempestuous Magic" },
  ]},
  warlock: { unlockLevel: 1, label: "Otherworldly Patron", options: [
    { id: "archfey",       name: "The Archfey",       description: "Fey Presence, Misty Escape" },
    { id: "fiend",         name: "The Fiend",          description: "Dark One's Blessing — temp HP on kills" },
    { id: "great-old-one", name: "The Great Old One",  description: "Awakened Mind telepathy" },
    { id: "hexblade",      name: "The Hexblade",       description: "Hexblade's Curse, Hex Warrior" },
    { id: "celestial",     name: "The Celestial",      description: "Healing Light, Radiant Soul" },
  ]},
  wizard: { unlockLevel: 2, label: "Arcane Tradition", options: [
    { id: "abjuration",   name: "School of Abjuration",   description: "Arcane Ward magical shield" },
    { id: "conjuration",  name: "School of Conjuration",  description: "Minor Conjuration, Benign Transposition" },
    { id: "divination",   name: "School of Divination",   description: "Portent — replace rolls with pre-rolled dice" },
    { id: "enchantment",  name: "School of Enchantment",  description: "Hypnotic Gaze, Instinctive Charm" },
    { id: "evocation",    name: "School of Evocation",    description: "Sculpt Spells — exclude allies from AoE" },
    { id: "illusion",     name: "School of Illusion",     description: "Malleable Illusions, Illusory Self" },
    { id: "necromancy",   name: "School of Necromancy",   description: "Grim Harvest, undead servant" },
    { id: "transmutation",name: "School of Transmutation",description: "Minor Alchemy, Transmuter's Stone" },
  ]},
};

// ── ASI Levels ────────────────────────────────────────────────────────────

export const ASI_LEVELS: Record<string, number[]> = {
  barbarian: [4, 8, 12, 16, 19],
  bard:      [4, 8, 12, 16, 19],
  cleric:    [4, 8, 12, 16, 19],
  druid:     [4, 8, 12, 16, 19],
  fighter:   [4, 6, 8, 12, 14, 16, 19],
  monk:      [4, 8, 12, 16, 19],
  paladin:   [4, 8, 12, 16, 19],
  ranger:    [4, 8, 12, 16, 19],
  rogue:     [4, 8, 10, 12, 16, 19],
  sorcerer:  [4, 8, 12, 16, 19],
  warlock:   [4, 8, 12, 16, 19],
  wizard:    [4, 8, 12, 16, 19],
};

// ── Multiclass Prerequisites ──────────────────────────────────────────────

export const MULTICLASS_PREREQS: Record<string, Array<{ stat: StatName; min: number }>> = {
  barbarian: [{ stat: "strength",     min: 13 }],
  bard:      [{ stat: "charisma",     min: 13 }],
  cleric:    [{ stat: "wisdom",       min: 13 }],
  druid:     [{ stat: "wisdom",       min: 13 }],
  fighter:   [{ stat: "strength",     min: 13 }],
  monk:      [{ stat: "dexterity",    min: 13 }, { stat: "wisdom", min: 13 }],
  paladin:   [{ stat: "strength",     min: 13 }, { stat: "charisma", min: 13 }],
  ranger:    [{ stat: "dexterity",    min: 13 }, { stat: "wisdom", min: 13 }],
  rogue:     [{ stat: "dexterity",    min: 13 }],
  sorcerer:  [{ stat: "charisma",     min: 13 }],
  warlock:   [{ stat: "charisma",     min: 13 }],
  wizard:    [{ stat: "intelligence", min: 13 }],
};

// ── Spell Slots ───────────────────────────────────────────────────────────

// Indexed by level-1 (0-19), values are [1st,2nd,3rd,4th,5th,6th,7th,8th,9th] slots
const FULL_CASTER_SLOTS = [
  [2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],
  [4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],
  [4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],
  [4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],
  [4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
];
const HALF_CASTER_SLOTS = [
  [0,0,0,0,0],[2,0,0,0,0],[3,0,0,0,0],[3,0,0,0,0],[4,2,0,0,0],[4,2,0,0,0],
  [4,3,0,0,0],[4,3,0,0,0],[4,3,2,0,0],[4,3,2,0,0],[4,3,3,0,0],[4,3,3,0,0],
  [4,3,3,1,0],[4,3,3,1,0],[4,3,3,2,0],[4,3,3,2,0],[4,3,3,3,1],[4,3,3,3,1],
  [4,3,3,3,2],[4,3,3,3,2],
];
// [spellLevel, slotCount] indexed by level-1
const WARLOCK_SLOTS: Array<[number, number]> = [
  [1,1],[1,2],[2,2],[2,2],[3,2],[3,2],[4,2],[4,2],[5,2],[5,2],
  [5,3],[5,3],[5,3],[5,3],[5,3],[5,3],[5,4],[5,4],[5,4],[5,4],
];

function slotsFromArray(arr: number[]): Record<string, number> {
  const result: Record<string, number> = {};
  arr.forEach((v, i) => { if (v > 0) result[String(i + 1)] = v; });
  return result;
}

export function getSpellSlots(className: string, level: number): Record<string, number> {
  const fullCasters = ["bard", "cleric", "druid", "sorcerer", "wizard"];
  const halfCasters = ["paladin", "ranger"];
  const c = className.toLowerCase();
  const i = Math.max(0, Math.min(19, level - 1));
  if (c === "warlock") {
    const [sl, count] = WARLOCK_SLOTS[i];
    return { [String(sl)]: count };
  }
  if (fullCasters.includes(c)) return slotsFromArray(FULL_CASTER_SLOTS[i]);
  if (halfCasters.includes(c)) return slotsFromArray(HALF_CASTER_SLOTS[i]);
  return {};
}
