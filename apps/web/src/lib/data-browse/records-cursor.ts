/**
 * Client cursor pagination for Data ▸ Browse.
 *
 * Fetches keyset pages from `GET /api/spaces/:spaceId/data/records` until the
 * caller has enough rows for the requested window, or `nextCursor` is null.
 *
 * Server-side filters are intentionally NOT sent here — Browse keeps client-side
 * filter/sort/search on the accumulated rows (ExportControl may add server filters later).
 */

import type { DataRecord } from '../../components/data/dataTypes'
import type { DataRecordRow } from './engine-shapes'
import { mapRecordRows } from './map'

export { mapRecordRows }

export interface FetchRecordsPageParams {
  spaceId: string
  tableId: string
  cursor?: string
  limit?: number
  sort?: string
}

export type FetchRecordsPageResult =
  | {
      ok: true
      records: DataRecordRow[]
      nextCursor: string | null
      total: number
      approximate: boolean
      filterErrors: string[]
    }
  | { ok: false; status: number; error: string }

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

/** One page from the Data records proxy. */
export async function fetchRecordsPage(
  params: FetchRecordsPageParams,
  fetchFn: FetchFn = fetch,
): Promise<FetchRecordsPageResult> {
  const sp = new URLSearchParams({
    tableId: params.tableId,
    limit: String(params.limit ?? 50),
  })
  if (params.cursor) sp.set('cursor', params.cursor)
  if (params.sort) sp.set('sort', params.sort)

  const url = `/api/spaces/${encodeURIComponent(params.spaceId)}/data/records?${sp}`
  let res: Response
  try {
    res = await fetchFn(url)
  } catch {
    return { ok: false, status: 0, error: 'network_error' }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { ok: false, status: res.status, error: 'invalid_json' }
  }

  if (!res.ok) {
    const err =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `http_${res.status}`
    return { ok: false, status: res.status, error: err }
  }

  const b = body as {
    records?: DataRecordRow[]
    nextCursor?: string | null
    total?: number
    approximate?: boolean
    filterErrors?: string[]
  }
  return {
    ok: true,
    records: Array.isArray(b.records) ? b.records : [],
    nextCursor: b.nextCursor ?? null,
    total: Number(b.total ?? 0),
    approximate: Boolean(b.approximate),
    filterErrors: Array.isArray(b.filterErrors) ? b.filterErrors : [],
  }
}

export interface EnsureRecordsCoverParams {
  spaceId: string
  tableId: string
  /** Inclusive end of the pager window (page * pageSize). */
  needCount: number
  /** How many rows for this table are already in the client snapshot. */
  loadedCount: number
  /**
   * Cursor for the *next* page.
   * - `undefined` + loadedCount === 0 → fetch page-1 (no cursor param)
   * - `undefined` + loadedCount > 0 → treat as unknown; do not fetch (caller should supply SSR cursor)
   * - `string` → fetch that page
   * - `null` → exhausted; nothing to fetch
   */
  nextCursor: string | null | undefined
  primaryFieldId?: string
  pageLimit?: number
  sort?: string
  fetchPage?: typeof fetchRecordsPage
}

export type EnsureRecordsCoverResult =
  | { ok: true; added: DataRecord[]; nextCursor: string | null }
  | { ok: false; error: string }

/**
 * Fetch successive pages until `loadedCount + added.length >= needCount`
 * or the server reports no further cursor.
 */
export async function ensureRecordsCover(
  params: EnsureRecordsCoverParams,
): Promise<EnsureRecordsCoverResult> {
  const fetchPage = params.fetchPage ?? fetchRecordsPage
  const pageLimit = params.pageLimit ?? 50

  if (params.loadedCount >= params.needCount) {
    return { ok: true, added: [], nextCursor: params.nextCursor ?? null }
  }
  if (params.nextCursor === null) {
    return { ok: true, added: [], nextCursor: null }
  }
  // SSR left rows without a cursor — refuse to re-fetch page-1 (would duplicate).
  if (params.nextCursor === undefined && params.loadedCount > 0) {
    return { ok: true, added: [], nextCursor: null }
  }

  let cursor: string | null | undefined = params.nextCursor
  let loaded = params.loadedCount
  const added: DataRecord[] = []

  while (loaded < params.needCount) {
    const page = await fetchPage({
      spaceId: params.spaceId,
      tableId: params.tableId,
      cursor: cursor ?? undefined,
      limit: pageLimit,
      sort: params.sort,
    })
    if (!page.ok) return { ok: false, error: page.error }

    const mapped = mapRecordRows(page.records, params.tableId, params.primaryFieldId)
    added.push(...mapped)
    loaded += mapped.length
    cursor = page.nextCursor

    if (mapped.length === 0 || cursor === null) break
  }

  return { ok: true, added, nextCursor: cursor ?? null }
}
