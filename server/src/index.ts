import { bootstrap } from "./app.js";
import { config } from "./config.js";
import { createStore } from "./store/index.js";

const store = createStore();
const app = await bootstrap(store);

const server = app.listen(config.port, () => {
  console.log(`[transitflow] API listening on http://localhost:${config.port}/api`);
  console.log(
    `[transitflow] AI: ${geminiStatus()} · storage: ${store.kind} · TTL: ${Math.round(
      config.alertTtlMs / 60000,
    )}min`,
  );
});

function geminiStatus(): string {
  if (config.geminiApiKey) return `enabled (${config.geminiModel})`;
  return "disabled (set GEMINI_API_KEY) — manual mode works";
}

const shutdown = (signal: string) => {
  console.log(`\n[transitflow] ${signal} received, shutting down…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
