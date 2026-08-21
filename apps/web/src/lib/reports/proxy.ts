// Reports proxy guard + error mapping (web-reports-page task 2.2).
//
// Auth + IDOR gate for the Reports proxy routes: an authenticated session
// (middleware already 401s unauthenticated /api/*), a valid Space UUID, and the
// Space's org matching the session's active org. Membership is org-scoped (same
// model as the Schema Docs / backup-runs proxies) — a user can't reach a Space
// outside their active org. Tier/creation gating is applied per-route on top.

import type { AccountContext } from '../account'
import { fetchSpaceById, type SpaceRowForDocs } from '../schema-docs/proxy'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Map an engine Reports error code to an HTTP status. */
export function reportsErrorStatus(code: string): number {
  switch (code) {
    case 'unauthorized':
      return 401
    case 'invalid_request':
      return 400
    case 'not_found':
      return 404
    case 'already_running':
      return 409
    case 'default_report_protected':
    case 'limit_reached':
    case 'capability_required':
      return 403
    case 'storage_unavailable':
      return 503
    case 'engine_unreachable':
      return 502
    default:
      return 500
  }
}

export interface ReportsGuardInput {
  account: AccountContext | null
  spaceId: string | undefined
  fetchSpace: (id: string) => Promise<SpaceRowForDocs | null>
}

export type ReportsGuardResult =
  | { ok: true; orgId: string; space: SpaceRowForDocs }
  | { ok: false; response: Response }

export async function guardReportsRequest(
  input: ReportsGuardInput,
): Promise<ReportsGuardResult> {
  if (!input.account?.organization?.id) {
    return { ok: false, response: jsonResponse({ error: 'unauthorized' }, 401) }
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return { ok: false, response: jsonResponse({ error: 'invalid_request' }, 400) }
  }
  const space = await input.fetchSpace(input.spaceId)
  if (!space) {
    return { ok: false, response: jsonResponse({ error: 'not_found' }, 404) }
  }
  if (space.organizationId !== input.account.organization.id) {
    return { ok: false, response: jsonResponse({ error: 'space_org_mismatch' }, 403) }
  }
  return { ok: true, orgId: space.organizationId, space }
}

export { fetchSpaceById }
