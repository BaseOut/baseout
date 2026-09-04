/**
 * /api/spaces/:spaceId/reports/:reportId  — (web-reports-page task 2.2)
 *   GET    → definition + run history
 *   PATCH  → update the definition
 *   DELETE → delete (engine rejects the default report → 403)
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type GetReportResult,
  type MutateReportResult,
  type DeleteReportResult,
} from '../../../../../lib/backup-engine'
import type { AccountContext } from '../../../../../lib/account'
import {
  fetchSpaceById,
  guardReportsRequest,
  jsonResponse,
  reportsErrorStatus,
} from '../../../../../lib/reports/proxy'

export interface ReportRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  reportId: string | undefined
  method: 'GET' | 'PATCH' | 'DELETE'
  parseBody: () => Promise<unknown>
  fetchSpace: (id: string) => Promise<{ id: string; organizationId: string } | null>
  engine: {
    getReportDefinition: (spaceId: string, defId: string) => Promise<GetReportResult>
    updateReportDefinition: (spaceId: string, defId: string, body: unknown) => Promise<MutateReportResult>
    deleteReportDefinition: (spaceId: string, defId: string) => Promise<DeleteReportResult>
  } | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function handleReport(input: ReportRouteInput): Promise<Response> {
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
  const defId = input.reportId

  if (input.method === 'GET') {
    const res = await input.engine.getReportDefinition(guard.space.id, defId)
    if (!res.ok) return jsonResponse({ error: res.code, message: res.message }, reportsErrorStatus(res.code))
    return jsonResponse({ ok: true, definition: res.definition, runs: res.runs }, 200)
  }

  if (input.method === 'PATCH') {
    let body: unknown
    try {
      body = await input.parseBody()
    } catch {
      return jsonResponse({ error: 'invalid_request' }, 400)
    }
    const res = await input.engine.updateReportDefinition(guard.space.id, defId, body)
    if (!res.ok) return jsonResponse({ error: res.code, message: res.message }, reportsErrorStatus(res.code))
    return jsonResponse({ ok: true, definition: res.definition }, 200)
  }

  // DELETE
  const res = await input.engine.deleteReportDefinition(guard.space.id, defId)
  if (!res.ok) return jsonResponse({ error: res.code, message: res.message }, reportsErrorStatus(res.code))
  return jsonResponse({ ok: true }, 200)
}

function buildEngine() {
  if (!env.SERVER || !env.SERVER_INTERNAL_TOKEN) return null
  const e = createBackupEngine({
    binding: env.SERVER,
    internalToken: env.SERVER_INTERNAL_TOKEN,
  })
  return {
    getReportDefinition: (spaceId: string, defId: string) => e.getReportDefinition(spaceId, defId),
    updateReportDefinition: (spaceId: string, defId: string, body: unknown) =>
      e.updateReportDefinition(spaceId, defId, body as Parameters<typeof e.updateReportDefinition>[2]),
    deleteReportDefinition: (spaceId: string, defId: string) => e.deleteReportDefinition(spaceId, defId),
  }
}

const route =
  (method: 'GET' | 'PATCH' | 'DELETE'): APIRoute =>
  async ({ locals, params, request }) => {
    const db = locals.db
    if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
    return handleReport({
      account: locals.account ?? null,
      spaceId: params.spaceId,
      reportId: params.reportId,
      method,
      parseBody: () => request.json(),
      fetchSpace: (id) => fetchSpaceById(db, id),
      engine: buildEngine(),
    })
  }

export const GET = route('GET')
export const PATCH = route('PATCH')
export const DELETE = route('DELETE')
