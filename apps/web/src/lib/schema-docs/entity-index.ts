// Entity panel index (web-schema-round3-shell §3): shapes the enriched schema
// payload (server-schema-read-enrichment) into per-entity panel data — identity
// with resolved location names, description variants, field configuration with
// names, and the REVERSE graph ("Referenced by", grouped by kind) derived by
// inverting the forward config. Pure; serialized into the Browse tab as JSON and
// rendered client-side by the detail-panel script.

import type {
  SchemaEntityBase,
  SchemaEntityField,
  SchemaEntityTable,
  SchemaEntityView,
} from '../backup-engine'

export interface RefRow {
  fieldId: string
  fieldName: string
  tableName: string
}

export interface ReferencedBy {
  formulas: RefRow[]
  rollups: RefRow[]
  lookups: RefRow[]
  links: RefRow[]
}

export interface EntityPanelInfo {
  id: string
  kind: 'base' | 'table' | 'field' | 'view'
  name: string
  baseName: string
  tableName?: string
  fieldType?: string
  isPrimary?: boolean
  recordCount?: number | null
  fieldCount?: number | null
  removedAt: string | null
  status: string
  airtableDescription: string | null
  aiDescription: string | null
  internalDescription: string | null
  formula?: string | null
  choices?: string[] | null
  linksTo?: {
    tableId: string
    tableName: string
    allowsMultiple: boolean | null
    inverseFieldName?: string
  }
  lookupVia?: { fieldId: string; fieldName: string }
  lookupTarget?: { fieldId: string; fieldName: string; tableName?: string }
  referencedBy: ReferencedBy
}

export interface PanelSchema {
  bases: SchemaEntityBase[]
  tables: SchemaEntityTable[]
  fields: SchemaEntityField[]
  views: SchemaEntityView[]
}

const emptyRefs = (): ReferencedBy => ({ formulas: [], rollups: [], lookups: [], links: [] })

export function buildEntityPanelIndex(schema: PanelSchema): Record<string, EntityPanelInfo> {
  const baseName = new Map(schema.bases.map((b) => [b.baseId, b.name]))
  const tableById = new Map(schema.tables.map((t) => [t.tableId, t]))
  const fieldById = new Map(schema.fields.map((f) => [f.fieldId, f]))
  const tableNameOf = (f: SchemaEntityField) => tableById.get(f.tableId)?.name ?? f.tableId

  const index: Record<string, EntityPanelInfo> = {}

  for (const b of schema.bases) {
    index[b.baseId] = {
      id: b.baseId,
      kind: 'base',
      name: b.name,
      baseName: b.name,
      removedAt: b.removedAt,
      status: b.status,
      airtableDescription: b.description,
      aiDescription: b.aiDescription,
      internalDescription: b.descriptionOverride,
      referencedBy: emptyRefs(),
    }
  }

  for (const t of schema.tables) {
    index[t.tableId] = {
      id: t.tableId,
      kind: 'table',
      name: t.name,
      baseName: baseName.get(t.baseId) ?? t.baseId,
      recordCount: t.recordCount,
      fieldCount: t.fieldCount,
      removedAt: t.removedAt,
      status: t.status,
      airtableDescription: t.description,
      aiDescription: t.aiDescription,
      internalDescription: t.descriptionOverride,
      referencedBy: emptyRefs(),
    }
  }

  for (const f of schema.fields) {
    const info: EntityPanelInfo = {
      id: f.fieldId,
      kind: 'field',
      name: f.name,
      baseName: baseName.get(f.baseId) ?? f.baseId,
      tableName: tableNameOf(f),
      fieldType: f.type,
      isPrimary: f.isPrimary,
      removedAt: f.removedAt,
      status: f.status,
      airtableDescription: f.description,
      aiDescription: f.aiDescription,
      internalDescription: f.descriptionOverride,
      formula: f.formula,
      choices: f.choices,
      referencedBy: emptyRefs(),
    }
    if (f.linkedTableId) {
      const linked = tableById.get(f.linkedTableId)
      const inverse = f.inverseFieldId ? fieldById.get(f.inverseFieldId) : undefined
      info.linksTo = {
        tableId: f.linkedTableId,
        tableName: linked?.name ?? f.linkedTableId,
        allowsMultiple: f.allowsMultiple,
        ...(inverse ? { inverseFieldName: inverse.name } : {}),
      }
    }
    if (f.lookupViaFieldId) {
      const via = fieldById.get(f.lookupViaFieldId)
      info.lookupVia = { fieldId: f.lookupViaFieldId, fieldName: via?.name ?? f.lookupViaFieldId }
    }
    if (f.lookupTargetFieldId) {
      const target = fieldById.get(f.lookupTargetFieldId)
      info.lookupTarget = {
        fieldId: f.lookupTargetFieldId,
        fieldName: target?.name ?? f.lookupTargetFieldId,
        ...(target ? { tableName: tableNameOf(target) } : {}),
      }
    }
    index[f.fieldId] = info
  }

  for (const v of schema.views) {
    index[v.viewId] = {
      id: v.viewId,
      kind: 'view',
      name: v.name,
      baseName: baseName.get(v.baseId) ?? v.baseId,
      tableName: tableById.get(v.tableId)?.name ?? v.tableId,
      fieldType: v.type ?? undefined,
      removedAt: v.removedAt,
      status: v.status,
      airtableDescription: null,
      aiDescription: null,
      internalDescription: null,
      referencedBy: emptyRefs(),
    }
  }

  // Reverse graph: walk every field's forward config once and append to the
  // referenced entity's grouped rows.
  const rowFor = (f: SchemaEntityField): RefRow => ({
    fieldId: f.fieldId,
    fieldName: f.name,
    tableName: tableNameOf(f),
  })
  const push = (targetId: string | null, group: keyof ReferencedBy, f: SchemaEntityField) => {
    if (!targetId) return
    const target = index[targetId]
    if (!target || target.id === f.fieldId) return
    target.referencedBy[group].push(rowFor(f))
  }

  for (const f of schema.fields) {
    for (const refId of f.referencedFieldIds ?? []) push(refId, 'formulas', f)
    const anchorGroup: keyof ReferencedBy = f.type === 'rollup' ? 'rollups' : 'lookups'
    push(f.lookupViaFieldId, anchorGroup, f)
    push(f.lookupTargetFieldId, anchorGroup, f)
    // The linked TABLE is "linked from" this field; the symmetric inverse FIELD
    // shows the pair under Links.
    push(f.linkedTableId, 'links', f)
    push(f.inverseFieldId, 'links', f)
  }

  return index
}
