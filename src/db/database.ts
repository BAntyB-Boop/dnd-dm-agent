import Database from "better-sqlite3";
import { config } from "../config.js";
import {
  CLASSES, CLASS_DEFAULT_SKILLS, BACKGROUND_SKILLS,
  SUBCLASSES, ASI_LEVELS, getSpellSlots,
  StatName,
} from "../game/character-data.js";

export let db: Database.Database;

export function initDatabase(): void {
  db = new Database(config.database.path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  createTables();
  runMigrations();
  console.log(`[DB] Database initialized at ${config.database.path}`);
}

function runMigrations(): void {
  const migrations = [
    "ALTER TABLE atmosphere_state ADD COLUMN current_map TEXT DEFAULT ''",
    "ALTER TABLE campaigns ADD COLUMN session_summary TEXT DEFAULT ''",
    "ALTER TABLE saved_sessions ADD COLUMN is_autosave INTEGER DEFAULT 0",
    "ALTER TABLE saved_sessions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE atmosphere_state ADD COLUMN player_x REAL DEFAULT -1",
    "ALTER TABLE atmosphere_state ADD COLUMN player_y REAL DEFAULT -1",
    "ALTER TABLE characters ADD COLUMN avatar TEXT DEFAULT ''",
    "ALTER TABLE characters ADD COLUMN skill_proficiencies TEXT DEFAULT '[]'",
    "ALTER TABLE atmosphere_state ADD COLUMN player_positions TEXT DEFAULT '{}'",
    "ALTER TABLE characters ADD COLUMN subclass TEXT DEFAULT ''",
    "ALTER TABLE characters ADD COLUMN multiclass TEXT DEFAULT '[]'",
    "ALTER TABLE characters ADD COLUMN race_option TEXT DEFAULT ''",
    "ALTER TABLE characters ADD COLUMN personality TEXT DEFAULT '{}'",
    "ALTER TABLE characters ADD COLUMN prepared_spells TEXT DEFAULT '[]'",
    "ALTER TABLE campaigns ADD COLUMN dm_name TEXT DEFAULT 'dm'",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists — skip */ }
  }
  migrateCharacterSkills();
  migrateSpellSlots();
}

function migrateCharacterSkills(): void {
  const chars = db.prepare(
    "SELECT id, class, background, skill_proficiencies FROM characters"
  ).all() as { id: number; class: string; background: string; skill_proficiencies: string }[];

  let migrated = 0;
  for (const char of chars) {
    let profs: string[] = [];
    try { profs = JSON.parse(char.skill_proficiencies); } catch { /* bad JSON */ }
    if (profs.length > 0) continue;

    const classSkills = CLASS_DEFAULT_SKILLS[char.class.toLowerCase()] ?? [];
    const bgSkills = BACKGROUND_SKILLS[char.background] ?? [];
    const merged = [...new Set([...classSkills, ...bgSkills])];
    if (merged.length === 0) continue;

    db.prepare("UPDATE characters SET skill_proficiencies = ? WHERE id = ?")
      .run(JSON.stringify(merged), char.id);
    migrated++;
  }
  if (migrated > 0) console.log(`[DB] Auto-assigned skills for ${migrated} existing character(s)`);
}

function migrateSpellSlots(): void {
  const chars = db.prepare(
    "SELECT id, class, level, spell_slots FROM characters"
  ).all() as { id: number; class: string; level: number; spell_slots: string }[];

  let migrated = 0;
  for (const char of chars) {
    let slots: Record<string, number> = {};
    try { slots = JSON.parse(char.spell_slots); } catch { /* bad JSON */ }
    if (Object.keys(slots).length > 0) continue;

    const computed = getSpellSlots(char.class, char.level);
    if (Object.keys(computed).length === 0) continue;

    db.prepare("UPDATE characters SET spell_slots = ? WHERE id = ?")
      .run(JSON.stringify(computed), char.id);
    migrated++;
  }
  if (migrated > 0) console.log(`[DB] Initialized spell slots for ${migrated} caster(s)`);
}

function createTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      language TEXT DEFAULT 'th',
      adventure_id TEXT,
      adventure_data TEXT DEFAULT '{}',
      session_summary TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id),
      discord_user_id TEXT NOT NULL,
      discord_username TEXT NOT NULL,
      name TEXT NOT NULL,
      class TEXT NOT NULL,
      race TEXT NOT NULL,
      background TEXT DEFAULT 'Folk Hero',
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      temp_hp INTEGER DEFAULT 0,
      ac INTEGER DEFAULT 10,
      initiative_bonus INTEGER DEFAULT 0,
      speed INTEGER DEFAULT 30,
      strength INTEGER DEFAULT 10,
      dexterity INTEGER DEFAULT 10,
      constitution INTEGER DEFAULT 10,
      intelligence INTEGER DEFAULT 10,
      wisdom INTEGER DEFAULT 10,
      charisma INTEGER DEFAULT 10,
      gold INTEGER DEFAULT 10,
      silver INTEGER DEFAULT 0,
      copper INTEGER DEFAULT 0,
      spell_slots TEXT DEFAULT '{}',
      conditions TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      weight REAL DEFAULT 0,
      value INTEGER DEFAULT 0,
      type TEXT DEFAULT 'misc',
      equipped INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS story_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id),
      session_number INTEGER DEFAULT 1,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      atmosphere TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS combat_encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id),
      active INTEGER DEFAULT 1,
      round INTEGER DEFAULT 1,
      current_turn_index INTEGER DEFAULT 0,
      participants TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS atmosphere_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER UNIQUE REFERENCES campaigns(id),
      scene TEXT DEFAULT 'A new adventure begins',
      mood TEXT DEFAULT 'neutral',
      time_of_day TEXT DEFAULT 'day',
      weather TEXT DEFAULT 'clear',
      lighting TEXT DEFAULT 'daylight',
      sounds TEXT DEFAULT '[]',
      active_effects TEXT DEFAULT '[]',
      location TEXT DEFAULT 'Unknown',
      current_map TEXT DEFAULT '',
      player_x REAL DEFAULT -1,
      player_y REAL DEFAULT -1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS session_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS saved_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id),
      name TEXT NOT NULL,
      messages_json TEXT NOT NULL DEFAULT '[]',
      message_count INTEGER DEFAULT 0,
      is_autosave INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      roles TEXT NOT NULL DEFAULT '["player"]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface AppUser {
  id: number;
  username: string;
  password_hash: string;
  salt: string;
  roles: string;
  created_at: string;
}

export function getUserByUsername(username: string): AppUser | undefined {
  return db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as AppUser | undefined;
}

export function createUser(username: string, passwordHash: string, salt: string, roles: string[]): number {
  const result = db.prepare(
    "INSERT INTO users (username, password_hash, salt, roles) VALUES (?, ?, ?, ?)"
  ).run(username, passwordHash, salt, JSON.stringify(roles));
  return result.lastInsertRowid as number;
}

// ─── Campaign ────────────────────────────────────────────────────────────────

export function getCampaign(id: number) {
  return db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as Campaign | undefined;
}

export function getActiveCampaign() {
  return db.prepare("SELECT * FROM campaigns WHERE active = 1 ORDER BY id DESC LIMIT 1").get() as Campaign | undefined;
}

export function createCampaign(name: string, description: string, language: "th" | "en" = "th", dmName = "dm") {
  db.prepare("UPDATE campaigns SET active = 0").run();
  const result = db.prepare(
    "INSERT INTO campaigns (name, description, language, dm_name) VALUES (?, ?, ?, ?)"
  ).run(name, description, language, dmName);
  db.prepare("INSERT INTO atmosphere_state (campaign_id) VALUES (?)").run(result.lastInsertRowid);
  return result.lastInsertRowid as number;
}

export function getCampaignsByDm(dmName: string) {
  return db.prepare("SELECT * FROM campaigns WHERE dm_name = ? ORDER BY id DESC").all(dmName) as Campaign[];
}

export function getCampaignPlayerCount(campaignId: number): number {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM characters WHERE campaign_id = ?").get(campaignId) as { cnt: number };
  return row.cnt;
}

export function updateCampaignAdventure(campaignId: number, adventureId: string, data: object) {
  db.prepare("UPDATE campaigns SET adventure_id = ?, adventure_data = ? WHERE id = ?")
    .run(adventureId, JSON.stringify(data), campaignId);
}

