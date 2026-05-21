import Fastify from "fastify";
import FastifyStatic from "@fastify/static";
import FastifyCors from "@fastify/cors";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { config } from "../config.js";
import {
  getActiveCampaign, getAtmosphere, getActiveCombat, getAllCharacters,
  getCharacterById, getInventory, createCharacter,
  updateCharacterSkills, addInventoryItem,
  longRestHeal, restoreAllSpellSlots, shortRestWarlockSlots, updateCharacterHp,
  getAllCampaigns, getCampaignsByDm, getCampaignPlayerCount,
  setActiveCampaign, updateCampaignAdventure, createCampaign,
  getUserByUsername, createUser,
  setItemEquipped, updateCharacterAc, levelUpCharacter, updateCharacterSubclass,
  updatePreparedSpells, getPreparedSpells, addSessionMessage,
} from "../db/database.js";
import { listAdventures, loadAdventure } from "../scripts/loader.js";
import {
  CLASSES, RACES, BACKGROUNDS, SKILLS, CLASS_DEFAULT_SKILLS, BACKGROUND_SKILLS,
  getSpellSlots, calcAcBase, applyRacialBonuses, SUBCLASSES, RACE_OPTIONS,
  StatName,
} from "../game/character-data.js";
import {
  getSpellsForClass, getFeaturesForClass, getMaxSpellLevel,
  isSpellPreparer, maxPreparedSpells, SPELL_PREPARERS,
} from "../game/abilities.js";
import { CLASS_EQUIPMENT_GROUPS } from "../game/equipment.js";
import { runDm } from "../agent/dm.js";
import { runMimoDm } from "../agent/dm-mimo.js";
import {
  getPendingRoll, clearPendingRoll,
  getPendingPartyRoll, clearPendingPartyRoll,
  broadcast,
  PendingPartyRoll,
} from "../agent/dm-shared.js";
import { rollDice } from "../game/dice.js";
import { nextTurn, finishCombat } from "../game/combat.js";

function recalcAc(charId: number): number {
  const char = getCharacterById(charId);
  if (!char) return 10;
  const inv    = getInventory(charId);
  const dexMod = Math.floor((char.dexterity - 10) / 2);
  const conMod = Math.floor((char.constitution - 10) / 2);
  const wisMod = Math.floor((char.wisdom - 10) / 2);

  const armor  = inv.find(i => i.equipped && i.type === "armor");
  const shield = inv.find(i => i.equipped && i.type === "shield");
  const shieldBonus = shield ? 2 : 0;

  let ac: number;
  if (!armor) {
    // Unarmored defense
    const cls = char.class.toLowerCase();
    if (cls === "barbarian") ac = 10 + dexMod + conMod;
    else if (cls === "monk")  ac = 10 + dexMod + wisMod;
    else                       ac = 10 + dexMod;
  } else {
    const desc = armor.description ?? "";
    const medMatch   = desc.match(/AC\s*(\d+)\+DEX\s*\(max \+(\d+)\)/i);
    const lightMatch = desc.match(/AC\s*(\d+)\+DEX/i);
    const heavyMatch = desc.match(/AC\s*(\d+)/i);
    if (medMatch)   ac = parseInt(medMatch[1])  + Math.min(dexMod, parseInt(medMatch[2]));
    else if (lightMatch) ac = parseInt(lightMatch[1]) + dexMod;
    else if (heavyMatch) ac = parseInt(heavyMatch[1]);
    else ac = 10 + dexMod;
  }

  ac += shieldBonus;
  updateCharacterAc(charId, ac);
  return ac;
}

// ── WebSocket broadcast ───────────────────────────────────────────────────

interface BroadcastClient {
  ws: WebSocket;
  campaignId?: number;
  isAlive: boolean;
}

const clients = new Set<BroadcastClient>();

export function broadcastEvent(campaignId: number, event: string, data: unknown): void {
  const payload = JSON.stringify({ event, data, timestamp: Date.now() });
  for (const client of clients) {
    if (client.campaignId === campaignId && client.ws.readyState === WebSocket.OPEN) {
      try { client.ws.send(payload); } catch { clients.delete(client); }
    }
  }
}

function sendInitialState(ws: WebSocket): void {
  const campaign = getActiveCampaign();
  if (!campaign) return;

  const atmosphere = getAtmosphere(campaign.id);
  const characters = getAllCharacters(campaign.id);
  const encounter = getActiveCombat(campaign.id);

  ws.send(JSON.stringify({
    event: "init",
    data: {
      campaign: { id: campaign.id, name: campaign.name },
      atmosphere,
      characters: characters.map(c => ({
        id: c.id, name: c.name, class: c.class, race: c.race,
        level: c.level, hp: c.hp, max_hp: c.max_hp, ac: c.ac, is_player: true, avatar: c.avatar ?? "",
        spell_slots: (() => { try { return JSON.parse(c.spell_slots || "{}"); } catch { return {}; } })(),
      })),
      combat: encounter ? {
        active: true,
        round: encounter.round,
        current_turn_index: encounter.current_turn_index,
        participants: typeof encounter.participants === "string"
          ? JSON.parse(encounter.participants)
          : encounter.participants,
      } : { active: false },
    },
    timestamp: Date.now()
  }));
}

// ── Roll helper ───────────────────────────────────────────────────────────

type RollResult = { total: number; breakdown: string; isCritical?: boolean; isCriticalFail?: boolean };

