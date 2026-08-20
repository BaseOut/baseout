/**
 * schemaEntities — the shared entity model behind Browse, the stacking detail
 * panel, the entity typeahead, and Docs tagging. One flat index of every
 * base / table / field in the Space, derived from the same schema the engine
 * captures at backup time (so it stays inside the Airtable metadata boundary:
 * names / types / descriptions / link targets are real; record counts are
 * "as of last backup"; there are no value statistics or workspace grouping).
 *
 * Build it once with buildEntityIndex(); everything downstream reads SchemaEntity.
 */
// Promotion retarget (2026-07-29): the fork keeps SchemaCanvas beside this
// file; our canvas lives in components/islands (React island split).
import type { SchemaTable } from '../islands/SchemaCanvas';

export type EntityKind = 'space' | 'base' | 'table' | 'field' | 'view';
export type Health = 'green' | 'amber' | 'red';

export interface SchemaEntity {
  /** Stable id (base id / table id / field id) — the identity used everywhere. */
  id: string;
  kind: EntityKind;
  name: string;
  /** Owning base (self for a base). */
  baseId: string;
  baseName: string;
  /** Owning table (fields only). */
  tableId?: string;
  tableName?: string;
  /** Airtable field type (fields only) — drives the vendored field icon. */
  fieldType?: string;
  // ── Views (view-schema-details) ───────────────────────────────────────────────────────
  /** Airtable view type (views only): grid / form / calendar / gallery / kanban / timeline /
   *  block (= Gantt). The enum is OPEN — an unrecognised string is rendered verbatim. */
  viewType?: string;
  /** Views only: set when the view is PERSONAL (visible to this collaborator alone). */
  personalForUserId?: string;
  /** Views only: the fields the view shows. Airtable returns this for GRID views ONLY, so its
   *  absence on a form/kanban/calendar view means "no API for it", never "shows no fields".
   *  There is deliberately NO filters/sorts/grouping here — Airtable exposes none of it. */
  visibleFieldIds?: string[];
  /** Views only: the capture could not resolve the owning table (founder Q7 open). Such a view
   *  carries NO tableId — it hangs off the base — and Browse gives it its own bucket instead of
   *  dropping it. Distinct from `unknown`, which is about the view itself, not our read of it. */
  tableUnresolved?: boolean;
  isPrimary?: boolean;
  health: Health;
  /** "As of last backup" — never a live count. base = Σ tables; table = own. */
  recordCount?: number;
  fieldCount?: number;
  // Descriptions (the Browse annotation block) — all optional, all real.
  /** READ MIRROR of Airtable's own description, as of the last backup. Baseout never writes it. */
  airtableDescription?: string;
  aiDescription?: string;
  /** AI-generated *technical* internal draft (more verbose than aiDescription) — seeds the
   *  Internal tab's Generate action. */
  aiTechnicalDescription?: string;
  userDescription?: string;
  hasDescription: boolean;
  /** Deleted in Airtable, kept for history; default-hidden in Browse (deleted-items-filter). */
  removed?: boolean;
  /** ISO date it went missing from Airtable (the "no longer in Airtable since…" caption). */
  removedAt?: string;
  /** Unconfirmed this run (NOT deleted; stays visible). */
  unknown?: boolean;
  // Relationships (real, from linked-record metadata).
  linkedTableId?: string;
  linkedTableName?: string;
  /** Computed fields (lookup/rollup/count): the source field they derive from. */
  derivedFrom?: string;
  // A4 — field-type configuration (resolved against the index at render time).
  formula?: string;
  referencedFieldIds?: string[];
  lookupViaFieldId?: string;
  lookupTargetFieldId?: string;
  // A6 — linked-record cardinality + symmetric backlink field id.
  allowsMultiple?: boolean;
  inverseFieldId?: string;
  // Structure.
  parentId?: string;
  /** Navigable children: base → tables, table → fields. (Field options are not entities.) */
  childIds: string[];
  /** Select choices (fields) — shown, not navigable. */
  options?: string[];
  /** Docs (from the Docs tab) that tag this entity — the reverse side of tagging. */
  docIds: string[];
}

export interface SchemaDocLink {
  label: string;
  url: string;
}
export interface SchemaDocDiagram {
  id: string;
  name: string;
  /** The tables this scoped mini-diagram includes. */
  tableIds: string[];
}
/** A doc body is a small block model so the editor shell and reading view share one render.
 *  `{ record }` is a DATA-page token (record tagging, Dan 2026-07-15 B4) — Schema docs never emit it. */
