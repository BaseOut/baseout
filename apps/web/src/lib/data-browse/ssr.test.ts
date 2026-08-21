/**
 * Data page engine loader — independent reads must overlap, not wait in a
 * chain. Each remote service-binding round-trip is expensive in wrangler
 * --remote; serializing them is what made /data feel empty-but-slow.
 */
import { describe, expect, it, vi } from 'vitest'
import { loadDataPageFromEngine, type DataPageEngine } from './ssr'
import type { GetSchemaResult } from '../backup-engine'
import type {
  GetDataChangelogResult,
  GetDataCommentsResult,
  GetDataRecordsResult,
  GetMediaResult,
} from './engine-shapes'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function schemaOk(): Extract<GetSchemaResult, { ok: true }> {
  return {
    ok: true,
    bases: [
      {
        baseId: 'appA',
        name: 'CRM',
        description: null,
        aiDescription: null,
        descriptionOverride: null,
        status: 'active',
        removedAt: null,
      },
    ],
    tables: [
      {
        tableId: 'tbl1',
        baseId: 'appA',
        name: 'Deals',
        recordCount: 2,
        fieldCount: 1,
        description: null,
        aiDescription: null,
        descriptionOverride: null,
        status: 'active',
        removedAt: null,
      },
    ],
    fields: [
      {
        fieldId: 'fldName',
        tableId: 'tbl1',
        baseId: 'appA',
        name: 'Name',
        type: 'singleLineText',
        isPrimary: true,
        description: null,
        aiDescription: null,
        descriptionOverride: null,
        status: 'active',
        removedAt: null,
        linkedTableId: null,
        allowsMultiple: null,
        inverseFieldId: null,
        formula: null,
        referencedFieldIds: null,
        lookupViaFieldId: null,
        lookupTargetFieldId: null,
        choices: null,
      },
    ],
    views: [],
  }
}

const emptyRecords: GetDataRecordsResult = {
  ok: true,
  records: [],
  nextCursor: null,
  total: 0,
  approximate: false,
  filterErrors: [],
}
const emptyMedia: GetMediaResult = { ok: true, items: [], nextCursor: null }
const emptyComments: GetDataCommentsResult = {
  ok: true,
  comments: [],
  nextCursor: null,
  total: 0,
  approximate: false,
}

describe('loadDataPageFromEngine', () => {
  it('starts schema, documents, and chat threads before any of them resolve', async () => {
    const schema = deferred<GetSchemaResult>()
    const docs = deferred<{ ok: true; documents: [] }>()
    const threads = deferred<{ ok: true; threads: [] }>()
    const started: string[] = []

    const engine: DataPageEngine = {
      getSchema: async () => {
        started.push('schema')
        return schema.promise
      },
      listDocuments: async () => {
        started.push('docs')
        return docs.promise
      },
      listChatThreads: async () => {
        started.push('threads')
        return threads.promise
      },
      getDataRecords: async () => emptyRecords,
      getDataChangelog: async () => ({ ok: true, mode: 'rollup', runs: [], nextCursor: null }),
      getMedia: async () => emptyMedia,
      getDataComments: async () => emptyComments,
    }

    const pending = loadDataPageFromEngine(engine, 'space-1', { docsLevel: 'manual' })
    await Promise.resolve()
    expect(started.sort()).toEqual(['docs', 'schema', 'threads'])

    schema.resolve(schemaOk())
    docs.resolve({ ok: true, documents: [] })
    threads.resolve({ ok: true, threads: [] })
    const result = await pending
    expect(result.managedPg).toBe(true)
    expect(result.tables[0]?.id).toBe('tbl1')
  })

  it('fans records, changelog, media, and comments after schema — in parallel', async () => {
    const records = deferred<GetDataRecordsResult>()
    const changelog = deferred<GetDataChangelogResult>()
    const media = deferred<GetMediaResult>()
    const comments = deferred<GetDataCommentsResult>()
    const started: string[] = []

    const engine: DataPageEngine = {
      getSchema: async () => schemaOk(),
      listDocuments: async () => ({ ok: true, documents: [] }),
      listChatThreads: async () => ({ ok: true, threads: [] }),
      getDataRecords: async () => {
        started.push('records')
        return records.promise
      },
      getDataChangelog: async () => {
        started.push('changelog')
        return changelog.promise
      },
      getMedia: async () => {
        started.push('media')
        return media.promise
      },
      getDataComments: async () => {
        started.push('comments')
        return comments.promise
      },
    }

    const pending = loadDataPageFromEngine(engine, 'space-1', { docsLevel: 'none' })
    await Promise.resolve()
    await Promise.resolve()
    expect(started.sort()).toEqual(['changelog', 'comments', 'media', 'records'])

    records.resolve(emptyRecords)
    changelog.resolve({ ok: true, mode: 'rollup', runs: [], nextCursor: null })
    media.resolve(emptyMedia)
    comments.resolve(emptyComments)
    await pending
  })

  it('fans per-type changelog row reads for the latest run in parallel', async () => {
    const created = deferred<GetDataChangelogResult>()
    const updated = deferred<GetDataChangelogResult>()
    const deleted = deferred<GetDataChangelogResult>()
    const rowStarts: string[] = []

    const engine: DataPageEngine = {
      getSchema: async () => schemaOk(),
      listDocuments: async () => ({ ok: true, documents: [] }),
      listChatThreads: async () => ({ ok: true, threads: [] }),
      getDataRecords: async () => emptyRecords,
      getDataChangelog: async (_spaceId, query) => {
        if (!query?.runId) {
          return {
            ok: true,
            mode: 'rollup',
            runs: [
              {
                runId: 'run-1',
                startedAt: '2026-07-01T00:00:00.000Z',
                completedAt: '2026-07-01T00:01:00.000Z',
                createdCount: 1,
                updatedCount: 1,
                deletedCount: 1,
              },
            ],
            nextCursor: null,
          }
        }
        rowStarts.push(query.changeType ?? '')
        if (query.changeType === 'created') return created.promise
        if (query.changeType === 'updated') return updated.promise
        return deleted.promise
      },
      getMedia: async () => emptyMedia,
      getDataComments: async () => emptyComments,
    }

    const pending = loadDataPageFromEngine(engine, 'space-1', { docsLevel: 'none' })
    await vi.waitFor(() => {
      expect([...rowStarts].sort()).toEqual(['created', 'deleted', 'updated'])
    })

    const emptyRows = (changeType: string): GetDataChangelogResult => ({
      ok: true,
      mode: 'rows',
      runId: 'run-1',
      changeType,
      rows: [],
      nextCursor: null,
    })
    created.resolve(emptyRows('created'))
    updated.resolve(emptyRows('updated'))
    deleted.resolve(emptyRows('deleted'))
    await pending
  })
})