export function getAllCampaigns() {
  return db.prepare("SELECT * FROM campaigns ORDER BY id DESC").all() as Campaign[];
}

export function setActiveCampaign(campaignId: number) {
  db.prepare("UPDATE campaigns SET active = 0").run();
  db.prepare("UPDATE campaigns SET active = 1 WHERE id = ?").run(campaignId);
  db.prepare("INSERT OR IGNORE INTO atmosphere_state (campaign_id) VALUES (?)").run(campaignId);
}

export function setCampaignLanguage(campaignId: number, language: "th" | "en") {
  db.prepare("UPDATE campaigns SET language = ? WHERE id = ?").run(language, campaignId);
}

// ─── Characters ──────────────────────────────────────────────────────────────

export function getCharacter(discordUserId: string, campaignId: number) {
  return db.prepare(
    "SELECT * FROM characters WHERE discord_user_id = ? AND campaign_id = ?"
  ).get(discordUserId, campaignId) as Character | undefined;
}

export function getCharacterById(id: number) {
  return db.prepare("SELECT * FROM characters WHERE id = ?").get(id) as Character | undefined;
}

export function getAllCharacters(campaignId: number) {
  return db.prepare("SELECT * FROM characters WHERE campaign_id = ?").all(campaignId) as Character[];
}

export function updateCharacterSubclass(id: number, subclass: string): void {
  db.prepare("UPDATE characters SET subclass = ? WHERE id = ?").run(subclass, id);
}

// prepared_spells stores JSON: Record<className, string[]>
// e.g. {"paladin": ["Cure Wounds", "Bless"], "cleric": ["Healing Word"]}
export function updatePreparedSpells(id: number, byClass: Record<string, string[]>): void {
  db.prepare("UPDATE characters SET prepared_spells = ? WHERE id = ?").run(JSON.stringify(byClass), id);
}

export function getPreparedSpells(id: number): Record<string, string[]> {
  const char = getCharacterById(id);
  if (!char) return {};
  try {
    const raw = JSON.parse(char.prepared_spells || "{}");
    // Migration: old flat-array format → wrap under main class
    if (Array.isArray(raw)) {
      return raw.length > 0 ? { [char.class.toLowerCase()]: raw } : {};
    }
    return raw as Record<string, string[]>;
  } catch { return {}; }
}

export function updateCharacterASI(id: number, stat1: StatName, amount1: number, stat2?: StatName, amount2?: number): void {
  const char = getCharacterById(id)!;
  const v1 = Math.min(20, (char[stat1] as number) + amount1);
  if (stat2 && amount2) {
    const v2 = Math.min(20, (char[stat2] as number) + amount2);
    db.prepare(`UPDATE characters SET ${stat1} = ?, ${stat2} = ? WHERE id = ?`).run(v1, v2, id);
  } else {
    db.prepare(`UPDATE characters SET ${stat1} = ? WHERE id = ?`).run(v1, id);
  }
}

export interface MulticlassEntry { class: string; level: number; subclass: string }

export function updateMulticlassSubclass(charId: number, className: string, subclass: string): void {
  const char = getCharacterById(charId)!;
  const mc: MulticlassEntry[] = JSON.parse(char.multiclass || "[]");
  const entry = mc.find(e => e.class === className);
  if (entry) {
    entry.subclass = subclass;
    db.prepare("UPDATE characters SET multiclass = ? WHERE id = ?").run(JSON.stringify(mc), charId);
  }
}

export function addMulticlassLevel(charId: number, className: string): { hpGain: number } {
  const char = getCharacterById(charId)!;
  const existing: MulticlassEntry[] = JSON.parse(char.multiclass || "[]");
  const hitDie = CLASSES[className.toLowerCase()]?.hitDie ?? 8;
  const conMod = Math.floor((char.constitution - 10) / 2);
  const hpGain = Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
  const idx = existing.findIndex(e => e.class === className);
  if (idx >= 0) { existing[idx].level++; } else { existing.push({ class: className, level: 1, subclass: "" }); }
  db.prepare("UPDATE characters SET multiclass = ?, max_hp = ? WHERE id = ?")
    .run(JSON.stringify(existing), char.max_hp + hpGain, charId);
  return { hpGain };
}

