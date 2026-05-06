import type { APIRoute } from 'astro'
import { switchActiveSpace, SpaceError } from '../../../lib/spaces'
import { getAccountContext } from '../../../lib/account'
import { getIntegrationsState } from '../../../lib/integrations'
import {
  extractSessionTokenCookie,
  invalidateSessionCache,
} from '../../../lib/session-cache'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  const orgId = locals.account?.organization?.id
  if (!orgId) {
    return jsonResponse({ error: 'No active organization' }, 403)
  }

  const sessionToken = extractSessionTokenCookie(
    request.headers.get('cookie') ?? '',
  )

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const spaceId = typeof body.spaceId === 'string' ? body.spaceId.trim() : ''
  if (!spaceId) {
    return jsonResponse({ error: 'spaceId is required' }, 400)
  }

  try {
    await switchActiveSpace(locals.db, {
      userId: locals.user.id,
      organizationId: orgId,
      spaceId,
    })
    invalidateSessionCache(sessionToken)

    // Re-load the account and integrations payloads against the new active
    // space. Returning these in the response lets the client update all three
    // hydrated stores ($account, $integrations, $spaces) in a single tick
    // instead of reloading the page.
    const account = await getAccountContext(locals.db, locals.user.id)
    const newSpaceId = account?.space?.id ?? spaceId
    const integrations = await getIntegrationsState(locals.db, orgId, newSpaceId)
    const spaces = {
      list: account?.spaces ?? [],
      activeSpaceId: account?.space?.id ?? null,
    }

    return jsonResponse({ ok: true, account, integrations, spaces }, 200)
  } catch (err) {
    if (err instanceof SpaceError && err.detail.kind === 'forbidden') {
      return jsonResponse({ error: err.detail.message }, 403)
    }
    throw err
  }
}
