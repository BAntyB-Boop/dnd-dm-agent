import type { StartingItem } from "./character-data.js";

export interface EquipOption {
  label: string;
  items: StartingItem[];
}

export interface EquipGroup {
  label: string;
  fixed: boolean;          // true = no choice, always granted
  options: EquipOption[];  // length 1 if fixed
}

// ── Shorthand helpers ─────────────────────────────────────────────────────

const w = (name: string, desc: string, val: number, wt: number, qty = 1, eq: 0 | 1 = 1): StartingItem =>
  ({ name, type: "weapon", quantity: qty, description: desc, value: val, weight: wt, equipped: eq });

const a = (name: string, desc: string, val: number, wt: number): StartingItem =>
  ({ name, type: "armor", quantity: 1, description: desc, value: val, weight: wt, equipped: 1 });

const s = (): StartingItem =>
  ({ name: "Shield", type: "shield", quantity: 1, description: "+2 AC", value: 10, weight: 6, equipped: 1 });

const g = (name: string, desc: string, val: number, wt: number): StartingItem =>
  ({ name, type: "gear", quantity: 1, description: desc, value: val, weight: wt, equipped: 0 });

const f = (name: string, desc: string, val = 25, wt = 2): StartingItem =>
  ({ name, type: "focus", quantity: 1, description: desc, value: val, weight: wt, equipped: 1 });

const ammo = (qty: number): StartingItem =>
  ({ name: "Arrows", type: "ammo", quantity: qty, description: "Ammunition for bow/crossbow", value: 1, weight: 1, equipped: 0 });

const bolts = (qty: number): StartingItem =>
  ({ name: "Bolts", type: "ammo", quantity: qty, description: "Ammunition for crossbow", value: 1, weight: 1, equipped: 0 });

// ── Common items ──────────────────────────────────────────────────────────

const LEATHER      = a("Leather Armor",  "AC 11+DEX", 10, 10);
const CHAIN_MAIL   = a("Chain Mail",     "AC 16 • disadvantage on Stealth", 75, 55);
const SCALE_MAIL   = a("Scale Mail",     "AC 14+DEX (max +2)", 50, 45);
const HOLY_SYMBOL  = f("Holy Symbol",    "Divine spellcasting focus", 5, 1);
const DRUIDIC_FOCUS = f("Druidic Focus", "Nature spellcasting focus", 1, 1);
const COMP_POUCH   = f("Component Pouch","Arcane spellcasting focus");
const SPELLBOOK    = g("Spellbook",      "Contains wizard spells (6 Lv1 spells)", 50, 3);
const THIEVES_TOOLS = g("Thieves' Tools","Lockpicking & trap disarming tools", 25, 1);

const EXPLORER   = g("Explorer's Pack",    "Backpack, bedroll, rations (10), rope, etc.",  10, 59);
const DUNGEONEER = g("Dungeoneer's Pack",  "Backpack, crowbar, hammer, torches, rations, etc.", 12, 61);
const PRIEST     = g("Priest's Pack",      "Backpack, blanket, candles, rations, etc.",    19, 24);
const SCHOLAR    = g("Scholar's Pack",     "Backpack, book, ink, parchment, sand, knife, etc.", 40, 11);
const DIPLOMAT   = g("Diplomat's Pack",    "Chest, fine clothes, ink, paper, etc.",        39, 36);
const ENTERTAINER = g("Entertainer's Pack","Backpack, bedroll, 2 costumes, candles, rations, etc.", 40, 38);
const BURGLAR    = g("Burglar's Pack",     "Backpack, ball bearings, string, bell, candles, etc.", 16, 47);

