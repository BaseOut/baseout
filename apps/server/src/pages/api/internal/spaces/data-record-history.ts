// GET /api/internal/spaces/:spaceId/data/records/:recordId/history
//
// Record timeline for the Data browser (server-data-browse Task 3.2). Replays
// bo_at_record_updates backwards from the current bo_at_record_field_data values
// to yield per-run before→after diffs, newest run first, plus created/deleted
// markers (from first_seen_run / first_unseen_run). Response:
//   { ok, entries:[{ runId, seq, at, changes:[{fieldId, before, after}], marker? }],
//     created:<marker|null>, deleted:<marker|null> }.
// Optional `?asOfRun=<uuid>`: instead returns the field values as they stood at
// that run — { ok, asOfRun, fields:{<fieldId>: <decoded value>} }.
// 404 { error:'record_not_found' } when the record is absent; 404
// { error:'run_not_found' } when asOfRun is not a real run in the Space.
// Managed_pg only (per-Space read path 501s on other backends). Token gate is
// applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from '../../../../env'
import { resolveSpaceDb } from '../../../../lib/per-space/resolve'
import { withSpaceSchema } from '../../../../lib/per-space/space-db-pg'
import { fetchRecordHistory, fetchRecordStateAsOf } from '../../../../lib/per-space/record-history-io'
import { logIfSlow, startTimer } from '../../../../lib/per-space/data-telemetry'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function spacesDataRecordHistoryHandler(
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

  const asOfRun = new URL(request.url).searchParams.get('asOfRun')
  if (asOfRun !== null && !UUID_RE.test(asOfRun)) {
    return jsonResponse({ error: 'invalid_request', param: 'asOfRun' }, 400)
  }

  const { db: masterDb } = locals.getMasterDb()
  const space = await resolveSpaceDb(masterDb, spaceId)
  if (!space || space.status !== 'active') return jsonResponse({ error: 'space_db_not_ready' }, 409)
  if (space.backend !== 'managed_pg' || !space.pgLocator) {
    return jsonResponse({ error: 'backend_not_implemented' }, 501)
  }

  const started = startTimer()
  try {
    if (asOfRun) {
      const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
        fetchRecordStateAsOf(tx, recordId, asOfRun),
      )
      logIfSlow('data/record-history', started, { spaceId, recordId, asOf: true })
      if ('error' in result) return jsonResponse({ error: result.error }, 404)
      return jsonResponse({ ok: true, asOfRun, fields: result.fields }, 200)
    }

    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      fetchRecordHistory(tx, recordId),
    )
    logIfSlow('data/record-history', started, { spaceId, recordId, entries: result?.entries.length ?? 0 })
    if (!result) return jsonResponse({ error: 'record_not_found' }, 404)
    return jsonResponse({ ok: true, ...result }, 200)
  } catch (err) {
    return jsonResponse(
      { error: 'data_read_failed', message: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}
