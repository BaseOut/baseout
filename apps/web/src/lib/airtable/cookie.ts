/**
 * Encrypted HttpOnly cookie carrying the Airtable OAuth handoff payload.
 *
 * Thin shim over lib/oauth/cookie (the provider-agnostic implementation
 * extracted per shared-byos-drive-dropbox design.md §C.3.0). Binds the
 * Airtable-specific cookie name + path and re-exports the shared seal /
 * open / read helpers. Call-site imports under
 * apps/web/src/pages/api/connections/airtable/ stay unchanged.
 */

import {
  buildClearCookie as sharedBuildClearCookie,
  buildSetCookie as sharedBuildSetCookie,
  readHandoffCookie as sharedReadHandoffCookie,
  type CookieAttrs,
  type CookieConfig,
  type OAuthHandoffPayload,
} from '../oauth/cookie'

export { openHandoffPayload, sealHandoffPayload } from '../oauth/cookie'
export type { CookieAttrs, OAuthHandoffPayload }

export const AIRTABLE_OAUTH_COOKIE = 'bo_oauth_airtable'
export const AIRTABLE_OAUTH_COOKIE_PATH = '/api/connections/airtable'

const CONFIG: CookieConfig = {
  name: AIRTABLE_OAUTH_COOKIE,
  path: AIRTABLE_OAUTH_COOKIE_PATH,
}

export function buildSetCookie(value: string, attrs?: CookieAttrs): string {
  return sharedBuildSetCookie(CONFIG, value, attrs)
}

export function buildClearCookie(attrs: { secure: boolean }): string {
  return sharedBuildClearCookie(CONFIG, attrs)
}

export function readHandoffCookie(cookieHeader: string | null): string | null {
  return sharedReadHandoffCookie(CONFIG, cookieHeader)
}
