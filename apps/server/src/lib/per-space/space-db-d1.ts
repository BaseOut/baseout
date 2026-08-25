// Per-Space DB read + apply — D1/SQLite backend, I/O layer (server-d1-data-plane).
//
// MIRROR of the schema slice of ./space-db-pg.ts, written as parameterized SQL
// against the SpaceD1Executor seam: production speaks the Cloudflare D1 HTTP
// query API (per-Space databases cannot be Worker bindings); tests run the
// SAME statements on a real local D1 (miniflare binding). The pure diff
// modules (schema-diff.ts) are backend-agnostic and shared with the pg path.
//
// NO cross-statement transaction exists on the D1 HTTP API (design D3), so
// every write here is an idempotent upsert keyed on natural ids — a partially
// applied sync converges on the next backup run instead of corrupting state.
// Scope is deliberately the schema data plane only: base runs, the schema
// working set + diff apply, the Browse read, and per-table view regeneration.

import type { SpaceD1Executor } from "./d1-query";
import type {
  LifecycleOp,
  PriorWorkingSet,
  SchemaDiffResult,
} from "./schema-diff";
import { extractFieldConfig, type FieldConfig } from "./schema-enrich";
import { pickLatestSchemaHashByBase } from "./schema-query";
import {
  buildQueryViewStatements,
  dropStaleViewStatements,
  planViewNames,
} from "./query-views-sqlite";

type Row = Record<string, unknown>;

const rows = (r: unknown[]): Row[] => r as Row[];
const s = (v: unknown): string => String(v);
const ns = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const ni = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const b = (v: unknown): boolean => v === 1 || v === true || v === "1";
/** JSON-encode like drizzle's json-mode text columns; null stays SQL NULL. */
const j = (v: unknown): string | null => (v === null || v === undefined ? null : JSON.stringify(v));
const parseJson = (v: unknown): unknown => {
  if (v === null || v === undefined) return null;
  try {
    return JSON.parse(String(v));
  } catch {
    return null; // one bad stored value must not error the read
  }
};

// ───────────────────────── base_runs ─────────────────────────

/** Select-or-insert the per-(backup_run, base) execution row; returns its id. */
export async function ensureBaseRun(
  exec: SpaceD1Executor,
  backupRunId: string,
  baseId: string,
): Promise<string> {
  const existing = rows(
    await exec.query(
      `SELECT id FROM bo_at_base_runs WHERE backup_run_id = ? AND base_id = ? LIMIT 1`,
      [backupRunId, baseId],
    ),
  );
  if (existing[0]) return s(existing[0].id);
  const id = crypto.randomUUID();
  await exec.query(
    `INSERT INTO bo_at_base_runs (id, backup_run_id, base_id, status, started_at)
     VALUES (?, ?, ?, 'running', ?)`,
    [id, backupRunId, baseId, new Date().toISOString()],
  );
  return id;
}

// ───────────────────────── schema working set ─────────────────────────

export async function readSchemaWorkingSet(
  exec: SpaceD1Executor,
  baseId: string,
): Promise<PriorWorkingSet> {
  const bases = rows(
    await exec.query(
      `SELECT base_id, name, description, status FROM bo_at_bases WHERE base_id = ?`,
      [baseId],
    ),
  );
  const tables = rows(
    await exec.query(
      `SELECT table_id, name, primary_field_id, description, status FROM bo_at_tables WHERE base_id = ?`,
      [baseId],
    ),
  );
  const fields = rows(
    await exec.query(
      `SELECT field_id, table_id, name, type, options, is_primary, description, status
       FROM bo_at_fields WHERE base_id = ?`,
      [baseId],
    ),
  );
  const views = rows(
    await exec.query(
      `SELECT view_id, table_id, name, type, status FROM bo_at_views WHERE base_id = ?`,
      [baseId],
    ),
  );
  const base = bases[0];
  return {
    base: base
      ? { baseId: s(base.base_id), name: s(base.name), description: ns(base.description), status: s(base.status) }
      : null,
    tables: tables.map((t) => ({
      tableId: s(t.table_id),
      name: s(t.name),
      primaryFieldId: ns(t.primary_field_id),
      description: ns(t.description),
      status: s(t.status),
    })),
    fields: fields.map((f) => ({
      fieldId: s(f.field_id),
      tableId: s(f.table_id),
      name: s(f.name),
      type: s(f.type),
      options: parseJson(f.options),
      isPrimary: b(f.is_primary),
      description: ns(f.description),
      status: s(f.status),
    })),
    views: views.map((v) => ({
      viewId: s(v.view_id),
      tableId: s(v.table_id),
      name: s(v.name),
      type: ns(v.type),
      status: s(v.status),
    })),
  };
}

