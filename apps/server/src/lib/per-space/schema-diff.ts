// Per-Space schema capture diff — PURE (no I/O), unit-tested.
//
// Given the schema captured from Airtable for ONE base + the current working set
// in the per-Space DB (bo_at_bases/tables/fields/views), compute:
//   - a stable schema hash (drives bo_at_schema_versions dedup),
//   - lifecycle ops (insert / seen / removed / unknown) for each entity,
//   - schema_updates ops for MODIFICATIONS (add/remove are lifecycle, not here).
//
// Lifecycle rules (openspec/changes/system-per-space-db, spec "Schema capture
// with lifecycle"): an entity is marked `removed` ONLY when its parent was fully
// + successfully enumerated (confident); a partial/failed capture leaves absent
// entities `unknown` — never false-delete. Reappearance flips back to active.
//
// The engine (Option B — engine-brokered writes) calls this from /schema-sync,
// then applies the ops to the per-Space DB. Field-type changes carry
// breaks_data = true (may invalidate existing cell values).

export type EntityType = "base" | "table" | "field" | "view";

// ---- Captured (normalized from Airtable getBaseSchema), one base ----

export interface CapturedField {
  fieldId: string;
  name: string;
  type: string;
  options?: unknown;
  isPrimary?: boolean;
  description?: string | null;
}
export interface CapturedView {
  viewId: string;
  name: string;
  type?: string | null;
}
export interface CapturedTable {
  tableId: string;
  name: string;
  primaryFieldId?: string | null;
  fieldCount?: number | null;
  recordCount?: number | null;
  description?: string | null;
  fields: CapturedField[];
  views: CapturedView[];
}
export interface CapturedBase {
  baseId: string;
  name: string;
  description?: string | null;
  tables: CapturedTable[];
}

// ---- Prior working set (rows already in the per-Space DB for this base) ----

export interface PriorBase {
  baseId: string;
  name: string;
  description: string | null;
  status: string;
}
export interface PriorTable {
  tableId: string;
  name: string;
  primaryFieldId: string | null;
  description: string | null;
  status: string;
}
export interface PriorField {
  fieldId: string;
  tableId: string;
  name: string;
  type: string;
  options: unknown;
  isPrimary: boolean;
  description: string | null;
  status: string;
}
export interface PriorView {
  viewId: string;
  tableId: string;
  name: string;
  type: string | null;
  status: string;
}
export interface PriorWorkingSet {
  base: PriorBase | null;
  tables: PriorTable[];
  fields: PriorField[];
  views: PriorView[];
}

// ---- Output ops ----

export type LifecycleAction = "insert" | "seen" | "removed" | "unknown";

export interface LifecycleOp {
  entity: EntityType;
  id: string;
  action: LifecycleAction;
  baseId: string;
  /** Parent table for field/view; null for base/table. */
  tableId: string | null;
  /**
   * Writable attribute columns for insert/seen (name, type, options, …). Empty
   * for removed/unknown. The writer upserts these + stamps run columns.
   */
  attrs: Record<string, unknown>;
}

export interface SchemaUpdateOp {
  entityType: EntityType;
  entityId: string;
  baseId: string;
  tableId: string | null;
  changeType: string; // 'name' | 'description' | 'type' | 'options' | 'primary_field'
  changeTypeName: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  breaksData: boolean;
}

export interface SchemaDiffResult {
  schemaHash: string;
  /** True when schemaHash differs from priorSchemaHash (→ new bo_at_schema_versions row). */
  schemaChanged: boolean;
  lifecycle: LifecycleOp[];
  schemaUpdates: SchemaUpdateOp[];
}

// ---- Stable hash (change-detector; the full JSON is stored alongside) ----

function canonicalize(base: CapturedBase): string {
  const sortById = <T>(arr: T[], key: keyof T): T[] =>
    [...arr].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
  const norm = {
    baseId: base.baseId,
    name: base.name,
    description: base.description ?? null,
    tables: sortById(base.tables, "tableId").map((t) => ({
      tableId: t.tableId,
      name: t.name,
      primaryFieldId: t.primaryFieldId ?? null,
      description: t.description ?? null,
      fields: sortById(t.fields, "fieldId").map((f) => ({
        fieldId: f.fieldId,
        name: f.name,
        type: f.type,
        options: f.options ?? null,
        isPrimary: f.isPrimary ?? false,
        description: f.description ?? null,
      })),
      views: sortById(t.views, "viewId").map((v) => ({
        viewId: v.viewId,
        name: v.name,
        type: v.type ?? null,
      })),
    })),
  };
  return JSON.stringify(norm);
}

