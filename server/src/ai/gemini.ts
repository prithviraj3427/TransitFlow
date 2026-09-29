import { config } from "../config.js";
import type { Confidence, Extraction } from "../domain/types.js";
import { normalizeRoute } from "../domain/normalize.js";

/**
 * Minimal, dependency-free client for Gemini "generateContent"
 * with native structured output (responseSchema) — no SDK needed.
 */

const PROMPT = `You are TransitFlow, an expert at reading Indian city-bus route numbers from a photo.

In the photo there are two possible route indicators:
1. STICKER: a red circular route sticker on the bus windshield — the route the bus CLAIMS to serve.
2. LED: the front LED destination display — the route the bus is ACTUALLY running.

Rules:
- Transcribe route numbers EXACTLY as shown, including letters (e.g. 102A, 36H, 96M).
- If the sticker is missing, unreadable or occluded, set stickerRoute to null.
- If the LED display is missing, off or unreadable, set ledRoute to null.
- Do not guess. If you are not confident a number is correct, return null instead.
- confidence: HIGH when both readings are clearly legible; MEDIUM when one is slightly unclear; LOW when neither is clearly legible.
- note: one short sentence describing what you see in the photo.
- If the photo does not contain a bus, return both null with confidence LOW.
Return only the JSON object.`;

interface GenerateContentResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  error?: { message?: string };
}

class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class Gemini {
  constructor(
    readonly apiKey: string | undefined,
    readonly model: string,
    readonly baseUrl: string,
    readonly timeoutMs: number,
  ) {}

  get available(): boolean {
    return this.apiKey !== undefined && this.apiKey.length > 0;
  }

  /**
   * Extract the sticker + LED route readings from a bus photo.
   * Retries once on 429/5xx. Throws GeminiError with a friendly message otherwise.
   */
  async extract(imageBase64: string, mimeType: string): Promise<Extraction> {
    if (!this.available) {
      throw new GeminiError(
        "AI is not configured on this server (GEMINI_API_KEY missing). Use the manual entry mode instead.",
        503,
      );
    }

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            stickerRoute: { type: "STRING", nullable: true },
            ledRoute: { type: "STRING", nullable: true },
            confidence: { type: "STRING", enum: ["HIGH", "MEDIUM", "LOW"] },
            note: { type: "STRING", nullable: true },
          },
          required: ["stickerRoute", "ledRoute", "confidence"],
          propertyOrdering: ["stickerRoute", "ledRoute", "confidence", "note"],
        },
      },
    };

    const modelsToTry = Array.from(new Set([this.model, "gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash"]));

    let lastError: unknown = null;
    for (const modelCandidate of modelsToTry) {
      const url = `${this.baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(modelCandidate)}:generateContent`;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await sleep(600);
        try {
          const response = await this.post(url, body);
          return parseExtraction(response);
        } catch (err) {
          lastError = err;
          if (err instanceof GeminiError && !retryable(err.status)) break;
        }
      }
    }
    throw toUserFacingError(lastError);
  }

  private async post(url: string, body: unknown): Promise<GenerateContentResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.apiKey as string,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        let message = `Gemini API error (${res.status})`;
        try {
          const parsed = JSON.parse(text) as { error?: { message?: string } };
          if (parsed.error?.message) message = parsed.error.message;
        } catch {
          /* keep generic message */
        }
        throw new GeminiError(message, res.status);
      }
      return JSON.parse(text) as GenerateContentResponse;
    } catch (err) {
      if (err instanceof GeminiError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new GeminiError("The AI service took too long to respond. Please try again.", 504);
      }
      throw new GeminiError("Could not reach the AI service. Please try again.", 502);
    } finally {
      clearTimeout(timer);
    }
  }
}

function retryable(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function toUserFacingError(err: unknown): GeminiError {
  if (err instanceof GeminiError) return err;
  if (err instanceof Error) return new GeminiError(err.message || "AI extraction failed.", 502);
  return new GeminiError("AI extraction failed.", 502);
}

function parseExtraction(response: GenerateContentResponse): Extraction {
  const candidate = response.candidates?.[0];
  if (!candidate) {
    if (response.error?.message) {
      throw new GeminiError(response.error.message, 502);
    }
    throw new GeminiError("The AI returned no answer. Please try again.", 502);
  }
  if (candidate.finishReason === "SAFETY" || candidate.finishReason === "RECITATION") {
    throw new GeminiError("The AI declined to process this image. Please try again.", 422);
  }
  const text = (candidate.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new GeminiError("The AI returned an empty answer. Please try again.", 502);
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new GeminiError("Couldn't interpret the AI's answer. Please try again.", 502);
  }

  const sticker = toRouteString(json.stickerRoute);
  const led = toRouteString(json.ledRoute);
  const rawConfidence = String(json.confidence ?? "LOW").toUpperCase();
  const confidence: Confidence = rawConfidence === "HIGH" || rawConfidence === "MEDIUM" ? rawConfidence : "LOW";
  const note = typeof json.note === "string" && json.note.trim() ? json.note.trim() : undefined;

  return { stickerRoute: sticker, ledRoute: led, confidence, note };
}

function toRouteString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "n/a") return null;
  const normalized = normalizeRoute(s);
  return normalized;
}

export const gemini = new Gemini(
  config.geminiApiKey,
  config.geminiModel,
  config.geminiBaseUrl,
  config.geminiTimeoutMs,
);
export { GeminiError };

