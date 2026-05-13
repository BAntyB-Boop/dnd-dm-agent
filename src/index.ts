import { initDatabase } from "./db/database.js";
import { startBot } from "./bot/index.js";
import { startWebServer, broadcastEvent } from "./web/index.js";
import { setBroadcast } from "./agent/dm.js";

async function main() {
  console.log("[Main] Starting D&D DM Agent...");

  // Init database
  initDatabase();

  // Wire up the broadcast function so DM agent can push events to WebSocket clients
  setBroadcast(broadcastEvent);

  // Start web server
  await startWebServer();

  // Start Discord bot
  await startBot();

  console.log("[Main] All systems online. Roll for initiative! 🎲");
}

main().catch(err => {
  console.error("[Main] Fatal error:", err);
  process.exit(1);
});
