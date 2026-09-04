/**
 * /api/spaces/:spaceId/reports/runs/:runId  (GET) — the rendered run document
 * JSON + the run row. (web-reports-page task 2.2 / 2.3)
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type GetReportRunResult,
} from '../../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../../lib/account'
import {
  fetchSpaceById,
  guardReportsRequest,
  jsonResponse,
  reportsErrorStatus,
} from '../../../../../../lib/reports/proxy'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ReportRunRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  runId: string | undefined
  fetchSpace: (id: string) => Promise<{ id: string; organizationId: string } | null>
  engine: {
    getReportRun: (spaceId: string, runId: string) => Promise<GetReportRunResult>
  } | null
}

export async function handleReportRun(input: ReportRunRouteInput): Promise<Response> {
  const guard = await guardReportsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
  })
  if (!guard.ok) return guard.response
  if (!input.runId || !UUID_RE.test(input.runId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (!input.engine) return jsonResponse({ error: 'server_misconfigured' }, 503)

  const res = await input.engine.getReportRun(guard.space.id, input.runId)
  if (!res.ok) return jsonResponse({ error: res.code, message: res.message }, reportsErrorStatus(res.code))
  return jsonResponse({ ok: true, run: res.run, document: res.document }, 200)
}

function buildEngine() {
  if (!env.SERVER || !env.SERVER_INTERNAL_TOKEN) return null
  const e = createBackupEngine({
    binding: env.SERVER,
    internalToken: env.SERVER_INTERNAL_TOKEN,
  })
  return { getReportRun: (spaceId: string, runId: string) => e.getReportRun(spaceId, runId) }
}

export const GET: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  return handleReportRun({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    runId: params.runId,
    fetchSpace: (id) => fetchSpaceById(db, id),
    engine: buildEngine(),
  })
}
