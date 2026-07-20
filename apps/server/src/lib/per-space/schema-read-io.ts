// Internal schema read/search DB helpers over the per-Space DB — I/O layer
// (server-rest-read-support). The public read API (apps/api) needs entity-scoped,
// paginated, searchable schema reads; these run against the same `bo_at_*`
// tables as readAllEntities but scoped + keyset-paginated. Managed_pg only today
// (the whole per-Space read path is — schema-read/changelog 501 on other
// backends); SQL is kept dialect-neutral (lower()/LIKE, no PG-only casts beyond
// options::text) so a future D1 read path can reuse the shapes. Pure decisions
// (cursor codec, LIKE escaping, config re-validation) live in schema-query.ts and
// are unit-tested; this executes and is exercised by the deployed smoke.

import { and, asc, desc, eq, gt, inArray, isNotNull, or, sql } from "drizzle-orm";
// note: keyset paging uses gt() (ascending id cursors); desc/asc for ordering.
import { alias } from "drizzle-orm/pg-core";
import { spacePg } from "@baseout/db-schema/space";
import type { SpaceTx } from "./space-db-pg";
import { extractFieldConfig } from "./schema-enrich";
import {
  decodeCursor,
  encodeCursor,
  likePattern,
  type MatchField,
  type SearchConfig,
} from "./schema-query";

const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);

// ───────────────────────── schema hash (ETag source, design D4) ─────────────────────────

/**
 * Current captured schema hash per base = the schema_hash on that base's most
 * recent base_run. `apps/api` derives ETags from this; it never hashes itself.
 */
export async function schemaHashesFor(
  tx: SpaceTx,
  baseIds: string[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const baseId of [...new Set(baseIds)]) {
    const [row] = await tx
      .select({ hash: spacePg.baseRuns.schemaHash })
      .from(spacePg.baseRuns)
      .where(and(eq(spacePg.baseRuns.baseId, baseId), isNotNull(spacePg.baseRuns.schemaHash)))
      .orderBy(desc(spacePg.baseRuns.startedAt))
      .limit(1);
    out[baseId] = row?.hash ?? null;
  }
  return out;
}

// ───────────────────────── scoped, paginated reads (design D1/D3) ─────────────────────────

export type ScopedEntity = "bases" | "tables" | "fields" | "views";

export interface ScopedReadOpts {
  entity: ScopedEntity;
  baseId?: string | null;
  tableId?: string | null;
  ids?: string[] | null;
  limit: number;
  cursor?: string | null;
}

export interface ScopedReadResult {
  entity: ScopedEntity;
  rows: Record<string, unknown>[];
  nextCursor: string | null;
  schemaHashByBase: Record<string, string | null>;
}

/** Cursor for scoped reads is the last row's native id (ascending keyset). */
function cursorId(cursor: string | null | undefined): string | null {
  if (!cursor) return null;
  const parts = decodeCursor(cursor);
  return parts && typeof parts[0] === "string" ? parts[0] : null;
}

