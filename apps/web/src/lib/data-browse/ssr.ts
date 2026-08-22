/**
 * Data page engine loader. Independent engine reads overlap; the previous
 * serial chain (schema → records → changelog → changelog rows → media →
 * comments → docs) paid one service-binding RTT per hop even on empty Spaces.
 */

import type {
  ChatThreadSummaryView,
  GetSchemaResult,
  ListChatThreadsResult,
  ListDocumentsResult,
  SchemaDocSummary,
} from '../backup-engine'
import type { SchemaDocsLevel } from '../capabilities/tier-capabilities'
import type {
  DataBase,
  DataChangeEntry,
  DataComment,
  DataRecord,
  DataTable,
  MediaAsset,
} from '../../components/data/dataTypes'
import type {
  GetDataChangelogResult,
  GetDataCommentsResult,
  GetDataRecordsResult,
  GetMediaResult,
} from './engine-shapes'
import {
  mapChangelogRows,
  mapComments,
  mapMediaAssets,
  mapRecords,
  mapRunTotals,
  mapSchemaToData,
} from './map'

export interface DataPageEngine {
  getSchema(spaceId: string): Promise<GetSchemaResult>
  getDataRecords(
    spaceId: string,
    tableId: string,
    query?: { limit?: number },
  ): Promise<GetDataRecordsResult>
  getDataChangelog(
    spaceId: string,
    query?: { limit?: number; runId?: string; changeType?: string },
  ): Promise<GetDataChangelogResult>
  getMedia(spaceId: string, query?: { limit?: number }): Promise<GetMediaResult>
  getDataComments(
    spaceId: string,
    query?: { limit?: number },
  ): Promise<GetDataCommentsResult>
  listDocuments(spaceId: string): Promise<ListDocumentsResult>
  listChatThreads(
    spaceId: string,
    includeArchived?: boolean,
  ): Promise<ListChatThreadsResult>
}

export interface DataPageEnginePayload {
  managedPg: boolean
  bases: DataBase[]
  tables: DataTable[]
  records: DataRecord[]
  comments: DataComment[]
  changelog: DataChangeEntry[]
  runTotals: Record<string, { created: number; updated: number; deleted: number }>
  assets: MediaAsset[]
  docs: SchemaDocSummary[]
  chatThreads: ChatThreadSummaryView[]
  landingTableId: string | undefined
  primaryByTable: Record<string, string | undefined>
  recordsNextCursor: string | null | undefined
}

export function emptyDataPagePayload(): DataPageEnginePayload {
  return {
    managedPg: false,
    bases: [],
    tables: [],
    records: [],
    comments: [],
    changelog: [],
    runTotals: {},
    assets: [],
    docs: [],
    chatThreads: [],
    landingTableId: undefined,
    primaryByTable: {},
    recordsNextCursor: undefined,
  }
}

export async function loadDataPageFromEngine(
  engine: DataPageEngine,
  spaceId: string,
  opts: {
    docsLevel: SchemaDocsLevel
    includeSecondary?: boolean
    landingTableIdHint?: string | Promise<string | undefined>
  },
): Promise<DataPageEnginePayload> {
  const out = emptyDataPagePayload()
  const includeSecondary = opts.includeSecondary !== false

  const schemaP = engine.getSchema(spaceId)
  const hintP = Promise.resolve(opts.landingTableIdHint)
  const hintedRecordsP = !includeSecondary
    ? hintP.then((h) => (h ? engine.getDataRecords(spaceId, h, { limit: 50 }) : null))
    : Promise.resolve(null)
  const docsP =
    includeSecondary && opts.docsLevel !== 'none'
      ? engine.listDocuments(spaceId)
      : Promise.resolve(null)
  const threadsP =
    includeSecondary && opts.docsLevel !== 'none'
      ? engine.listChatThreads(spaceId, false)
      : Promise.resolve(null)

  const [schemaRes, docsRes, threadsRes, hintedRecs, hint] = await Promise.all([
    schemaP,
    docsP,
    threadsP,
    hintedRecordsP,
    hintP,
  ])

  if (docsRes?.ok) out.docs = docsRes.documents
  if (threadsRes?.ok) out.chatThreads = threadsRes.threads

  if (!schemaRes.ok) return out

  out.managedPg = true
  const mapped = mapSchemaToData(schemaRes)
  out.bases = mapped.bases
  out.tables = mapped.tables
  out.primaryByTable = mapped.primaryByTable
  out.landingTableId = mapped.tables[0]?.id

  const landingTableId = out.landingTableId
  if (!landingTableId) return out

  if (!includeSecondary) {
    const recRes =
      hint && hint === landingTableId && hintedRecs?.ok
        ? hintedRecs
        : await engine.getDataRecords(spaceId, landingTableId, { limit: 50 })
    if (recRes.ok) {
      out.records = mapRecords(
        recRes.records,
        landingTableId,
        mapped.primaryByTable[landingTableId],
      )
      out.recordsNextCursor = recRes.nextCursor
    }
    return out
  }

  const browse = Promise.all([
    engine.getDataRecords(spaceId, landingTableId, { limit: 50 }),
    engine.getDataChangelog(spaceId, { limit: 50 }),
    engine.getMedia(spaceId, { limit: 50 }),
  ])
  const commentsP = engine.getDataComments(spaceId, { limit: 50 })

  const [browseRes, commentsRes] = await Promise.all([browse, commentsP])
  if (commentsRes.ok) out.comments = mapComments(commentsRes.comments)

  const [recRes, rollupRes, mediaRes] = browseRes
  if (recRes.ok) {
    out.records = mapRecords(
      recRes.records,
      landingTableId,
      mapped.primaryByTable[landingTableId],
    )
    out.recordsNextCursor = recRes.nextCursor
  }
  if (mediaRes.ok) out.assets = mapMediaAssets(mediaRes.items)

  if (rollupRes.ok && rollupRes.mode === 'rollup') {
    out.runTotals = mapRunTotals(rollupRes.runs)
    const top = rollupRes.runs[0]
    if (top) {
      const runAt = top.startedAt ?? top.completedAt ?? ''
      const counts = {
        created: top.createdCount,
        updated: top.updatedCount,
        deleted: top.deletedCount,
      }
      const types = (['created', 'updated', 'deleted'] as const).filter(
        (t) => counts[t] > 0,
      )
      const samples = await Promise.all(
        types.map(async (changeType) => {
          const rowsRes = await engine.getDataChangelog(spaceId, {
            runId: top.runId,
            changeType,
            limit: 25,
          })
          if (rowsRes.ok && rowsRes.mode === 'rows') {
            return mapChangelogRows(rowsRes.rows, top.runId, runAt)
          }
          return [] as DataChangeEntry[]
        }),
      )
      out.changelog = samples.flat()
    }
  }

  return out
}
