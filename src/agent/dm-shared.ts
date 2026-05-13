// Shared types, state, and accessors used by all DM provider implementations

export type BroadcastFn = (campaignId: number, event: string, data: unknown) => void;

let broadcastFn: BroadcastFn | null = null;

export function setBroadcast(fn: BroadcastFn): void {
  broadcastFn = fn;
}

export function broadcast(campaignId: number, event: string, data: unknown): void {
  broadcastFn?.(campaignId, event, data);
}

// ── Single-character roll ─────────────────────────────────────────────────

export interface PendingRoll {
  rollId: string;
  campaignId: number;
  characterName: string;
  expression: string;
  purpose: string;
  dc?: number;
  advantage: "normal" | "advantage" | "disadvantage";
  ownerDiscordId?: string;
}

const pendingRolls = new Map<string, PendingRoll>();

export function getPendingRoll(rollId: string): PendingRoll | undefined {
  return pendingRolls.get(rollId);
}

export function clearPendingRoll(rollId: string): void {
  pendingRolls.delete(rollId);
}

export function setPendingRoll(rollId: string, roll: PendingRoll): void {
  pendingRolls.set(rollId, roll);
}

// ── Party roll ────────────────────────────────────────────────────────────

export interface PartyRollEntry {
  characterName: string;
  discordUserId: string;
  rolled: boolean;
  result?: number;
  breakdown?: string;
  isCritical?: boolean;
  isCriticalFail?: boolean;
}

export interface PendingPartyRoll {
  groupId: string;
  campaignId: number;
  expression: string;
  purpose: string;
  dc?: number;
  advantage: "normal" | "advantage" | "disadvantage";
  mode: "group_check" | "lowest_wins" | "individual";
  entries: PartyRollEntry[];
}

const pendingPartyRolls = new Map<string, PendingPartyRoll>();

export function getPendingPartyRoll(groupId: string): PendingPartyRoll | undefined {
  return pendingPartyRolls.get(groupId);
}

export function clearPendingPartyRoll(groupId: string): void {
  pendingPartyRolls.delete(groupId);
}

export function setPendingPartyRoll(groupId: string, roll: PendingPartyRoll): void {
  pendingPartyRolls.set(groupId, roll);
}

// ── Level-up event ────────────────────────────────────────────────────────

export interface LevelUpEvent {
  charId: number;
  characterName: string;
  discordUserId: string;
  charClass: string;
  newLevel: number;
  hpGain: number;
  needsSubclass: boolean;
  needsASI: boolean;
  currentStats: {
    strength: number; dexterity: number; constitution: number;
    intelligence: number; wisdom: number; charisma: number;
  };
}

// ── Tool / DM response ────────────────────────────────────────────────────

export interface ToolResultSummary {
  tool: string;
  success: boolean;
  message: string;
  pendingRoll?: PendingRoll;
  pendingPartyRoll?: PendingPartyRoll;
  levelUpEvents?: LevelUpEvent[];
}

export interface DmResponse {
  narrative: string;
  toolResults: ToolResultSummary[];
  combatUpdate?: string;
  pendingRoll?: PendingRoll;
  pendingPartyRoll?: PendingPartyRoll;
  levelUpEvents: LevelUpEvent[];
}
