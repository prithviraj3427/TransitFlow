import { config } from "../config.js";
import { MemoryStore } from "./memory.js";
import { RedisStore } from "./redis.js";
import type { Store } from "./store.js";

export function createStore(): Store {
  if (config.redisUrl) {
    console.log("[transitflow] storage: redis");
    const dayPrefix = () => new Date().toISOString().slice(0, 10);
    return new RedisStore(config.redisUrl, dayPrefix);
  }
  console.log("[transitflow] storage: memory (set REDIS_URL for durable storage)");
  return new MemoryStore(config.alertTtlMs);
}
