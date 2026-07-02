// Open-redirect guard for the `?returnTo=` param on /login.
//
// The admin console (apps/admin) has no login of its own — it sends staff to
// web's /login with a returnTo back to the admin origin, which we pass to
// better-auth as the magic-link callbackURL. We must only ever round-trip to
// origins we control, or an attacker could craft /login?returnTo=evil.com and
// have a freshly-authenticated user land on a hostile page.
//
// In dev, any baseout.local origin (the canonical dev host, any scheme/port) is
// allowed. In every env, an origin in `allowedOrigins` is allowed (e.g. the
// deployed admin origin). Everything else returns null → caller falls back to
// the default post-login destination.

import { sanitizeReturnTo } from './airtable/return-to'

export interface ReturnToOptions {
  dev: boolean
  allowedOrigins?: string[]
}

export function validateReturnTo(
  raw: string | null | undefined,
  opts: ReturnToOptions,
): string | null {
  if (!raw) return null

  // Same-app relative paths (set by the middleware's /login bounce) are safe
  // in every env — the browser resolves them against the current origin, so
  // they cannot redirect off-site. Reuses the OAuth returnTo sanitizer for
  // one shared definition of "relative app path".
  if (raw.startsWith('/')) {
    return sanitizeReturnTo(raw)
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  if (opts.dev && url.hostname === 'baseout.local') return url.href
  if (opts.allowedOrigins?.includes(url.origin)) return url.href

  return null
}
