/**
 * GET /api/stub/airtable/v0/meta/bases  (DEV STUB — impersonates the Meta API)
 *
 * Active only when env.AIRTABLE_STUBS_ENABLED === '1'. Returns two fake bases
 * with distinct random IDs per call so a reconnect does not collapse them via
 * the at_bases (spaceId, atBaseId) upsert.
 *
 * TODO(oauth): remove this file when real Airtable OAuth creds are provisioned.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

function randomId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return `${prefix}${hex}`
}

export const GET: APIRoute = ({ request }) => {
  const workerEnv = env as unknown as { AIRTABLE_STUBS_ENABLED?: string }
  if (workerEnv.AIRTABLE_STUBS_ENABLED !== '1') {
    return new Response('Not found', { status: 404 })
  }

  const authHeader = request.headers.get('authorization') ?? ''
  if (!/^bearer\s+/i.test(authHeader)) {
    return new Response(
      JSON.stringify({ error: 'AUTHENTICATION_REQUIRED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const payload = {
    bases: [
      {
        id: randomId('appSTUB'),
        name: 'Marketing CRM',
        permissionLevel: 'create',
      },
      {
        id: randomId('appSTUB'),
        name: 'Project Tracker',
        permissionLevel: 'edit',
      },
    ],
  }
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
