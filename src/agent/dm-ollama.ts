import OpenAI from "openai";
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
  buildAdventureContext, AVAILABLE_MAPS, extractXmlToolCalls,
} from "./dm-tools.js";

// ── Ollama client (OpenAI-compatible) ────────────────────────────────────

const client = new OpenAI({
  baseURL: `${config.ollama.baseUrl}/v1`,
  apiKey: "ollama",
});

// ── Context-aware tool filtering ──────────────────────────────────────────

const COMBAT_ONLY = new Set(["apply_damage", "apply_healing", "end_combat"]);
const NONCOMBAT_ONLY = new Set(["start_combat", "award_xp", "add_item", "remove_item", "long_rest", "short_rest"]);

function getContextualTools(campaignId: number): OpenAI.Chat.ChatCompletionTool[] {
  const inCombat = !!getActiveCombat(campaignId);
  return DM_TOOLS
    .filter(t => {
      if (inCombat && NONCOMBAT_ONLY.has(t.name)) return false;
      if (!inCombat && COMBAT_ONLY.has(t.name)) return false;
      return true;
    })
    .map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema as Record<string, unknown>,
      },
    }));
}

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
    const res = await client.chat.completions.create({
      model: config.ollama.model,
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Summarize this D&D session conversation into 3-5 compact bullet points. Include: key events, decisions made, NPCs met, locations visited, and important items/quests. Be concise.\n\n${prompt}`,
      }],
    });
    const summary = res.choices[0].message.content?.trim() ?? "";
    if (summary) {
      setSessionSummary(campaignId, summary);
      console.log(`[DM/Ollama] Compressed ${toCompress.length} messages into summary (${summary.length} chars)`);
    }
  } catch (err) {
    console.warn("[DM/Ollama] Compression failed, keeping messages:", err);
    for (const m of toCompress) {
      addSessionMessage(campaignId, m.role as "user" | "assistant", m.content);
    }
  }
}

// ── Main runDm (Ollama) ───────────────────────────────────────────────────

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

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: contextualMessage },
  ];

  const toolResults = [];
  let narrative = "";
  let continueLoop = true;
  let loopMessages = [...messages];

  while (continueLoop) {
    const tools = getContextualTools(campaignId);

    let response: OpenAI.Chat.ChatCompletion;
    try {
      response = await client.chat.completions.create({
        model: config.ollama.model,
        max_tokens: 2048,
        messages: loopMessages,
        tools,
        tool_choice: "auto",
      });
    } catch (err: unknown) {
      // Some Ollama models don't support tool_choice — retry without tools
      const isToolFail = err instanceof Error &&
        (err.message.includes("tool") || err.message.includes("400"));
      if (isToolFail) {
        console.warn("[DM/Ollama] Tool call failed — retrying without tools");
        response = await client.chat.completions.create({
          model: config.ollama.model,
          max_tokens: 2048,
          messages: loopMessages,
        });
      } else {
        throw err;
      }
    }

    const choice = response.choices[0];
    const msg = choice.message;

    // Check for XML-style tool calls embedded in content (fallback format)
    const rawContent = msg.content ?? "";
    const { calls: xmlCalls, cleaned: cleanedContent } = extractXmlToolCalls(rawContent);

    const turnNarrative = cleanedContent.trim();
    if (turnNarrative) narrative += (narrative ? "\n\n" : "") + turnNarrative;

    const properToolCalls = msg.tool_calls ?? [];
    const hasAnyCalls = properToolCalls.length > 0 || xmlCalls.length > 0;

    if (!hasAnyCalls || choice.finish_reason === "stop") {
      continueLoop = false;
    } else {
      loopMessages = [...loopMessages, msg as OpenAI.Chat.ChatCompletionMessageParam];

      const toolResultMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      for (const toolCall of properToolCalls) {
        if (!("function" in toolCall)) continue;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(toolCall.function.arguments); } catch { /* leave empty */ }

        const result = await executeTool(campaignId, toolCall.function.name, args);
        toolResults.push(result);
        toolResultMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result.message,
        });
      }

      for (const xmlCall of xmlCalls) {
        const result = await executeTool(campaignId, xmlCall.name, xmlCall.args);
        toolResults.push(result);
        toolResultMessages.push({
          role: "user",
          content: `[Tool result for ${xmlCall.name}]: ${result.message}`,
        });
      }

      const rollSignal      = toolResults.find(r => r.pendingRoll);
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

      loopMessages = [...loopMessages, ...toolResultMessages];
    }
  }

  if (narrative) { addSessionMessage(campaignId, "assistant", narrative); autoSaveSession(campaignId); }

  const activeEncounter = getActiveCombat(campaignId);
  const combatUpdate = activeEncounter ? getCombatSummary(campaignId) : undefined;
  const levelUpEvents = toolResults.flatMap((r: { levelUpEvents?: unknown[] }) => r.levelUpEvents ?? []);
  return { narrative, toolResults, combatUpdate, levelUpEvents } as DmResponse;
}
