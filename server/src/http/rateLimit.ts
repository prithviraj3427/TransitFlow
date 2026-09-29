import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errors.js";

/**
 * Tiny per-IP token-bucket rate limiter (in-memory).
 *
 * Note: on multi-instance hosts (e.g. Render with autoscaling) the bucket is
 * per-instance, so the effective limit is looser — fine for a community app
 * where abuse is already discouraged by the AI call cost.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface RateLimitOptions {
  key: string;
  max: number;
  windowMs: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > 24 * 3600_000) buckets.delete(key);
  }
}

export function rateLimit(options: RateLimitOptions) {
  const { key, max, windowMs } = options;
  const refillPerMs = max / windowMs;

  return function rateLimitMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      "unknown";
    const id = `${key}:${ip}`;
    const now = Date.now();
    sweep(now);

    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = { tokens: max, updatedAt: now };
      buckets.set(id, bucket);
    } else {
      const elapsed = now - bucket.updatedAt;
      bucket.tokens = Math.min(max, bucket.tokens + elapsed * refillPerMs);
      bucket.updatedAt = now;
    }

    if (bucket.tokens < 1) {
      const retryAfterSec = Math.ceil((1 - bucket.tokens) / refillPerMs / 1000);
      next(HttpError.tooMany(`You're being a bit too quick — try again in ~${retryAfterSec}s.`));
      return;
    }
    bucket.tokens -= 1;
    next();
  };
}