// ───────────────────────── schema diff apply ─────────────────────────

async function applyLifecycleOp(
  exec: SpaceD1Executor,
  runId: string,
  op: LifecycleOp,
): Promise<void> {
  const a = op.attrs;

  if (op.action === "insert" || op.action === "seen") {
    switch (op.entity) {
      case "base":
        await exec.query(
          `INSERT INTO bo_at_bases (base_id, name, description, status, first_seen_run, last_seen_run)
           VALUES (?, ?, ?, 'active', ?, ?)
           ON CONFLICT(base_id) DO UPDATE SET
             name = excluded.name, description = excluded.description,
             status = 'active', last_seen_run = excluded.last_seen_run`,
          [op.id, s(a.name), ns(a.description), runId, runId],
        );
        return;
      case "table":
        await exec.query(
          `INSERT INTO bo_at_tables (table_id, base_id, name, primary_field_id, field_count, record_count, description, status, first_seen_run, last_seen_run)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
           ON CONFLICT(table_id) DO UPDATE SET
             name = excluded.name, primary_field_id = excluded.primary_field_id,
             field_count = excluded.field_count, record_count = excluded.record_count,
             description = excluded.description, status = 'active',
             last_seen_run = excluded.last_seen_run`,
          [op.id, op.baseId, s(a.name), ns(a.primaryFieldId), ni(a.fieldCount), ni(a.recordCount), ns(a.description), runId, runId],
        );
        return;
      case "field":
        await exec.query(
          `INSERT INTO bo_at_fields (field_id, table_id, base_id, name, type, options, is_primary, description, status, first_seen_run, last_seen_run)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
           ON CONFLICT(field_id) DO UPDATE SET
             name = excluded.name, type = excluded.type, options = excluded.options,
             is_primary = excluded.is_primary, description = excluded.description,
             status = 'active', last_seen_run = excluded.last_seen_run`,
          [op.id, s(op.tableId), op.baseId, s(a.name), s(a.type), j(a.options), a.isPrimary === true ? 1 : 0, ns(a.description), runId, runId],
        );
        return;
      case "view":
        await exec.query(
          `INSERT INTO bo_at_views (view_id, table_id, base_id, name, type, status, first_seen_run, last_seen_run)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
           ON CONFLICT(view_id) DO UPDATE SET
             name = excluded.name, type = excluded.type, status = 'active',
             last_seen_run = excluded.last_seen_run`,
          [op.id, s(op.tableId), op.baseId, s(a.name), ns(a.type), runId, runId],
        );
        return;
    }
  }

  // removed | unknown — removed stamps first_unseen_run once; unknown never does
  // (reserved for confident removals — same rule as the pg writer).
  const table =
    op.entity === "base" ? "bo_at_bases"
    : op.entity === "table" ? "bo_at_tables"
    : op.entity === "field" ? "bo_at_fields"
    : "bo_at_views";
  const pk =
    op.entity === "base" ? "base_id"
    : op.entity === "table" ? "table_id"
    : op.entity === "field" ? "field_id"
    : "view_id";
  if (op.action === "removed") {
    await exec.query(
      `UPDATE ${table} SET status = 'removed', first_unseen_run = coalesce(first_unseen_run, ?) WHERE ${pk} = ?`,
      [runId, op.id],
    );
  } else {
    await exec.query(`UPDATE ${table} SET status = 'unknown' WHERE ${pk} = ?`, [op.id]);
  }
}

