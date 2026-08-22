// Internal schema read/search helpers — PURE (no I/O), unit-tested.
// (server-rest-read-support.) The drizzle execution over the per-Space DB lives
// in space-db-pg.ts; this module owns the parts that must be deterministic and
// dialect-agnostic: the opaque keyset cursor codec, LIKE-pattern construction
// with wildcard escaping (identical semantics on D1 SQLite and managed PG), and
// the defensive re-validation of the search config that apps/api already
// Zod-validated at the public boundary (design D2). No zod dependency — the same
// hand-validation style as schema-sync.ts.

// ───────────────────────── keyset cursor ─────────────────────────
// Opaque base64url of the last row's sort key parts (design D3). No offsets;
// deterministic tie-break ordering makes these gap/duplicate-safe.

export type CursorParts = (string | number | null)[];

export function encodeCursor(parts: CursorParts): string {
  return Buffer.from(JSON.stringify(parts), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorParts | null {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((v) => v === null || typeof v === "string" || typeof v === "number")) return null;
    return parsed as CursorParts;
  } catch {
    return null;
  }
}

// ───────────────────────── LIKE matching ─────────────────────────
// Escape the SQL-LIKE metacharacters so user input matches literally; the only
// wildcards are the ones WE add per match mode. Backslash is the ESCAPE char
// (both dialects: SQLite defaults to no escape unless ESCAPE '\' is given; PG
// uses '\' by default — the query helper passes ESCAPE '\' explicitly for parity).

export function escapeLike(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export type MatchMode = "contains" | "exact" | "prefix";

export function likePattern(query: string, mode: MatchMode): string {
  const q = escapeLike(query);
  switch (mode) {
    case "contains":
      return `%${q}%`;
    case "prefix":
      return `${q}%`;
    case "exact":
      return q;
  }
}

// ───────────────────────── search config re-validation ─────────────────────────

export type EntityType = "base" | "table" | "field" | "view";
export type MatchField = "name" | "description" | "options";

export interface SearchConfig {
  query: string;
  types: EntityType[];
  match: { mode: MatchMode; in: MatchField[] };
  filters: {
    baseIds?: string[];
    fieldTypes?: string[];
    isPrimary?: boolean;
    changedAfter?: string;
  };
  sort?: { field: string; dir: "asc" | "desc" };
  limit: number;
  cursor?: string;
}

export type NormalizeResult =
  | { ok: true; config: SearchConfig }
  | { ok: false; param: string; message: string };

const ENTITY_TYPES: EntityType[] = ["base", "table", "field", "view"];
const MATCH_MODES: MatchMode[] = ["contains", "exact", "prefix"];
const MATCH_FIELDS: MatchField[] = ["name", "description", "options"];
const ALLOWED_TOP = new Set(["query", "types", "match", "filters", "sort", "limit", "cursor"]);
const ALLOWED_MATCH = new Set(["mode", "in"]);
const ALLOWED_FILTERS = new Set(["baseIds", "fieldTypes", "isPrimary", "changedAfter"]);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const fail = (param: string, message: string): NormalizeResult => ({ ok: false, param, message });

function stringArray(v: unknown, allowed: readonly string[] | null, param: string): { ok: true; value: string[] } | { ok: false; param: string; message: string } {
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
    return { ok: false, param, message: `${param} must be a string[]` };
  }
  if (allowed) {
    const bad = v.find((x) => !allowed.includes(x));
    if (bad !== undefined) return { ok: false, param, message: `${param} has invalid value "${bad}"` };
  }
  return { ok: true, value: v as string[] };
}

/**
 * Defensive re-validation of the search config. `apps/api` owns public
 * Zod-validation; this re-checks server-side and applies defaults. Unknown
 * top-level (and nested match/filters) keys are rejected, naming the param, to
 * mirror the public API's 400 `invalid_request` behavior.
 */
