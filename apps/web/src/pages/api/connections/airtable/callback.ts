/**
 * GET /api/connections/airtable/callback
 *
 * Consumes the encrypted handoff cookie, completes the OAuth token exchange,
 * calls Airtable's Meta API to populate whoami + bases, and persists the
 * connection + bases. Always redirects back to /integrations with a result
 * query param — never surfaces tokens or detailed errors to the browser.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  getClientCredentials,
  resolveAirtableUrls,
} from '../../../../lib/airtable/config'
import {
  createAirtableClient,
} from '../../../../lib/airtable/client'
import {
  buildClearCookie,
  openHandoffPayload,
  readHandoffCookie,
} from '../../../../lib/airtable/cookie'
import { exchangeCodeForTokens } from '../../../../lib/airtable/oauth'
import { persistAirtableConnection } from '../../../../lib/airtable/persist'

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
  const failUrl = (code: string) => `/?error=${encodeURIComponent(code)}`

  const airtableError = url.searchParams.get('error')
  if (airtableError) {
    return redirectWith(failUrl(airtableError), clearCookie)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return redirectWith(failUrl('missing_code'), clearCookie)
  }

  const workerEnv = env as unknown as {
    AIRTABLE_OAUTH_CLIENT_ID?: string
    AIRTABLE_OAUTH_CLIENT_SECRET?: string
    BASEOUT_ENCRYPTION_KEY?: string
    AIRTABLE_STUBS_ENABLED?: string
  }
  if (!workerEnv.BASEOUT_ENCRYPTION_KEY) {
    return redirectWith(failUrl('not_configured'), clearCookie)
  }

  const { tokenUrl, apiBase } = resolveAirtableUrls(workerEnv, url.origin)

  const sealed = readHandoffCookie(request.headers.get('cookie'))
  if (!sealed) {
    return redirectWith(failUrl('missing_handoff'), clearCookie)
  }

  let handoff
  try {
    handoff = await openHandoffPayload(sealed, workerEnv.BASEOUT_ENCRYPTION_KEY)
  } catch {
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
      tokenUrl,
    })
  } catch {
    return redirectWith(failUrl('token_exchange_failed'), clearCookie)
  }

  const airtable = createAirtableClient({
    accessToken: tokens.accessToken,
    apiBase,
  })
  let whoami
  let bases
  try {
    whoami = await airtable.whoami()
    bases = await airtable.listBases()
  } catch {
    return redirectWith(failUrl('api_call_failed'), clearCookie)
  }

  try {
    await persistAirtableConnection(locals.db, workerEnv.BASEOUT_ENCRYPTION_KEY, {
      userId: handoff.userId,
      organizationId: handoff.organizationId,
      spaceId: handoff.spaceId,
      tokens,
      whoami,
      bases,
    })
  } catch {
    return redirectWith(failUrl('persist_failed'), clearCookie)
  }

  return redirectWith('/?connected=1', clearCookie)
}