function rollExpression(expression: string, advantage: "normal" | "advantage" | "disadvantage"): RollResult {
  if (advantage === "normal") {
    const r = rollDice(expression);
    return { total: r.total, breakdown: r.breakdown, isCritical: r.isCritical, isCriticalFail: r.isCriticalFail };
  }
  const modMatch = expression.match(/^1?d20([+-]\d+)?$/i);
  const modifier = modMatch?.[1] ? parseInt(modMatch[1]) : 0;
  const r1 = Math.floor(Math.random() * 20) + 1;
  const r2 = Math.floor(Math.random() * 20) + 1;
  const kept    = advantage === "advantage" ? Math.max(r1, r2) : Math.min(r1, r2);
  const dropped = advantage === "advantage" ? Math.min(r1, r2) : Math.max(r1, r2);
  const total   = kept + modifier;
  const modStr  = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : "";
  const label   = advantage === "advantage" ? "Adv" : "Dis";
  return {
    total,
    breakdown: `[${dropped}, ${kept}]${modStr} = ${total} (${label})`,
    isCritical: kept === 20 && modifier === 0,
    isCriticalFail: kept === 1 && modifier === 0,
  };
}

async function resolveWebPartyRoll(partyRoll: PendingPartyRoll, useMimo = false): Promise<{ narrative: string; pendingRoll: unknown | null }> {
  const { entries, purpose, expression, dc, mode, campaignId } = partyRoll;
  const rolled = entries.filter(e => e.rolled);
  const resultLines = entries.map(e =>
    e.rolled
      ? `${e.characterName}: ${e.breakdown} = ${e.result}${dc !== undefined ? ` — DC ${dc}: ${e.result! >= dc ? "SUCCESS" : "FAIL"}` : ""}`
      : `${e.characterName}: did not roll`
  );
  let verdict = "";
  if (mode === "group_check" && dc !== undefined && rolled.length > 0) {
    const successes = rolled.filter(e => e.result! >= dc).length;
    verdict = `Group: ${successes}/${rolled.length} — Party ${successes >= Math.ceil(rolled.length / 2) ? "SUCCEEDS" : "FAILS"}`;
  } else if (mode === "lowest_wins" && rolled.length > 0) {
    const worst = Math.min(...rolled.map(e => e.result!));
    const worstChar = rolled.find(e => e.result === worst)!;
    verdict = `Worst: ${worstChar.characterName} = ${worst}${dc !== undefined ? ` — DC ${dc}: ${worst >= dc ? "SUCCESS" : "FAIL"}` : ""}`;
  }
  const dmMessage = [`[Party Roll — ${purpose} (${expression})]`, ...resultLines, verdict].filter(Boolean).join("\n");
  try {
    const r = useMimo ? await runMimoDm(campaignId, dmMessage) : await runDm(campaignId, dmMessage);
    return { narrative: r.narrative, pendingRoll: r.pendingRoll ?? null };
  } catch { return { narrative: "", pendingRoll: null }; }
}

// ── Password helpers ─────────────────────────────────────────────────────

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computed = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(computed, Buffer.from(hash, "hex"));
  } catch { return false; }
}

// ── Auth helpers ─────────────────────────────────────────────────────────

type AuthUser = { role: string; name: string };

function createToken(role: string, name = ""): string {
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const data = `${role}:${name}:${expiry}`;
  const sig = crypto.createHmac("sha256", config.web.secret).update(data).digest("hex").slice(0, 16);
  return Buffer.from(`${data}:${sig}`).toString("base64url");
}

function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length === 4) {
      const [role, name, expiry, sig] = parts;
      if (Date.now() > parseInt(expiry)) return null;
      const data = `${role}:${name}:${expiry}`;
      const expected = crypto.createHmac("sha256", config.web.secret).update(data).digest("hex").slice(0, 16);
      if (sig !== expected) return null;
      return { role, name };
    }
    // backward-compat: old 3-part tokens
    if (parts.length === 3) {
      const [role, expiry, sig] = parts;
      if (Date.now() > parseInt(expiry)) return null;
      const data = `${role}:${expiry}`;
      const expected = crypto.createHmac("sha256", config.web.secret).update(data).digest("hex").slice(0, 16);
      if (sig !== expected) return null;
      return { role, name: role === "dm" ? "dm" : "" };
    }
    return null;
  } catch { return null; }
}

