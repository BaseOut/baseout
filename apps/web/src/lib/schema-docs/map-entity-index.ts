/**
 * map-entity-index — engine schema → EntityPanel SchemaEntity[] (Phase 13).
 *
 * Flattens the backup-engine getSchema payload into the nested canvas tables
 * buildEntityIndex expects, mapping:
 *   description        → airtableDescription (read mirror)
 *   descriptionOverride → userDescription (Internal note)
 *   aiDescription      → aiDescription
 *
 * No airtableDraft / Publish lifecycle — Airtable copy is read-only (7502f810).
 */
import type {
  SchemaDocSummary,
  SchemaEntityBase,
  SchemaEntityField,
  SchemaEntityTable,
  SchemaEntityView,
} from '../backup-engine'
import type { SchemaTable } from '../../components/islands/SchemaCanvas'
import {
  buildEntityIndex,
  type SchemaDoc,
  type SchemaEntity,
} from '../../components/schema/schemaEntities'
import { isRemoved } from './deleted-filter'

export interface EngineSchemaPayload {
  bases: SchemaEntityBase[]
  tables: SchemaEntityTable[]
  fields: SchemaEntityField[]
  views?: SchemaEntityView[]
}

function removedFlag(status: string, removedAt: string | null): { removed?: boolean; removedAt?: string } {
  if (!isRemoved(status) && !removedAt) return {}
  return {
    removed: true,
    ...(removedAt ? { removedAt } : {}),
  }
}

/** Nest flat engine fields/views under tables for buildEntityIndex. */
export function mapEngineToCanvasTables(schema: EngineSchemaPayload): SchemaTable[] {
  const fieldsByTable = new Map<string, SchemaEntityField[]>()
  for (const f of schema.fields) {
    const list = fieldsByTable.get(f.tableId) ?? []
    list.push(f)
    fieldsByTable.set(f.tableId, list)
  }
  const viewsByTable = new Map<string, SchemaEntityView[]>()
  for (const v of schema.views ?? []) {
    const list = viewsByTable.get(v.tableId) ?? []
    list.push(v)
    viewsByTable.set(v.tableId, list)
  }

  return schema.tables.map((t) => {
    const fields = (fieldsByTable.get(t.tableId) ?? []).map((f) => ({
      id: f.fieldId,
      name: f.name,
      type: f.type,
      isPrimary: f.isPrimary,
      linkedTableId: f.linkedTableId ?? undefined,
      allowsMultiple: f.allowsMultiple ?? undefined,
      inverseFieldId: f.inverseFieldId ?? undefined,
      formula: f.formula ?? undefined,
      referencedFieldIds: f.referencedFieldIds ?? undefined,
      lookupViaFieldId: f.lookupViaFieldId ?? undefined,
      lookupTargetFieldId: f.lookupTargetFieldId ?? undefined,
      options: f.choices ?? undefined,
      airtableDescription: f.description ?? undefined,
      userDescription: f.descriptionOverride ?? undefined,
      description: f.aiDescription ?? undefined,
      ...removedFlag(f.status, f.removedAt),
    }))
    const views = (viewsByTable.get(t.tableId) ?? []).map((v) => ({
      id: v.viewId,
      name: v.name,
      type: v.type ?? undefined,
      ...removedFlag(v.status, v.removedAt),
    }))
    return {
      id: t.tableId,
      name: t.name,
      baseId: t.baseId,
      fieldCount: t.fieldCount ?? fields.filter((f) => !f.removed).length,
      recordCount: t.recordCount ?? undefined,
      airtableDescription: t.description ?? undefined,
      userDescription: t.descriptionOverride ?? undefined,
      description: t.aiDescription ?? undefined,
      fields,
      views,
      ...removedFlag(t.status, t.removedAt),
    }
  })
}

/** Map listDocuments summaries into the panel SchemaDoc title list (entityIds filled later). */
export function mapDocSummariesToSchemaDocs(docs: SchemaDocSummary[]): SchemaDoc[] {
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    excerpt: d.excerpt ?? '',
    updatedAt: d.updatedAt ?? '',
    body: [],
    entityIds: [],
    links: [],
    diagrams: [],
  }))
}

/** Full index for EntityPanel / Reports. */
export function mapEngineToEntityIndex(
  schema: EngineSchemaPayload,
  docs: SchemaDocSummary[] = [],
): SchemaEntity[] {
  const bases = schema.bases.map((b) => ({ id: b.baseId, name: b.name }))
  const tables = mapEngineToCanvasTables(schema)
  // Attach base-level descriptions onto the base entity after buildEntityIndex
  // by merging — buildEntityIndex only sees {id,name} for bases.
  const index = buildEntityIndex(bases, tables, mapDocSummariesToSchemaDocs(docs))
  const baseMeta = new Map(
    schema.bases.map((b) => [
      b.baseId,
      {
        airtableDescription: b.description ?? undefined,
        userDescription: b.descriptionOverride ?? undefined,
        aiDescription: b.aiDescription ?? undefined,
        ...removedFlag(b.status, b.removedAt),
      },
    ]),
  )
  return index.map((e) => {
    if (e.kind !== 'base') return e
    const meta = baseMeta.get(e.id)
    if (!meta) return e
    return {
      ...e,
      ...meta,
      hasDescription: Boolean(
        meta.airtableDescription || meta.userDescription || meta.aiDescription || e.hasDescription,
      ),
    }
  })
}
