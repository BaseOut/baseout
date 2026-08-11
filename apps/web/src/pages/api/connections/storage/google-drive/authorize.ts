/**
 * POST /api/connections/storage/google-drive/authorize
 *
 * Begins the Google Drive OAuth authorization flow:
 *   - verifies the caller has an active organization + space
 *   - generates PKCE verifier + OAuth state
 *   - seals both into an encrypted HttpOnly cookie (consumed by /callback)
 *   - 302s the browser to Google's consent screen
 *
 * Mirrors the shape of /api/connections/airtable/start.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  GOOGLE_DRIVE_SCOPES,
  getClientCredentials,
  getRedirectUri,
} from '../../../../../lib/google-drive/config'
import {
  buildAuthorizeUrl,
  generatePkcePair,
  generateState,
} from '../../../../../lib/google-drive/oauth'
import {
  buildSetCookie,
  sealHandoffPayload,
} from '../../../../../lib/google-drive/cookie'
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
    GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string
    GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string
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
    credentials = getClientCredentials(workerEnv)
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : 'OAuth is not configured',
      503,
    )
  }

  // See note in airtable/start.ts. url.origin resolves to the deployed worker
  // under `wrangler dev --remote`; anchoring on PUBLIC_AUTH_BASE_URL keeps the
  // OAuth provider's redirect on the browser-facing origin.
  const publicOrigin = workerEnv.PUBLIC_AUTH_BASE_URL ?? url.origin
  const redirectUri = getRedirectUri(publicOrigin)
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
    scopes: GOOGLE_DRIVE_SCOPES,
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
