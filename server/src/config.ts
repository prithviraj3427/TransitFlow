import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function env(name: string, fallback: string | undefined = undefined): string | undefined {
  const value = process.env[name];
  if (value !== undefined && value.trim() !== "") return value;
  return fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = env(name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface Config {
  port: number;
  geminiApiKey: string | undefined;
  geminiModel: string;
  geminiBaseUrl: string;
  geminiTimeoutMs: number;
  redisUrl: string | undefined;
  corsOrigins: (string | RegExp)[] | "*";
  dataPath: string;
  alertTtlMs: number;
  maxImageBytes: number;
  scanRateLimit: { max: number; windowMs: number };
  reportRateLimit: { max: number; windowMs: number };
  confirmRateLimit: { max: number; windowMs: number };
  appVersion: string;
}

const repoRoot = path.resolve(__dirname, "..", "..");

const DEFAULT_CORS = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i,
  /^https:\/\/[a-z0-9-]+\.netlify\.app$/i,
];

function parseCors(raw: string | undefined): (string | RegExp)[] | "*" {
  if (!raw) return DEFAULT_CORS;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return DEFAULT_CORS;
  if (list[0] === "*") return "*";
  return list;
}

export function loadConfig(): Config {
  return {
    port: envInt("PORT", 4000),
    geminiApiKey: env("GEMINI_API_KEY"),
    geminiModel: env("GEMINI_MODEL", "gemini-1.5-flash") ?? "gemini-1.5-flash",
    geminiBaseUrl:
      env("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta") ??
      "https://generativelanguage.googleapis.com/v1beta",
    geminiTimeoutMs: envInt("GEMINI_TIMEOUT_MS", 12000),
    redisUrl: env("REDIS_URL"),
    corsOrigins: parseCors(env("CORS_ORIGINS")),
    dataPath: env("DATA_PATH", path.join(repoRoot, "data", "routes.json")) ??
      path.join(repoRoot, "data", "routes.json"),
    alertTtlMs: envInt("ALERT_TTL_MINUTES", 30) * 60_000,
    maxImageBytes: 10 * 1024 * 1024,
    scanRateLimit: { max: 10, windowMs: 15 * 60_000 },
    reportRateLimit: { max: 30, windowMs: 15 * 60_000 },
    confirmRateLimit: { max: 60, windowMs: 60 * 60_000 },
    appVersion: "1.0.0",
  };
}

export const config = loadConfig();

/** True when the origin is allowed by the CORS policy. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser clients (Android, curl) send no Origin
  const policy = config.corsOrigins;
  if (policy === "*") return true;
  return policy.some((entry) => {
    if (entry instanceof RegExp) return entry.test(origin);
    return entry === origin;
  });
}
