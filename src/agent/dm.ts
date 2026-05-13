import { config } from "../config.js";

export type {
  BroadcastFn,
  PendingRoll,
  PartyRollEntry,
  PendingPartyRoll,
  DmResponse,
  LevelUpEvent,
  ToolResultSummary,
} from "./dm-shared.js";

export {
  setBroadcast,
  getPendingRoll,
  clearPendingRoll,
  getPendingPartyRoll,
  clearPendingPartyRoll,
} from "./dm-shared.js";

import type { DmResponse } from "./dm-shared.js";

export async function runDm(
  campaignId: number,
  userMessage: string,
  discordUserId?: string
): Promise<DmResponse> {
  if (config.dm.provider === "openclaw") {
    const { runDm: runOpenClaw } = await import("./dm-openclaw.js");
    return runOpenClaw(campaignId, userMessage, discordUserId);
  }
  if (config.dm.provider === "gemini") {
    const { runDm: runGemini } = await import("./dm-gemini.js");
    return runGemini(campaignId, userMessage, discordUserId);
  }
  if (config.dm.provider === "groq") {
    const { runDm: runGroq } = await import("./dm-groq.js");
    return runGroq(campaignId, userMessage, discordUserId);
  }
  if (config.dm.provider === "ollama") {
    const { runDm: runOllama } = await import("./dm-ollama.js");
    return runOllama(campaignId, userMessage, discordUserId);
  }
  const { runDm: runAnthropic } = await import("./dm-anthropic.js");
  return runAnthropic(campaignId, userMessage, discordUserId);
}
