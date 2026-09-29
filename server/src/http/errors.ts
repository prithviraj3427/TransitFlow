import type { NextFunction, Request, Response } from "express";

/** Typed HTTP error with a status code and user-safe message. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }

  static badRequest(message = "Bad request.") {
    return new HttpError(400, message);
  }
  static notFound(message = "Not found.") {
    return new HttpError(404, message);
  }
  static tooMany(message = "Too many requests. Slow down a little and try again shortly.") {
    return new HttpError(429, message);
  }
  static unavailable(message = "Service unavailable. Please try again in a moment.") {
    return new HttpError(503, message);
  }
}

export interface AppContext {
  store: unknown;
  geminiError?: typeof import("../ai/gemini.js").GeminiError;
}

/** Error handler — converts HttpError / GeminiError into a clean JSON body. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message } });
    return;
  }
  if (err instanceof Error && err.name === "GeminiError") {
    const status = (err as unknown as { status?: number }).status ?? 502;
    res.status(status).json({ error: { message: err.message } });
    return;
  }
  console.error("[transitflow] unhandled error:", err);
  res.status(500).json({ error: { message: "Something went wrong on our side. Please try again." } });
}

/** 404 fallback for unknown API routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { message: "Unknown API endpoint." } });
}