export async function readEntitiesScoped(tx: SpaceTx, opts: ScopedReadOpts): Promise<ScopedReadResult> {
  const removedRuns = alias(spacePg.baseRuns, "removed_runs");
  const after = cursorId(opts.cursor);
  const take = opts.limit + 1; // fetch one extra to detect a next page
  const idsFilter = opts.ids && opts.ids.length ? opts.ids : null;

  let rows: Record<string, unknown>[] = [];

  if (opts.entity === "bases") {
    const where = [];
    if (idsFilter) where.push(inArray(spacePg.bases.baseId, idsFilter));
    if (after) where.push(gt(spacePg.bases.baseId, after));
    rows = (
      await tx
        .select({
          baseId: spacePg.bases.baseId, name: spacePg.bases.name, description: spacePg.bases.description,
          aiDescription: spacePg.bases.aiDescription, descriptionOverride: spacePg.bases.descriptionOverride,
          status: spacePg.bases.status, removedAtTs: removedRuns.completedAt,
        })
        .from(spacePg.bases)
        .leftJoin(removedRuns, eq(spacePg.bases.firstUnseenRun, removedRuns.id))
        .where(where.length ? and(...where) : undefined)
        .orderBy(asc(spacePg.bases.baseId))
        .limit(take)
    ).map(({ removedAtTs, ...b }) => ({ ...b, removedAt: isoOrNull(removedAtTs) }));
  } else if (opts.entity === "tables") {
    const where = [];
    if (opts.baseId) where.push(eq(spacePg.tables.baseId, opts.baseId));
    if (idsFilter) where.push(inArray(spacePg.tables.tableId, idsFilter));
    if (after) where.push(gt(spacePg.tables.tableId, after));
    rows = (
      await tx
        .select({
          tableId: spacePg.tables.tableId, baseId: spacePg.tables.baseId, name: spacePg.tables.name,
          recordCount: spacePg.tables.recordCount, fieldCount: spacePg.tables.fieldCount,
          description: spacePg.tables.description, aiDescription: spacePg.tables.aiDescription,
          descriptionOverride: spacePg.tables.descriptionOverride, status: spacePg.tables.status,
          removedAtTs: removedRuns.completedAt,
        })
        .from(spacePg.tables)
        .leftJoin(removedRuns, eq(spacePg.tables.firstUnseenRun, removedRuns.id))
        .where(where.length ? and(...where) : undefined)
        .orderBy(asc(spacePg.tables.tableId))
        .limit(take)
    ).map(({ removedAtTs, ...t }) => ({ ...t, removedAt: isoOrNull(removedAtTs) }));
  } else if (opts.entity === "fields") {
    const where = [];
    if (opts.baseId) where.push(eq(spacePg.fields.baseId, opts.baseId));
    if (opts.tableId) where.push(eq(spacePg.fields.tableId, opts.tableId));
    if (idsFilter) where.push(inArray(spacePg.fields.fieldId, idsFilter));
    if (after) where.push(gt(spacePg.fields.fieldId, after));
    rows = (
      await tx
        .select({
          fieldId: spacePg.fields.fieldId, tableId: spacePg.fields.tableId, baseId: spacePg.fields.baseId,
          name: spacePg.fields.name, type: spacePg.fields.type, options: spacePg.fields.options,
          isPrimary: spacePg.fields.isPrimary, description: spacePg.fields.description,
          aiDescription: spacePg.fields.aiDescription, descriptionOverride: spacePg.fields.descriptionOverride,
          status: spacePg.fields.status, removedAtTs: removedRuns.completedAt,
        })
        .from(spacePg.fields)
        .leftJoin(removedRuns, eq(spacePg.fields.firstUnseenRun, removedRuns.id))
        .where(where.length ? and(...where) : undefined)
        .orderBy(asc(spacePg.fields.fieldId))
        .limit(take)
    ).map(({ removedAtTs, options, ...f }) => ({ ...f, ...extractFieldConfig(f.type, options), removedAt: isoOrNull(removedAtTs) }));
  } else {
    const where = [];
    if (opts.baseId) where.push(eq(spacePg.views.baseId, opts.baseId));
    if (opts.tableId) where.push(eq(spacePg.views.tableId, opts.tableId));
    if (idsFilter) where.push(inArray(spacePg.views.viewId, idsFilter));
    if (after) where.push(gt(spacePg.views.viewId, after));
    rows = (
      await tx
        .select({
          viewId: spacePg.views.viewId, tableId: spacePg.views.tableId, baseId: spacePg.views.baseId,
          name: spacePg.views.name, type: spacePg.views.type, status: spacePg.views.status,
          removedAtTs: removedRuns.completedAt,
        })
        .from(spacePg.views)
        .leftJoin(removedRuns, eq(spacePg.views.firstUnseenRun, removedRuns.id))
        .where(where.length ? and(...where) : undefined)
        .orderBy(asc(spacePg.views.viewId))
        .limit(take)
    ).map(({ removedAtTs, ...v }) => ({ ...v, removedAt: isoOrNull(removedAtTs) }));
  }

  const idKey = opts.entity === "bases" ? "baseId" : opts.entity === "tables" ? "tableId" : opts.entity === "fields" ? "fieldId" : "viewId";
  let nextCursor: string | null = null;
  if (rows.length > opts.limit) {
    rows = rows.slice(0, opts.limit);
    const last = rows[rows.length - 1]!;
    nextCursor = encodeCursor([last[idKey] as string]);
  }

  const baseIds = rows.map((r) => r.baseId as string).filter(Boolean);
  const schemaHashByBase = await schemaHashesFor(tx, baseIds.length ? baseIds : opts.baseId ? [opts.baseId] : []);
  return { entity: opts.entity, rows, nextCursor, schemaHashByBase };
}

