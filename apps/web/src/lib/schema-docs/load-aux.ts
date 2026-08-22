/**
 * Schema aux tabs — per-base engine fan-out. Must not run on first paint.
 */
import type {
  GetHealthOverviewResult,
  GetRelationshipsResult,
  GetSchemaChangelogResult,
} from '../backup-engine'
import { adaptEngineRelationships, type SchemaRelationship } from './adapt-relationships'
import { adaptChangelogEntries, type TipChangelogEntry } from './adapt-changelog'
import { adaptHealthOverview, type TipBaseHealth } from './adapt-health'

export interface SchemaAuxEngine {
  getRelationships(
    spaceId: string,
    baseId: string,
    includeDismissed?: boolean,
  ): Promise<GetRelationshipsResult>
  getSchemaChangelog(
    spaceId: string,
    baseId: string,
    limit?: number,
  ): Promise<GetSchemaChangelogResult>
  getHealthOverview(spaceId: string, baseId: string): Promise<GetHealthOverviewResult>
}

export interface SchemaAuxBase {
  baseId: string
  name: string
}

export interface SchemaNameIndex {
  bases: { baseId: string; name: string }[]
  tables: { tableId: string; baseId: string; name: string }[]
  fields: { fieldId: string; tableId: string; baseId: string; name: string }[]
  views: { viewId: string; tableId: string; baseId: string; name: string }[]
}

export async function loadSchemaAuxTabs(
  engine: SchemaAuxEngine,
  spaceId: string,
  bases: SchemaAuxBase[],
  nameSchema: SchemaNameIndex,
): Promise<{
  relationships: SchemaRelationship[]
  changelogEntries: TipChangelogEntry[]
  healthRows: TipBaseHealth[]
}> {
  const [relResults, clResults, hlResults] = await Promise.all([
    Promise.all(
      bases.map(async (b) => {
        const res = await engine.getRelationships(spaceId, b.baseId, true)
        if (!res.ok) return [] as SchemaRelationship[]
        return adaptEngineRelationships(b.baseId, b.name, {
          derived: res.derived,
          syncedViews: res.syncedViews,
        })
      }),
    ),
    Promise.all(
      bases.map(async (b) => {
        const res = await engine.getSchemaChangelog(spaceId, b.baseId, 200)
        if (!res.ok) return [] as TipChangelogEntry[]
        return adaptChangelogEntries(res.entries, nameSchema)
      }),
    ),
    Promise.all(
      bases.map(async (b) => {
        const res = await engine.getHealthOverview(spaceId, b.baseId)
        if (!res.ok) return null
        return adaptHealthOverview(b.baseId, b.name, {
          grade: res.grade,
          metrics: res.metrics,
          issues: res.issues,
        })
      }),
    ),
  ])
  return {
    relationships: relResults.flat(),
    changelogEntries: clResults.flat().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)),
    healthRows: hlResults.filter((h): h is TipBaseHealth => h != null),
  }
}
