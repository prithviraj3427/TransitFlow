import type { Extraction, Verdict } from "./types.js";
import { normalizeRoute, sameRoute } from "./normalize.js";

/**
 * The single source of truth for the TransitFlow verdict.
 *
 *   sticker == led  → MATCH     (bus is running its claimed route)
 *   sticker != led  → MISMATCH  (ghost bus — rider alert)
 *   either missing  → UNCERTAIN (needs human confirmation / manual entry)
 *
 * The client never decides; it only presents the server verdict.
 */
export function decide(sticker: string | null, led: string | null): Verdict {
  const s = normalizeRoute(sticker);
  const l = normalizeRoute(led);
  if (s === null || l === null) return "UNCERTAIN";
  return s === l ? "MATCH" : "MISMATCH";
}

export function decideExtraction(extraction: Extraction): Verdict {
  return decide(extraction.stickerRoute, extraction.ledRoute);
}

/**
 * Human-readable explanation of a verdict, for UI copy.
 */
export function explainVerdict(
  verdict: Verdict,
  sticker: string | null,
  led: string | null,
): string {
  const s = normalizeRoute(sticker);
  const l = normalizeRoute(led);
  switch (verdict) {
    case "MATCH":
      return `Route ${l} is running as advertised on its sticker. Safe to board for ${s}.`;
    case "MISMATCH":
      return `This bus claims ${s} on its sticker but is actually running ${l}.`;
    case "UNCERTAIN":
      return "I couldn't read both route numbers clearly. Double-check the bus, then confirm below.";
  }
}
