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
import type { SchemaTable } from './SchemaCanvas';

export type EntityKind = 'base' | 'table' | 'field';
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
  isPrimary?: boolean;
  health: Health;
  /** "As of last backup" — never a live count. base = Σ tables; table = own. */
  recordCount?: number;
  fieldCount?: number;
  // Descriptions (the Browse annotation block) — all optional, all real.
  airtableDescription?: string;
  /** Edited-but-unpublished Airtable description (≠ airtableDescription ⇒ out of sync). */
  airtableDraft?: string;
  /** Airtable's live description changed since the last backup (drives stale warning). */
  airtableExternallyChanged?: boolean;
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
/** A doc body is a small block model so the editor shell and reading view share one render. */
export type DocInline = string | { entity: string };
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
        baseHealth = worst(baseHealth, t.health);
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
          airtableDraft: f.airtableDraft,
          airtableExternallyChanged: f.airtableExternallyChanged,
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

      // Table entity.
      entities.push({
        id: t.id,
        kind: 'table',
        name: t.name,
        baseId: base.id,
        baseName: base.name,
        tableName: t.name,
        health: t.health,
        recordCount: t.recordCount,
        fieldCount: t.fieldCount ?? t.fields.length,
        airtableDescription: t.airtableDescription,
        airtableDraft: t.airtableDraft,
        airtableExternallyChanged: t.airtableExternallyChanged,
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

/** Human label for an Airtable field type (e.g. single_select → "Single select"). */
export function fieldTypeLabel(type?: string): string {
  if (!type) return '';
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bId\b/, 'ID');
}
