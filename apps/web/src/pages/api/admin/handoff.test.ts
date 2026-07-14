/**
 * Tests for handleAdminHandoff — the login → staff-console session handoff
 * (openspec/changes/shared-admin-dev-deploy). The token itself is round-trip
 * verified with decryptToken to pin the payload shape admin's
 * src/lib/handoff.ts depends on. The target is always ADMIN_APP_URL — there
 * is no ?to= param (better-auth double-decodes the magic-link callbackURL, so
 * an embedded encoded origin fails its INVALID_CALLBACK_URL check).
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))
const { handleAdminHandoff, HANDOFF_TTL_MS } = await import('./handoff')

import { decryptToken, generateEncryptionKey } from '../../../lib/crypto'

const ADMIN_ORIGIN = 'https://baseout-admin-dev.openside.workers.dev'
const SECRET = generateEncryptionKey()
const NOW = new Date('2026-07-13T12:00:00Z')

const base = {
  adminAppUrl: ADMIN_ORIGIN,
  secret: SECRET,
  sessionCookieValue: 'tok123.sig456',
  fetchRole: vi.fn(async () => 'super'),
  now: NOW,
}

describe('handleAdminHandoff', () => {
  it('302s to admin /auth/handoff with a decryptable, audience-bound token', async () => {
    const res = await handleAdminHandoff({ ...base })
    expect(res.status).toBe(302)
    expect(res.headers.get('Cache-Control')).toBe('no-store')

    const location = new URL(res.headers.get('Location')!)
    expect(location.origin).toBe(ADMIN_ORIGIN)
    expect(location.pathname).toBe('/auth/handoff')

    const payload = JSON.parse(
      await decryptToken(location.searchParams.get('token')!, SECRET),
    )
    expect(payload).toEqual({
      v: 1,
      st: 'tok123.sig456',
      aud: ADMIN_ORIGIN,
      exp: NOW.getTime() + HANDOFF_TTL_MS,
    })
  })

  it('normalizes ADMIN_APP_URL to its origin for the audience', async () => {
    const res = await handleAdminHandoff({ ...base, adminAppUrl: `${ADMIN_ORIGIN}/` })
    expect(new URL(res.headers.get('Location')!).origin).toBe(ADMIN_ORIGIN)
  })

  it('500s when ADMIN_APP_URL is unset or malformed (misconfiguration, not a silent pass)', async () => {
    expect((await handleAdminHandoff({ ...base, adminAppUrl: undefined })).status).toBe(500)
    expect((await handleAdminHandoff({ ...base, adminAppUrl: 'not a url' })).status).toBe(500)
  })

  it('403s for a non-staff user', async () => {
    const res = await handleAdminHandoff({ ...base, fetchRole: async () => 'customer' })
    expect(res.status).toBe(403)
  })

  it('401s without a session cookie', async () => {
    const res = await handleAdminHandoff({ ...base, sessionCookieValue: null })
    expect(res.status).toBe(401)
  })

  it('500s when the shared secret is missing (misconfiguration, not a silent pass)', async () => {
    const res = await handleAdminHandoff({ ...base, secret: undefined })
    expect(res.status).toBe(500)
  })
})
