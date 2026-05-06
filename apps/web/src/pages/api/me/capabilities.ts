/**
 * GET /api/me/capabilities — returns the resolved capabilities for the
 * authenticated user's active organization on the Airtable platform (V1).
 *
 * Spec: openspec/changes/baseout-web-capability-api/specs/web-capability-api/spec.md
 */

import type { APIRoute } from 'astro'
import { getCapabilitiesFor } from '../../../lib/capabilities/enforce'

export const GET: APIRoute = async (ctx) => {
  const result = await getCapabilitiesFor(ctx, 'airtable')
  if (result instanceof Response) return result

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=300',
    },
  })
}
