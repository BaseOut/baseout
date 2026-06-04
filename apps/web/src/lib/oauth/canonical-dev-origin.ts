/**
 * Local dev uses `https://baseout.local:4331` as the single browser origin
 * (see shared/internal/oauth-setup.md §5.5). wrangler still binds `localhost`,
 * and legacy `MICROSOFT_REDIRECT_URI` / Azure registrations may send OAuth
 * callbacks to `localhost:4331`. Cookies (session + handoff) are host-scoped
 * to `baseout.local`, so staying on localhost after OAuth looks like a
 * forced re-login.
 */

const LOCALHOST_TRAP_HOSTS = new Set(['localhost', '127.0.0.1'])
const CANONICAL_LOCAL_DEV_HOST = 'baseout.local'
const CANONICAL_LOCAL_DEV_PORT = '4331'

/** Dev-only: rewrite `localhost:4331` (or `127.0.0.1:4331`) to `baseout.local:4331`. */
export function rewriteLocalhostTrapUrl(url: URL): URL | null {
  if (!import.meta.env.DEV) return null
  if (!LOCALHOST_TRAP_HOSTS.has(url.hostname)) return null
  if (url.port !== CANONICAL_LOCAL_DEV_PORT) return null
  const rewritten = new URL(url.href)
  rewritten.hostname = CANONICAL_LOCAL_DEV_HOST
  return rewritten
}

/**
 * Build the post-OAuth browser redirect. When `PUBLIC_AUTH_BASE_URL` is set,
 * return an absolute URL on the canonical origin so a callback that landed on
 * the wrong host (localhost trap) still sends the user back to baseout.local.
 */
export function resolvePostOAuthReturnLocation(
  relativePath: string,
  publicAuthBaseUrl?: string,
): string {
  const base = publicAuthBaseUrl?.trim().replace(/\/$/, '')
  if (!base) return relativePath
  try {
    return new URL(relativePath, `${base}/`).href
  } catch {
    return relativePath
  }
}
