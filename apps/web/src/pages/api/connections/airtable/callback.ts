/**
 * GET /api/connections/airtable/callback
 *
 * Consumes the encrypted handoff cookie, completes the OAuth token exchange,
 * calls Airtable's Meta API to populate whoami + bases, and persists the
 * connection + bases. First-time connects land in /integrations/configure
 * (?first=1); everything else redirects back to returnTo with a result query
 * param — never surfaces tokens or detailed errors to the browser.
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
  type OAuthHandoffPayload,
} from '../../../../lib/airtable/cookie'
import { exchangeCodeForTokens } from '../../../../lib/airtable/oauth'
import { persistAirtableConnection } from '../../../../lib/airtable/persist'
import { sanitizeReturnTo } from '../../../../lib/airtable/return-to'
import {
  appendQuery,
  resolveSuccessRedirect,
} from '../../../../lib/airtable/success-redirect'
import { shouldSetSecureOAuthCookie } from '../../../../lib/oauth/local-dev-secure'
import { resolvePostOAuthReturnLocation } from '../../../../lib/oauth/canonical-dev-origin'
import { backupConfigurations } from '../../../../db/schema'
import { eq } from 'drizzle-orm'

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
    AIRTABLE_OAUTH_CLIENT_ID?: string
    AIRTABLE_OAUTH_CLIENT_SECRET?: string
    BASEOUT_ENCRYPTION_KEY?: string
    AIRTABLE_STUBS_ENABLED?: string
    PUBLIC_AUTH_BASE_URL?: string
  }

  // Open the handoff cookie up front so error redirects can land on the
  // originating page (returnTo) when we have one. If the cookie is missing
  // or won't decrypt we fall through to the default redirect target.
  const sealed = readHandoffCookie(request.headers.get('cookie'))
  let handoff: OAuthHandoffPayload | null = null
  if (sealed && workerEnv.BASEOUT_ENCRYPTION_KEY) {
    try {
      handoff = await openHandoffPayload(sealed, workerEnv.BASEOUT_ENCRYPTION_KEY)
    } catch {
      handoff = null
    }
  }
  const returnTo = sanitizeReturnTo(handoff?.returnTo) ?? '/'
  const toLocation = (path: string) =>
    resolvePostOAuthReturnLocation(path, workerEnv.PUBLIC_AUTH_BASE_URL)
  const failUrl = (code: string) =>
    toLocation(appendQuery(returnTo, 'error', code))

  const airtableError = url.searchParams.get('error')
  if (airtableError) {
    return redirectWith(failUrl(airtableError), clearCookie)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return redirectWith(failUrl('missing_code'), clearCookie)
  }

  if (!workerEnv.BASEOUT_ENCRYPTION_KEY) {
    return redirectWith(failUrl('not_configured'), clearCookie)
  }

  const { tokenUrl, apiBase } = resolveAirtableUrls(workerEnv, url.origin)

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

  // First-time connect (no backup configuration for this Space yet) lands in
  // Configure setup; a failed lookup falls back to the returning-user
  // redirect rather than failing a flow whose connection already persisted.
  let hasBackupConfig = true
  try {
    const rows = await locals.db
      .select({ id: backupConfigurations.id })
      .from(backupConfigurations)
      .where(eq(backupConfigurations.spaceId, handoff.spaceId))
      .limit(1)
    hasBackupConfig = rows.length > 0
  } catch {
    hasBackupConfig = true
  }

  return redirectWith(
    toLocation(resolveSuccessRedirect({ returnTo, hasBackupConfig })),
    clearCookie,
  )
}
