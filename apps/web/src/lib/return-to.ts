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

export interface ReturnToOptions {
  dev: boolean
  allowedOrigins?: string[]
}

export function validateReturnTo(
  raw: string | null | undefined,
  opts: ReturnToOptions,
): string | null {
  if (!raw) return null

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
