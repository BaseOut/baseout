/**
 * GET /api/stub/airtable/v0/meta/whoami  (DEV STUB — impersonates the Meta API)
 *
 * Active only when env.AIRTABLE_STUBS_ENABLED === '1'. Requires an
 * Authorization: Bearer <token> header, matching the real API's behaviour.
 *
 * TODO(oauth): remove this file when real Airtable OAuth creds are provisioned.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { AIRTABLE_SCOPES } from '../../../../../../lib/airtable/config'

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
    id: randomId('usrSTUB'),
    scopes: [...AIRTABLE_SCOPES],
    email: 'stub@baseout.dev',
  }
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
