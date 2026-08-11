// Cursor pagination (rest-read-api "Cursor pagination and list envelope"):
// opaque base64 keyset cursors, `limit` 1–100 default 50, no offsets. Pure +
// unit-tested; gap/duplicate-safe because the cursor carries the last row's
// keyset tuple (the caller filters strictly greater than it).

import { invalidRequest } from "./errors";

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

export type CursorParts = (string | number | null)[];

export function encodeCursor(parts: CursorParts): string {
  return Buffer.from(JSON.stringify(parts), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined): CursorParts | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((v) => v === null || typeof v === "string" || typeof v === "number")) return null;
    return parsed as CursorParts;
  } catch {
    return null;
  }
}

/** Parse `?limit=` into [1, MAX_LIMIT]; throws 400 invalid_limit on a non-numeric or out-of-range value. */
export function parseLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    throw invalidRequest("invalid_limit", `limit must be an integer between 1 and ${MAX_LIMIT}.`, "limit");
  }
  return n;
}

/** Decode `?cursor=`; throws 400 invalid_cursor on a malformed value (distinguish from "no cursor"). */
export function parseCursor(raw: string | null): CursorParts | null {
  if (raw === null) return null;
  const parts = decodeCursor(raw);
  if (parts === null) throw invalidRequest("invalid_cursor", "cursor is not a valid pagination cursor.", "cursor");
  return parts;
}

export interface Paginated<T> {
  data: T[];
  pagination: { nextCursor: string | null };
}

/**
 * Given `limit + 1` fetched rows, slice to `limit` and derive nextCursor from the
 * last kept row's keyset tuple. `keyOf` MUST match the ORDER BY used in the query.
 */
export function paginate<T>(rows: T[], limit: number, keyOf: (row: T) => CursorParts): Paginated<T> {
  if (rows.length <= limit) return { data: rows, pagination: { nextCursor: null } };
  const data = rows.slice(0, limit);
  return { data, pagination: { nextCursor: encodeCursor(keyOf(data[data.length - 1]!)) } };
}