export function normalizeSearchConfig(raw: unknown): NormalizeResult {
  if (!isRecord(raw)) return fail("body", "body must be an object");

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_TOP.has(key)) return fail(key, `unknown property "${key}"`);
  }

  if (typeof raw.query !== "string" || raw.query.length === 0) {
    return fail("query", "query must be a non-empty string");
  }

  let types: EntityType[] = [...ENTITY_TYPES];
  if (raw.types !== undefined) {
    const r = stringArray(raw.types, ENTITY_TYPES, "types");
    if (!r.ok) return r;
    if (r.value.length === 0) return fail("types", "types must not be empty");
    types = r.value as EntityType[];
  }

  let match: SearchConfig["match"] = { mode: "contains", in: ["name", "description"] };
  if (raw.match !== undefined) {
    if (!isRecord(raw.match)) return fail("match", "match must be an object");
    for (const key of Object.keys(raw.match)) {
      if (!ALLOWED_MATCH.has(key)) return fail(`match.${key}`, `unknown property "match.${key}"`);
    }
    let mode: MatchMode = "contains";
    if (raw.match.mode !== undefined) {
      if (typeof raw.match.mode !== "string" || !MATCH_MODES.includes(raw.match.mode as MatchMode)) {
        return fail("match.mode", `match.mode must be one of ${MATCH_MODES.join("|")}`);
      }
      mode = raw.match.mode as MatchMode;
    }
    let inFields: MatchField[] = ["name", "description"];
    if (raw.match.in !== undefined) {
      const r = stringArray(raw.match.in, MATCH_FIELDS, "match.in");
      if (!r.ok) return r;
      if (r.value.length === 0) return fail("match.in", "match.in must not be empty");
      inFields = r.value as MatchField[];
    }
    match = { mode, in: inFields };
  }

  const filters: SearchConfig["filters"] = {};
  if (raw.filters !== undefined) {
    if (!isRecord(raw.filters)) return fail("filters", "filters must be an object");
    for (const key of Object.keys(raw.filters)) {
      if (!ALLOWED_FILTERS.has(key)) return fail(`filters.${key}`, `unknown property "filters.${key}"`);
    }
    if (raw.filters.baseIds !== undefined) {
      const r = stringArray(raw.filters.baseIds, null, "filters.baseIds");
      if (!r.ok) return r;
      filters.baseIds = r.value;
    }
    if (raw.filters.fieldTypes !== undefined) {
      const r = stringArray(raw.filters.fieldTypes, null, "filters.fieldTypes");
      if (!r.ok) return r;
      filters.fieldTypes = r.value;
    }
    if (raw.filters.isPrimary !== undefined) {
      if (typeof raw.filters.isPrimary !== "boolean") return fail("filters.isPrimary", "filters.isPrimary must be a boolean");
      filters.isPrimary = raw.filters.isPrimary;
    }
    if (raw.filters.changedAfter !== undefined) {
      if (typeof raw.filters.changedAfter !== "string" || Number.isNaN(Date.parse(raw.filters.changedAfter))) {
        return fail("filters.changedAfter", "filters.changedAfter must be an ISO-8601 date string");
      }
      filters.changedAfter = raw.filters.changedAfter;
    }
  }

  let sort: SearchConfig["sort"];
  if (raw.sort !== undefined) {
    if (!isRecord(raw.sort) || typeof raw.sort.field !== "string") return fail("sort", "sort must be { field, dir }");
    const dir = raw.sort.dir === "desc" ? "desc" : "asc";
    sort = { field: raw.sort.field, dir };
  }

  let limit = DEFAULT_LIMIT;
  if (raw.limit !== undefined) {
    if (typeof raw.limit !== "number" || !Number.isFinite(raw.limit)) return fail("limit", "limit must be a number");
    limit = Math.min(Math.max(Math.trunc(raw.limit), 1), MAX_LIMIT);
  }

  let cursor: string | undefined;
  if (raw.cursor !== undefined) {
    if (typeof raw.cursor !== "string") return fail("cursor", "cursor must be a string");
    cursor = raw.cursor;
  }

  return { ok: true, config: { query: raw.query, types, match, filters, sort, limit, cursor } };
}

