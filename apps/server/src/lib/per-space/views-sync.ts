// MCP views capture → bo_at_views merge — PURE (no I/O), unit-tested
// (server-mcp-views; paired with workflows-mcp-views).
//
// The workflows backup task captures a base's views via the Airtable MCP
// server — `list_views_for_table` is PER-TABLE (spike 2026-07-27, see
// workflows-mcp-views README), so the capture is the per-table aggregation,
// forwarded on the schema-sync callback as the optional `views` field. This
// module owns:
//   - the wire type of that field (single source for both repos),
//   - extraction into flat view entities,
//   - the run-over-run diff against the prior bo_at_views working set.
//
// The envelope is inventory-grade ({views: [{id, name, type}]} — no
// configuration), so per design Decision 4 there is NO definition column and
// NO `config` changelog rows: lifecycle + name/type updates only, mirroring
// the REST enterprise path's view handling in schema-diff.ts EXACTLY — one
// bo_at_views table, two sources, no consumer-visible difference (Decision 1).
//
// All-or-skip contract: a present capture covers EVERY table of the base
// (workflows marks the whole capture skipped if any table's call fails), so a
// successful capture is a full sighting — absent view ids are confident
// removals, never `unknown`. A structurally-broken table entry therefore
// invalidates the WHOLE capture (partial visibility must not false-remove).
//
// Diff rules (REST parity, schema-diff.ts views block):
//   - add/remove are lifecycle (status + run stamps), NOT bo_at_schema_updates
//     (the changelog derives add/remove from lifecycle stamps);
//   - renames/type changes → bo_at_schema_updates (entity_type='view');
//   - an identical capture (vs the ACTIVE prior rows) short-circuits with zero
//     ops; the IO layer still stamps last_seen_run (stampViewsSeenForBase).

import type { LifecycleOp, PriorView, SchemaUpdateOp } from "./schema-diff";

/**
 * Wire shape of the optional `views` field on the schema-sync POST body —
 * owned by THIS change; workflows sends it, only on fully-successful captures.
 * Each entry's `raw` is one table's `list_views_for_table` envelope, forwarded
 * verbatim.
 */
export interface ViewsCapture {
  /** ISO-8601 — when the MCP capture resolved on the workflows side. */
  capturedAt: string;
  tables: { tableId: string; raw: unknown }[];
}

export interface ExtractedView {
  viewId: string;
  tableId: string;
  name: string;
  type: string | null;
}

export type ParsedViewsCapture =
  | { kind: "absent" }
  | { kind: "invalid"; reason: "invalid_capture" | "invalid_envelope" }
  | { kind: "ok"; capturedAt: Date; views: ExtractedView[]; dropped: number };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Parse the optional `views` field. `undefined` (absent — old workflows,
 * skipped captures, REST-mode runs) means NO view processing whatsoever; a
 * present-but-malformed field is reported (`invalid`) without failing the
 * sync. Per-view entries missing a string id/name are dropped (counted) —
 * spike-pinned entries always carry both.
 */
export function parseViewsField(field: unknown): ParsedViewsCapture {
  if (field === undefined) return { kind: "absent" };
  const capture = field as Partial<ViewsCapture> | null;
  const capturedAt = new Date(String(capture?.capturedAt ?? ""));
  if (!capture || Number.isNaN(capturedAt.getTime()) || !Array.isArray(capture.tables)) {
    return { kind: "invalid", reason: "invalid_capture" };
  }

  const views: ExtractedView[] = [];
  let dropped = 0;
  for (const entry of capture.tables) {
    if (!isRecord(entry) || typeof entry.tableId !== "string" || !isRecord(entry.raw) || !Array.isArray(entry.raw.views)) {
      return { kind: "invalid", reason: "invalid_envelope" };
    }
    for (const v of entry.raw.views) {
      if (!isRecord(v) || typeof v.id !== "string" || typeof v.name !== "string") {
        dropped++;
        continue;
      }
      views.push({
        viewId: v.id,
        tableId: entry.tableId,
        name: v.name,
        type: typeof v.type === "string" ? v.type : null,
      });
    }
  }
  return { kind: "ok", capturedAt, views, dropped };
}

export interface ViewsDiffResult {
  /** Identical to the active prior set — IO stamps last_seen_run and stops. */
  unchanged: boolean;
  lifecycle: LifecycleOp[];
  schemaUpdates: SchemaUpdateOp[];
}

/**
 * Run-over-run diff of a successful MCP views capture against the prior
 * bo_at_views working set for one base. Mirrors schema-diff.ts's views block:
 * insert/seen upserts with {tableId, name, type} attrs, name/type
 * schema-updates on seen rows, confident removal of active-or-unknown prior
 * rows absent from the capture.
 */
export function diffViews(args: {
  baseId: string;
  prior: PriorView[];
  next: ExtractedView[];
}): ViewsDiffResult {
  const { baseId, prior, next } = args;

  // Short-circuit: compare the ACTIVE prior rows to the capture on the full
  // attribute tuple. Any `unknown` row blocks the short-circuit — a successful
  // capture must resolve it either way (seen-resurrect or confident removal).
  const tuple = (v: { viewId: string; tableId: string; name: string; type: string | null }) =>
    JSON.stringify([v.viewId, v.tableId, v.name, v.type ?? null]);
  const activePrior = prior.filter((p) => p.status === "active");
  const priorSet = new Set(activePrior.map(tuple));
  const nextSet = new Set(next.map(tuple));
  const hasUnknown = prior.some((p) => p.status === "unknown");
  if (!hasUnknown && priorSet.size === nextSet.size && [...nextSet].every((t) => priorSet.has(t))) {
    return { unchanged: true, lifecycle: [], schemaUpdates: [] };
  }

  const lifecycle: LifecycleOp[] = [];
  const schemaUpdates: SchemaUpdateOp[] = [];
  const priorById = new Map(prior.map((p) => [p.viewId, p]));
  const nextById = new Map(next.map((v) => [v.viewId, v]));

  for (const v of next) {
    const p = priorById.get(v.viewId);
    const attrs = { tableId: v.tableId, name: v.name, type: v.type ?? null };
    if (!p) {
      lifecycle.push({ entity: "view", id: v.viewId, action: "insert", baseId, tableId: v.tableId, attrs });
      continue;
    }
    lifecycle.push({ entity: "view", id: v.viewId, action: "seen", baseId, tableId: v.tableId, attrs });
    if (p.name !== v.name) {
      schemaUpdates.push({
        entityType: "view",
        entityId: v.viewId,
        baseId,
        tableId: v.tableId,
        changeType: "name",
        changeTypeName: null,
        beforeValue: p.name,
        afterValue: v.name,
        breaksData: false,
      });
    }
    if ((p.type ?? null) !== (v.type ?? null)) {
      schemaUpdates.push({
        entityType: "view",
        entityId: v.viewId,
        baseId,
        tableId: v.tableId,
        changeType: "type",
        changeTypeName: null,
        beforeValue: p.type ?? null,
        afterValue: v.type ?? null,
        breaksData: false,
      });
    }
  }

  for (const p of prior) {
    if (!nextById.has(p.viewId) && p.status !== "removed") {
      lifecycle.push({ entity: "view", id: p.viewId, action: "removed", baseId, tableId: p.tableId, attrs: {} });
    }
  }

  return { unchanged: false, lifecycle, schemaUpdates };
}
