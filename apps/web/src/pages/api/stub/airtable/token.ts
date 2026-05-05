/**
 * POST /api/stub/airtable/token  (DEV STUB — impersonates airtable.com token endpoint)
 *
 * Active only when env.AIRTABLE_STUBS_ENABLED === '1'. Accepts the same
 * form-encoded body shape Airtable's token endpoint does:
 *   grant_type=authorization_code + code + code_verifier + redirect_uri
 *   grant_type=refresh_token + refresh_token
 * Ignores credentials + code correctness — returns fresh fake tokens.
 *
 * TODO(oauth): remove this file when real Airtable OAuth creds are provisioned.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { AIRTABLE_SCOPES } from '../../../../lib/airtable/config'

function randomToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return `${prefix}${hex}`
}

export const POST: APIRoute = async ({ request }) => {
  const workerEnv = env as unknown as { AIRTABLE_STUBS_ENABLED?: string }
  if (workerEnv.AIRTABLE_STUBS_ENABLED !== '1') {
    return new Response('Not found', { status: 404 })
  }

  const body = new URLSearchParams(await request.text())
  const grantType = body.get('grant_type')
  if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
    return new Response(
      JSON.stringify({ error: 'unsupported_grant_type' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const payload = {
    access_token: randomToken('stub_at_'),
    refresh_token: randomToken('stub_rt_'),
    expires_in: 3600,
    scope: AIRTABLE_SCOPES.join(' '),
    token_type: 'Bearer',
  }
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
