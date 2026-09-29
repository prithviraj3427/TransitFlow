import { randomBytes } from "node:crypto";

/** Short, URL-safe, sortable-enough identifiers. */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("base64url")}`;
}

export const scanId = (): string => newId("sc");
export const reportId = (): string => newId("rp");
export const alertId = (): string => newId("al");
