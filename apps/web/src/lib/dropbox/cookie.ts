/**
 * Encrypted HttpOnly cookie carrying the Dropbox OAuth handoff payload.
 *
 * Thin shim over lib/oauth/cookie (the provider-agnostic implementation
 * extracted per shared-byos-drive-dropbox design.md §C.3.0). Binds the
 * Dropbox-specific cookie name + path and re-exports the shared seal /
 * open / read helpers. Both the authorize POST and the callback GET live
 * under `/api/connections/storage/dropbox/`, so the cookie is scoped to
 * that path.
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

export const DROPBOX_OAUTH_COOKIE = 'bo_oauth_dropbox'
export const DROPBOX_OAUTH_COOKIE_PATH = '/api/connections/storage/dropbox'

const CONFIG: CookieConfig = {
  name: DROPBOX_OAUTH_COOKIE,
  path: DROPBOX_OAUTH_COOKIE_PATH,
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
