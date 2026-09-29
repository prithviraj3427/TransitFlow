import { Router } from "express";
import { config } from "../config.js";
import { gemini, GeminiError } from "../ai/gemini.js";
import { decide } from "../domain/decision.js";
import { scanId } from "../domain/ids.js";
import { HttpError } from "../http/errors.js";
import { rateLimit } from "../http/rateLimit.js";
import type { Store } from "../store/store.js";
import type { Scan } from "../domain/types.js";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/scan
 * body: { "imageBase64": "<base64>", "mimeType": "image/jpeg" }
 *
 * Runs the AI extraction and stores the reading server-side.
 * Response: { scanId, verdict, extraction, createdAt }
 */
export function scanRouter(store: Store): Router {
  const router = Router();

  router.post(
    "/",
    rateLimit({ key: "scan", max: config.scanRateLimit.max, windowMs: config.scanRateLimit.windowMs }),
    async (req, res, next) => {
      try {
        const body = (req.body ?? {}) as { imageBase64?: unknown; mimeType?: unknown };
        const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
        const mimeType = typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";

        if (!imageBase64) {
          throw HttpError.badRequest("Please attach a photo of the bus (imageBase64).");
        }
        if (imageBase64.length > config.maxImageBytes * 1.4) {
          throw HttpError.badRequest("That photo is too large. Use a photo under 10 MB.");
        }
        const cleanMime = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
        if (!ALLOWED_MIME.has(cleanMime)) {
          throw HttpError.badRequest("Unsupported image type. Please send a JPEG, PNG or WebP photo.");
        }

        // Cheap sanity sniff: base64 of a JPEG starts with "/9j", PNG with "iVBOR", WebP with "UklGR".
        const head = imageBase64.slice(0, 8);
        const sniffOk =
          head.startsWith("/9j") || // jpeg
          head.startsWith("iVBOR") || // png
          head.startsWith("UklGR") || // webp (RIFF)
          head.startsWith("R0lGOD"); // gif (tolerated, sent as jpeg/png)
        if (!sniffOk) {
          throw HttpError.badRequest("That doesn't look like a photo. Please try a different image.");
        }

        const extraction = await gemini.extract(imageBase64, cleanMime);
        const verdict = decide(extraction.stickerRoute, extraction.ledRoute);
        const scan: Scan = {
          scanId: scanId(),
          extraction,
          verdict,
          source: "ai",
          createdAt: new Date().toISOString(),
        };
        await store.createScan(scan);

        res.json({
          scanId: scan.scanId,
          verdict: scan.verdict,
          extraction: scan.extraction,
          createdAt: scan.createdAt,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export { GeminiError };