export function updateCharacterSkills(id: number, skills: string[]): void {
  db.prepare("UPDATE characters SET skill_proficiencies = ? WHERE id = ?")
    .run(JSON.stringify(skills), id);
}

export function createCharacter(char: Omit<Character, "id" | "created_at" | "avatar" | "skill_proficiencies" | "subclass" | "multiclass">) {
  const result = db.prepare(`
    INSERT INTO characters
    (campaign_id, discord_user_id, discord_username, name, class, race, background,
     level, hp, max_hp, ac, strength, dexterity, constitution, intelligence, wisdom, charisma,
     race_option, personality)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    char.campaign_id, char.discord_user_id, char.discord_username,
    char.name, char.class, char.race, char.background,
    char.level, char.hp, char.max_hp, char.ac,
    char.strength, char.dexterity, char.constitution,
    char.intelligence, char.wisdom, char.charisma,
    char.race_option ?? '',
    char.personality ?? '{}'
  );
  return result.lastInsertRowid as number;
}

export function updateCharacterHp(id: number, hp: number) {
  db.prepare("UPDATE characters SET hp = MAX(0, MIN(max_hp + temp_hp, ?)) WHERE id = ?").run(hp, id);
}

export function updateCharacterAc(id: number, ac: number): void {
  db.prepare("UPDATE characters SET ac = ? WHERE id = ?").run(ac, id);
}

export function updateCharacterAvatar(id: number, filename: string) {
  db.prepare("UPDATE characters SET avatar = ? WHERE id = ?").run(filename, id);
}

export function updateCharacterXp(id: number, xp: number) {
  const char = getCharacterById(id)!;
  const newXp = char.xp + xp;
  const newLevel = xpToLevel(newXp);
  const leveledUp = newLevel > char.level;

  let newMaxHp = char.max_hp;
  let totalHpGain = 0;
  let needsSubclass = false;
  let needsASI = false;

  if (leveledUp) {
    const hitDie = CLASSES[char.class.toLowerCase()]?.hitDie ?? 8;
    const conMod = Math.floor((char.constitution - 10) / 2);
    const hillDwarfBonus = char.race.toLowerCase() === "hill-dwarf" ? 1 : 0;
    const gainedLevels = Array.from({ length: newLevel - char.level }, (_, i) => char.level + i + 1);

    for (const _lv of gainedLevels) {
      const gain = Math.max(1, Math.floor(hitDie / 2) + 1 + conMod + hillDwarfBonus);
      newMaxHp += gain;
      totalHpGain += gain;
    }

    const subclassData = SUBCLASSES[char.class.toLowerCase()];
    if (subclassData && gainedLevels.includes(subclassData.unlockLevel) && !char.subclass) {
      needsSubclass = true;
    }
    const asiLevels = ASI_LEVELS[char.class.toLowerCase()] ?? [];
    if (gainedLevels.some(l => asiLevels.includes(l))) needsASI = true;

    const newSpellSlots = getSpellSlots(char.class, newLevel);
    db.prepare("UPDATE characters SET xp = ?, level = ?, max_hp = ?, spell_slots = ? WHERE id = ?")
      .run(newXp, newLevel, newMaxHp, JSON.stringify(newSpellSlots), id);
  } else {
    db.prepare("UPDATE characters SET xp = ? WHERE id = ?").run(newXp, id);
  }

  return { newXp, newLevel, leveledUp, newMaxHp, hpGain: totalHpGain, needsSubclass, needsASI };
}

export function useSpellSlot(charId: number, level: number): { remaining: number } | false {
  const char = getCharacterById(charId);
  if (!char) return false;
  const slots: Record<string, number> = {};
  try { Object.assign(slots, JSON.parse(char.spell_slots || "{}")); } catch { /* leave empty */ }
  const key = String(level);
  if (!(key in slots) || slots[key] <= 0) return false;
  slots[key]--;
  db.prepare("UPDATE characters SET spell_slots = ? WHERE id = ?").run(JSON.stringify(slots), charId);
  return { remaining: slots[key] };
}

export function restoreAllSpellSlots(campaignId: number): void {
  const chars = getAllCharacters(campaignId);
  for (const char of chars) {
    const maxSlots = getSpellSlots(char.class, char.level);
    if (Object.keys(maxSlots).length === 0) continue;
    db.prepare("UPDATE characters SET spell_slots = ? WHERE id = ?").run(JSON.stringify(maxSlots), char.id);
  }
}

export function levelUpCharacter(id: number, targetClass?: string): {
  newLevel: number; mainClassLevel: number; hpGain: number;
  needsASI: boolean; needsSubclass: boolean; isMulticlass: boolean;
} {
  const char = getCharacterById(id)!;
  if (char.level >= 20) {
    return { newLevel: 20, mainClassLevel: 20, hpGain: 0, needsASI: false, needsSubclass: false, isMulticlass: false };
  }

  const cls        = (targetClass ?? char.class).toLowerCase();
  const isMulticlass = cls !== char.class.toLowerCase();
  const hitDie     = CLASSES[cls]?.hitDie ?? 8;
  const conMod     = Math.floor((char.constitution - 10) / 2);
  const hillBonus  = char.race.toLowerCase() === "hill-dwarf" ? 1 : 0;
  const hpGain     = Math.max(1, Math.floor(hitDie / 2) + 1 + conMod + hillBonus);
  const newTotalLevel = char.level + 1;

  const mcEntries: MulticlassEntry[] = JSON.parse(char.multiclass || "[]");
  const mcSum = mcEntries.reduce((s, e) => s + e.level, 0);

  if (isMulticlass) {
    const idx = mcEntries.findIndex(e => e.class.toLowerCase() === cls);
    if (idx >= 0) { mcEntries[idx].level++; } else { mcEntries.push({ class: cls, level: 1, subclass: "" }); }
    db.prepare("UPDATE characters SET level = ?, max_hp = ?, multiclass = ? WHERE id = ?")
      .run(newTotalLevel, char.max_hp + hpGain, JSON.stringify(mcEntries), id);
    const newMcLevel = mcEntries.find(e => e.class.toLowerCase() === cls)!.level;
    return { newLevel: newTotalLevel, mainClassLevel: newMcLevel, hpGain, needsASI: false, needsSubclass: false, isMulticlass: true };
  }

  // Main class level up
  const mainClassLevel = newTotalLevel - mcSum;
  const subclassData   = SUBCLASSES[char.class.toLowerCase()];
  const needsSubclass  = !!(subclassData && subclassData.unlockLevel === mainClassLevel && !char.subclass);
  const asiLevels      = ASI_LEVELS[char.class.toLowerCase()] ?? [];
  const needsASI       = asiLevels.includes(mainClassLevel);
  const newSpellSlots  = getSpellSlots(char.class, newTotalLevel);

  db.prepare("UPDATE characters SET level = ?, max_hp = ?, spell_slots = ? WHERE id = ?")
    .run(newTotalLevel, char.max_hp + hpGain, JSON.stringify(newSpellSlots), id);

  return { newLevel: newTotalLevel, mainClassLevel, hpGain, needsASI, needsSubclass, isMulticlass: false };
}

export function shortRestWarlockSlots(campaignId: number): string[] {
  const chars = getAllCharacters(campaignId);
  const restored: string[] = [];
  for (const char of chars) {
    if (char.class.toLowerCase() !== "warlock") continue;
    const maxSlots = getSpellSlots(char.class, char.level);
    db.prepare("UPDATE characters SET spell_slots = ? WHERE id = ?").run(JSON.stringify(maxSlots), char.id);
    restored.push(char.name);
  }
  return restored;
}

export function longRestHeal(campaignId: number): void {
  db.prepare("UPDATE characters SET hp = max_hp WHERE campaign_id = ?").run(campaignId);
}

export function addInventoryItem(characterId: number, item: Omit<InventoryItem, "id" | "character_id">) {
  db.prepare(
    "INSERT INTO inventory (character_id, name, description, quantity, weight, value, type) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(characterId, item.name, item.description, item.quantity, item.weight, item.value, item.type);
}

export function getInventory(characterId: number) {
  return db.prepare("SELECT * FROM inventory WHERE character_id = ?").all(characterId) as InventoryItem[];
}

export function setItemEquipped(itemId: number, equipped: boolean): boolean {
  const result = db.prepare("UPDATE inventory SET equipped = ? WHERE id = ?").run(equipped ? 1 : 0, itemId);
  return result.changes > 0;
}

export function removeInventoryItem(characterId: number, itemName: string, quantity?: number): boolean {
  const item = db.prepare(
    "SELECT * FROM inventory WHERE character_id = ? AND LOWER(name) = LOWER(?)"
  ).get(characterId, itemName) as InventoryItem | undefined;
  if (!item) return false;
  if (quantity !== undefined && quantity < item.quantity) {
    db.prepare("UPDATE inventory SET quantity = ? WHERE id = ?").run(item.quantity - quantity, item.id);
  } else {
    db.prepare("DELETE FROM inventory WHERE id = ?").run(item.id);
  }
  return true;
}

// ─── Story Log ───────────────────────────────────────────────────────────────

export function addStoryLog(campaignId: number, type: string, content: string, atmosphere?: object) {
  db.prepare("INSERT INTO story_log (campaign_id, type, content, atmosphere) VALUES (?, ?, ?, ?)")
    .run(campaignId, type, content, JSON.stringify(atmosphere ?? {}));
}

export function getRecentStory(campaignId: number, limit = 10) {
  return db.prepare(
    "SELECT * FROM story_log WHERE campaign_id = ? ORDER BY id DESC LIMIT ?"
  ).all(campaignId, limit) as StoryEntry[];
}

// ─── Combat ──────────────────────────────────────────────────────────────────

export function getActiveCombat(campaignId: number) {
  return db.prepare(
    "SELECT * FROM combat_encounters WHERE campaign_id = ? AND active = 1"
  ).get(campaignId) as CombatEncounter | undefined;
}

export function createCombat(campaignId: number, participants: CombatParticipant[]) {
  db.prepare("UPDATE combat_encounters SET active = 0 WHERE campaign_id = ?").run(campaignId);
  const result = db.prepare(
    "INSERT INTO combat_encounters (campaign_id, participants) VALUES (?, ?)"
  ).run(campaignId, JSON.stringify(participants));
  return result.lastInsertRowid as number;
}

export function updateCombat(id: number, data: Partial<CombatEncounter>) {
  if (data.participants !== undefined) {
    db.prepare("UPDATE combat_encounters SET participants = ? WHERE id = ?")
      .run(JSON.stringify(data.participants), id);
  }
  if (data.round !== undefined) {
    db.prepare("UPDATE combat_encounters SET round = ? WHERE id = ?").run(data.round, id);
  }
  if (data.current_turn_index !== undefined) {
    db.prepare("UPDATE combat_encounters SET current_turn_index = ? WHERE id = ?")
      .run(data.current_turn_index, id);
  }
}

export function endCombat(id: number) {
  db.prepare("UPDATE combat_encounters SET active = 0 WHERE id = ?").run(id);
}

// ─── Atmosphere ──────────────────────────────────────────────────────────────

export function getAtmosphere(campaignId: number) {
  return db.prepare("SELECT * FROM atmosphere_state WHERE campaign_id = ?").get(campaignId) as AtmosphereState | undefined;
}

export function updateAtmosphere(campaignId: number, state: Partial<AtmosphereState>) {
  const existing = getAtmosphere(campaignId);
  if (!existing) {
    db.prepare("INSERT INTO atmosphere_state (campaign_id, scene, mood, time_of_day, weather, lighting, sounds, active_effects, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(campaignId,
        state.scene ?? "A new adventure begins",
        state.mood ?? "neutral",
        state.time_of_day ?? "day",
        state.weather ?? "clear",
        state.lighting ?? "daylight",
        JSON.stringify(state.sounds ?? []),
        JSON.stringify(state.active_effects ?? []),
        state.location ?? "Unknown"
      );
  } else {
    const updates: string[] = [];
    const values: unknown[] = [];
    if (state.scene !== undefined) { updates.push("scene = ?"); values.push(state.scene); }
    if (state.mood !== undefined) { updates.push("mood = ?"); values.push(state.mood); }
    if (state.time_of_day !== undefined) { updates.push("time_of_day = ?"); values.push(state.time_of_day); }
    if (state.weather !== undefined) { updates.push("weather = ?"); values.push(state.weather); }
    if (state.lighting !== undefined) { updates.push("lighting = ?"); values.push(state.lighting); }
    if (state.sounds !== undefined) { updates.push("sounds = ?"); values.push(JSON.stringify(state.sounds)); }
    if (state.active_effects !== undefined) { updates.push("active_effects = ?"); values.push(JSON.stringify(state.active_effects)); }
    if (state.location !== undefined) { updates.push("location = ?"); values.push(state.location); }
    if (state.current_map !== undefined) { updates.push("current_map = ?"); values.push(state.current_map); }
    if (state.player_x !== undefined) { updates.push("player_x = ?"); values.push(state.player_x); }
    if (state.player_y !== undefined) { updates.push("player_y = ?"); values.push(state.player_y); }
    if (state.player_positions !== undefined) { updates.push("player_positions = ?"); values.push(state.player_positions); }
    if (updates.length > 0) {
      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(campaignId);
      db.prepare(`UPDATE atmosphere_state SET ${updates.join(", ")} WHERE campaign_id = ?`).run(...values);
    }
  }
}

// ─── Session Messages (conversation history for Claude) ──────────────────────

export function addSessionMessage(campaignId: number, role: "user" | "assistant", content: string) {
  db.prepare("INSERT INTO session_messages (campaign_id, role, content) VALUES (?, ?, ?)")
    .run(campaignId, role, content);
  // Keep last 20 messages only
  db.prepare(`
    DELETE FROM session_messages
    WHERE campaign_id = ? AND id NOT IN (
      SELECT id FROM session_messages WHERE campaign_id = ? ORDER BY id DESC LIMIT 20
    )
  `).run(campaignId, campaignId);
}

export function getSessionMessages(campaignId: number) {
  return db.prepare(
    "SELECT role, content FROM session_messages WHERE campaign_id = ? ORDER BY id ASC"
  ).all(campaignId) as { role: "user" | "assistant"; content: string }[];
}

export function clearSessionMessages(campaignId: number) {
  db.prepare("DELETE FROM session_messages WHERE campaign_id = ?").run(campaignId);
}

export function getSessionSummary(campaignId: number): string {
  const row = db.prepare("SELECT session_summary FROM campaigns WHERE id = ?").get(campaignId) as { session_summary: string } | undefined;
  return row?.session_summary ?? "";
}

export function setSessionSummary(campaignId: number, summary: string) {
  db.prepare("UPDATE campaigns SET session_summary = ? WHERE id = ?").run(summary, campaignId);
}

export function popOldMessages(campaignId: number, keepLast: number): { role: string; content: string }[] {
  const all = db.prepare(
    "SELECT id, role, content FROM session_messages WHERE campaign_id = ? ORDER BY id ASC"
  ).all(campaignId) as { id: number; role: string; content: string }[];
  if (all.length <= keepLast) return [];
  const toCompress = all.slice(0, all.length - keepLast);
  const ids = toCompress.map(m => m.id);
  db.prepare(`DELETE FROM session_messages WHERE id IN (${ids.map(() => "?").join(",")})`).run(...ids);
  return toCompress;
}

// ─── Saved Sessions ───────────────────────────────────────────────────────────

export interface SavedSession {
  id: number;
  campaign_id: number;
  name: string;
  messages_json: string;
  message_count: number;
  is_autosave: number;
  updated_at: string;
  created_at: string;
}

export function saveSession(campaignId: number, name: string): number {
  const messages = getSessionMessages(campaignId);
  const result = db.prepare(
    "INSERT INTO saved_sessions (campaign_id, name, messages_json, message_count, is_autosave) VALUES (?, ?, ?, ?, 0)"
  ).run(campaignId, name, JSON.stringify(messages), messages.length);
  return result.lastInsertRowid as number;
}

export function autoSaveSession(campaignId: number): void {
  const messages = getSessionMessages(campaignId);
  if (messages.length === 0) return;

  const existing = db.prepare(
    "SELECT id FROM saved_sessions WHERE campaign_id = ? AND is_autosave = 1 LIMIT 1"
  ).get(campaignId) as { id: number } | undefined;

  const now = new Date().toISOString().replace("T", " ").substring(0, 16);
  const name = `Autosave — ${now}`;
  const json = JSON.stringify(messages);

  if (existing) {
    db.prepare(
      "UPDATE saved_sessions SET name = ?, messages_json = ?, message_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(name, json, messages.length, existing.id);
  } else {
    db.prepare(
      "INSERT INTO saved_sessions (campaign_id, name, messages_json, message_count, is_autosave) VALUES (?, ?, ?, ?, 1)"
    ).run(campaignId, name, json, messages.length);
  }
}

export function listSavedSessions(campaignId: number): SavedSession[] {
  return db.prepare(
    "SELECT * FROM saved_sessions WHERE campaign_id = ? ORDER BY id DESC"
  ).all(campaignId) as SavedSession[];
}

export function getSavedSession(sessionId: number): SavedSession | undefined {
  return db.prepare("SELECT * FROM saved_sessions WHERE id = ?").get(sessionId) as SavedSession | undefined;
}

export function loadSavedSession(campaignId: number, sessionId: number): number {
  const save = getSavedSession(sessionId);
  if (!save) return 0;
  const messages = JSON.parse(save.messages_json) as { role: "user" | "assistant"; content: string }[];
  clearSessionMessages(campaignId);
  const insert = db.prepare("INSERT INTO session_messages (campaign_id, role, content) VALUES (?, ?, ?)");
  for (const msg of messages) {
    insert.run(campaignId, msg.role, msg.content);
  }
  return messages.length;
}

export function deleteSavedSession(sessionId: number) {
  db.prepare("DELETE FROM saved_sessions WHERE id = ?").run(sessionId);
}

export function renameSavedSession(sessionId: number, name: string) {
  db.prepare("UPDATE saved_sessions SET name = ? WHERE id = ?").run(name, sessionId);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function xpToLevel(xp: number): number {
  const thresholds = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i + 1;
    else break;
  }
  return Math.min(level, 20);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Campaign {
  id: number;
  name: string;
  description: string;
  language: "th" | "en";
  adventure_id: string | null;
  adventure_data: string;
  created_at: string;
  active: number;
  dm_name: string;
}

export interface Character {
  id: number;
  campaign_id: number;
  discord_user_id: string;
  discord_username: string;
  name: string;
  class: string;
  race: string;
  background: string;
  level: number;
  xp: number;
  hp: number;
  max_hp: number;
  temp_hp: number;
  ac: number;
  initiative_bonus: number;
  speed: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  gold: number;
  silver: number;
  copper: number;
  spell_slots: string;
  conditions: string;
  notes: string;
  avatar: string;
  skill_proficiencies: string;
  subclass: string;
  multiclass: string;
  race_option: string;
  personality: string;       // JSON: { traits, ideals, bonds, flaws, appearance, backstory }
  prepared_spells: string;   // JSON: string[] — spell names currently prepared
  created_at: string;
}

export interface InventoryItem {
  id: number;
  character_id: number;
  name: string;
  description: string;
  quantity: number;
  weight: number;
  value: number;
  type: string;
  equipped: number;
}

export interface StoryEntry {
  id: number;
  campaign_id: number;
  session_number: number;
  type: string;
  content: string;
  atmosphere: string;
  created_at: string;
}

export interface CombatEncounter {
  id: number;
  campaign_id: number;
  active: number;
  round: number;
  current_turn_index: number;
  participants: CombatParticipant[] | string;
  created_at: string;
}

export interface CombatParticipant {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  max_hp: number;
  ac: number;
  is_player: boolean;
  discord_user_id?: string;
  conditions: string[];
  took_turn: boolean;
  avatar?: string;   // filename under /monsters/ (monsters) or looked up from character (players)
  map_x?: number;   // 0.0–1.0 position on current map
  map_y?: number;
}

export interface AtmosphereState {
  id: number;
  campaign_id: number;
  scene: string;
  mood: string;
  time_of_day: string;
  weather: string;
  lighting: string;
  sounds: string;
  active_effects: string;
  location: string;
  current_map: string;
  player_x: number;
  player_y: number;
  player_positions: string; // JSON: {"charId": {x, y}}
  updated_at: string;
}
