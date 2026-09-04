/**
 * /api/spaces/:spaceId/reports/runs/:runId/resend  (POST) — re-send the failed
 * deliveries for a run. (web-reports-page task 2.2)
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type ResendReportResult,
} from '../../../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../../../lib/account'
import {
  fetchSpaceById,
  guardReportsRequest,
  jsonResponse,
  reportsErrorStatus,
} from '../../../../../../../lib/reports/proxy'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ResendRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  runId: string | undefined
  fetchSpace: (id: string) => Promise<{ id: string; organizationId: string } | null>
  engine: {
    resendReportDelivery: (spaceId: string, runId: string) => Promise<ResendReportResult>
  } | null
}

export async function handleResend(input: ResendRouteInput): Promise<Response> {
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

  const res = await input.engine.resendReportDelivery(guard.space.id, input.runId)
  if (!res.ok) return jsonResponse({ error: res.code, message: res.message }, reportsErrorStatus(res.code))
  return jsonResponse({ ok: true, resent: res.resent, failed: res.failed }, 200)
}

function buildEngine() {
  if (!env.SERVER || !env.SERVER_INTERNAL_TOKEN) return null
  const e = createBackupEngine({
    binding: env.SERVER,
    internalToken: env.SERVER_INTERNAL_TOKEN,
  })
  return {
    resendReportDelivery: (spaceId: string, runId: string) => e.resendReportDelivery(spaceId, runId),
  }
}

export const POST: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  return handleResend({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    runId: params.runId,
    fetchSpace: (id) => fetchSpaceById(db, id),
    engine: buildEngine(),
  })
}
