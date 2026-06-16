import { config } from "../config.js";

// ── Free-form Q&A ─────────────────────────────────────────────────────────
//
// A lightweight "ask the AI anything" helper. Unlike runDm() this needs no
// active campaign, keeps no history, and exposes no game tools — it's a plain
// one-shot chat call against whichever provider DM_PROVIDER selects.

const SYSTEM_TH =
  "คุณเป็นผู้ช่วยที่เป็นมิตรและรอบรู้ โดยเฉพาะเรื่อง Dungeons & Dragons " +
  "(กฎ, เผ่าพันธุ์, คลาส, มอนสเตอร์, ไอเทม, การสร้างโลกและเนื้อเรื่อง) แต่ก็ตอบคำถามทั่วไปได้ด้วย " +
  "ตอบเป็นภาษาไทยอย่างกระชับ ชัดเจน และถูกต้อง ถ้าไม่แน่ใจให้บอกตามตรง";

const SYSTEM_EN =
  "You are a friendly, knowledgeable assistant — especially about Dungeons & Dragons " +
  "(rules, races, classes, monsters, items, worldbuilding and lore) but you also answer general questions. " +
  "Reply concisely, clearly and accurately. If you are unsure, say so honestly.";

const MAX_TOKENS = 1024;

export async function runAsk(
  question: string,
  language: "th" | "en" = config.defaultLanguage,
): Promise<string> {
  const system = language === "en" ? SYSTEM_EN : SYSTEM_TH;
  const provider = config.dm.provider;

  if (provider === "gemini") {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({ model: config.gemini.model, systemInstruction: system });
    const result = await model.generateContent(question);
    return result.response.text().trim();
  }

  if (provider === "groq") {
    const Groq = (await import("groq-sdk")).default;
    const client = new Groq({ apiKey: config.groq.apiKeys[0] });
    const res = await client.chat.completions.create({
      model: config.groq.model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
    });
    return (res.choices[0].message.content ?? "").trim();
  }

  if (provider === "ollama") {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ baseURL: `${config.ollama.baseUrl}/v1`, apiKey: "ollama" });
    const res = await client.chat.completions.create({
      model: config.ollama.model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
    });
    return (res.choices[0].message.content ?? "").trim();
  }

  if (provider === "openclaw") {
    // OpenClaw gateway is OpenAI-compatible (baseUrl + bearer token + model).
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({
      baseURL: `${config.dm.openclaw.baseUrl}/v1`,
      apiKey: config.dm.openclaw.token || "openclaw",
    });
    const res = await client.chat.completions.create({
      model: config.dm.openclaw.model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
    });
    return (res.choices[0].message.content ?? "").trim();
  }

  // default: anthropic
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({
    apiKey: config.anthropic.apiKey,
    ...(config.anthropic.baseURL ? { baseURL: config.anthropic.baseURL } : {}),
  });
  const res = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: question }],
  });
  return res.content
    .map(b => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}
