import type { DmResponse } from "./dm-shared.js";

export async function runDm(
  _campaignId: number,
  _userMessage: string,
  _discordUserId?: string
): Promise<DmResponse> {
  throw new Error("OpenClaw provider is not yet implemented.");
}
