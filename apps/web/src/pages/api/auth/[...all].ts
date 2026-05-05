/**
 * Better Auth API — catch-all route
 *
 * Handles all auth endpoints: sign-up, sign-in, sign-out,
 * session, email verification, etc.
 *
 * `auth` is built per-request by `src/middleware.ts` and attached to
 * `Astro.locals.auth` to satisfy workerd's per-request I/O constraint.
 */

import type { APIRoute } from 'astro'

export const ALL: APIRoute = async ({ request, locals }) => {
  return locals.auth.handler(request)
}
