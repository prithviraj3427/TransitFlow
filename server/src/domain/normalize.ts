/**
 * Route-token normalization.
 *
 * Indian city-bus route numbers look like: 1, 10, 102, 102A, 36H, 96M.
 * Comparison must be tolerant of case, surrounding spaces and stray dots,
 * but must NOT merge distinct routes (102 ≠ 102A).
 */

export function normalizeRoute(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().toUpperCase();
  if (s === "" || s === "NULL" || s === "N/A" || s === "UNKNOWN" || s === "-") return null;
  // Strip words that models sometimes prepend/append.
  s = s.replace(/^(ROUTE|NO\.?|NUMBER)\s*/i, "");
  // Collapse internal whitespace; drop trailing punctuation noise.
  s = s.replace(/\s+/g, "").replace(/[.\u200b]+$/g, "").trim();
  if (s === "") return null;
  return s;
}

/** Case/space-insensitive equality of two route tokens. */
export function sameRoute(a: string | null, b: string | null): boolean {
  const na = normalizeRoute(a);
  const nb = normalizeRoute(b);
  if (na === null || nb === null) return false;
  return na === nb;
}

/** Normalize a stop name for index lookups. */
export function normalizeStop(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,·]+$/g, "")
    .trim();
}
