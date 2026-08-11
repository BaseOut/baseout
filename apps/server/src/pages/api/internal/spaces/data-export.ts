// POST /api/internal/spaces/:spaceId/data/export
// GET  /api/internal/spaces/:spaceId/data/export/:jobId
//
// Record export over the per-Space Postgres (server-data-browse Task 3.5, SYNC
// path + job status). Body: { scope: {baseId?, tableId?, filters?, sort?}, format }.
//
// The route runs a capped count of the scope: at or below SYNC_THRESHOLD it
// streams the export SYNCHRONOUSLY as the Response body (CSV via csvLines, JSON
// via jsonExportChunks — piped through a ReadableStream so the serialized set is
// never buffered, PRD §7.2). Above the threshold it INSERTs a queued
// bo_at_export_jobs row and returns 202 — the actual async writer is the
// DEFERRED workflows-data-export follow-up; nothing is enqueued here.
//
// GET returns the export-job status row (404 if missing). Managed_pg only (per-
// Space read path 501s on other backends). Token gate applied by middleware
// (path begins /api/internal/).

import type { AppLocals, Env } from '../../../../env'
import { resolveSpaceDb } from '../../../../lib/per-space/resolve'
import { withSpaceSchema } from '../../../../lib/per-space/space-db-pg'
import { logIfSlow, startTimer } from '../../../../lib/per-space/data-telemetry'
import { jsonExportShape } from '../../../../lib/per-space/record-export'
import {
  buildCsvLines,
  cappedScopeCount,
  decideExportMode,
  fetchExportData,
  insertExportJob,
  jsonExportChunks,
  readExportJob,
  validateExportRequest,
} from '../../../../lib/per-space/record-export-io'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** ReadableStream that pulls string chunks from `gen`, encoded UTF-8 and joined
 *  by `joiner`. Never materializes the whole serialized set. */
function streamChunks(gen: Iterable<string>, joiner: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const iter = gen[Symbol.iterator]()
  let first = true
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const { value, done } = iter.next()
      if (done) {
        controller.close()
        return
      }
      const chunk = first ? value : joiner + value
      first = false
      controller.enqueue(encoder.encode(chunk))
    },
  })
}

function filenameFor(scope: { baseId?: string; tableId?: string }, ext: string): string {
  const stem = scope.tableId ?? scope.baseId ?? 'export'
  return `export-${stem}.${ext}`
}

export async function spacesDataExportHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: 'invalid_request', param: 'spaceId' }, 400)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid_request', message: 'invalid JSON body' }, 400)
  }

  const parsed = validateExportRequest(body)
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error, param: parsed.param, message: parsed.message }, 400)
  }
  const { format, scope, filters } = parsed

  const { db: masterDb } = locals.getMasterDb()
  const space = await resolveSpaceDb(masterDb, spaceId)
  if (!space || space.status !== 'active') return jsonResponse({ error: 'space_db_not_ready' }, 409)
  if (space.backend !== 'managed_pg' || !space.pgLocator) {
    return jsonResponse({ error: 'backend_not_implemented' }, 501)
  }

  const started = startTimer()
  try {
    const count = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      cappedScopeCount(tx, scope, filters),
    )

    if (decideExportMode(count) === 'async') {
      const jobId = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
        insertExportJob(tx, { scope: { ...scope, filters }, format }),
      )
      logIfSlow('data/export', started, { spaceId, mode: 'async' })
      return jsonResponse({ ok: true, jobId, status: 'queued', async: true }, 202)
    }

    // Sync: read the whole (bounded) scope inside the transaction, then stream
    // the serialized output from the generator.
    const payload = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      fetchExportData(tx, { format, scope, filters }),
    )
    logIfSlow('data/export', started, { spaceId, mode: 'sync', rows: payload.rowCount })

    if (payload.kind === 'csv') {
      const stream = streamChunks(buildCsvLines(payload.fields, payload.records), '\n')
      return new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${filenameFor(scope, 'csv')}"`,
        },
      })
    }

    const stream = streamChunks(jsonExportChunks(jsonExportShape(payload.bases)), '')
    return new Response(stream, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${filenameFor(scope, 'json')}"`,
      },
    })
  } catch (err) {
    return jsonResponse(
      { error: 'data_export_failed', message: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}

export async function spacesDataExportJobHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  jobId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405)
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: 'invalid_request', param: 'spaceId' }, 400)
  if (!UUID_RE.test(jobId)) return jsonResponse({ error: 'invalid_request', param: 'jobId' }, 400)

  const { db: masterDb } = locals.getMasterDb()
  const space = await resolveSpaceDb(masterDb, spaceId)
  if (!space || space.status !== 'active') return jsonResponse({ error: 'space_db_not_ready' }, 409)
  if (space.backend !== 'managed_pg' || !space.pgLocator) {
    return jsonResponse({ error: 'backend_not_implemented' }, 501)
  }

  try {
    const job = await withSpaceSchema(masterDb, space.pgLocator, (tx) => readExportJob(tx, jobId))
    if (!job) return jsonResponse({ error: 'not_found' }, 404)
    return jsonResponse({ ok: true, job }, 200)
  } catch (err) {
    return jsonResponse(
      { error: 'data_export_failed', message: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}
