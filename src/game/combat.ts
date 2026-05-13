import { CombatParticipant, getActiveCombat, createCombat, updateCombat, endCombat } from "../db/database.js";
import { rollDice, getModifier } from "./dice.js";

export interface CombatState {
  id: number;
  round: number;
  currentTurn: string;
  participants: CombatParticipant[];
  active: boolean;
}

export interface AttackResult {
  attacker: string;
  target: string;
  attackRoll: number;
  hitAC: number;
  hit: boolean;
  isCritical: boolean;
  isCriticalFail: boolean;
  damage: number;
  damageType: string;
  description: string;
}

export function parseCombat(encounter: { participants: CombatParticipant[] | string }): CombatParticipant[] {
  if (typeof encounter.participants === "string") {
    return JSON.parse(encounter.participants) as CombatParticipant[];
  }
  return encounter.participants;
}

export function startCombat(campaignId: number, participants: CombatParticipant[]): number {
  const sorted = [...participants].sort((a, b) => b.initiative - a.initiative);
  return createCombat(campaignId, sorted);
}

export function rollInitiative(dexterity: number, proficiencyBonus = 0): number {
  const mod = getModifier(dexterity);
  return rollDice(`1d20${mod >= 0 ? "+" : ""}${mod + proficiencyBonus}`).total;
}

export function nextTurn(campaignId: number): { participant: CombatParticipant; round: number; isNewRound: boolean } | null {
  const encounter = getActiveCombat(campaignId);
  if (!encounter) return null;

  const participants = parseCombat(encounter);
  const aliveParticipants = participants.filter(p => p.hp > 0);

  if (aliveParticipants.length === 0) return null;

  let idx = encounter.current_turn_index;
  let round = encounter.round;
  let isNewRound = false;

  // Move to next alive participant
  idx = (idx + 1) % participants.length;
  let attempts = 0;
  while (participants[idx]?.hp <= 0) {
    idx = (idx + 1) % participants.length;
    attempts++;
    if (attempts > participants.length) return null;
  }

  // Check if we looped around (new round)
  if (idx <= encounter.current_turn_index) {
    round++;
    isNewRound = true;
  }

  updateCombat(encounter.id, { current_turn_index: idx, round });

  return { participant: participants[idx], round, isNewRound };
}

export function applyDamage(
  campaignId: number,
  targetName: string,
  damage: number,
  damageType = "piercing"
): { participant: CombatParticipant; died: boolean } | null {
  const encounter = getActiveCombat(campaignId);
  if (!encounter) return null;

  const participants = parseCombat(encounter);
  const targetIdx = participants.findIndex(p => p.name.toLowerCase() === targetName.toLowerCase());
  if (targetIdx === -1) return null;

  const target = participants[targetIdx];
  target.hp = Math.max(0, target.hp - damage);
  const died = target.hp === 0;

  updateCombat(encounter.id, { participants });

  return { participant: target, died };
}

export function applyHealing(
  campaignId: number,
  targetName: string,
  amount: number
): CombatParticipant | null {
  const encounter = getActiveCombat(campaignId);
  if (!encounter) return null;

  const participants = parseCombat(encounter);
  const targetIdx = participants.findIndex(p => p.name.toLowerCase() === targetName.toLowerCase());
  if (targetIdx === -1) return null;

  const target = participants[targetIdx];
  target.hp = Math.min(target.max_hp, target.hp + amount);
  updateCombat(encounter.id, { participants });

  return target;
}

export function getCombatSummary(campaignId: number): string {
  const encounter = getActiveCombat(campaignId);
  if (!encounter) return "No active combat";

  const participants = parseCombat(encounter);
  const lines = [
    `⚔️ **Combat Round ${encounter.round}**`,
    "",
    ...participants.map((p, i) => {
      const arrow = i === encounter.current_turn_index ? "→ " : "  ";
      const hpBar = createHpBar(p.hp, p.max_hp);
      const status = p.hp <= 0 ? "💀" : p.conditions.length > 0 ? `[${p.conditions.join(", ")}]` : "";
      return `${arrow}${p.is_player ? "🧙" : "👾"} **${p.name}** ${hpBar} AC:${p.ac} ${status}`;
    })
  ];

  return lines.join("\n");
}

export function createHpBar(hp: number, maxHp: number): string {
  const pct = maxHp > 0 ? hp / maxHp : 0;
  const filled = Math.round(pct * 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  const color = pct > 0.6 ? "🟢" : pct > 0.25 ? "🟡" : "🔴";
  return `${color}[${bar}] ${hp}/${maxHp}`;
}

export function finishCombat(campaignId: number): void {
  const encounter = getActiveCombat(campaignId);
  if (encounter) endCombat(encounter.id);
}

// Simulate a monster attack
export function monsterAttack(
  attackBonus: number,
  damageDice: string,
  targetAc: number,
  targetName: string,
  monsterName: string
): AttackResult {
  const attackRoll = rollDice(`1d20+${attackBonus}`);
  const isCritical = attackRoll.isCritical ?? false;
  const isCriticalFail = attackRoll.isCriticalFail ?? false;
  const hit = isCritical || (!isCriticalFail && attackRoll.total >= targetAc);

  let damage = 0;
  if (hit) {
    const dmgResult = rollDice(isCritical ? `${damageDice}+${damageDice}` : damageDice);
    damage = Math.max(1, dmgResult.total);
  }

  return {
    attacker: monsterName,
    target: targetName,
    attackRoll: attackRoll.total,
    hitAC: targetAc,
    hit,
    isCritical,
    isCriticalFail,
    damage,
    damageType: "slashing",
    description: isCritical
      ? `🎯 CRITICAL HIT! ${monsterName} deals ${damage} damage to ${targetName}!`
      : isCriticalFail
        ? `💨 ${monsterName} critically misses ${targetName}!`
        : hit
          ? `⚔️ ${monsterName} hits ${targetName} for ${damage} damage (rolled ${attackRoll.total} vs AC ${targetAc})`
          : `❌ ${monsterName} misses ${targetName} (rolled ${attackRoll.total} vs AC ${targetAc})`
  };
}
