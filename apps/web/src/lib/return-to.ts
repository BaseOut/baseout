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

// Resolves a raw ?returnTo= into the value /login hands better-auth as the
// magic-link callbackURL (and the signed-in /login bounce target). Three
// shapes come out:
//   - relative app path                → unchanged (browser resolves same-origin)
//   - absolute baseout.local URL (dev) → unchanged (shared-cookie host; admin
//                                        on :4332 reads web's cookie directly)
//   - any other allowlisted origin     → the RELATIVE /api/admin/handoff route
// The wrap exists because web's session cookie is host-only (and workers.dev
// is on the Public Suffix List, so no Domain= cookie can span the two dev
// Workers) — a deployed admin origin can never receive it. The handoff route
// runs same-origin with the fresh cookie and mints a short-lived token that
// carries the session to admin. Relative callbackURLs also mean no better-auth
// trustedOrigins change. See openspec/changes/shared-admin-dev-deploy.
//
// Deliberately parameter-less: the handoff route derives its target from
// ADMIN_APP_URL (the same single-origin allowlist used here). Carrying the
// origin as ?to=<encoded> broke the magic-link round-trip — better-auth's
// verify endpoint decodeURIComponent()s the callbackURL an extra time, and
// its relative-path safety regex then rejects the revealed "https://"
// (INVALID_CALLBACK_URL, 2026-07-13). A bare path survives any decode depth.
export function resolveLoginCallback(
  raw: string | null | undefined,
  opts: ReturnToOptions,
): string | null {
  const validated = validateReturnTo(raw, opts)
  if (!validated) return null
  if (validated.startsWith('/')) return validated

  const url = new URL(validated)
  if (url.hostname === 'baseout.local') return validated
  return '/api/admin/handoff'
}
