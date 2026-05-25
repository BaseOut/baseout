/**
 * GET /api/connections/storage/google-drive/callback
 *
 * Consumes the encrypted handoff cookie, completes the OAuth token exchange,
 * looks up (or creates) the Baseout-<spaceId> folder via Drive v3, and
 * persists the storage_destinations row. Always redirects back to the
 * originating page with a result query param — never surfaces tokens or
 * detailed errors to the browser.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { getClientCredentials } from '../../../../../lib/google-drive/config'
import { createGoogleDriveClient } from '../../../../../lib/google-drive/client'
import {
  buildClearCookie,
  openHandoffPayload,
  readHandoffCookie,
  type OAuthHandoffPayload,
} from '../../../../../lib/google-drive/cookie'
import { exchangeCodeForTokens } from '../../../../../lib/google-drive/oauth'
import { persistDriveDestination } from '../../../../../lib/google-drive/persist'
import { sanitizeReturnTo } from '../../../../../lib/airtable/return-to'

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
  const isSecure = url.protocol === 'https:'
  const clearCookie = buildClearCookie({ secure: isSecure })

  const workerEnv = env as unknown as {
    GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string
    GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string
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
  const returnTo = sanitizeReturnTo(handoff?.returnTo) ?? '/backups'
  const failUrl = (code: string) => appendQuery(returnTo, 'storage_error', code)
  const successUrl = appendQuery(returnTo, 'connected', 'google_drive')

  const driveError = url.searchParams.get('error')
  if (driveError) {
    return redirectWith(failUrl(driveError), clearCookie)
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

  // Look up (or create) the per-Space folder + read account email.
  const driveClient = createGoogleDriveClient({
    accessToken: tokens.accessToken,
  })
  const folderName = `Baseout-${handoff.spaceId}`
  let folder
  let about
  try {
    folder = await driveClient.ensureBaseoutFolder(folderName)
    about = await driveClient.about()
  } catch {
    return redirectWith(failUrl('drive_api_failed'), clearCookie)
  }

  try {
    await persistDriveDestination(locals.db, workerEnv.BASEOUT_ENCRYPTION_KEY, {
      spaceId: handoff.spaceId,
      userId: handoff.userId,
      tokens,
      accountEmail: about.user.emailAddress,
      accountId: about.user.permissionId,
      providerFolderId: folder.id,
    })
  } catch {
    return redirectWith(failUrl('persist_failed'), clearCookie)
  }

  return redirectWith(successUrl, clearCookie)
}