// ───────────────────────── search (design D2) ─────────────────────────

export interface SearchHit {
  type: "base" | "table" | "field" | "view";
  entity: Record<string, unknown>;
  ancestry: { base?: { baseId: string; name: string }; table?: { tableId: string; name: string } };
  /** internal sort key (name); not serialized by the public API. */
  sortValue: string | null;
}

export interface SearchResult {
  hits: Omit<SearchHit, "sortValue">[];
  nextCursor: string | null;
  schemaHashByBase: Record<string, string | null>;
}

// Case-insensitive LIKE with explicit backslash ESCAPE for %/_ parity.
const ilikeEsc = (col: unknown, pattern: string) => sql`${col} ILIKE ${pattern} ESCAPE '\'`;

/** Per-type cap so a pathological query can't unbound the merge (schema volume is small). */
const SEARCH_PER_TYPE_CAP = 500;

export async function searchSchema(tx: SpaceTx, config: SearchConfig): Promise<SearchResult> {
  const pattern = likePattern(config.query, config.match.mode);
  const inFields = new Set<MatchField>(config.match.in);
  const baseIds = config.filters.baseIds && config.filters.baseIds.length ? config.filters.baseIds : null;
  const changedAfter = config.filters.changedAfter ? new Date(config.filters.changedAfter) : null;

  const nameMatch = (col: unknown) => (inFields.has("name") ? [ilikeEsc(col, pattern)] : []);
  const descMatch = (col: unknown) => (inFields.has("description") ? [ilikeEsc(col, pattern)] : []);

  const hits: SearchHit[] = [];

  // changedAfter: entity's last_seen_run completed_at ≥ instant. The `changed`
  // alias is joined per type on that entity's last_seen_run, so the condition
  // just checks its completed_at.
  const changed = alias(spacePg.baseRuns, "changed_runs");
  const changedCond = () =>
    changedAfter ? [sql`${changed.completedAt} >= ${changedAfter.toISOString()}`] : [];

  if (config.types.includes("base")) {
    const or1 = [...nameMatch(spacePg.bases.name), ...descMatch(spacePg.bases.description)];
    if (or1.length) {
      const where = [or(...or1)!];
      if (baseIds) where.push(inArray(spacePg.bases.baseId, baseIds));
      if (changedAfter) where.push(...changedCond());
      const rows = await tx
        .select({ baseId: spacePg.bases.baseId, name: spacePg.bases.name, description: spacePg.bases.description, status: spacePg.bases.status })
        .from(spacePg.bases)
        .leftJoin(changed, eq(spacePg.bases.lastSeenRun, changed.id))
        .where(and(...where))
        .limit(SEARCH_PER_TYPE_CAP);
      for (const r of rows) hits.push({ type: "base", entity: r, ancestry: {}, sortValue: r.name });
    }
  }

  if (config.types.includes("table")) {
    const or1 = [...nameMatch(spacePg.tables.name), ...descMatch(spacePg.tables.description)];
    if (or1.length) {
      const where = [or(...or1)!];
      if (baseIds) where.push(inArray(spacePg.tables.baseId, baseIds));
      if (changedAfter) where.push(...changedCond());
      const rows = await tx
        .select({
          tableId: spacePg.tables.tableId, baseId: spacePg.tables.baseId, name: spacePg.tables.name,
          description: spacePg.tables.description, status: spacePg.tables.status, baseName: spacePg.bases.name,
        })
        .from(spacePg.tables)
        .leftJoin(spacePg.bases, eq(spacePg.tables.baseId, spacePg.bases.baseId))
        .leftJoin(changed, eq(spacePg.tables.lastSeenRun, changed.id))
        .where(and(...where))
        .limit(SEARCH_PER_TYPE_CAP);
      for (const { baseName, ...t } of rows)
        hits.push({ type: "table", entity: t, ancestry: { base: { baseId: t.baseId, name: baseName ?? "" } }, sortValue: t.name });
    }
  }

  if (config.types.includes("field")) {
    const or1 = [
      ...nameMatch(spacePg.fields.name),
      ...descMatch(spacePg.fields.description),
      ...(inFields.has("options") ? [ilikeEsc(sql`${spacePg.fields.options}::text`, pattern)] : []),
    ];
    if (or1.length) {
      const where = [or(...or1)!];
      if (baseIds) where.push(inArray(spacePg.fields.baseId, baseIds));
      if (config.filters.fieldTypes?.length) where.push(inArray(spacePg.fields.type, config.filters.fieldTypes));
      if (config.filters.isPrimary !== undefined) where.push(eq(spacePg.fields.isPrimary, config.filters.isPrimary));
      if (changedAfter) where.push(...changedCond());
      const tbl = alias(spacePg.tables, "field_table");
      const rows = await tx
        .select({
          fieldId: spacePg.fields.fieldId, tableId: spacePg.fields.tableId, baseId: spacePg.fields.baseId,
          name: spacePg.fields.name, type: spacePg.fields.type, options: spacePg.fields.options,
          isPrimary: spacePg.fields.isPrimary, description: spacePg.fields.description, status: spacePg.fields.status,
          baseName: spacePg.bases.name, tableName: tbl.name,
        })
        .from(spacePg.fields)
        .leftJoin(spacePg.bases, eq(spacePg.fields.baseId, spacePg.bases.baseId))
        .leftJoin(tbl, eq(spacePg.fields.tableId, tbl.tableId))
        .leftJoin(changed, eq(spacePg.fields.lastSeenRun, changed.id))
        .where(and(...where))
        .limit(SEARCH_PER_TYPE_CAP);
      for (const { baseName, tableName, options, ...f } of rows) {
        hits.push({
          type: "field",
          entity: { ...f, ...extractFieldConfig(f.type, options) },
          ancestry: { base: { baseId: f.baseId, name: baseName ?? "" }, table: { tableId: f.tableId, name: tableName ?? "" } },
          sortValue: f.name,
        });
      }
    }
  }

  if (config.types.includes("view")) {
    const or1 = [...nameMatch(spacePg.views.name)]; // views have no description/options
    if (or1.length && (inFields.has("name") || inFields.size === 0)) {
      const where = [or(...or1)!];
      if (baseIds) where.push(inArray(spacePg.views.baseId, baseIds));
      if (changedAfter) where.push(...changedCond());
      const tbl = alias(spacePg.tables, "view_table");
      const rows = await tx
        .select({
          viewId: spacePg.views.viewId, tableId: spacePg.views.tableId, baseId: spacePg.views.baseId,
          name: spacePg.views.name, type: spacePg.views.type, status: spacePg.views.status,
          baseName: spacePg.bases.name, tableName: tbl.name,
        })
        .from(spacePg.views)
        .leftJoin(spacePg.bases, eq(spacePg.views.baseId, spacePg.bases.baseId))
        .leftJoin(tbl, eq(spacePg.views.tableId, tbl.tableId))
        .leftJoin(changed, eq(spacePg.views.lastSeenRun, changed.id))
        .where(and(...where))
        .limit(SEARCH_PER_TYPE_CAP);
      for (const { baseName, tableName, ...v } of rows)
        hits.push({
          type: "view",
          entity: v,
          ancestry: { base: { baseId: v.baseId, name: baseName ?? "" }, table: { tableId: v.tableId, name: tableName ?? "" } },
          sortValue: v.name,
        });
    }
  }

  // Deterministic global order: name (nulls last), then type, then native id — so
  // the opaque cursor [sortValue, type, id] is stable (design D2/D3).
  const idOf = (h: SearchHit) => (h.entity.baseId ?? h.entity.tableId ?? h.entity.fieldId ?? h.entity.viewId ?? "") as string;
  const cmp = (a: SearchHit, b: SearchHit): number => {
    const an = a.sortValue ?? "￿";
    const bn = b.sortValue ?? "￿";
    if (an !== bn) return an < bn ? -1 : 1;
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    const ai = idOf(a), bi = idOf(b);
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  };
  hits.sort(cmp);

  // Apply cursor: drop everything up to and including the cursor tuple.
  const cur = config.cursor ? decodeCursor(config.cursor) : null;
  let start = 0;
  if (cur && cur.length === 3) {
    const cursorHit: SearchHit = {
      type: cur[1] as SearchHit["type"],
      entity: {},
      ancestry: {},
      sortValue: cur[0] as string | null,
    };
    // find first hit strictly greater than the cursor tuple
    const idCur = cur[2] as string;
    start = hits.findIndex((h) => {
      const an = h.sortValue ?? "￿";
      const bn = cursorHit.sortValue ?? "￿";
      if (an !== bn) return an > bn;
      if (h.type !== cursorHit.type) return h.type > cursorHit.type;
      return idOf(h) > idCur;
    });
    if (start < 0) start = hits.length;
  }

  const page = hits.slice(start, start + config.limit);
  let nextCursor: string | null = null;
  if (start + config.limit < hits.length && page.length) {
    const last = page[page.length - 1]!;
    nextCursor = encodeCursor([last.sortValue, last.type, idOf(last)]);
  }

  const involvedBaseIds = page.map((h) => (h.ancestry.base?.baseId ?? (h.entity.baseId as string)) ?? "").filter(Boolean);
  const schemaHashByBase = await schemaHashesFor(tx, involvedBaseIds);
  return { hits: page.map(({ sortValue: _s, ...h }) => h), nextCursor, schemaHashByBase };
}

