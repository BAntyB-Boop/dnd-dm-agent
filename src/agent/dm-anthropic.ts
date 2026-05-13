import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import {
  getSessionMessages, addSessionMessage, getCampaign,
  getSessionSummary, setSessionSummary, popOldMessages, autoSaveSession,
} from "../db/database.js";
import { getSystemPrompt, DM_TOOLS } from "./prompts.js";
import { getCombatSummary } from "../game/combat.js";
import { getActiveCombat } from "../db/database.js";
import { DmResponse } from "./dm-shared.js";
import {
  executeTool, buildLocalContext, buildCombatContext, buildPartyContext,
  buildAdventureContext, AVAILABLE_MAPS,
} from "./dm-tools.js";

// ── Anthropic client ──────────────────────────────────────────────────────

const client = new Anthropic({
  apiKey: config.anthropic.apiKey,
  ...(config.anthropic.baseURL ? { baseURL: config.anthropic.baseURL } : {}),
});

// ── Session compression ───────────────────────────────────────────────────

const COMPRESS_THRESHOLD = 15;
const KEEP_RECENT = 6;

async function compressSessionIfNeeded(campaignId: number): Promise<void> {
  const messages = getSessionMessages(campaignId);
  if (messages.length < COMPRESS_THRESHOLD) return;

  const toCompress = popOldMessages(campaignId, KEEP_RECENT);
  if (toCompress.length === 0) return;

  const existingSummary = getSessionSummary(campaignId);
  const transcript = toCompress
    .map(m => `${m.role === "user" ? "Player" : "DM"}: ${m.content}`)
    .join("\n\n");
  const prompt = existingSummary
    ? `Previous summary:\n${existingSummary}\n\nNew conversation to add:\n${transcript}`
    : `Conversation to summarize:\n${transcript}`;

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: `Summarize this D&D session conversation into 3-5 compact bullet points. Include: key events, decisions made, NPCs met, locations visited, and important items/quests. Be concise.\n\n${prompt}` }],
    });
    const summary = res.content.find(b => b.type === "text")?.text ?? "";
    if (summary) {
      setSessionSummary(campaignId, summary);
      console.log(`[DM] Compressed ${toCompress.length} messages into summary (${summary.length} chars)`);
    }
  } catch (err) {
    console.warn("[DM] Compression failed, keeping messages:", err);
    for (const m of toCompress) {
      addSessionMessage(campaignId, m.role as "user" | "assistant", m.content);
    }
  }
}

// ── Main runDm (Anthropic) ────────────────────────────────────────────────

export async function runDm(
  campaignId: number,
  userMessage: string,
  _discordUserId?: string
): Promise<DmResponse> {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  await compressSessionIfNeeded(campaignId);

  const history = getSessionMessages(campaignId);
  const adventureContext = campaign.adventure_data !== "{}" ? buildAdventureContext(campaign.adventure_data) : undefined;
  const systemPrompt = getSystemPrompt(campaign.language, adventureContext, AVAILABLE_MAPS);

  const localContext = buildLocalContext(campaignId);
  const combatStatus = buildCombatContext(campaignId);
  const partyStatus  = buildPartyContext(campaignId);

  const contextualMessage = [
    localContext,
    partyStatus  ? `[Party]\n${partyStatus}`   : "",
    combatStatus ? `[Combat]\n${combatStatus}` : "",
    userMessage,
  ].filter(Boolean).join("\n\n");

  addSessionMessage(campaignId, "user", userMessage);

  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: contextualMessage },
  ];

  const tools = DM_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  }));

  const toolResults = [];
  let narrative = "";
  let continueLoop = true;
  let loopMessages = [...messages];

  while (continueLoop) {
    const systemBlocks: Anthropic.TextBlockParam[] = [{
      type: "text",
      text: systemPrompt,
      ...(config.anthropic.promptCaching ? { cache_control: { type: "ephemeral" } } : {}),
    }];

    const supportsThinking = config.anthropic.model.includes("opus") || config.anthropic.model.includes("sonnet");
    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 4096,
      ...(supportsThinking ? { thinking: { type: "adaptive" } } : {}),
      system: systemBlocks,
      messages: loopMessages,
      tools,
    } as Parameters<typeof client.messages.create>[0]) as Anthropic.Message;

    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
    const turnNarrative = textBlocks.map(b => b.text).join("\n").trim();
    if (turnNarrative) narrative += (narrative ? "\n\n" : "") + turnNarrative;

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
      continueLoop = false;
    } else {
      const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        const result = await executeTool(campaignId, toolBlock.name, toolBlock.input as Record<string, unknown>);
        toolResults.push(result);
        toolResultContents.push({ type: "tool_result", tool_use_id: toolBlock.id, content: result.message });
      }

      const rollSignal = toolResults.find(r => r.pendingRoll);
      const partyRollSignal = toolResults.find(r => r.pendingPartyRoll);
      if (rollSignal?.pendingRoll || partyRollSignal?.pendingPartyRoll) {
        if (narrative) { addSessionMessage(campaignId, "assistant", narrative); autoSaveSession(campaignId); }
        return {
          narrative, toolResults,
          pendingRoll: rollSignal?.pendingRoll,
          pendingPartyRoll: partyRollSignal?.pendingPartyRoll,
          levelUpEvents: toolResults.flatMap(r => r.levelUpEvents ?? []),
        };
      }

      loopMessages = [
        ...loopMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResultContents },
      ];
    }
  }

  if (narrative) { addSessionMessage(campaignId, "assistant", narrative); autoSaveSession(campaignId); }

  const activeEncounter = getActiveCombat(campaignId);
  const combatUpdate = activeEncounter ? getCombatSummary(campaignId) : undefined;
  const levelUpEvents = toolResults.flatMap((r: { levelUpEvents?: unknown[] }) => r.levelUpEvents ?? []);
  return { narrative, toolResults, combatUpdate, levelUpEvents } as DmResponse;
}
