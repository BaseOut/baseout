/**
 * POST /api/auth/sign-out — clears the console's session cookies and lands on
 * /auth/sign-in. Middleware-exempt (an expired user must still be able to
 * sign out; see gate.ts).
 *
 * Cookies only — admin never mutates `sessions` rows (see lib/sign-out.ts for
 * the per-environment semantics). CSRF: same-origin check on the Origin
 * header, which browsers always send on same-origin form POSTs.
 */

import type { APIRoute } from 'astro'
import { checkOrigin } from '../../../lib/origin'
import { json, methodNotAllowed } from '../../../lib/actions/http'
import { signOutCookieHeaders } from '../../../lib/sign-out'

export const POST: APIRoute = ({ request, url }) => {
  if (!checkOrigin(request.headers.get('origin'), url.origin)) {
    return json(403, { error: 'bad_origin' })
  }

  const headers = new Headers({
    Location: '/auth/sign-in?reason=signed-out',
    'Cache-Control': 'no-store',
  })
  for (const cookie of signOutCookieHeaders(url.protocol === 'https:')) {
    headers.append('Set-Cookie', cookie)
  }
  return new Response(null, { status: 303, headers })
}

export const GET: APIRoute = () => methodNotAllowed()
export const PUT: APIRoute = () => methodNotAllowed()
export const PATCH: APIRoute = () => methodNotAllowed()
export const DELETE: APIRoute = () => methodNotAllowed()
