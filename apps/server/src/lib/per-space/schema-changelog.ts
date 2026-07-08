// Per-Space schema changelog (server-schema-changelog).
//
// Read-time assembly over data the engine already persists — no new capture:
//   - MODIFICATIONS come from bo_at_schema_updates (name/description/type/config/
//     options/primary_field changes, with before/after + breaks_data), stamped
//     with their run's date.
//   - REMOVALS come from the entity lifecycle columns (status='removed' +
//     first_unseen_run), stamped with the unseen run's date.
// This module is the PURE assembler: it takes already-fetched rows and produces
// the sorted, limited feed. The DB query lives in schema-changelog-io.ts so this
// stays unit-testable without a database.
//
// Additions (first_seen_run) are intentionally NOT emitted yet: every entity has
// a first_seen_run, so a naive "added" event would flood the feed with the
// baseline capture. Emitting genuine post-baseline additions needs the base's
// earliest run to filter against — a documented follow-up.

export type ChangelogEntityType = "base" | "table" | "field" | "view";
export type ChangelogKind = "modified" | "removed";

export interface ChangelogModificationRow {
  id: string;
  runId: string;
  entityType: ChangelogEntityType;
  entityId: string;
  baseId: string;
  tableId: string | null;
  changeType: string;
  changeTypeName: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  breaksData: boolean;
  /** ISO date of the run that recorded this change (completed_at ?? started_at). */
  at: string | null;
}

export interface ChangelogRemovalRow {
  runId: string | null;
  entityType: ChangelogEntityType;
  entityId: string;
  baseId: string;
  tableId: string | null;
  name: string;
  /** ISO date of the run that first didn't see the entity (first_unseen_run). */
  at: string | null;
}

export interface ChangelogEntry {
  runId: string | null;
  at: string | null;
  entityType: ChangelogEntityType;
  entityId: string;
  entityName: string | null;
  baseId: string;
  tableId: string | null;
  kind: ChangelogKind;
  changeType: string | null;
  changeTypeName: string | null;
  before: unknown;
  after: unknown;
  breaksData: boolean;
}

export interface SchemaChangelog {
  entries: ChangelogEntry[];
}

/** Descending by `at` (ISO strings sort lexically); null dates sort last. */
function byDateDesc(a: ChangelogEntry, b: ChangelogEntry): number {
  if (a.at === b.at) return 0;
  if (a.at === null) return 1;
  if (b.at === null) return -1;
  return a.at < b.at ? 1 : -1;
}

/**
 * Merge modification + removal rows into one date-sorted, limited feed.
 */
export function assembleChangelog(
  modifications: ChangelogModificationRow[],
  removals: ChangelogRemovalRow[],
  opts?: { limit?: number },
): SchemaChangelog {
  const modEntries: ChangelogEntry[] = modifications.map((m) => ({
    runId: m.runId,
    at: m.at,
    entityType: m.entityType,
    entityId: m.entityId,
    entityName: null,
    baseId: m.baseId,
    tableId: m.tableId,
    kind: "modified",
    changeType: m.changeType,
    changeTypeName: m.changeTypeName,
    before: m.beforeValue ?? null,
    after: m.afterValue ?? null,
    breaksData: m.breaksData,
  }));

  const removalEntries: ChangelogEntry[] = removals.map((r) => ({
    runId: r.runId,
    at: r.at,
    entityType: r.entityType,
    entityId: r.entityId,
    entityName: r.name,
    baseId: r.baseId,
    tableId: r.tableId,
    kind: "removed",
    changeType: null,
    changeTypeName: null,
    before: null,
    after: null,
    breaksData: false,
  }));

  const entries = [...modEntries, ...removalEntries].sort(byDateDesc);
  const limit = opts?.limit;
  return { entries: limit != null ? entries.slice(0, limit) : entries };
}
