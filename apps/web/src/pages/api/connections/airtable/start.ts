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
import { sanitizeReturnTo } from '../../../../lib/airtable/return-to'
import { shouldSetSecureOAuthCookie } from '../../../../lib/oauth/local-dev-secure'

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ locals, request, url }) => {
  if (!locals.user) return jsonError('Not authenticated', 401)
  const account = locals.account
  if (!account?.organization || !account?.space) {
    return jsonError('No active organization or space', 403)
  }

  let returnTo: string | null = null
  try {
    const form = await request.clone().formData()
    returnTo = sanitizeReturnTo(form.get('returnTo'))
  } catch {
    returnTo = null
  }

  const workerEnv = env as unknown as {
    AIRTABLE_OAUTH_CLIENT_ID?: string
    AIRTABLE_OAUTH_CLIENT_SECRET?: string
    BASEOUT_ENCRYPTION_KEY?: string
    AIRTABLE_STUBS_ENABLED?: string
    PUBLIC_AUTH_BASE_URL?: string
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

  // Use PUBLIC_AUTH_BASE_URL (the browser-facing origin) when set, falling
  // back to the request's url.origin. Under `wrangler dev --remote`, url.origin
  // resolves to the deployed worker URL even when the browser is at
  // baseout.local:4331 — sending that as redirect_uri makes the OAuth provider
  // redirect to the deployed worker, where the browser's session + handoff
  // cookies (scoped to baseout.local) don't follow, and the user bounces to
  // /login on the deployed worker. Anchoring on PUBLIC_AUTH_BASE_URL keeps the
  // callback on the origin the browser is actually using.
  const publicOrigin = workerEnv.PUBLIC_AUTH_BASE_URL ?? url.origin
  const redirectUri = getRedirectUri(publicOrigin)
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
      ...(returnTo ? { returnTo } : {}),
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

  const isSecure = shouldSetSecureOAuthCookie(request)
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
