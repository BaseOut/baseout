/**
 * GET /oauth/callback/google
 *
 * The redirect URI registered in Google Cloud Console for the `baseout-dev`
 * OAuth app. Path is chosen to match the registration — DO NOT change
 * without also updating the Console.
 *
 * Consumes the encrypted handoff cookie, completes the OAuth token exchange,
 * fetches the user's email via userinfo, creates a `Baseout-<spaceId>` folder
 * in their Drive, and persists the encrypted tokens + folder ID into
 * `storage_destinations`. Always redirects back to a same-origin URL with a
 * result query param — never surfaces tokens or detailed errors to the
 * browser.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  getClientCredentials,
} from '../../../lib/google-drive/config'
import {
  createGoogleDriveClient,
} from '../../../lib/google-drive/client'
import {
  buildClearCookie,
  openHandoffPayload,
  readHandoffCookie,
  type OAuthHandoffPayload,
} from '../../../lib/google-drive/cookie'
import { exchangeCodeForTokens } from '../../../lib/google-drive/oauth'
import { persistGoogleDriveDestination } from '../../../lib/google-drive/persist'

function appendQuery(path: string, key: string, value: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}${key}=${encodeURIComponent(value)}`
}

function redirectWith(location: string, clearCookieValue: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Set-Cookie': clearCookieValue,
    },
  })
}

function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  if (value.length > 256) return null
  return value
}

export const GET: APIRoute = async ({ locals, request, url }) => {
  const isSecure = url.protocol === 'https:'
  const clearCookie = buildClearCookie({ secure: isSecure })

  const workerEnv = env as unknown as {
    GOOGLE_OAUTH_CLIENT_ID?: string
    GOOGLE_OAUTH_CLIENT_SECRET?: string
    BASEOUT_ENCRYPTION_KEY?: string
  }

  const sealed = readHandoffCookie(request.headers.get('cookie'))
  let handoff: OAuthHandoffPayload | null = null
  if (sealed && workerEnv.BASEOUT_ENCRYPTION_KEY) {
    try {
      handoff = await openHandoffPayload(sealed, workerEnv.BASEOUT_ENCRYPTION_KEY)
    } catch {
      handoff = null
    }
  }
  const returnTo = sanitizeReturnTo(handoff?.returnTo) ?? '/integrations'
  const failUrl = (code: string) => appendQuery(returnTo, 'error', code)
  const successUrl = appendQuery(returnTo, 'connected', 'google-drive')

  const googleError = url.searchParams.get('error')
  if (googleError) {
    return redirectWith(failUrl(googleError), clearCookie)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return redirectWith(failUrl('missing_code'), clearCookie)
  }

  if (!workerEnv.BASEOUT_ENCRYPTION_KEY) {
    return redirectWith(failUrl('not_configured'), clearCookie)
  }

  if (!sealed) {
    return redirectWith(failUrl('missing_handoff'), clearCookie)
  }
  if (!handoff) {
    return redirectWith(failUrl('invalid_handoff'), clearCookie)
  }
  if (handoff.state !== state) {
    return redirectWith(failUrl('state_mismatch'), clearCookie)
  }
  if (locals.user && locals.user.id !== handoff.userId) {
    return redirectWith(failUrl('user_mismatch'), clearCookie)
  }

  let credentials
  try {
    credentials = getClientCredentials(workerEnv)
  } catch {
    return redirectWith(failUrl('not_configured'), clearCookie)
  }

  let tokens
  try {
    tokens = await exchangeCodeForTokens({
      code,
      verifier: handoff.verifier,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      redirectUri: handoff.redirectUri,
    })
  } catch {
    return redirectWith(failUrl('token_exchange_failed'), clearCookie)
  }

  const drive = createGoogleDriveClient({ accessToken: tokens.accessToken })
  let userinfo
  let folder
  try {
    userinfo = await drive.getUserInfo()
    folder = await drive.createBaseoutFolder(handoff.spaceId)
  } catch {
    return redirectWith(failUrl('api_call_failed'), clearCookie)
  }

  try {
    await persistGoogleDriveDestination(
      locals.db,
      workerEnv.BASEOUT_ENCRYPTION_KEY,
      {
        userId: handoff.userId,
        spaceId: handoff.spaceId,
        tokens,
        userinfo,
        providerFolderId: folder.id,
      },
    )
  } catch {
    return redirectWith(failUrl('persist_failed'), clearCookie)
  }

  return redirectWith(successUrl, clearCookie)
}
