/**
 * GET /api/me — returns the authenticated user's account context.
 *
 * Client-side fallback for when server props aren't available.
 * The middleware already populates `locals.account` from the session cookie.
 */

import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.account) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(locals.account), {
    headers: { 'Content-Type': 'application/json' },
  })
}
