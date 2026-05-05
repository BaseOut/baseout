/**
 * POST /api/connections/airtable/start
 *
 * Begins the Airtable OAuth authorization flow:
 *   - verifies the caller has an active organization + space
 *   - generates PKCE verifier + OAuth state
 *   - seals both into an encrypted HttpOnly cookie (consumed by /callback)
 *   - 302s the browser to Airtable's consent screen
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  AIRTABLE_SCOPES,
  getClientCredentials,
  getRedirectUri,
  resolveAirtableUrls,
} from '../../../../lib/airtable/config'
import {
  buildAuthorizeUrl,
  generatePkcePair,
  generateState,
} from '../../../../lib/airtable/oauth'
import {
  buildSetCookie,
  sealHandoffPayload,
} from '../../../../lib/airtable/cookie'

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ locals, url }) => {
  if (!locals.user) return jsonError('Not authenticated', 401)
  const account = locals.account
  if (!account?.organization || !account?.space) {
    return jsonError('No active organization or space', 403)
  }

  const workerEnv = env as unknown as {
    AIRTABLE_OAUTH_CLIENT_ID?: string
    AIRTABLE_OAUTH_CLIENT_SECRET?: string
    BASEOUT_ENCRYPTION_KEY?: string
    AIRTABLE_STUBS_ENABLED?: string
  }

  if (!workerEnv.BASEOUT_ENCRYPTION_KEY) {
    return jsonError(
      'Encryption key is not configured. Contact support.',
      503,
    )
  }

  let credentials
  try {
    credentials = getClientCredentials(workerEnv)
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : 'OAuth is not configured',
      503,
    )
  }

  const redirectUri = getRedirectUri(url.origin)
  const { authorizeUrl } = resolveAirtableUrls(workerEnv, url.origin)
  const { verifier, challenge } = await generatePkcePair()
  const state = generateState()

  const cookieValue = await sealHandoffPayload(
    {
      verifier,
      state,
      organizationId: account.organization.id,
      spaceId: account.space.id,
      userId: locals.user.id,
      redirectUri,
    },
    workerEnv.BASEOUT_ENCRYPTION_KEY,
  )

  const targetUrl = buildAuthorizeUrl({
    clientId: credentials.clientId,
    redirectUri,
    scopes: AIRTABLE_SCOPES,
    state,
    challenge,
    authorizeUrl,
  })

  const isSecure = url.protocol === 'https:'
  return new Response(null, {
    status: 302,
    headers: {
      Location: targetUrl,
      'Set-Cookie': buildSetCookie(cookieValue, {
        secure: isSecure,
        maxAgeSeconds: 600,
      }),
    },
  })
}