/** FNV-1a 64-bit over the canonical serialization, hex. Pure + deterministic. */
export function hashSchema(base: CapturedBase): string {
  const str = canonicalize(base);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

const jsonEq = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function diffSchema(args: {
  captured: CapturedBase;
  prior: PriorWorkingSet;
  runId: string;
  /** Was the schema fully + successfully enumerated? If false, absent ⇒ unknown. */
  confident: boolean;
  priorSchemaHash?: string | null;
}): SchemaDiffResult {
  const { captured, prior, confident, priorSchemaHash } = args;
  const lifecycle: LifecycleOp[] = [];
  const schemaUpdates: SchemaUpdateOp[] = [];

  const schemaHash = hashSchema(captured);
  const schemaChanged = (priorSchemaHash ?? null) !== schemaHash;

  const baseId = captured.baseId;

  const addUpdate = (
    entityType: EntityType,
    entityId: string,
    tableId: string | null,
    changeType: string,
    before: unknown,
    after: unknown,
    breaksData = false,
  ) => {
    schemaUpdates.push({
      entityType,
      entityId,
      baseId,
      tableId,
      changeType,
      changeTypeName: null,
      beforeValue: before ?? null,
      afterValue: after ?? null,
      breaksData,
    });
  };

  const absent = (action: LifecycleAction, entity: EntityType, id: string, tableId: string | null) =>
    lifecycle.push({ entity, id, action, baseId, tableId, attrs: {} });
  const absentAction: LifecycleAction = confident ? "removed" : "unknown";

  // ---- Base (always present in a capture; never removed via this path) ----
  if (!prior.base) {
    lifecycle.push({
      entity: "base",
      id: baseId,
      action: "insert",
      baseId,
      tableId: null,
      attrs: { name: captured.name, description: captured.description ?? null },
    });
  } else {
    lifecycle.push({
      entity: "base",
      id: baseId,
      action: "seen",
      baseId,
      tableId: null,
      attrs: { name: captured.name, description: captured.description ?? null },
    });
    if (prior.base.name !== captured.name)
      addUpdate("base", baseId, null, "name", prior.base.name, captured.name);
    if ((prior.base.description ?? null) !== (captured.description ?? null))
      addUpdate("base", baseId, null, "description", prior.base.description, captured.description ?? null);
  }

  // ---- Tables ----
  const capTables = new Map(captured.tables.map((t) => [t.tableId, t]));
  const priorTables = new Map(prior.tables.map((t) => [t.tableId, t]));
  for (const t of captured.tables) {
    const p = priorTables.get(t.tableId);
    const attrs = {
      name: t.name,
      primaryFieldId: t.primaryFieldId ?? null,
      fieldCount: t.fieldCount ?? t.fields.length,
      recordCount: t.recordCount ?? null,
      description: t.description ?? null,
    };
    if (!p) {
      lifecycle.push({ entity: "table", id: t.tableId, action: "insert", baseId, tableId: null, attrs });
    } else {
      lifecycle.push({ entity: "table", id: t.tableId, action: "seen", baseId, tableId: null, attrs });
      if (p.name !== t.name) addUpdate("table", t.tableId, t.tableId, "name", p.name, t.name);
      if ((p.description ?? null) !== (t.description ?? null))
        addUpdate("table", t.tableId, t.tableId, "description", p.description, t.description ?? null);
      if ((p.primaryFieldId ?? null) !== (t.primaryFieldId ?? null))
        addUpdate("table", t.tableId, t.tableId, "primary_field", p.primaryFieldId, t.primaryFieldId ?? null);
    }
  }
  for (const p of prior.tables) {
    if (!capTables.has(p.tableId) && p.status !== "removed") {
      absent(absentAction, "table", p.tableId, null);
    }
  }

  // ---- Fields (compared across the whole base; absence covers table removal) ----
  const capFields = new Map<string, { f: CapturedField; tableId: string }>();
  for (const t of captured.tables) for (const f of t.fields) capFields.set(f.fieldId, { f, tableId: t.tableId });
  const priorFields = new Map(prior.fields.map((f) => [f.fieldId, f]));
  for (const [fieldId, { f, tableId }] of capFields) {
    const p = priorFields.get(fieldId);
    const attrs = {
      tableId,
      name: f.name,
      type: f.type,
      options: f.options ?? null,
      isPrimary: f.isPrimary ?? false,
      description: f.description ?? null,
    };
    if (!p) {
      lifecycle.push({ entity: "field", id: fieldId, action: "insert", baseId, tableId, attrs });
    } else {
      lifecycle.push({ entity: "field", id: fieldId, action: "seen", baseId, tableId, attrs });
      if (p.name !== f.name) addUpdate("field", fieldId, tableId, "name", p.name, f.name);
      if (p.type !== f.type) addUpdate("field", fieldId, tableId, "type", p.type, f.type, /* breaksData */ true);
      if (!jsonEq(p.options, f.options ?? null))
        addUpdate("field", fieldId, tableId, "options", p.options ?? null, f.options ?? null);
      if ((p.description ?? null) !== (f.description ?? null))
        addUpdate("field", fieldId, tableId, "description", p.description, f.description ?? null);
    }
  }
  for (const p of prior.fields) {
    if (!capFields.has(p.fieldId) && p.status !== "removed") {
      absent(absentAction, "field", p.fieldId, p.tableId);
    }
  }

  // ---- Views ----
  const capViews = new Map<string, { v: CapturedView; tableId: string }>();
  for (const t of captured.tables) for (const v of t.views) capViews.set(v.viewId, { v, tableId: t.tableId });
  const priorViews = new Map(prior.views.map((v) => [v.viewId, v]));
  for (const [viewId, { v, tableId }] of capViews) {
    const p = priorViews.get(viewId);
    const attrs = { tableId, name: v.name, type: v.type ?? null };
    if (!p) {
      lifecycle.push({ entity: "view", id: viewId, action: "insert", baseId, tableId, attrs });
    } else {
      lifecycle.push({ entity: "view", id: viewId, action: "seen", baseId, tableId, attrs });
      if (p.name !== v.name) addUpdate("view", viewId, tableId, "name", p.name, v.name);
      if ((p.type ?? null) !== (v.type ?? null))
        addUpdate("view", viewId, tableId, "type", p.type, v.type ?? null);
    }
  }
  for (const p of prior.views) {
    if (!capViews.has(p.viewId) && p.status !== "removed") {
      absent(absentAction, "view", p.viewId, p.tableId);
    }
  }

  return { schemaHash, schemaChanged, lifecycle, schemaUpdates };
}
