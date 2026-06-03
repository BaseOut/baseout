/**
 * Shared local-dev host set + `Secure` attribute decision for OAuth handoff
 * cookies.
 *
 * Companion to the `advanced.useSecureCookies` decision in `auth-factory.ts`,
 * which imports `isLocalDevHost` from here so both cookie surfaces use one
 * host definition. The better-auth knob covers the session/cookieCache
 * cookies; `shouldSetSecureOAuthCookie` below covers our own encrypted
 * handoff cookies (`bo_oauth_<provider>`) used by the Airtable +
 * storage-provider OAuth round-trips.
 *
 * Why: wrangler dev's TLS cert is auto-generated for `localhost` only.
 * The dev script serves at `https://baseout.local:4331` (because Airtable's
 * registered redirect URI is at that host) — Chromium-family browsers
 * special-case `localhost` as a Secure context even with a self-signed cert,
 * but a non-localhost hostname with the same self-signed cert is NOT trusted
 * for Secure-cookie storage. Cookies set with `Secure: true` from
 * `https://baseout.local:4331` get dropped by the browser between page
 * loads — the user returns from the OAuth provider's redirect with no
 * handoff cookie, the callback hits the `missing_handoff` branch, and the
 * connection is silently lost.
 *
 * Fix: when the request host is a recognised local-dev hostname, force
 * `secure: false` on the handoff cookie. Production hosts (anything not in
 * the local-dev set) keep `secure: true` from the https:// protocol.
 */

export const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', 'baseout.local'])

/** True when `hostname` is a recognised local-dev host (no port). */
export function isLocalDevHost(hostname: string): boolean {
  return LOCAL_DEV_HOSTS.has(hostname)
}

export function shouldSetSecureOAuthCookie(request: Request): boolean {
  let url: URL
  try {
    url = new URL(request.url)
  } catch {
    // Unparseable request URL — fail closed (Secure on) so we never
    // accidentally weaken the cookie on a deployed worker that hands us a
    // malformed Request. The local-dev path always has a parseable URL.
    return true
  }
  if (isLocalDevHost(url.hostname)) return false
  return url.protocol === 'https:'
}
