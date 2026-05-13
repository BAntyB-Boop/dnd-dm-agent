import dotenv from "dotenv";
import path from "path";

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL?.trim();
const dmProviderRaw = (process.env.DM_PROVIDER ?? "anthropic").toLowerCase();
const dmProvider = (["openclaw", "gemini", "groq", "ollama"].includes(dmProviderRaw) ? dmProviderRaw : "anthropic") as "anthropic" | "gemini" | "groq" | "openclaw" | "ollama";

export const config = {
  dm: {
    provider: dmProvider,
    openclaw: {
      baseUrl:
        dmProvider === "openclaw"
          ? required("OPENCLAW_BASE_URL")
          : (process.env.OPENCLAW_BASE_URL ?? "http://127.0.0.1:18789").trim(),
      token:
        dmProvider === "openclaw"
          ? (process.env.OPENCLAW_GATEWAY_TOKEN ?? process.env.OPENCLAW_TOKEN ?? required("OPENCLAW_GATEWAY_TOKEN"))
          : (process.env.OPENCLAW_GATEWAY_TOKEN ?? process.env.OPENCLAW_TOKEN ?? ""),
      model: (process.env.OPENCLAW_MODEL ?? "openclaw/default").trim(),
      agentId: (process.env.OPENCLAW_AGENT_ID ?? "").trim(),
      backendModel: (process.env.OPENCLAW_BACKEND_MODEL ?? "").trim(),
    },
  },
  anthropic: {
    apiKey: dmProvider === "anthropic" ? required("ANTHROPIC_API_KEY") : (process.env.ANTHROPIC_API_KEY ?? "unused"),
    baseURL: anthropicBaseUrl || undefined,
    model: process.env.DM_MODEL ?? "claude-opus-4-7",
    promptCaching: !anthropicBaseUrl,
  },
  gemini: {
    apiKey: dmProvider === "gemini" ? required("GEMINI_API_KEY") : (process.env.GEMINI_API_KEY ?? "unused"),
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  },
  mimo: {
    apiKey: process.env.MIMO_API_KEY ?? "unused",
    baseUrl: process.env.MIMO_BASE_URL ?? "https://api.xiaomimimo.com/v1",
    model: process.env.MIMO_MODEL ?? "mimo-v2.5-pro",
  },
  ollama: {
    baseUrl: (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").trim(),
    model: (process.env.OLLAMA_MODEL ?? "gemma4").trim(),
  },
  groq: {
    // Supports multiple keys via GROQ_API_KEYS (comma-separated) or single GROQ_API_KEY
    apiKeys: (() => {
      const multi = process.env.GROQ_API_KEYS?.split(",").map(k => k.trim()).filter(Boolean) ?? [];
      if (multi.length > 0) return multi;
      const single = dmProvider === "groq" ? required("GROQ_API_KEY") : (process.env.GROQ_API_KEY ?? "unused");
      return [single];
    })(),
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  },
  discord: {
    token: required("DISCORD_TOKEN"),
    clientId: required("DISCORD_CLIENT_ID"),
    guildId: process.env.DISCORD_GUILD_ID,
    dmChannelId: process.env.DM_CHANNEL_ID,
  },
  web: {
    port: parseInt(process.env.PORT ?? process.env.WEB_PORT ?? "3000"),
    secret: process.env.WEB_SECRET ?? "dnd-secret-change-me",
    // DM_ACCOUNTS=alice:pass1,bob:pass2  (multiple DMs)
    // Falls back to single DM using DM_PASSWORD
    dmAccounts: (() => {
      const raw = process.env.DM_ACCOUNTS?.trim() ?? "";
      if (raw) {
        return raw.split(",").map(s => {
          const idx = s.indexOf(":");
          return idx === -1 ? null : { name: s.slice(0, idx).trim(), password: s.slice(idx + 1).trim() };
        }).filter((a): a is { name: string; password: string } => !!a?.name && !!a?.password);
      }
      return [{ name: "dm", password: process.env.DM_PASSWORD ?? "dm1234" }];
    })(),
    playerPassword: process.env.PLAYER_PASSWORD ?? "",
  },
  database: {
    path: process.env.DATABASE_PATH ?? path.join(process.cwd(), "dnd.db"),
  },
  defaultLanguage: (process.env.DEFAULT_LANGUAGE ?? "th") as "th" | "en",
};