/** Clamp a bare read-limit param (schema-read / versions / changelog paging). */
export function clampLimit(raw: string | null, fallback = DEFAULT_LIMIT): number {
  const n = parseInt(raw ?? String(fallback), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
}

// ───────────────────────── changelog filter + pagination (pure) ─────────────────────────
// The changelog is assembled in memory (bounded per base) from modifications +
// removals; the additive public filters + keyset pagination apply over that
// already-sorted (newest-first) list, so the web's parameterless path is
// untouched. Deterministic tie-break: (at desc, entityType, entityId, kind).

export interface ChangelogFilter {
  entityType?: string;
  changeType?: string;
  breaksData?: boolean;
  from?: string; // ISO — inclusive lower bound on `at`
  to?: string; // ISO — inclusive upper bound on `at`
  limit: number;
  cursor?: string;
}

export interface PaginableEntry {
  at: string | null;
  entityType: string;
  entityId: string;
  changeType: string | null;
  breaksData: boolean;
  kind: string;
}

const changelogKey = (e: PaginableEntry): CursorParts => [e.at, e.entityType, e.entityId, e.kind];

/** True when `a`'s sort tuple is strictly AFTER `b`'s under (at desc, type, id, kind). */
function afterTuple(a: CursorParts, b: CursorParts): boolean {
  // at DESC: a is "after" b when a.at < b.at.
  const aat = (a[0] as string | null) ?? "";
  const bat = (b[0] as string | null) ?? "";
  if (aat !== bat) return aat < bat;
  for (let i = 1; i < 4; i++) {
    const av = String(a[i] ?? ""), bv = String(b[i] ?? "");
    if (av !== bv) return av > bv;
  }
  return false;
}

export function paginateChangelog<E extends PaginableEntry>(
  entries: E[],
  filter: ChangelogFilter,
): { entries: E[]; nextCursor: string | null } {
  const fromMs = filter.from ? Date.parse(filter.from) : null;
  const toMs = filter.to ? Date.parse(filter.to) : null;
  let filtered = entries.filter((e) => {
    if (filter.entityType && e.entityType !== filter.entityType) return false;
    if (filter.changeType && e.changeType !== filter.changeType) return false;
    if (filter.breaksData !== undefined && e.breaksData !== filter.breaksData) return false;
    if ((fromMs != null || toMs != null)) {
      const atMs = e.at ? Date.parse(e.at) : NaN;
      if (Number.isNaN(atMs)) return false;
      if (fromMs != null && atMs < fromMs) return false;
      if (toMs != null && atMs > toMs) return false;
    }
    return true;
  });

  const cur = filter.cursor ? decodeCursor(filter.cursor) : null;
  if (cur && cur.length === 4) {
    filtered = filtered.filter((e) => afterTuple(changelogKey(e), cur));
  }

  let nextCursor: string | null = null;
  let page = filtered;
  if (filtered.length > filter.limit) {
    page = filtered.slice(0, filter.limit);
    nextCursor = encodeCursor(changelogKey(page[page.length - 1]!));
  }
  return { entries: page, nextCursor };
}

/**
 * Collapse base-run rows (one query) into the newest schema_hash per base.
 * Used by schemaHashesFor so getSchema is O(1) queries, not O(bases).
 */
export function pickLatestSchemaHashByBase(
  rows: { baseId: string; hash: string | null; startedAt: Date | null }[],
): Record<string, string | null> {
  const best = new Map<string, { hash: string | null; t: number }>();
  for (const row of rows) {
    const t = row.startedAt?.getTime() ?? 0;
    const prev = best.get(row.baseId);
    if (!prev || t > prev.t) best.set(row.baseId, { hash: row.hash, t });
  }
  return Object.fromEntries([...best].map(([id, v]) => [id, v.hash]));
}