export type DocInline = string | { entity: string } | { record: string };
export interface DocBlock {
  type: 'h2' | 'p' | 'ul' | 'diagram';
  content?: DocInline[];
  items?: DocInline[][];
  diagramId?: string;
}
export interface SchemaDoc {
  id: string;
  title: string;
  excerpt: string;
  /** ISO timestamp of last edit. */
  updatedAt: string;
  author?: string;
  body: DocBlock[];
  /** Tagged entity ids (the explicit association list). */
  entityIds: string[];
  /** Tagged RECORD ids (Data docs only — B4 record tagging; drives the rail's Records group
   *  and the record drawer's "Referenced in" reverse links). */
  recordIds?: string[];
  links: SchemaDocLink[];
  diagrams: SchemaDocDiagram[];
}

const HEALTH_RANK: Record<Health, number> = { green: 0, amber: 1, red: 2 };
const worst = (a: Health, b: Health): Health => (HEALTH_RANK[a] >= HEALTH_RANK[b] ? a : b);

/** Derive a field's health honestly: broken link = red, undocumented = amber, else green. */
function fieldHealth(field: { linkedTableId?: string; hasDescription: boolean }, tableIds: Set<string>): Health {
  if (field.linkedTableId && !tableIds.has(field.linkedTableId)) return 'red';
  return field.hasDescription ? 'green' : 'amber';
}

/**
 * Flatten bases + tables into one entity index, computing health, descriptions,
 * relationships, children, and (optionally) the docs that reference each entity.
 */
export function buildEntityIndex(
  bases: { id: string; name: string }[],
  tables: SchemaTable[],
  docs: SchemaDoc[] = [],
): SchemaEntity[] {
  const tableIds = new Set(tables.map((t) => t.id));
  const tableName = (id?: string) => tables.find((t) => t.id === id)?.name;
  const baseName = (id?: string) => bases.find((b) => b.id === id)?.name ?? 'Base';

  // Which docs tag which entity (reverse index).
  const docsFor = (entityId: string) => docs.filter((d) => d.entityIds.includes(entityId)).map((d) => d.id);

  const entities: SchemaEntity[] = [];

  // Fields + tables, grouped by base.
  const tablesByBase = new Map<string, SchemaTable[]>();
  for (const t of tables) {
    const bid = t.baseId ?? bases[0]?.id ?? 'base';
    if (!tablesByBase.has(bid)) tablesByBase.set(bid, []);
    tablesByBase.get(bid)!.push(t);
  }

  for (const base of bases) {
    const baseTables = tablesByBase.get(base.id) ?? [];
    let baseHealth: Health = 'green';
    let baseRecords = 0;

    for (const t of baseTables) {
      const ai = t.description;
      const tableHas = Boolean(ai || t.airtableDescription || t.userDescription);
      // Removed (deleted) tables are history — they don't count toward the active base rollups.
      if (!t.removed) {
        baseHealth = worst(baseHealth, t.health ?? 'green');
        if (typeof t.recordCount === 'number') baseRecords += t.recordCount;
      }

      // Field entities.
      for (const f of t.fields) {
        const fAi = f.description;
        const fHas = Boolean(fAi || f.airtableDescription || f.userDescription);
        const fh = fieldHealth({ linkedTableId: f.linkedTableId, hasDescription: fHas }, tableIds);
        entities.push({
          id: f.id,
          kind: 'field',
          name: f.name,
          baseId: base.id,
          baseName: base.name,
          tableId: t.id,
          tableName: t.name,
          fieldType: f.type,
          isPrimary: f.isPrimary,
          health: fh,
          airtableDescription: f.airtableDescription,
          aiDescription: fAi,
          aiTechnicalDescription: f.technicalDescription,
          userDescription: f.userDescription,
          removed: f.removed || t.removed,
          removedAt: f.removedAt ?? (t.removed ? t.removedAt : undefined),
          unknown: f.unknown,
          hasDescription: fHas,
          linkedTableId: f.linkedTableId,
          linkedTableName: tableName(f.linkedTableId),
          derivedFrom: f.derivedFrom,
          formula: f.formula,
          referencedFieldIds: f.referencedFieldIds,
          lookupViaFieldId: f.lookupViaFieldId,
          lookupTargetFieldId: f.lookupTargetFieldId,
          allowsMultiple: f.allowsMultiple,
          inverseFieldId: f.inverseFieldId,
          parentId: t.id,
          childIds: [],
          options: f.options,
          docIds: docsFor(f.id),
        });
      }

      // View entities (view-schema-details). A view is a LENS over the table, not a member of
      // it, so: parentId = the table (it nests under it in Browse), but it is NOT in the table's
      // childIds — those are the fields, and mixing the two would put views in the panel's
      // "Fields" list. Health is always 'green' and views are EXCLUDED from the base health
      // rollup above: we capture a view's identity, not anything we could score it on, so an
      // amber view would be an invented judgement.
      // The "N of M" denominator: M is the table's LIVE field count, which EXCLUDES fields deleted
      // in Airtable — the same number the table's own panel shows. Deriving it here (rather than
      // trusting a per-view figure) is what stops a view panel claiming 12 while its table claims 11.
      const liveFieldCount = t.fieldCount ?? t.fields.filter((f) => !f.removed).length;
      for (const v of t.views ?? []) {
        entities.push({
          id: v.id,
          kind: 'view',
          name: v.name,
          baseId: base.id,
          baseName: base.name,
          // Q7 open: when the capture didn't say which table a view belongs to, we must not
          // invent one. No tableId ⇒ Browse renders it in the base's "table unresolved" bucket.
          tableId: v.tableUnresolved ? undefined : t.id,
          tableName: v.tableUnresolved ? undefined : t.name,
          tableUnresolved: v.tableUnresolved,
          viewType: v.type,
          personalForUserId: v.personalForUserId,
          visibleFieldIds: v.visibleFieldIds,
          // Prefer the table we actually hold: a captured per-view figure that disagrees with the
          // table's own live count is exactly the defect this replaces. The captured number is the
          // fallback only when there are no fields to count (a schema-shallow capture).
          fieldCount: t.fields.length ? liveFieldCount : v.fieldCount,
          health: 'green',
          // A view under a removed table is itself gone, exactly as a field is.
          removed: v.removed || t.removed,
          removedAt: v.removedAt ?? (t.removed ? t.removedAt : undefined),
          unknown: v.unknown,
          hasDescription: false,
          parentId: t.id,
          childIds: [],
          docIds: docsFor(v.id),
        });
      }

      // Table entity.
      entities.push({
        id: t.id,
        kind: 'table',
        name: t.name,
        baseId: base.id,
        baseName: base.name,
        tableName: t.name,
        health: t.health ?? 'green',
        recordCount: t.recordCount,
        // Same live count the views' "N of M" denominator uses — the two can never disagree.
        fieldCount: liveFieldCount,
        airtableDescription: t.airtableDescription,
        aiDescription: ai,
        aiTechnicalDescription: t.technicalDescription,
        userDescription: t.userDescription,
        removed: t.removed,
        removedAt: t.removedAt,
        unknown: t.unknown,
        hasDescription: tableHas,
        parentId: base.id,
        childIds: t.fields.map((f) => f.id),
        docIds: docsFor(t.id),
      });
    }

    // Base entity.
    entities.push({
      id: base.id,
      kind: 'base',
      name: base.name,
      baseId: base.id,
      baseName: base.name,
      health: baseHealth,
      recordCount: baseRecords || undefined,
      fieldCount: baseTables.reduce((n, t) => n + (t.removed ? 0 : (t.fieldCount ?? t.fields.length)), 0),
      hasDescription: false,
      childIds: baseTables.map((t) => t.id),
      docIds: docsFor(base.id),
    });
  }

  return entities;
}

