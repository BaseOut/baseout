/**
 * Map engine relationships payload → SchemaRelationship view model.
 * Shared by SchemaCanvas (Relationships mode) and SchemaRelationships tab.
 */
export type RelType =
  | 'linkedRecords'
  | 'formulas'
  | 'rollups'
  | 'lookups'
  | 'lastModified'
  | 'syncedViews'

export interface RelEndpoint {
  id: string
  name: string
  kind: 'table' | 'field'
  fieldType?: string
  tableName?: string
}

export interface RelLink {
  from: RelEndpoint
  to: RelEndpoint
  removed?: boolean
  firstSeen?: string
  removedAt?: string
  note?: string
}

export interface SchemaRelationship {
  id: string
  type: RelType
  baseId: string
  baseName: string
  a: RelEndpoint
  b: RelEndpoint
  cardinality?: string
  direction?: 'one' | 'two'
  inferred?: boolean
  validity: 'valid' | 'invalid'
  hasRemovedHistory?: boolean
  provenance?: string
  links?: RelLink[]
}

export type EngineRef = {
  tableId?: string
  fieldId?: string
  name: string
  removed: boolean
}

export type EngineDerived = {
  id: string
  type: 'linkedRecords' | 'formulas' | 'rollups' | 'lookups' | 'lastModified'
  label: string
  refs: EngineRef[]
  hasRemovedHistory: boolean
  valid: boolean
}

export type EngineSynced = {
  id: string
  sourceTableId: string
  sourceTableName: string
  destTableId: string
  destTableName: string
  status: string
  origin: string
  inferred: boolean
  matchScore: number | null
}

export function adaptEngineRelationships(
  baseId: string,
  baseName: string,
  payload: { derived: EngineDerived[]; syncedViews: EngineSynced[] },
): SchemaRelationship[] {
  const out: SchemaRelationship[] = []
  const ep = (r: EngineRef): RelEndpoint => ({
    id: r.tableId ?? r.fieldId ?? r.name,
    name: r.name,
    kind: r.tableId ? 'table' : 'field',
  })
  for (const d of payload.derived) {
    const [a, b] = d.refs
    if (!a || !b) continue
    out.push({
      id: d.id,
      type: d.type,
      baseId,
      baseName,
      a: ep(a),
      b: ep(b),
      validity: d.valid ? 'valid' : 'invalid',
      hasRemovedHistory: d.hasRemovedHistory,
    })
  }
  for (const s of payload.syncedViews) {
    // Dismissed synced views stay in the payload when includeDismissed=1;
    // tip UI treats inferred=false + status dismissed as history — map status.
    const dismissed = s.status === 'dismissed'
    out.push({
      id: s.id,
      type: 'syncedViews',
      baseId,
      baseName,
      a: { id: s.sourceTableId, name: s.sourceTableName, kind: 'table' },
      b: { id: s.destTableId, name: s.destTableName, kind: 'table' },
      inferred: s.inferred && !dismissed,
      validity: dismissed ? 'invalid' : 'valid',
      hasRemovedHistory: dismissed,
    })
  }
  return out
}
