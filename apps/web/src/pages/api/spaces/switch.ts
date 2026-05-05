import type { APIRoute } from 'astro'
import { switchActiveSpace, SpaceError } from '../../../lib/spaces'
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
    return jsonResponse({ ok: true }, 200)
  } catch (err) {
    if (err instanceof SpaceError && err.detail.kind === 'forbidden') {
      return jsonResponse({ error: err.detail.message }, 403)
    }
    throw err
  }
}