/** Tables that link out from / into a given table — the "Relationships" panel section. */
export function tableRelationships(
  table: SchemaEntity,
  index: SchemaEntity[],
): { outgoing: { fieldId: string; fieldName: string; tableId: string; tableName: string }[]; incoming: { tableId: string; tableName: string; fieldName: string }[] } {
  const fields = index.filter((e) => e.kind === 'field' && e.tableId === table.id);
  const outgoing = fields
    .filter((f) => f.linkedTableId)
    .map((f) => ({ fieldId: f.id, fieldName: f.name, tableId: f.linkedTableId!, tableName: f.linkedTableName ?? 'Table' }));
  const incoming = index
    .filter((e) => e.kind === 'field' && e.linkedTableId === table.id)
    .map((f) => ({ tableId: f.tableId!, tableName: f.tableName ?? 'Table', fieldName: f.name }));
  return { outgoing, incoming };
}

/**
 * Human label for an Airtable VIEW type (view-schema-details).
 *
 * `block` is Airtable's wire name for a GANTT view — showing "Block" would be a word no
 * Airtable user recognises. The enum is treated as OPEN: Airtable ships new view types, so an
 * unrecognised string is returned VERBATIM rather than coerced to a known type or dropped.
 * Callers render the result in a neutral chip either way.
 */
const VIEW_TYPE_LABEL: Record<string, string> = {
  grid: 'Grid', form: 'Form', calendar: 'Calendar', gallery: 'Gallery',
  kanban: 'Kanban', timeline: 'Timeline', block: 'Gantt',
};
export function viewTypeLabel(type?: string): string {
  if (!type) return 'View';
  return VIEW_TYPE_LABEL[type] ?? type;
}

/** Human label for an Airtable field type (e.g. single_select → "Single select"). */
export function fieldTypeLabel(type?: string): string {
  if (!type) return '';
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bId\b/, 'ID');
}