function getTokenFromRequest(req: { headers: Record<string, string | string[] | undefined> }): AuthUser | null {
  const auth = req.headers["authorization"];
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

function requireDm(req: { headers: Record<string, string | string[] | undefined> }, reply: { status: (n: number) => { send: (v: unknown) => unknown } }): boolean {
  const user = getTokenFromRequest(req);
  if (!user || user.role !== "dm") {
    reply.status(403).send({ error: "DM access required" });
    return false;
  }
  return true;
}

// ── Web server ────────────────────────────────────────────────────────────

export async function startWebServer(): Promise<void> {
  const app = Fastify({ logger: false });

  await app.register(FastifyCors, { origin: true });
  await app.register(FastifyStatic, {
    root: path.join(process.cwd(), "src/web/public"),
    prefix: "/",
  });

  const mapsDir = path.join(process.cwd(), "maps");
  if (!fs.existsSync(mapsDir)) fs.mkdirSync(mapsDir, { recursive: true });
  await app.register(FastifyStatic, { root: mapsDir, prefix: "/maps/", decorateReply: false });

  const avatarsDir = path.join(process.cwd(), "avatars");
  if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
  await app.register(FastifyStatic, { root: avatarsDir, prefix: "/avatars/", decorateReply: false });

  const monstersDir = path.join(process.cwd(), "monsters");
  if (!fs.existsSync(monstersDir)) fs.mkdirSync(monstersDir, { recursive: true });
  await app.register(FastifyStatic, { root: monstersDir, prefix: "/monsters/", decorateReply: false });

  // ── Clean URL Routes ───────────────────────────────────────────────────
  app.get("/story", (_req, reply) => reply.sendFile("story.html"));
  app.get("/game",  (_req, reply) => reply.sendFile("game.html"));
  const folioMap: Record<string, string> = {
    "aurora":       "folio/aurora.html",
    "aython":       "folio/aython.html",
    "kael-veranth": "folio/kael-veranth.html",
    "anuchit":      "folio/anuchit.html",
    "kael-vorn":    "folio/kael-vorn.html",
    "jen":          "folio/jen.html",
  };
  for (const [slug, file] of Object.entries(folioMap)) {
    app.get(`/folio/${slug}`, (_req, reply) => reply.sendFile(file));
  }
  app.get("/sessions/:slug", (req, reply) => {
    const { slug } = req.params as { slug: string };
    return reply.sendFile(`sessions/${slug}.html`);
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  // Check if username exists
  app.get("/api/auth/user-exists/:username", async (req, reply) => {
    const { username } = req.params as { username: string };
    const user = getUserByUsername(username.trim());
    return reply.send({ exists: !!user });
  });

  // Register new user
  app.post("/api/auth/register", async (req, reply) => {
    const { username, password, roles, accessCode } = req.body as {
      username?: string; password?: string; roles?: string[]; accessCode?: string;
    };
    const name = username?.trim() ?? "";
    if (!name || !password) return reply.status(400).send({ error: "username และ password จำเป็น" });
    if (name.length < 2) return reply.status(400).send({ error: "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร" });
    if (password.length < 4) return reply.status(400).send({ error: "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร" });

    const wantedRoles = Array.isArray(roles) && roles.length > 0 ? roles : ["player"];

    // Validate DM access code if registering as DM
    if (wantedRoles.includes("dm")) {
      const validCode = config.web.dmAccounts.some(a => a.password === accessCode);
      if (!validCode) return reply.status(403).send({ error: "DM Access Code ไม่ถูกต้อง" });
    }

    if (getUserByUsername(name)) return reply.status(409).send({ error: "ชื่อนี้ถูกใช้ไปแล้ว" });

    const { hash, salt } = hashPassword(password);
    createUser(name, hash, salt, wantedRoles);
    return reply.send({ ok: true });
  });

  // Validate credentials → return available roles (no token yet)
  app.post("/api/auth/check", async (req, reply) => {
    const { username, password } = req.body as { username?: string; password?: string };
    const name = username?.trim() ?? "";
    if (!name || !password) return reply.status(400).send({ error: "username และ password จำเป็น" });
    const user = getUserByUsername(name);
    if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
      return reply.status(401).send({ error: "ชื่อหรือรหัสผ่านไม่ถูกต้อง" });
    }
    const roles: string[] = (() => { try { return JSON.parse(user.roles); } catch { return ["player"]; } })();
    return reply.send({ roles });
  });

  // Issue token for chosen role
  app.post("/api/auth/login", async (req, reply) => {
    const { username, password, role } = req.body as { username?: string; password?: string; role?: string };
    const name = username?.trim() ?? "";
    if (!name || !password || !role) return reply.status(400).send({ error: "username, password, role จำเป็น" });
    const user = getUserByUsername(name);
    if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
      return reply.status(401).send({ error: "ชื่อหรือรหัสผ่านไม่ถูกต้อง" });
    }
    const roles: string[] = (() => { try { return JSON.parse(user.roles); } catch { return ["player"]; } })();
    if (!roles.includes(role)) return reply.status(403).send({ error: `ไม่มีสิทธิ์ ${role}` });
    return reply.send({ role, name, token: createToken(role, name) });
  });

  app.get("/api/auth/me", async (req, reply) => {
    const user = getTokenFromRequest(req as any);
    if (!user) return reply.status(401).send({ error: "Not authenticated" });
    return reply.send(user);
  });

  // ── Game State ─────────────────────────────────────────────────────────

  app.get("/api/state", async (_req, reply) => {
    const campaign = getActiveCampaign();
    if (!campaign) return reply.status(404).send({ error: "No active campaign" });
    const atmosphere = getAtmosphere(campaign.id);
    const characters = getAllCharacters(campaign.id);
    const encounter  = getActiveCombat(campaign.id);
    return {
      campaign: { id: campaign.id, name: campaign.name, language: campaign.language },
      atmosphere,
      characters: characters.map(c => ({
        id: c.id, name: c.name, class: c.class, race: c.race,
        level: c.level, hp: c.hp, max_hp: c.max_hp, ac: c.ac, is_player: true, avatar: c.avatar ?? "",
        spell_slots: (() => { try { return JSON.parse(c.spell_slots || "{}"); } catch { return {}; } })(),
      })),
      combat: encounter ? {
        active: true, round: encounter.round,
        current_turn_index: encounter.current_turn_index,
        participants: typeof encounter.participants === "string"
          ? JSON.parse(encounter.participants) : encounter.participants,
      } : { active: false },
    };
  });

  // ── Character ──────────────────────────────────────────────────────────

  app.get("/api/character/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const char = getCharacterById(parseInt(id));
    if (!char) return reply.status(404).send({ error: "Character not found" });
    const inventory    = getInventory(char.id);
    const slots        = (() => { try { return JSON.parse(char.spell_slots || "{}"); } catch { return {}; } })();
    const maxSlots     = getSpellSlots(char.class, char.level);
    const classData    = CLASSES[char.class.toLowerCase()];
    const savingThrows = classData?.savingThrows ?? [];
    const conditions   = (() => { try { return JSON.parse(char.conditions || "[]"); } catch { return []; } })();
    const skills       = (() => { try { return JSON.parse(char.skill_proficiencies || "[]"); } catch { return []; } })();
    const xpThresholds     = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
    const nextLvXp         = xpThresholds[Math.min(char.level, 19)] ?? null;
    const multiclassEntries = (() => { try { return JSON.parse(char.multiclass || "[]"); } catch { return []; } })();
    return { ...char, spell_slots: slots, max_spell_slots: maxSlots, inventory, savingThrows, conditions, skills, nextLvXp, multiclassEntries };
  });

  // ── Game Options (for character creation) ─────────────────────────────

  app.get("/api/game/options", async () => {
    return {
      classes: Object.entries(CLASSES).map(([id, c]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        hitDie: c.hitDie,
        spellcaster: c.spellcaster,
        spellcastingStat: c.spellcastingStat ?? null,
        primaryStats: c.primaryStats,
        savingThrows: c.savingThrows,
        level1Features: c.level1Features,
        startingEquipment: c.startingEquipment,
      })),
      races: Object.entries(RACES).map(([id, r]) => ({
        id, display: r.display, bonuses: r.bonuses, speed: r.speed, traits: r.traits,
      })),
      backgrounds: BACKGROUNDS,
      skills: Object.keys(SKILLS),
      classSkills: CLASS_DEFAULT_SKILLS,
      bgSkills: BACKGROUND_SKILLS,
      standardArray: [15, 14, 13, 12, 10, 8],
      equipmentGroups: CLASS_EQUIPMENT_GROUPS,
      raceOptions: RACE_OPTIONS,
    };
  });

  // ── Create Character ───────────────────────────────────────────────────

  app.post("/api/characters", async (req, reply) => {
    const body = req.body as {
      name: string; charClass: string; race: string; background: string;
      stats: Record<string, number>; skills: string[]; playerName: string;
      equipChoices?: number[];   // index of chosen option per equipment group
      raceOption?: string;       // e.g. "red" for Dragonborn draconic ancestry
      personality?: Record<string, string>;  // traits, ideals, bonds, flaws, appearance, backstory
    };
    const campaign = getActiveCampaign();
    if (!campaign) return reply.status(404).send({ error: "No active campaign" });
    const classData = CLASSES[body.charClass];
    if (!classData) return reply.status(400).send({ error: `Unknown class: ${body.charClass}` });

    const finalStats = applyRacialBonuses(body.stats as Record<StatName, number>, body.race);
    const maxHp = Math.max(1, classData.hitDie + Math.floor((finalStats.constitution - 10) / 2));
    const speed = RACES[body.race]?.speed ?? 30;

    const charId = createCharacter({
      campaign_id: campaign.id,
      discord_user_id: `web_${body.playerName.toLowerCase().replace(/\s+/g, "_")}`,
      discord_username: body.playerName,
      name: body.name, class: body.charClass, race: body.race, background: body.background,
      level: 1, xp: 0, hp: maxHp, max_hp: maxHp, temp_hp: 0, ac: 10,
      initiative_bonus: Math.floor((finalStats.dexterity - 10) / 2),
      speed,
      strength: finalStats.strength, dexterity: finalStats.dexterity,
      constitution: finalStats.constitution, intelligence: finalStats.intelligence,
      wisdom: finalStats.wisdom, charisma: finalStats.charisma,
      gold: 10, silver: 0, copper: 0,
      spell_slots: JSON.stringify(getSpellSlots(body.charClass, 1)),
      conditions: "[]", notes: "",
      race_option: body.raceOption ?? "",
      personality: JSON.stringify(body.personality ?? {}),
      prepared_spells: "[]",
    });

    updateCharacterSkills(charId, body.skills);

    // Resolve equipment from choices; fall back to class default items
    const groups    = CLASS_EQUIPMENT_GROUPS[body.charClass] ?? [];
    const choices   = body.equipChoices ?? [];
    const itemsToAdd = groups.length > 0
      ? groups.flatMap((grp, gi) => {
          const optIdx = Math.min(choices[gi] ?? 0, grp.options.length - 1);
          return grp.options[optIdx].items;
        })
      : classData.startingItems;

    for (const item of itemsToAdd) {
      addInventoryItem(charId, {
        name: item.name, description: item.description,
        quantity: item.quantity, type: item.type,
        value: item.value, weight: item.weight, equipped: item.equipped,
      });
    }

    // Recalculate AC based on actually equipped armor
    const finalAc = recalcAc(charId);

    broadcast(campaign.id, "party_update", getAllCharacters(campaign.id).map(c => ({
      id: c.id, name: c.name, class: c.class, race: c.race,
      level: c.level, hp: c.hp, max_hp: c.max_hp, ac: c.ac, is_player: true, avatar: c.avatar ?? "",
      spell_slots: (() => { try { return JSON.parse(c.spell_slots || "{}"); } catch { return {}; } })(),
    })));

    return { id: charId, name: body.name, hp: maxHp, ac: finalAc };
  });

  // ── Human DM Narrate ──────────────────────────────────────────────────

  app.post("/api/dm/narrate", async (req, reply) => {
    if (!requireDm(req as any, reply)) return;
    const { message } = req.body as { message: string };
    const campaign = getActiveCampaign();
    if (!campaign) return reply.status(404).send({ error: "No active campaign" });
    if (!message?.trim()) return reply.status(400).send({ error: "message required" });
    addSessionMessage(campaign.id, "assistant", message.trim());
    broadcast(campaign.id, "dm_narrative", { narrative: message.trim() });
    return { ok: true, narrative: message.trim() };
  });

  // ── DM Chat ────────────────────────────────────────────────────────────

  app.post("/api/dm", async (req, reply) => {
    const { message, characterName, provider = "default" } = req.body as {
      message: string; characterName?: string; provider?: string;
    };
    const campaign = getActiveCampaign();
    if (!campaign) return reply.status(404).send({ error: "No active campaign" });
    const fullMsg = characterName ? `**${characterName}**: ${message}` : message;
    try {
      const response = provider === "mimo"
        ? await runMimoDm(campaign.id, fullMsg)
        : await runDm(campaign.id, fullMsg);
      return {
        narrative: response.narrative,
        combatUpdate: response.combatUpdate ?? null,
        pendingRoll: response.pendingRoll ?? null,
        pendingPartyRoll: response.pendingPartyRoll
          ? {
              groupId: response.pendingPartyRoll.groupId,
              expression: response.pendingPartyRoll.expression,
              purpose: response.pendingPartyRoll.purpose,
              dc: response.pendingPartyRoll.dc,
              advantage: response.pendingPartyRoll.advantage,
              mode: response.pendingPartyRoll.mode,
              entries: response.pendingPartyRoll.entries.map(e => ({
                characterName: e.characterName, rolled: false,
              })),
            }
          : null,
        levelUpEvents: response.levelUpEvents ?? [],
      };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : "DM error" });
    }
  });

  // ── Roll submission ────────────────────────────────────────────────────

  app.post("/api/roll/:rollId", async (req, reply) => {
    const { rollId } = req.params as { rollId: string };
    const { provider = "default" } = (req.body ?? {}) as { provider?: string };
    const pending = getPendingRoll(rollId);
    if (!pending) return reply.status(404).send({ error: "Roll expired or not found" });
    clearPendingRoll(rollId);
    const campaign = getActiveCampaign();
    if (!campaign) return reply.status(404).send({ error: "No active campaign" });

    const result = rollExpression(pending.expression, pending.advantage);
    const dcPart   = pending.dc !== undefined ? `, DC ${pending.dc} — ${result.total >= pending.dc ? "SUCCESS" : "FAIL"}` : "";
    const critPart = result.isCritical ? ", CRITICAL HIT" : result.isCriticalFail ? ", CRITICAL FAIL" : "";
    const rollMsg  = `[Roll Result] ${pending.characterName} rolled ${pending.purpose} (${pending.expression}): total = ${result.total}${dcPart}${critPart}`;

    try {
      const dmResponse = provider === "mimo"
        ? await runMimoDm(campaign.id, rollMsg)
        : await runDm(campaign.id, rollMsg);
      return {
        roll: result,
        narrative: dmResponse.narrative,
        pendingRoll: dmResponse.pendingRoll ?? null,
        pendingPartyRoll: dmResponse.pendingPartyRoll ?? null,
        levelUpEvents: dmResponse.levelUpEvents ?? [],
      };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : "DM error" });
    }
  });

  // ── Party roll submission ──────────────────────────────────────────────

  app.post("/api/party-roll/:groupId/:charIdx", async (req, reply) => {
    const { groupId, charIdx } = req.params as { groupId: string; charIdx: string };
    const { provider = "default" } = (req.body ?? {}) as { provider?: string };
    const partyRoll = getPendingPartyRoll(groupId);
    if (!partyRoll) return reply.status(404).send({ error: "Party roll expired" });

    const idx   = parseInt(charIdx);
    const entry = partyRoll.entries[idx];
    if (!entry) return reply.status(404).send({ error: "Character index out of range" });
    if (entry.rolled) return { alreadyRolled: true, result: entry.result };

    const result = rollExpression(partyRoll.expression, partyRoll.advantage);
    entry.rolled = true; entry.result = result.total;
    entry.breakdown = result.breakdown;
    entry.isCritical = result.isCritical; entry.isCriticalFail = result.isCriticalFail;

    broadcast(partyRoll.campaignId, "party_roll_update", {
      groupId,
      entries: partyRoll.entries.map(e => ({ characterName: e.characterName, rolled: e.rolled, result: e.result })),
    });

    const allRolled = partyRoll.entries.every(e => e.rolled);
    if (allRolled) {
      clearPendingPartyRoll(groupId);
      const { narrative, pendingRoll } = await resolveWebPartyRoll(partyRoll, provider === "mimo");
      return { roll: result, allDone: true, narrative, pendingRoll };
    }
    return { roll: result, allDone: false };
  });

  // ── Rest ───────────────────────────────────────────────────────────────

  app.post("/api/rest/long", async (_req, reply) => {
    const campaign = getActiveCampaign();
    if (!campaign) return reply.status(404).send({ error: "No active campaign" });
    longRestHeal(campaign.id);
    restoreAllSpellSlots(campaign.id);
    const chars = getAllCharacters(campaign.id);
    broadcast(campaign.id, "long_rest", { description: "Long rest" });
    broadcast(campaign.id, "party_update", chars.map(c => ({
      id: c.id, name: c.name, class: c.class, race: c.race,
      level: c.level, hp: c.max_hp, max_hp: c.max_hp, ac: c.ac, is_player: true, avatar: c.avatar ?? "",
      spell_slots: (() => { try { return JSON.parse(c.spell_slots || "{}"); } catch { return {}; } })(),
    })));
    return { ok: true };
  });

  app.post("/api/rest/short", async (req, reply) => {
    const { characterName, hitDice = 0 } = (req.body ?? {}) as { characterName?: string; hitDice?: number };
    const campaign = getActiveCampaign();
    if (!campaign) return reply.status(404).send({ error: "No active campaign" });
    const restored = shortRestWarlockSlots(campaign.id);
    let hpRecovered = 0;
    if (characterName && hitDice > 0) {
      const char = getAllCharacters(campaign.id).find(c => c.name.toLowerCase() === characterName.toLowerCase());
      if (char) {
        const hitDie = CLASSES[char.class.toLowerCase()]?.hitDie ?? 8;
        const conMod = Math.floor((char.constitution - 10) / 2);
        for (let i = 0; i < Math.min(hitDice, char.level); i++) {
          const r = rollDice(`1d${hitDie}${conMod >= 0 ? "+" : ""}${conMod}`);
          hpRecovered += Math.max(0, r.total);
        }
        updateCharacterHp(char.id, Math.min(char.max_hp, char.hp + hpRecovered));
        broadcast(campaign.id, "party_update", getAllCharacters(campaign.id).map(c => ({
          id: c.id, name: c.name, class: c.class, race: c.race,
          level: c.level, hp: c.hp, max_hp: c.max_hp, ac: c.ac, is_player: true, avatar: c.avatar ?? "",
          spell_slots: (() => { try { return JSON.parse(c.spell_slots || "{}"); } catch { return {}; } })(),
        })));
      }
    }
    broadcast(campaign.id, "short_rest", { description: "Short rest" });
    return { ok: true, restoredWarlocks: restored, hpRecovered };
  });

  // ── Combat ─────────────────────────────────────────────────────────────

  app.post("/api/combat/next", async (_req, reply) => {
    const campaign = getActiveCampaign();
    if (!campaign) return reply.status(404).send({ error: "No active campaign" });
    const result = nextTurn(campaign.id);
    if (!result) return reply.status(400).send({ error: "No active combat" });
    return { participant: result.participant.name, round: result.round, isNewRound: result.isNewRound };
  });

  app.post("/api/combat/reset", async (_req, reply) => {
    const campaign = getActiveCampaign();
    if (!campaign) return reply.status(404).send({ error: "No active campaign" });
    finishCombat(campaign.id);
    broadcast(campaign.id, "combat_end", { outcome: "reset" });
    return { ok: true };
  });

  // ── Dice ───────────────────────────────────────────────────────────────

  app.post("/api/dice", async (req, reply) => {
    const { expression } = (req.body ?? {}) as { expression?: string };
    if (!expression) return reply.status(400).send({ error: "expression required" });
    try {
      const r = rollDice(expression);
      return { total: r.total, breakdown: r.breakdown };
    } catch {
      return reply.status(400).send({ error: "Invalid expression" });
    }
  });

  // ── Inventory ──────────────────────────────────────────────────────────

  app.patch("/api/inventory/:itemId/equip", async (req, reply) => {
    const itemId = parseInt((req.params as { itemId: string }).itemId);
    const { equipped, charId } = req.body as { equipped: boolean; charId?: number };
    if (isNaN(itemId)) return reply.status(400).send({ error: "invalid itemId" });
    const ok = setItemEquipped(itemId, equipped);
    if (!ok) return reply.status(404).send({ error: "Item not found" });

    // Recalculate AC when armor or shield changes
    if (charId) {
      const newAc = recalcAc(charId);
      const campaign = getActiveCampaign();
      if (campaign) {
        const chars = getAllCharacters(campaign.id);
        broadcast(campaign.id, "party_update", chars.map(c => ({
          id: c.id, name: c.name, class: c.class, race: c.race,
          level: c.level, hp: c.hp, max_hp: c.max_hp, ac: c.ac, is_player: true, avatar: c.avatar ?? "",
          spell_slots: (() => { try { return JSON.parse(c.spell_slots || "{}"); } catch { return {}; } })(),
        })));
      }
      return { ok: true, newAc };
    }
    return { ok: true };
  });

  // ── Campaigns ──────────────────────────────────────────────────────────

  app.get("/api/campaigns", async (req) => {
    const user = getTokenFromRequest(req as any);
    const isDm = user?.role === "dm";
    const campaigns = isDm
      ? getCampaignsByDm(user!.name)
      : getAllCampaigns();
    return campaigns.map(c => ({
      id: c.id, name: c.name, description: c.description,
      language: c.language, active: c.active === 1,
      adventure_id: c.adventure_id ?? null,
      dm_name: c.dm_name ?? "dm",
      playerCount: getCampaignPlayerCount(c.id),
    }));
  });

  app.post("/api/campaign", async (req, reply) => {
    if (!requireDm(req as any, reply)) return;
    const user = getTokenFromRequest(req as any)!;
    const { name, description = "", language = "th" } = req.body as {
      name?: string; description?: string; language?: "th" | "en";
    };
    if (!name?.trim()) return reply.status(400).send({ error: "name required" });
    const id = createCampaign(name.trim(), description, language, user.name);
    return { id, name: name.trim() };
  });

  app.post("/api/campaign/:id/activate", async (req, reply) => {
    if (!requireDm(req as any, reply)) return;
    const id = parseInt((req.params as { id: string }).id);
    if (isNaN(id)) return reply.status(400).send({ error: "invalid id" });
    setActiveCampaign(id);
    const campaign = getActiveCampaign();
    if (campaign) broadcastEvent(id, "campaign_changed", { id: campaign.id, name: campaign.name });
    return { ok: true };
  });

  app.post("/api/character/:id/levelup", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { className } = (req.body ?? {}) as { className?: string };
    const char = getCharacterById(parseInt(id));
    if (!char) return reply.status(404).send({ error: "Character not found" });
    if (char.level >= 20) return reply.status(400).send({ error: "Already at maximum level 20" });

    const result = levelUpCharacter(parseInt(id), className);

    const leveledClass  = className ?? char.class;
    const newFeatures   = getFeaturesForClass(leveledClass, result.mainClassLevel)
                            .filter(f => f.level === result.mainClassLevel);

    // Include subclass options when the unlock level is reached
    const subclassData  = !result.isMulticlass ? SUBCLASSES[leveledClass.toLowerCase()] : undefined;
    const subclassOptions = result.needsSubclass && subclassData ? subclassData.options : [];
    const subclassLabel   = result.needsSubclass && subclassData ? subclassData.label : "";

    const campaign = getActiveCampaign();
    if (campaign) {
      const updated = getAllCharacters(campaign.id);
      broadcastEvent(campaign.id, "party_update", updated.map(c => ({
        id: c.id, name: c.name, class: c.class, race: c.race,
        level: c.level, hp: c.hp, max_hp: c.max_hp, ac: c.ac,
        is_player: true, avatar: c.avatar ?? "",
        spell_slots: (() => { try { return JSON.parse(c.spell_slots || "{}"); } catch { return {}; } })(),
      })));
    }

    return { ...result, newFeatures, leveledClass, subclassOptions, subclassLabel };
  });

  app.post("/api/character/:id/subclass", async (req, reply) => {
    const { id }      = req.params as { id: string };
    const { subclassId } = req.body as { subclassId: string };
    const char = getCharacterById(parseInt(id));
    if (!char) return reply.status(404).send({ error: "Character not found" });
    if (!subclassId) return reply.status(400).send({ error: "subclassId required" });

    const scData = SUBCLASSES[char.class.toLowerCase()];
    const option = scData?.options.find(o => o.id === subclassId);
    if (!option) return reply.status(400).send({ error: `Unknown subclass: ${subclassId}` });

    updateCharacterSubclass(parseInt(id), option.name);

    const campaign = getActiveCampaign();
    if (campaign) {
      broadcastEvent(campaign.id, "party_update", getAllCharacters(campaign.id).map(c => ({
        id: c.id, name: c.name, class: c.class, race: c.race,
        level: c.level, hp: c.hp, max_hp: c.max_hp, ac: c.ac,
        is_player: true, avatar: c.avatar ?? "",
        spell_slots: (() => { try { return JSON.parse(c.spell_slots || "{}"); } catch { return {}; } })(),
      })));
    }

    return { ok: true, subclassName: option.name };
  });

  app.post("/api/character/:id/prepare-spells", async (req, reply) => {
    const { id } = req.params as { id: string };
    // Accept: { className: string; spells: string[] }
    const { className, spells } = req.body as { className: string; spells: string[] };
    const char = getCharacterById(parseInt(id));
    if (!char) return reply.status(404).send({ error: "Character not found" });
    if (!className || !isSpellPreparer(className))
      return reply.status(400).send({ error: `${className} does not prepare spells` });

    // Verify this class belongs to the character
    const mcEntries: Array<{ class: string; level: number }> =
      (() => { try { return JSON.parse(char.multiclass || "[]"); } catch { return []; } })();
    const mcSum  = mcEntries.reduce((s, e) => s + e.level, 0);
    const isMain = char.class.toLowerCase() === className.toLowerCase();
    const mcEntry = mcEntries.find(e => e.class.toLowerCase() === className.toLowerCase());
    if (!isMain && !mcEntry)
      return reply.status(400).send({ error: `${char.name} does not have class ${className}` });

    const clsLv   = isMain ? char.level - mcSum : mcEntry!.level;
    const prepStat = SPELL_PREPARERS[className.toLowerCase()].stat;
    const statVal  = (char as unknown as Record<string, number>)[prepStat] ?? 10;
    const maxPrep  = maxPreparedSpells(className, clsLv, statVal);

    if (!Array.isArray(spells)) return reply.status(400).send({ error: "spells must be an array" });
    const trimmed = [...new Set(spells.filter(s => typeof s === "string" && s.length > 0))];
    if (trimmed.length > maxPrep)
      return reply.status(400).send({ error: `Cannot prepare more than ${maxPrep} spells for ${className}` });

    // Merge into the per-class map
    const current = getPreparedSpells(parseInt(id));
    current[className.toLowerCase()] = trimmed;
    updatePreparedSpells(parseInt(id), current);

    return { ok: true, className: className.toLowerCase(), preparedSpells: trimmed, maxPrepared: maxPrep };
  });

  app.get("/api/character/:id/abilities", async (req, reply) => {
    const { id } = req.params as { id: string };
    const char = getCharacterById(parseInt(id));
    if (!char) return reply.status(404).send({ error: "Character not found" });

    // Must use per-class level, not total character level
    const mcEntries: Array<{ class: string; level: number }> =
      (() => { try { return JSON.parse(char.multiclass || "[]"); } catch { return []; } })();
    const mcSum       = mcEntries.reduce((s, e) => s + e.level, 0);
    const mainClsLv   = char.level - mcSum;   // e.g. Paladin 3, not total 5

    // Main class
    const mainMaxSpell = getMaxSpellLevel(char.class, mainClsLv);
    const features: Array<Record<string, unknown>> = getFeaturesForClass(char.class, mainClsLv)
      .map(f => ({ ...f, fromClass: char.class }));
    const spells: Array<Record<string, unknown>> = getSpellsForClass(char.class, mainMaxSpell)
      .map(s => ({ ...s, fromClass: char.class }));

    // Each multiclass
    for (const mc of mcEntries) {
      const mcMaxSpell = getMaxSpellLevel(mc.class, mc.level);
      getFeaturesForClass(mc.class, mc.level).forEach(f => features.push({ ...f, fromClass: mc.class }));
      getSpellsForClass(mc.class, mcMaxSpell).forEach(s => spells.push({ ...s, fromClass: mc.class }));
    }

    // Per-class spell preparation info (Wizard, Cleric, Druid, Paladin — main + multiclass)
    const preparedByClass = getPreparedSpells(char.id);
    const charStats = char as unknown as Record<string, number>;

    const prepClasses: Array<{
      className: string; statName: string; maxPrepared: number; prepared: string[];
    }> = [];

    if (isSpellPreparer(char.class)) {
      const stat = SPELL_PREPARERS[char.class.toLowerCase()].stat;
      prepClasses.push({
        className: char.class.toLowerCase(),
        statName: stat,
        maxPrepared: maxPreparedSpells(char.class, mainClsLv, charStats[stat] ?? 10),
        prepared: preparedByClass[char.class.toLowerCase()] ?? [],
      });
    }
    for (const mc of mcEntries) {
      if (isSpellPreparer(mc.class)) {
        const stat = SPELL_PREPARERS[mc.class.toLowerCase()].stat;
        prepClasses.push({
          className: mc.class.toLowerCase(),
          statName: stat,
          maxPrepared: maxPreparedSpells(mc.class, mc.level, charStats[stat] ?? 10),
          prepared: preparedByClass[mc.class.toLowerCase()] ?? [],
        });
      }
    }

    return { features, spells, prepClasses };
  });

  app.get("/api/adventures", async () => {
    return listAdventures().map(id => {
      const adv = loadAdventure(id);
      return { id, title: adv?.title ?? id, synopsis: adv?.synopsis ?? "" };
    });
  });

  app.post("/api/campaign/:id/adventure", async (req, reply) => {
    if (!requireDm(req as any, reply)) return;
    const campaignId = parseInt((req.params as { id: string }).id);
    const { adventureId } = req.body as { adventureId?: string };
    if (!adventureId) return reply.status(400).send({ error: "adventureId required" });
    const adv = loadAdventure(adventureId);
    if (!adv) return reply.status(404).send({ error: `Adventure "${adventureId}" not found` });
    updateCampaignAdventure(campaignId, adventureId, adv);
    return { ok: true, title: adv.title ?? adventureId };
  });

  // ── Start ──────────────────────────────────────────────────────────────

  await app.listen({ port: config.web.port, host: "0.0.0.0" });
  console.log(`[Web] Server running at http://localhost:${config.web.port}`);

  const wss = new WebSocketServer({ noServer: true });

  app.server.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (socket) => {
    const campaign = getActiveCampaign();
    const client: BroadcastClient = { ws: socket, campaignId: campaign?.id, isAlive: true };
    clients.add(client);
    console.log(`[WS] Client connected. Total: ${clients.size}`);

    socket.on("pong", () => { client.isAlive = true; });
    try { sendInitialState(socket); } catch { /* ignore */ }

    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; campaignId?: number };
        if (msg.type === "ping") socket.send(JSON.stringify({ event: "pong", timestamp: Date.now() }));
        if (msg.type === "subscribe" && msg.campaignId) client.campaignId = msg.campaignId;
      } catch { /* ignore */ }
    });

    socket.on("close", () => { clients.delete(client); console.log(`[WS] Client disconnected. Total: ${clients.size}`); });
    socket.on("error", () => clients.delete(client));
  });

  setInterval(() => {
    for (const client of clients) {
      if (!client.isAlive) { client.ws.terminate(); clients.delete(client); continue; }
      client.isAlive = false;
      client.ws.ping();
    }
  }, 30000);
}
