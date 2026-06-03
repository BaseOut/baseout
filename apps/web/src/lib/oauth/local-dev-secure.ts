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
 * Why: wrangler dev's TLS cert is the trusted cert that `pnpm setup:certs`
 * provisions via mkcert. The dev script serves at `https://baseout.local:4331`
 * (the canonical local URL — `localhost:4331` is intentionally unsupported,
 * see shared/internal/oauth-setup.md §5.5). Chromium-family browsers do NOT
 * special-case `baseout.local` as a Secure context the way they do
 * `localhost`, so Secure cookies set under `baseout.local` get dropped by
 * the browser between page loads — the user returns from the OAuth
 * provider's redirect with no handoff cookie, the callback hits the
 * `missing_handoff` branch, and the connection is silently lost.
 *
 * Fix: when the request host is `baseout.local`, force `secure: false` on
 * the handoff cookie. Every other host (deployed Workers, prod, and the
 * unsupported `localhost`/`127.0.0.1` fallbacks) keeps `secure: true` from
 * the https:// protocol — landing on those hostnames is a misconfiguration
 * and should fail loudly via Secure-cookie drop, not be papered over here.
 */

export const LOCAL_DEV_HOSTS = new Set(['baseout.local'])

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