const LONGBOW    = w("Longbow",       "1d8 piercing • range 150/600 ft, two-handed", 50, 2, 1, 0);
const CROSSBOW_L = w("Light Crossbow","1d8 piercing • range 80/320 ft, two-handed",  25, 5, 1, 0);
const LONGSWORD  = w("Longsword",     "1d8 slashing • versatile (1d10)", 15, 3);
const RAPIER     = w("Rapier",        "1d8 piercing • finesse", 25, 2);
const SHORTSWORD = w("Shortsword",    "1d6 piercing • finesse, light", 10, 2);
const QUARTERSTAFF = w("Quarterstaff","1d6 bludgeoning • versatile (1d8)", 2, 4);
const DAGGER     = w("Dagger",        "1d4 piercing • finesse, light, thrown (20/60 ft)", 2, 1, 1, 0);
const HANDAXE    = w("Handaxe",       "1d6 slashing • light, thrown (20/60 ft)", 5, 2, 1, 0);
const MACE       = w("Mace",          "1d6 bludgeoning", 5, 4);
const SCIMITAR   = w("Scimitar",      "1d6 slashing • finesse, light", 25, 3);
const GREATAXE   = w("Greataxe",      "1d12 slashing • heavy, two-handed", 30, 7);
const JAVELIN    = w("Javelin",       "1d6 piercing • thrown (30/120 ft)", 1, 2, 1, 0);

// ── Equipment groups per class ────────────────────────────────────────────