export async function applySchemaDiff(
  exec: SpaceD1Executor,
  args: { baseId: string; baseRunId: string; result: SchemaDiffResult; schemaJson: unknown },
): Promise<{ schemaVersionId: string | null }> {
  const { baseId, baseRunId, result, schemaJson } = args;

  if (result.schemaChanged) {
    await exec.query(
      `INSERT INTO bo_at_schema_versions (id, base_id, schema_hash, schema_json, first_seen_run)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(base_id, schema_hash) DO NOTHING`,
      [crypto.randomUUID(), baseId, result.schemaHash, JSON.stringify(schemaJson), baseRunId],
    );
  }
  const ver = rows(
    await exec.query(
      `SELECT id FROM bo_at_schema_versions WHERE base_id = ? AND schema_hash = ? LIMIT 1`,
      [baseId, result.schemaHash],
    ),
  );
  const schemaVersionId = ver[0] ? s(ver[0].id) : null;

  await exec.query(
    `UPDATE bo_at_base_runs SET schema_version_id = ?, schema_hash = ? WHERE id = ?`,
    [schemaVersionId, result.schemaHash, baseRunId],
  );

  for (const op of result.lifecycle) await applyLifecycleOp(exec, baseRunId, op);

  for (const u of result.schemaUpdates) {
    await exec.query(
      `INSERT INTO bo_at_schema_updates (id, run_id, entity_type, entity_id, base_id, table_id, change_type, change_type_name, before_value, after_value, breaks_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), baseRunId, u.entityType, u.entityId, u.baseId, u.tableId, u.changeType, u.changeTypeName ?? null, j(u.beforeValue), j(u.afterValue), u.breaksData ? 1 : 0],
    );
  }

  return { schemaVersionId };
}

// ───────────────────────── Browse read ─────────────────────────

/**
 * Read every captured schema entity across all bases — the Browse tree, same
 * payload shape as the pg reader (removedAt resolves first_unseen_run → that
 * base run's completed_at; field rows carry extractFieldConfig enrichment).
 */
export async function readAllEntities(exec: SpaceD1Executor): Promise<{
  bases: { baseId: string; name: string; description: string | null; aiDescription: string | null; descriptionOverride: string | null; status: string; removedAt: string | null }[];
  tables: { tableId: string; baseId: string; name: string; recordCount: number | null; fieldCount: number | null; description: string | null; aiDescription: string | null; descriptionOverride: string | null; status: string; removedAt: string | null }[];
  fields: ({ fieldId: string; tableId: string; baseId: string; name: string; type: string; isPrimary: boolean; description: string | null; aiDescription: string | null; descriptionOverride: string | null; status: string; removedAt: string | null } & FieldConfig)[];
  views: { viewId: string; tableId: string; baseId: string; name: string; type: string | null; status: string; removedAt: string | null }[];
}> {
  const removedJoin = `LEFT JOIN bo_at_base_runs rr ON rr.id = e.first_unseen_run`;

  const bases = rows(
    await exec.query(
      `SELECT e.base_id, e.name, e.description, e.ai_description, e.description_override, e.status, rr.completed_at AS removed_at
       FROM bo_at_bases e ${removedJoin}`,
    ),
  ).map((r) => ({
    baseId: s(r.base_id),
    name: s(r.name),
    description: ns(r.description),
    aiDescription: ns(r.ai_description),
    descriptionOverride: ns(r.description_override),
    status: s(r.status),
    removedAt: ns(r.removed_at),
  }));

  const tables = rows(
    await exec.query(
      `SELECT e.table_id, e.base_id, e.name, e.record_count, e.field_count, e.description, e.ai_description, e.description_override, e.status, rr.completed_at AS removed_at
       FROM bo_at_tables e ${removedJoin}`,
    ),
  ).map((r) => ({
    tableId: s(r.table_id),
    baseId: s(r.base_id),
    name: s(r.name),
    recordCount: ni(r.record_count),
    fieldCount: ni(r.field_count),
    description: ns(r.description),
    aiDescription: ns(r.ai_description),
    descriptionOverride: ns(r.description_override),
    status: s(r.status),
    removedAt: ns(r.removed_at),
  }));

  const fields = rows(
    await exec.query(
      `SELECT e.field_id, e.table_id, e.base_id, e.name, e.type, e.options, e.is_primary, e.description, e.ai_description, e.description_override, e.status, rr.completed_at AS removed_at
       FROM bo_at_fields e ${removedJoin}`,
    ),
  ).map((r) => ({
    fieldId: s(r.field_id),
    tableId: s(r.table_id),
    baseId: s(r.base_id),
    name: s(r.name),
    type: s(r.type),
    isPrimary: b(r.is_primary),
    description: ns(r.description),
    aiDescription: ns(r.ai_description),
    descriptionOverride: ns(r.description_override),
    status: s(r.status),
    removedAt: ns(r.removed_at),
    ...extractFieldConfig(s(r.type), parseJson(r.options)),
  }));

  const views = rows(
    await exec.query(
      `SELECT e.view_id, e.table_id, e.base_id, e.name, e.type, e.status, rr.completed_at AS removed_at
       FROM bo_at_views e ${removedJoin}`,
    ),
  ).map((r) => ({
    viewId: s(r.view_id),
    tableId: s(r.table_id),
    baseId: s(r.base_id),
    name: s(r.name),
    type: ns(r.type),
    status: s(r.status),
    removedAt: ns(r.removed_at),
  }));

  return { bases, tables, fields, views };
}

/** Latest per-base schema hash (feeds the read response's schemaHashByBase). */
export async function schemaHashesFor(
  exec: SpaceD1Executor,
  baseIds: string[],
): Promise<Record<string, string | null>> {
  const unique = [...new Set(baseIds)];
  const out: Record<string, string | null> = {};
  for (const id of unique) out[id] = null;
  if (unique.length === 0) return out;

  const placeholders = unique.map(() => "?").join(", ");
  const rr = rows(
    await exec.query(
      `SELECT base_id, schema_hash, started_at FROM bo_at_base_runs
       WHERE base_id IN (${placeholders}) AND schema_hash IS NOT NULL`,
      unique,
    ),
  );
  return {
    ...out,
    ...pickLatestSchemaHashByBase(
      rr.map((r) => ({
        baseId: s(r.base_id),
        hash: ns(r.schema_hash),
        startedAt: r.started_at ? new Date(s(r.started_at)) : null,
      })),
    ),
  };
}

// ───────────────────────── query views ─────────────────────────

/**
 * Regenerate the per-table live-pivot views (records-enabled Spaces only —
 * schema-only Spaces have nothing to project). Same contract as the pg
 * regenerateQueryViews: name planning spans ALL active tables, stale views
 * drop on every call, `tableIds` narrows the rebuild.
 */
export async function regenerateQueryViews(
  exec: SpaceD1Executor,
  args: { tableIds?: string[] },
): Promise<{ regenerated: number; dropped: number }> {
  const active = rows(
    await exec.query(`SELECT table_id, name FROM bo_at_tables WHERE status = 'active'`),
  ).map((r) => ({ tableId: s(r.table_id), name: s(r.name) }));

  const names = planViewNames(active);

  const existing = rows(
    await exec.query(`SELECT name FROM sqlite_master WHERE type = 'view' AND name NOT LIKE 'sqlite_%'`),
  ).map((r) => s(r.name));

  const dropStmts = dropStaleViewStatements(existing, new Set(names.values()));
  for (const stmt of dropStmts) await exec.query(stmt);

  const wanted = args.tableIds ? new Set(args.tableIds) : null;
  const targets = wanted ? active.filter((t) => wanted.has(t.tableId)) : active;

  for (const t of targets) {
    const fields = rows(
      await exec.query(
        `SELECT field_id, name, type FROM bo_at_fields WHERE table_id = ? AND status = 'active'`,
        [t.tableId],
      ),
    ).map((r) => ({ fieldId: s(r.field_id), name: s(r.name), type: s(r.type) }));
    for (const stmt of buildQueryViewStatements(names.get(t.tableId)!, t.tableId, fields)) {
      await exec.query(stmt);
    }
  }

  return { regenerated: targets.length, dropped: dropStmts.length };
}
