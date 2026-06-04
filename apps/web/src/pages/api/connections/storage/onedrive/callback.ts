/**
 * GET /api/connections/storage/onedrive/callback
 *
 * Consumes the encrypted handoff cookie, completes the OAuth token exchange
 * (PKCE only — no client_secret), looks up (or creates) the
 * `Baseout-<spaceId>` folder under the app's approot, and persists the
 * storage_destinations row. Always redirects back to the originating page
 * with a result query param — never surfaces tokens or detailed errors to
 * the browser.
 *
 * Microsoft specifics:
 *   - Refresh tokens ARE returned on this initial code exchange AND on
 *     every refresh response (rotation). persist.ts overwrites the stored
 *     ciphertext unconditionally on UPSERT.
 *   - `providerFolderId` is the Graph DriveItem `id` (opaque alphanumeric)
 *     of the `Baseout-<spaceId>` folder, NOT a path.
 *   - `oauth_account_email` falls back from `mail` (work/school) to
 *     `userPrincipalName` (personal MSA) since `mail` is null on personal
 *     Microsoft accounts.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { getClientId } from '../../../../../lib/onedrive/config'
import { createOneDriveClient } from '../../../../../lib/onedrive/client'
import {
  buildClearCookie,
  openHandoffPayload,
  readHandoffCookie,
  type OAuthHandoffPayload,
} from '../../../../../lib/onedrive/cookie'
import { exchangeCodeForTokens } from '../../../../../lib/onedrive/oauth'
import { persistOneDriveDestination } from '../../../../../lib/onedrive/persist'
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
    MICROSOFT_OAUTH_CLIENT_ID?: string
    MICROSOFT_REDIRECT_URI?: string
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
  const successUrl = toLocation(appendQuery(returnTo, 'connected', 'onedrive'))

  const msftError = url.searchParams.get('error')
  if (msftError) {
    return redirectWith(failUrl(msftError), clearCookie)
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
    credentials = getClientId(workerEnv)
  } catch {
    return redirectWith(failUrl('not_configured'), clearCookie)
  }

  let tokens
  try {
    tokens = await exchangeCodeForTokens({
      code,
      verifier: handoff.verifier,
      clientId: credentials.clientId,
      redirectUri: handoff.redirectUri,
    })
  } catch {
    return redirectWith(failUrl('token_exchange_failed'), clearCookie)
  }

  // Look up (or create) the per-Space folder + read account identity.
  const odClient = createOneDriveClient({ accessToken: tokens.accessToken })
  const folderName = `Baseout-${handoff.spaceId}`
  let folder
  let me
  try {
    folder = await odClient.ensureBaseoutFolder(folderName)
    me = await odClient.me()
  } catch {
    return redirectWith(failUrl('onedrive_api_failed'), clearCookie)
  }

  try {
    await persistOneDriveDestination(
      locals.db,
      workerEnv.BASEOUT_ENCRYPTION_KEY,
      {
        spaceId: handoff.spaceId,
        userId: handoff.userId,
        tokens,
        // `mail` is the work/school address; null on personal MSA, where
        // `userPrincipalName` carries the email-like login.
        accountEmail: me.mail ?? me.userPrincipalName ?? null,
        accountId: me.id,
        providerFolderId: folder.id,
      },
    )
  } catch {
    return redirectWith(failUrl('persist_failed'), clearCookie)
  }

  return redirectWith(successUrl, clearCookie)
}
