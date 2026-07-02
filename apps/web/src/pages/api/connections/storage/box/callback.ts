/**
 * GET /api/connections/storage/box/callback
 *
 * Consumes the encrypted handoff cookie, completes the OAuth token exchange,
 * looks up (or creates) the Baseout-<spaceId> folder at the Box account root,
 * and persists the storage_destinations row. Always redirects back to the
 * originating page with a result query param — never surfaces tokens or
 * detailed errors to the browser.
 *
 * Box vs. Drive: the persist path encrypts BOTH access and refresh tokens
 * unconditionally. Box rotates the refresh token on every code exchange and
 * every refresh, so we never preserve a prior refresh-token value.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { getClientCredentials } from '../../../../../lib/box/config'
import { createBoxClient } from '../../../../../lib/box/client'
import {
  buildClearCookie,
  openHandoffPayload,
  readHandoffCookie,
  type OAuthHandoffPayload,
} from '../../../../../lib/box/cookie'
import { exchangeCodeForTokens } from '../../../../../lib/box/oauth'
import { persistBoxDestination } from '../../../../../lib/box/persist'
import { sanitizeReturnTo } from '../../../../../lib/airtable/return-to'
import { shouldSetSecureOAuthCookie } from '../../../../../lib/oauth/local-dev-secure'
import { resolvePostOAuthReturnLocation } from '../../../../../lib/oauth/canonical-dev-origin'

function appendQuery(path: string, key: string, value: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}${key}=${encodeURIComponent(value)}`
}

function redirectWith(
  location: string,
  clearCookieValue: string,
): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Set-Cookie': clearCookieValue,
    },
  })
}

export const GET: APIRoute = async ({ locals, request, url }) => {
  const isSecure = shouldSetSecureOAuthCookie(request)
  const clearCookie = buildClearCookie({ secure: isSecure })

  const workerEnv = env as unknown as {
    BOX_OAUTH_CLIENT_ID?: string
    BOX_OAUTH_CLIENT_SECRET?: string
    BASEOUT_ENCRYPTION_KEY?: string
    PUBLIC_AUTH_BASE_URL?: string
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
  const returnTo = sanitizeReturnTo(handoff?.returnTo) ?? '/backups'
  const toLocation = (path: string) =>
    resolvePostOAuthReturnLocation(path, workerEnv.PUBLIC_AUTH_BASE_URL)
  const failUrl = (code: string) =>
    toLocation(appendQuery(returnTo, 'storage_error', code))
  const successUrl = toLocation(appendQuery(returnTo, 'connected', 'box'))

  const boxError = url.searchParams.get('error')
  if (boxError) {
    return redirectWith(failUrl(boxError), clearCookie)
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

  // Look up (or create) the per-Space folder + read account identity.
  const boxClient = createBoxClient({ accessToken: tokens.accessToken })
  const folderName = `Baseout-${handoff.spaceId}`
  let folder
  let me
  try {
    folder = await boxClient.ensureBaseoutFolder(folderName)
    me = await boxClient.getCurrentUser()
  } catch {
    return redirectWith(failUrl('box_api_failed'), clearCookie)
  }

  try {
    await persistBoxDestination(locals.db, workerEnv.BASEOUT_ENCRYPTION_KEY, {
      spaceId: handoff.spaceId,
      userId: handoff.userId,
      tokens,
      accountEmail: me.login,
      accountId: me.id,
      providerFolderId: folder.id,
    })
  } catch {
    return redirectWith(failUrl('persist_failed'), clearCookie)
  }

  return redirectWith(successUrl, clearCookie)
}
