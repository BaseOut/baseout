/**
 * /api/spaces/:spaceId/reports/:reportId/generate  (POST) — run-now.
 * Optional { windowStart, windowEnd } override → ad-hoc. (web-reports-page 2.2)
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type GenerateReportResult,
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

export interface GenerateRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  reportId: string | undefined
  parseBody: () => Promise<unknown>
  fetchSpace: (id: string) => Promise<{ id: string; organizationId: string } | null>
  engine: {
    generateReportNow: (
      spaceId: string,
      defId: string,
      body?: Record<string, unknown>,
    ) => Promise<GenerateReportResult>
  } | null
}

export async function handleGenerate(input: GenerateRouteInput): Promise<Response> {
  const guard = await guardReportsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
  })
  if (!guard.ok) return guard.response
  if (!input.reportId || !UUID_RE.test(input.reportId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (!input.engine) return jsonResponse({ error: 'server_misconfigured' }, 503)

  let body: Record<string, unknown> = {}
  try {
    const parsed = await input.parseBody()
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>
  } catch {
    body = {}
  }

  const res = await input.engine.generateReportNow(guard.space.id, input.reportId, body)
  if (!res.ok) return jsonResponse({ error: res.code, message: res.message }, reportsErrorStatus(res.code))
  return jsonResponse({ ok: true, runId: res.runId }, 202)
}

function buildEngine() {
  if (!env.SERVER || !env.SERVER_INTERNAL_TOKEN) return null
  const e = createBackupEngine({
    binding: env.SERVER,
    internalToken: env.SERVER_INTERNAL_TOKEN,
  })
  return {
    generateReportNow: (spaceId: string, defId: string, body?: Record<string, unknown>) =>
      e.generateReportNow(spaceId, defId, body),
  }
}

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  return handleGenerate({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    reportId: params.reportId,
    parseBody: () => request.json(),
    fetchSpace: (id) => fetchSpaceById(db, id),
    engine: buildEngine(),
  })
}
