// GET /api/internal/spaces/:spaceId/data/records/:recordId
//
// Single-record detail for the Data browser (server-data-browse Task 3.2).
// record_id is globally unique within the Space (PK), so the lookup takes no
// tableId. Response: { ok, record: { recordId, tableId, baseId, createdTime,
// modifiedTime, status, fields: {<fieldId>: <decoded value>}, attachments:[…] } }.
// 404 { error:'record_not_found' } when no bo_at_records row exists.
// Managed_pg only (per-Space read path 501s on other backends). Token gate is
// applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from '../../../../env'
import { resolveSpaceDb } from '../../../../lib/per-space/resolve'
import { withSpaceSchema } from '../../../../lib/per-space/space-db-pg'
import { fetchRecordDetail } from '../../../../lib/per-space/record-detail-io'
import { logIfSlow, startTimer } from '../../../../lib/per-space/data-telemetry'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function spacesDataRecordHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  recordId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405)
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: 'invalid_request', param: 'spaceId' }, 400)
  if (!recordId) return jsonResponse({ error: 'invalid_request', param: 'recordId' }, 400)

  const { db: masterDb } = locals.getMasterDb()
  const space = await resolveSpaceDb(masterDb, spaceId)
  if (!space || space.status !== 'active') return jsonResponse({ error: 'space_db_not_ready' }, 409)
  if (space.backend !== 'managed_pg' || !space.pgLocator) {
    return jsonResponse({ error: 'backend_not_implemented' }, 501)
  }

  const started = startTimer()
  try {
    const record = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      fetchRecordDetail(tx, recordId),
    )
    logIfSlow('data/record', started, { spaceId, recordId, found: record != null })
    if (!record) return jsonResponse({ error: 'record_not_found' }, 404)
    return jsonResponse({ ok: true, record }, 200)
  } catch (err) {
    return jsonResponse(
      { error: 'data_read_failed', message: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}
