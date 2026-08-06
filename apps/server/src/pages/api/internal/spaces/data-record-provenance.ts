// GET /api/internal/spaces/:spaceId/data/records/:recordId/provenance/:fieldId
//
// Cell provenance for the Data browser (server-data-browse Task 3.2b), served
// from captured `bo_at_fields.options` — interpretation, not new capture:
//   - formula → the expression + each referenced field (options.referencedFieldIds)
//     with THIS record's current value.
//   - lookup/rollup → the traversed link field (options.recordLinkFieldId), the
//     source table, the source records with the looked-up field's value each
//     (options.fieldIdInLinkedTable), + the aggregation kind for rollups. Source
//     records keyset-page via ?cursor=/?limit= (same machinery as links).
//   - plain / linked field → { ok, provenance: null }.
// One level per call — no server-side recursion (the UI expands one hop per
// user action, which bounds each response and avoids cycle handling). Options
// captures lacking reference metadata return provenance with a `reason`, never
// inferred by parsing the expression text.
// Managed_pg only (501 otherwise). Token gate applied by middleware.

import type { AppLocals, Env } from '../../../../env'
import { resolveSpaceDb } from '../../../../lib/per-space/resolve'
import { withSpaceSchema } from '../../../../lib/per-space/space-db-pg'
import { clampPageSize } from '../../../../lib/per-space/record-read'
import { resolveProvenance } from '../../../../lib/per-space/record-provenance-io'
import { logIfSlow, startTimer } from '../../../../lib/per-space/data-telemetry'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function spacesDataRecordProvenanceHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  recordId: string,
  fieldId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405)
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: 'invalid_request', param: 'spaceId' }, 400)
  if (!recordId) return jsonResponse({ error: 'invalid_request', param: 'recordId' }, 400)
  if (!fieldId) return jsonResponse({ error: 'invalid_request', param: 'fieldId' }, 400)

  const sp = new URL(request.url).searchParams
  const limit = clampPageSize(sp.get('limit'))
  const cursor = sp.get('cursor')

  const { db: masterDb } = locals.getMasterDb()
  const space = await resolveSpaceDb(masterDb, spaceId)
  if (!space || space.status !== 'active') return jsonResponse({ error: 'space_db_not_ready' }, 409)
  if (space.backend !== 'managed_pg' || !space.pgLocator) {
    return jsonResponse({ error: 'backend_not_implemented' }, 501)
  }

  const started = startTimer()
  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      resolveProvenance(tx, { recordId, fieldId, cursor, limit }),
    )
    if (result.status === 'field_not_found') return jsonResponse({ error: 'field_not_found' }, 404)
    logIfSlow('data/record-provenance', started, { spaceId, recordId, fieldId, kind: result.provenance?.kind ?? 'none' })
    return jsonResponse({ ok: true, provenance: result.provenance }, 200)
  } catch (err) {
    return jsonResponse(
      { error: 'data_read_failed', message: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}
