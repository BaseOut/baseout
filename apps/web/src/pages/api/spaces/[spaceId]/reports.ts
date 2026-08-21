/**
 * /api/spaces/:spaceId/reports  — Reports proxy (web-reports-page task 2.2)
 *   GET  → list report definitions (each with its latest run)
 *   POST → create a definition (capability-gated: active_reports creation cap)
 *
 * Authenticated + IDOR-gated (guardReportsRequest), then forwards to
 * @baseout/server via the BACKUP_ENGINE binding. Testable inner handler takes
 * deps as args (no cloudflare:workers import reached in tests).
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  createBackupEngine,
  type ListReportsResult,
  type MutateReportResult,
} from '../../../../lib/backup-engine'
import type { AccountContext } from '../../../../lib/account'
import {
  fetchSpaceById,
  guardReportsRequest,
  jsonResponse,
  reportsErrorStatus,
} from '../../../../lib/reports/proxy'
import { checkCreationCap } from '../../../../lib/entitlements/enforce-create'
import { resolveEntitlements } from '../../../../lib/entitlements/resolve'
import { countActiveReportsForOrg } from '../../../../lib/reports/queries'

interface CapDecision {
  allowed: boolean
  used: number | null
  limit: number | null
  addonSlug: string | null
}

export interface ReportsRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  method: 'GET' | 'POST'
  parseBody: () => Promise<unknown>
  fetchSpace: (id: string) => Promise<{ id: string; organizationId: string } | null>
  engine: {
    listReportDefinitions: (spaceId: string) => Promise<ListReportsResult>
    createReportDefinition: (spaceId: string, body: unknown) => Promise<MutateReportResult>
  } | null
  /** active_reports creation-cap check (server-side gate). */
  checkCreate: (orgId: string) => Promise<CapDecision>
}

export async function handleReports(input: ReportsRouteInput): Promise<Response> {
  const guard = await guardReportsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
  })
  if (!guard.ok) return guard.response
  if (!input.engine) return jsonResponse({ error: 'server_misconfigured' }, 503)

  if (input.method === 'GET') {
    const res = await input.engine.listReportDefinitions(guard.space.id)
    if (!res.ok) return jsonResponse({ error: res.code, message: res.message }, reportsErrorStatus(res.code))
    return jsonResponse({ ok: true, definitions: res.definitions }, 200)
  }

  // POST — create. Gate the active_reports creation cap before hitting the engine.
  const cap = await input.checkCreate(guard.orgId)
  if (!cap.allowed) {
    return jsonResponse(
      {
        error: 'limit_reached',
        code: 'limit_reached',
        feature: 'active_reports',
        used: cap.used,
        limit: cap.limit,
        addon: cap.addonSlug,
      },
      403,
    )
  }

  let body: unknown
  try {
    body = await input.parseBody()
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const res = await input.engine.createReportDefinition(guard.space.id, body)
  if (!res.ok) return jsonResponse({ error: res.code, message: res.message }, reportsErrorStatus(res.code))
  return jsonResponse({ ok: true, definition: res.definition }, 201)
}

function buildEngine() {
  if (!env.BACKUP_ENGINE || !env.BACKUP_ENGINE_INTERNAL_TOKEN) return null
  const e = createBackupEngine({
    binding: env.BACKUP_ENGINE,
    internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
  })
  return {
    listReportDefinitions: (spaceId: string) => e.listReportDefinitions(spaceId),
    createReportDefinition: (spaceId: string, body: unknown) =>
      e.createReportDefinition(spaceId, body as Parameters<typeof e.createReportDefinition>[1]),
  }
}

const route =
  (method: 'GET' | 'POST'): APIRoute =>
  async ({ locals, params, request }) => {
    const db = locals.db
    if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
    return handleReports({
      account: locals.account ?? null,
      spaceId: params.spaceId,
      method,
      parseBody: () => request.json(),
      fetchSpace: (id) => fetchSpaceById(db, id),
      engine: buildEngine(),
      checkCreate: (orgId) =>
        checkCreationCap(orgId, 'active_reports', {
          enforcementEnabled: env.ENTITLEMENT_ENFORCEMENT === '1',
          resolveEntitlements: (id) => resolveEntitlements(db, id),
          count: (id) => countActiveReportsForOrg(db, id),
        }),
    })
  }

export const GET = route('GET')
export const POST = route('POST')
