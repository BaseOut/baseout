/**
 * POST /api/connections/storage/onedrive/authorize
 *
 * Begins the OneDrive OAuth authorization flow:
 *   - verifies the caller has an active organization + space
 *   - generates PKCE verifier + OAuth state
 *   - seals both into an encrypted HttpOnly cookie (consumed by /callback)
 *   - 302s the browser to Microsoft's consent screen
 *
 * Public-client PKCE only — no MICROSOFT_OAUTH_CLIENT_SECRET is read or
 * required. Mirrors the shape of /api/connections/storage/dropbox/authorize
 * with the client-id-only credential resolver.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  getClientId,
  getRedirectUri,
} from '../../../../../lib/onedrive/config'
import {
  buildAuthorizeUrl,
  generatePkcePair,
  generateState,
} from '../../../../../lib/onedrive/oauth'
import {
  buildSetCookie,
  sealHandoffPayload,
} from '../../../../../lib/onedrive/cookie'
import { sanitizeReturnTo } from '../../../../../lib/airtable/return-to'
import { shouldSetSecureOAuthCookie } from '../../../../../lib/oauth/local-dev-secure'

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
    MICROSOFT_OAUTH_CLIENT_ID?: string
    MICROSOFT_REDIRECT_URI?: string
    BASEOUT_ENCRYPTION_KEY?: string
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
    credentials = getClientId(workerEnv)
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : 'OAuth is not configured',
      503,
    )
  }

  // See note in airtable/start.ts. url.origin resolves to the deployed worker
  // under `wrangler dev --remote`; anchoring on PUBLIC_AUTH_BASE_URL keeps the
  // OAuth provider's redirect on the browser-facing origin. The MICROSOFT_REDIRECT_URI
  // override (used as a per-provider workaround when the registered set lags) still
  // wins inside getRedirectUri().
  const publicOrigin = workerEnv.PUBLIC_AUTH_BASE_URL ?? url.origin
  const redirectUri = getRedirectUri(publicOrigin, workerEnv)
  const { verifier, challenge } = await generatePkcePair()
  const state = generateState()

  const cookieValue = await sealHandoffPayload(
    {
      verifier,
      state,
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
    state,
    challenge,
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
