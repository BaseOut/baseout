/**
 * GET /api/stub/airtable/authorize  (DEV STUB — impersonates airtable.com)
 *
 * Active only when env.AIRTABLE_STUBS_ENABLED === '1'. Skips the real Airtable
 * consent screen: reads the OAuth params our own start.ts handed to the
 * "authorize URL", then 302s straight back to the supplied redirect_uri with
 * a fake `code` and the echoed `state`.
 *
 * TODO(oauth): remove this file when real Airtable OAuth creds are provisioned.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

function randomToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return `${prefix}${hex}`
}

export const GET: APIRoute = ({ url }) => {
  const workerEnv = env as unknown as { AIRTABLE_STUBS_ENABLED?: string }
  if (workerEnv.AIRTABLE_STUBS_ENABLED !== '1') {
    return new Response('Not found', { status: 404 })
  }

  const redirectUri = url.searchParams.get('redirect_uri')
  const state = url.searchParams.get('state')
  if (!redirectUri || !state) {
    return new Response('Missing redirect_uri or state', { status: 400 })
  }

  const dest = new URL(redirectUri)
  dest.searchParams.set('code', randomToken('stub_code_'))
  dest.searchParams.set('state', state)

  return new Response(null, {
    status: 302,
    headers: { Location: dest.toString() },
  })
}
