import { GoogleGenerativeAI, Part, Content, Tool, FunctionDeclarationSchema } from "@google/generative-ai";
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

// ── Gemini client ─────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

// Convert DM_TOOLS (Anthropic format) → Gemini functionDeclarations
// input_schema is compatible JSON Schema; cast via unknown to satisfy SDK types
const geminiTools: Tool[] = [{
  functionDeclarations: DM_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema as unknown as FunctionDeclarationSchema,
  })),
}];

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
    const summaryModel = genAI.getGenerativeModel({ model: config.gemini.model });
    const res = await summaryModel.generateContent(
      `Summarize this D&D session conversation into 3-5 compact bullet points. Include: key events, decisions made, NPCs met, locations visited, and important items/quests. Be concise.\n\n${prompt}`
    );
    const summary = res.response.text().trim();
    if (summary) {
      setSessionSummary(campaignId, summary);
      console.log(`[DM/Gemini] Compressed ${toCompress.length} messages into summary (${summary.length} chars)`);
    }
  } catch (err) {
    console.warn("[DM/Gemini] Compression failed, keeping messages:", err);
    for (const m of toCompress) {
      addSessionMessage(campaignId, m.role as "user" | "assistant", m.content);
    }
  }
}

// ── Main runDm (Gemini) ───────────────────────────────────────────────────

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

  // Convert DB history to Gemini Content format (role: "user"|"model")
  const historyContents: Content[] = history.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Build model with system instruction for this request
  const model = genAI.getGenerativeModel({
    model: config.gemini.model,
    systemInstruction: systemPrompt,
    tools: geminiTools,
  });

  const toolResults = [];
  let narrative = "";
  let continueLoop = true;

  // loopMessages starts with DB history + current contextual message
  let loopMessages: Content[] = [
    ...historyContents,
    { role: "user", parts: [{ text: contextualMessage }] },
  ];

  while (continueLoop) {
    const response = await model.generateContent({ contents: loopMessages });
    const candidate = response.response.candidates?.[0];
    const parts: Part[] = candidate?.content?.parts ?? [];

    // Collect text narrative from this turn
    const textParts = parts.filter((p): p is { text: string } & Part => typeof p.text === "string");
    const turnNarrative = textParts.map(p => p.text).join("").trim();
    if (turnNarrative) narrative += (narrative ? "\n\n" : "") + turnNarrative;

    // Collect function call parts
    const funcParts = parts.filter(
      (p): p is { functionCall: { name: string; args: Record<string, unknown> } } & Part => !!p.functionCall
    );

    const finishReason = candidate?.finishReason;
    if (funcParts.length === 0 || finishReason === "STOP" || finishReason === "MAX_TOKENS") {
      continueLoop = false;
    } else {
      const funcResponses: Part[] = [];

      for (const funcPart of funcParts) {
        const result = await executeTool(campaignId, funcPart.functionCall.name, funcPart.functionCall.args);
        toolResults.push(result);
        funcResponses.push({
          functionResponse: {
            name: funcPart.functionCall.name,
            response: { result: result.message },
          },
        });
      }

      // Check for roll signals before continuing
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
        { role: "model", parts },
        { role: "user", parts: funcResponses },
      ];
    }
  }

  if (narrative) { addSessionMessage(campaignId, "assistant", narrative); autoSaveSession(campaignId); }

  const activeEncounter = getActiveCombat(campaignId);
  const combatUpdate = activeEncounter ? getCombatSummary(campaignId) : undefined;
  const levelUpEvents = toolResults.flatMap((r: { levelUpEvents?: unknown[] }) => r.levelUpEvents ?? []);
  return { narrative, toolResults, combatUpdate, levelUpEvents } as DmResponse;
}
