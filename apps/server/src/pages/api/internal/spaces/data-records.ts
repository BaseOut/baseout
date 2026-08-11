// GET /api/internal/spaces/:spaceId/data/tables/:tableId/records
//
// Keyset-paginated record page for the Data browser (server-data-browse Task
// 3.1). Query params:
//   - filters: URL-encoded JSON array of typed RecordFilter (AND semantics)
//   - sort:    "<column>:<asc|desc>"  — record_id | created_time | modified_time
//              (field-value sort is a documented follow-up → 400)
//   - cursor:  opaque keyset cursor from a prior page's nextCursor
//   - limit:   page size, clamped to [1, 200]
//   - fields:  comma-separated fieldId projection (default: all populated)
// Response: { ok, records:[{recordId, createdTime, modifiedTime, status, fields}],
//             nextCursor, total, approximate, filterErrors }.
// Managed_pg only (per-Space read path 501s on other backends). Token gate is
// applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from '../../../../env'
import { resolveSpaceDb } from '../../../../lib/per-space/resolve'
import { withSpaceSchema } from '../../../../lib/per-space/space-db-pg'
import {
  clampPageSize,
  decodeCursor,
  parseFilters,
  parseSort,
} from '../../../../lib/per-space/record-read'
import { queryRecordsPage } from '../../../../lib/per-space/record-read-io'
import { logIfSlow, startTimer } from '../../../../lib/per-space/data-telemetry'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function spacesDataRecordsHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  tableId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405)
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: 'invalid_request', param: 'spaceId' }, 400)
  if (!tableId) return jsonResponse({ error: 'invalid_request', param: 'tableId' }, 400)

  const sp = new URL(request.url).searchParams

  const { sort, error: sortError } = parseSort(sp.get('sort'))
  if (sortError) {
    return jsonResponse(
      {
        error: 'invalid_request',
        param: 'sort',
        message: 'field-value sort not yet supported — use record_id, created_time or modified_time',
      },
      400,
    )
  }

  const cursorParam = sp.get('cursor')
  const cursor = cursorParam ? decodeCursor(cursorParam) : null
  if (cursorParam && !cursor) return jsonResponse({ error: 'invalid_request', param: 'cursor' }, 400)

  const { filters, errors: filterParseErrors } = parseFilters(sp.get('filters'))
  const limit = clampPageSize(sp.get('limit'))
  const fieldsParam = sp.get('fields')
  const fields = fieldsParam
    ? fieldsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : null

  const { db: masterDb } = locals.getMasterDb()
  const space = await resolveSpaceDb(masterDb, spaceId)
  if (!space || space.status !== 'active') return jsonResponse({ error: 'space_db_not_ready' }, 409)
  if (space.backend !== 'managed_pg' || !space.pgLocator) {
    return jsonResponse({ error: 'backend_not_implemented' }, 501)
  }

  const started = startTimer()
  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      queryRecordsPage(tx, { tableId, filters, sort, cursor, limit, fields }),
    )
    logIfSlow('data/records', started, { spaceId, tableId, rows: result.records.length })
    return jsonResponse(
      { ok: true, ...result, filterErrors: [...filterParseErrors, ...result.filterErrors] },
      200,
    )
  } catch (err) {
    return jsonResponse(
      { error: 'data_read_failed', message: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}