// ───────────────────────── versions listing (no schema_json) ─────────────────────────

export interface VersionsResult {
  versions: { id: string; schemaHash: string; capturedAt: string | null }[];
  nextCursor: string | null;
}

export async function readSchemaVersions(
  tx: SpaceTx,
  baseId: string,
  opts: { limit: number; cursor?: string | null },
): Promise<VersionsResult> {
  const take = opts.limit + 1;
  const rows = await tx
    .select({
      id: spacePg.schemaVersions.id,
      schemaHash: spacePg.schemaVersions.schemaHash,
      capturedAt: spacePg.baseRuns.completedAt,
      startedAt: spacePg.baseRuns.startedAt,
    })
    .from(spacePg.schemaVersions)
    .leftJoin(spacePg.baseRuns, eq(spacePg.schemaVersions.firstSeenRun, spacePg.baseRuns.id))
    .where(eq(spacePg.schemaVersions.baseId, baseId))
    .orderBy(desc(spacePg.baseRuns.startedAt), desc(spacePg.schemaVersions.id))
    .limit(take);

  // cursor = [startedAtIso, versionId]; keyset on (started_at desc, id desc).
  const cur = opts.cursor ? decodeCursor(opts.cursor) : null;
  let filtered = rows;
  if (cur && cur.length === 2) {
    const [ts, id] = cur as [string | null, string];
    filtered = rows.filter((r) => {
      const rts = isoOrNull(r.startedAt) ?? "";
      const cts = ts ?? "";
      if (rts !== cts) return rts < cts;
      return r.id < id;
    });
  }

  let nextCursor: string | null = null;
  let page = filtered;
  if (filtered.length > opts.limit) {
    page = filtered.slice(0, opts.limit);
    const last = page[page.length - 1]!;
    nextCursor = encodeCursor([isoOrNull(last.startedAt), last.id]);
  }

  return {
    versions: page.map((r) => ({ id: r.id, schemaHash: r.schemaHash, capturedAt: isoOrNull(r.capturedAt) })),
    nextCursor,
  };
}
