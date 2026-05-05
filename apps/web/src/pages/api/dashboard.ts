import type { APIRoute } from 'astro'
import { buildDashboardModel } from '../../lib/dashboard'
import { getIntegrationsState } from '../../lib/integrations'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return jsonResponse({ error: 'Not authenticated' }, 401)

  const account = locals.account
  const orgId = account?.organization?.id ?? null
  const spaceId = account?.space?.id ?? null

  const integrations =
    orgId && spaceId
      ? await getIntegrationsState(locals.db, orgId, spaceId)
      : { connections: [], bases: [] }

  const model = buildDashboardModel(account)
  const hasAirtableConnection = integrations.connections.some(
    (c) => c.platformSlug === 'airtable' && c.status === 'active',
  )

  return jsonResponse({ model, hasAirtableConnection }, 200)
}