export const CLASS_EQUIPMENT_GROUPS: Record<string, EquipGroup[]> = {

  barbarian: [
    { label: "Primary Weapon", fixed: false, options: [
      { label: "Greataxe  (1d12 • heavy)", items: [GREATAXE] },
      { label: "Longsword  (1d8 • versatile)", items: [LONGSWORD] },
    ]},
    { label: "Secondary Weapon", fixed: false, options: [
      { label: "2× Handaxe  (1d6 • thrown)", items: [{ ...HANDAXE, quantity: 2 }] },
      { label: "Shortsword  (1d6 • finesse)", items: [{ ...SHORTSWORD, equipped: 0 }] },
    ]},
    { label: "Gear", fixed: true, options: [
      { label: "Explorer's Pack + 4 Javelins", items: [EXPLORER, { ...JAVELIN, quantity: 4 }] },
    ]},
  ],

  bard: [
    { label: "Main Weapon", fixed: false, options: [
      { label: "Rapier  (1d8 • finesse)", items: [RAPIER] },
      { label: "Longsword  (1d8 • versatile)", items: [LONGSWORD] },
    ]},
    { label: "Pack", fixed: false, options: [
      { label: "Diplomat's Pack", items: [DIPLOMAT] },
      { label: "Entertainer's Pack", items: [ENTERTAINER] },
    ]},
    { label: "Gear", fixed: true, options: [
      { label: "Leather Armor + Dagger", items: [LEATHER, { ...DAGGER, equipped: 0 }] },
    ]},
  ],

  cleric: [
    { label: "Weapon", fixed: false, options: [
      { label: "Mace  (1d6 • bludgeoning)", items: [MACE] },
      { label: "Warhammer  (1d8 • versatile)", items: [w("Warhammer", "1d8 bludgeoning • versatile (1d10)", 15, 2)] },
    ]},
    { label: "Armor", fixed: false, options: [
      { label: "Scale Mail  (AC 14+DEX max+2)", items: [SCALE_MAIL] },
      { label: "Leather Armor  (AC 11+DEX)", items: [LEATHER] },
      { label: "Chain Mail  (AC 16)", items: [CHAIN_MAIL] },
    ]},
    { label: "Ranged / Extra Weapon", fixed: false, options: [
      { label: "Light Crossbow + 20 Bolts", items: [CROSSBOW_L, bolts(20)] },
      { label: "2× Handaxe", items: [{ ...HANDAXE, quantity: 2 }] },
    ]},
    { label: "Gear", fixed: true, options: [
      { label: "Shield + Holy Symbol + Priest's Pack", items: [s(), HOLY_SYMBOL, PRIEST] },
    ]},
  ],

  druid: [
    { label: "Weapon", fixed: false, options: [
      { label: "Scimitar  (1d6 • finesse)", items: [SCIMITAR] },
      { label: "Quarterstaff  (1d6 • versatile)", items: [QUARTERSTAFF] },
    ]},
    { label: "Pack", fixed: false, options: [
      { label: "Explorer's Pack", items: [EXPLORER] },
      { label: "Dungeoneer's Pack", items: [DUNGEONEER] },
    ]},
    { label: "Gear", fixed: true, options: [
      { label: "Wooden Shield + Leather Armor + Druidic Focus", items: [
        { name: "Wooden Shield", type: "shield", quantity: 1, description: "+2 AC", value: 10, weight: 6, equipped: 1 },
        LEATHER, DRUIDIC_FOCUS,
      ]},
    ]},
  ],

  fighter: [
    { label: "Armor", fixed: false, options: [
      { label: "Chain Mail  (AC 16)", items: [CHAIN_MAIL] },
      { label: "Leather Armor + Longbow + 20 Arrows", items: [LEATHER, { ...LONGBOW, equipped: 0 }, ammo(20)] },
    ]},
    { label: "Main Weapon", fixed: false, options: [
      { label: "Longsword + Shield", items: [LONGSWORD, s()] },
      { label: "Two Shortswords", items: [SHORTSWORD, { ...SHORTSWORD, quantity: 1 }] },
    ]},
    { label: "Ranged / Secondary", fixed: false, options: [
      { label: "Light Crossbow + 20 Bolts", items: [CROSSBOW_L, bolts(20)] },
      { label: "2× Handaxe", items: [{ ...HANDAXE, quantity: 2 }] },
    ]},
    { label: "Pack", fixed: false, options: [
      { label: "Dungeoneer's Pack", items: [DUNGEONEER] },
      { label: "Explorer's Pack", items: [EXPLORER] },
    ]},
  ],

  monk: [
    { label: "Weapon", fixed: false, options: [
      { label: "Shortsword  (1d6 • finesse)", items: [SHORTSWORD] },
      { label: "Quarterstaff  (1d6 • versatile)", items: [QUARTERSTAFF] },
    ]},
    { label: "Pack", fixed: false, options: [
      { label: "Dungeoneer's Pack", items: [DUNGEONEER] },
      { label: "Explorer's Pack", items: [EXPLORER] },
    ]},
    { label: "Gear", fixed: true, options: [
      { label: "10× Dart", items: [w("Dart", "1d4 piercing • finesse, thrown (20/60 ft)", 0, 0, 10, 0)] },
    ]},
  ],

  paladin: [
    { label: "Main Weapon", fixed: false, options: [
      { label: "Longsword  (1d8 • versatile)", items: [LONGSWORD] },
      { label: "Battleaxe  (1d8 • versatile)", items: [w("Battleaxe", "1d8 slashing • versatile (1d10)", 10, 4)] },
    ]},
    { label: "Shield / Off-Hand", fixed: false, options: [
      { label: "Shield + 5 Javelins", items: [s(), { ...JAVELIN, quantity: 5 }] },
      { label: "Two Shortswords", items: [SHORTSWORD, { ...SHORTSWORD, quantity: 1 }] },
    ]},
    { label: "Pack", fixed: false, options: [
      { label: "Priest's Pack", items: [PRIEST] },
      { label: "Explorer's Pack", items: [EXPLORER] },
    ]},
    { label: "Gear", fixed: true, options: [
      { label: "Chain Mail + Holy Symbol", items: [CHAIN_MAIL, HOLY_SYMBOL] },
    ]},
  ],

  ranger: [
    { label: "Armor", fixed: false, options: [
      { label: "Scale Mail  (AC 14+DEX max+2)", items: [SCALE_MAIL] },
      { label: "Leather Armor  (AC 11+DEX)", items: [LEATHER] },
    ]},
    { label: "Melee Weapons", fixed: false, options: [
      { label: "Two Shortswords", items: [SHORTSWORD, { ...SHORTSWORD, quantity: 1 }] },
      { label: "Two Handaxes", items: [{ ...HANDAXE, quantity: 2 }] },
    ]},
    { label: "Pack", fixed: false, options: [
      { label: "Dungeoneer's Pack", items: [DUNGEONEER] },
      { label: "Explorer's Pack", items: [EXPLORER] },
    ]},
    { label: "Gear", fixed: true, options: [
      { label: "Longbow + 20 Arrows", items: [{ ...LONGBOW, equipped: 0 }, ammo(20)] },
    ]},
  ],

  rogue: [
    { label: "Main Weapon", fixed: false, options: [
      { label: "Rapier  (1d8 • finesse)", items: [RAPIER] },
      { label: "Shortsword  (1d6 • finesse)", items: [SHORTSWORD] },
    ]},
    { label: "Ranged / Second Melee", fixed: false, options: [
      { label: "Shortbow + 20 Arrows", items: [
        w("Shortbow", "1d6 piercing • range 80/320 ft, two-handed", 25, 2, 1, 0), ammo(20),
      ]},
      { label: "Second Shortsword", items: [{ ...SHORTSWORD, equipped: 0 }] },
    ]},
    { label: "Pack", fixed: false, options: [
      { label: "Burglar's Pack", items: [BURGLAR] },
      { label: "Dungeoneer's Pack", items: [DUNGEONEER] },
      { label: "Explorer's Pack", items: [EXPLORER] },
    ]},
    { label: "Gear", fixed: true, options: [
      { label: "Leather Armor + 2 Daggers + Thieves' Tools", items: [
        LEATHER, { ...DAGGER, quantity: 2 }, THIEVES_TOOLS,
      ]},
    ]},
  ],

  sorcerer: [
    { label: "Weapon / Ranged", fixed: false, options: [
      { label: "Light Crossbow + 20 Bolts", items: [CROSSBOW_L, bolts(20)] },
      { label: "Quarterstaff  (1d6 • versatile)", items: [{ ...QUARTERSTAFF, equipped: 1 }] },
    ]},
    { label: "Pack", fixed: false, options: [
      { label: "Dungeoneer's Pack", items: [DUNGEONEER] },
      { label: "Explorer's Pack", items: [EXPLORER] },
    ]},
    { label: "Gear", fixed: true, options: [
      { label: "Component Pouch + 2 Daggers", items: [COMP_POUCH, { ...DAGGER, quantity: 2, equipped: 1 }] },
    ]},
  ],

  warlock: [
    { label: "Weapon / Ranged", fixed: false, options: [
      { label: "Light Crossbow + 20 Bolts", items: [CROSSBOW_L, bolts(20)] },
      { label: "Quarterstaff  (1d6 • versatile)", items: [{ ...QUARTERSTAFF, equipped: 1 }] },
    ]},
    { label: "Pack", fixed: false, options: [
      { label: "Scholar's Pack", items: [SCHOLAR] },
      { label: "Dungeoneer's Pack", items: [DUNGEONEER] },
    ]},
    { label: "Gear", fixed: true, options: [
      { label: "Leather Armor + 2 Daggers + Component Pouch", items: [
        LEATHER, { ...DAGGER, quantity: 2, equipped: 1 }, COMP_POUCH,
      ]},
    ]},
  ],

  wizard: [
    { label: "Weapon", fixed: false, options: [
      { label: "Quarterstaff  (1d6 • versatile)", items: [{ ...QUARTERSTAFF, equipped: 1 }] },
      { label: "Dagger  (1d4 • finesse)", items: [{ ...DAGGER, equipped: 1 }] },
    ]},
    { label: "Pack", fixed: false, options: [
      { label: "Scholar's Pack", items: [SCHOLAR] },
      { label: "Explorer's Pack", items: [EXPLORER] },
    ]},
    { label: "Gear", fixed: true, options: [
      { label: "Component Pouch + Spellbook", items: [COMP_POUCH, SPELLBOOK] },
    ]},
  ],
};
