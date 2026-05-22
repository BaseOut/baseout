/**
 * POST /api/connections/storage/dropbox/authorize
 *
 * Begins the Dropbox OAuth authorization flow:
 *   - verifies the caller has an active organization + space
 *   - generates PKCE verifier + OAuth state
 *   - seals both into an encrypted HttpOnly cookie (consumed by the callback)
 *   - 302s the browser to Dropbox's consent screen
 *
 * Callback lands at GET /api/connections/storage/dropbox/callback (the URI
 * the Dropbox OAuth app is registered with). The cookie is scoped to
 * `/api/connections/storage/dropbox` so the browser delivers it to that
 * path; the cookie is HttpOnly so client JS can't read it.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  DROPBOX_SCOPES,
  getClientCredentials,
  getRedirectUri,
} from '../../../../../lib/dropbox/config'
import {
  buildAuthorizeUrl,
  generatePkcePair,
  generateState,
} from '../../../../../lib/dropbox/oauth'
import {
  buildSetCookie,
  sealHandoffPayload,
} from '../../../../../lib/dropbox/cookie'

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sanitizeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  if (value.length > 256) return null
  return value
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
    DROPBOX_OAUTH_CLIENT_ID?: string
    DROPBOX_OAUTH_CLIENT_SECRET?: string
    BASEOUT_ENCRYPTION_KEY?: string
    PUBLIC_AUTH_BASE_URL?: string
  }

  if (!workerEnv.BASEOUT_ENCRYPTION_KEY) {
    return jsonError('Encryption key is not configured. Contact support.', 503)
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

  const redirectUri = getRedirectUri(url.origin, workerEnv)
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
    scopes: DROPBOX_SCOPES,
    state,
    challenge,
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
