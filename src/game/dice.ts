export interface DiceResult {
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
  breakdown: string;
  isCritical?: boolean;
  isCriticalFail?: boolean;
}

// Parse and roll dice expression like "2d6+3", "1d20", "d8-1", "4d6kh3"
export function rollDice(expression: string): DiceResult {
  const expr = expression.toLowerCase().replace(/\s/g, "");

  // Match patterns: XdY+Z, XdYkh/klN (keep highest/lowest)
  const match = expr.match(/^(\d*)d(\d+)(?:(kh|kl)(\d+))?(([+-]\d+)*)$/);

  if (!match) {
    // Try plain number
    const num = parseInt(expr);
    if (!isNaN(num)) {
      return { expression: expr, rolls: [num], modifier: 0, total: num, breakdown: `${num}` };
    }
    throw new Error(`Invalid dice expression: ${expression}`);
  }

  const count = parseInt(match[1] || "1");
  const sides = parseInt(match[2]);
  const keepType = match[3] as "kh" | "kl" | undefined;
  const keepCount = match[4] ? parseInt(match[4]) : undefined;
  const modifierStr = match[5] || "";

  if (count < 1 || count > 100) throw new Error(`Dice count must be 1-100`);
  if (sides < 2 || sides > 1000) throw new Error(`Dice sides must be 2-1000`);

  const rolls: number[] = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);

  let activeRolls = [...rolls];
  if (keepType && keepCount !== undefined) {
    activeRolls.sort((a, b) => keepType === "kh" ? b - a : a - b);
    activeRolls = activeRolls.slice(0, keepCount);
  }

  const modifier = modifierStr ? parseInt(modifierStr) : 0;
  const diceTotal = activeRolls.reduce((sum, r) => sum + r, 0);
  const total = diceTotal + modifier;

  const rollDisplay = rolls.map(r => {
    if (keepType && keepCount !== undefined) {
      const sorted = [...rolls].sort((a, b) => keepType === "kh" ? b - a : a - b);
      const kept = sorted.slice(0, keepCount);
      return kept.includes(r) ? `**${r}**` : `~~${r}~~`;
    }
    return r === sides ? `**${r}**` : r === 1 ? `*${r}*` : `${r}`;
  });

  const breakdown = [
    `[${rollDisplay.join(", ")}]`,
    modifier !== 0 ? `${modifier > 0 ? "+" : ""}${modifier}` : "",
    `= **${total}**`
  ].filter(Boolean).join(" ");

  return {
    expression,
    rolls: activeRolls,
    modifier,
    total,
    breakdown,
    isCritical: count === 1 && sides === 20 && activeRolls[0] === 20,
    isCriticalFail: count === 1 && sides === 20 && activeRolls[0] === 1,
  };
}

// Advantage/Disadvantage rolls
export function rollWithAdvantage(): DiceResult & { advantageRoll: number; disadvantageRoll: number } {
  const r1 = Math.floor(Math.random() * 20) + 1;
  const r2 = Math.floor(Math.random() * 20) + 1;
  const total = Math.max(r1, r2);
  return {
    expression: "1d20 (advantage)",
    rolls: [total],
    modifier: 0,
    total,
    breakdown: `[~~${Math.min(r1, r2)}~~, **${total}**] = **${total}**`,
    advantageRoll: r1,
    disadvantageRoll: r2,
    isCritical: total === 20,
    isCriticalFail: total === 1,
  };
}

export function rollWithDisadvantage(): DiceResult & { advantageRoll: number; disadvantageRoll: number } {
  const r1 = Math.floor(Math.random() * 20) + 1;
  const r2 = Math.floor(Math.random() * 20) + 1;
  const total = Math.min(r1, r2);
  return {
    expression: "1d20 (disadvantage)",
    rolls: [total],
    modifier: 0,
    total,
    breakdown: `[**${total}**, ~~${Math.max(r1, r2)}~~] = **${total}**`,
    advantageRoll: r1,
    disadvantageRoll: r2,
    isCritical: total === 20,
    isCriticalFail: total === 1,
  };
}

// Ability check with proficiency
export function abilityCheck(statValue: number, proficient = false, proficiencyBonus = 2): DiceResult {
  const modifier = Math.floor((statValue - 10) / 2);
  const bonus = proficient ? modifier + proficiencyBonus : modifier;
  const result = rollDice(`1d20${bonus >= 0 ? "+" : ""}${bonus}`);
  return result;
}

// D&D 5e stats from 4d6 drop lowest
export function rollStats(): number[] {
  return Array.from({ length: 6 }, () => {
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => b - a);
    return rolls.slice(0, 3).reduce((sum, r) => sum + r, 0);
  });
}

// Get ability modifier
export function getModifier(stat: number): number {
  return Math.floor((stat - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// HP for a class
export function getStartingHp(charClass: string, constitution: number): number {
  const hitDice: Record<string, number> = {
    barbarian: 12, fighter: 10, paladin: 10, ranger: 10,
    bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
    sorcerer: 6, wizard: 6,
  };
  const hd = hitDice[charClass.toLowerCase()] ?? 8;
  const conMod = getModifier(constitution);
  return hd + conMod;
}

// Initiative roll: 1d20 + DEX modifier
export function rollInitiative(dexterity: number): DiceResult {
  const mod = getModifier(dexterity);
  return rollDice(`1d20${mod >= 0 ? "+" : ""}${mod}`);
}

// Proficiency bonus by level
export function getProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

// XP thresholds for CR
export function xpByCR(cr: string | number): number {
  const table: Record<string, number> = {
    "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
    "1": 200, "2": 450, "3": 700, "4": 1100,
    "5": 1800, "6": 2300, "7": 2900, "8": 3900,
    "9": 5000, "10": 5900, "11": 7200, "12": 8400,
    "13": 10000, "14": 11500, "15": 13000, "16": 15000,
    "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  };
  return table[String(cr)] ?? 0;
}
