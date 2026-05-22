/**
 * GET /api/connections/storage/dropbox/callback
 *
 * The redirect URI registered with the Dropbox app. Path matches the
 * Console registration — DO NOT change without also updating the App
 * Console.
 *
 * Consumes the encrypted handoff cookie, completes the OAuth token
 * exchange, fetches the user's email via users/get_current_account,
 * ensures `/Apps/Baseout/<spaceId>` exists in their Dropbox, and persists
 * the encrypted tokens + folder path into `storage_destinations`. Always
 * redirects back to a same-origin URL with a result query param — never
 * surfaces tokens or detailed errors to the browser.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { getClientCredentials } from '../../../../../lib/dropbox/config'
import { createDropboxClient } from '../../../../../lib/dropbox/client'
import {
  buildClearCookie,
  openHandoffPayload,
  readHandoffCookie,
  type OAuthHandoffPayload,
} from '../../../../../lib/dropbox/cookie'
import { exchangeCodeForTokens } from '../../../../../lib/dropbox/oauth'
import { persistDropboxDestination } from '../../../../../lib/dropbox/persist'

function appendQuery(path: string, key: string, value: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}${key}=${encodeURIComponent(value)}`
}

/** Trim a thrown Error message to a URL-safe short slug for the `detail`
 *  query param. Lets the user / future Claude diagnose Dropbox API failures
 *  without grepping wrangler logs. The error never carries tokens. */
function detailFor(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'unknown'
  return raw.replaceAll(/\s+/g, '_').slice(0, 80)
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
    DROPBOX_OAUTH_CLIENT_ID?: string
    DROPBOX_OAUTH_CLIENT_SECRET?: string
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
  const successUrl = appendQuery(returnTo, 'connected', 'dropbox')

  const dropboxError = url.searchParams.get('error')
  if (dropboxError) {
    return redirectWith(failUrl(dropboxError), clearCookie)
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

  const dropbox = createDropboxClient({ accessToken: tokens.accessToken })
  let account
  let folder
  try {
    account = await dropbox.getCurrentAccount()
  } catch (err) {
    return redirectWith(
      appendQuery(failUrl('api_call_failed'), 'detail', `account:${detailFor(err)}`),
      clearCookie,
    )
  }
  try {
    folder = await dropbox.ensureBaseoutFolder(handoff.spaceId)
  } catch (err) {
    return redirectWith(
      appendQuery(failUrl('api_call_failed'), 'detail', `folder_create:${detailFor(err)}`),
      clearCookie,
    )
  }

  try {
    await persistDropboxDestination(
      locals.db,
      workerEnv.BASEOUT_ENCRYPTION_KEY,
      {
        userId: handoff.userId,
        spaceId: handoff.spaceId,
        tokens,
        account,
        providerFolderId: folder.path,
      },
    )
  } catch {
    return redirectWith(failUrl('persist_failed'), clearCookie)
  }

  return redirectWith(successUrl, clearCookie)
}
