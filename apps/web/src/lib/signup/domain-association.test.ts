/**
 * Pure-module tests for known-domain resolution
 * (openspec/changes/web-signup-domain-association task 1.2).
 *
 * The db-facing wrapper (resolveOrganizationsForEmail) is exercised through
 * the route tests with injected deps; here we pin the pure set algebra:
 * derived ∪ added − suppressed − public-provider denylist, capped at 3.
 */

import { describe, expect, it } from 'vitest'
import {
  applyDomainOverrides,
  emailDomain,
  isPublicEmailDomain,
  MAX_DOMAIN_MATCHES,
} from './domain-association'
import { PUBLIC_EMAIL_DOMAINS } from './public-email-domains'

describe('emailDomain', () => {
  it('extracts the lowercased domain', () => {
    expect(emailDomain('Person@Acme.COM')).toBe('acme.com')
  })

  it('returns null for malformed addresses', () => {
    expect(emailDomain('not-an-email')).toBeNull()
    expect(emailDomain('')).toBeNull()
    expect(emailDomain('a@')).toBeNull()
    expect(emailDomain('@acme.com')).toBeNull()
  })

  it('uses the last @ (quoted-local edge)', () => {
    expect(emailDomain('a@b@acme.com')).toBe('acme.com')
  })
})

describe('isPublicEmailDomain', () => {
  it('flags well-known public providers', () => {
    expect(isPublicEmailDomain('gmail.com')).toBe(true)
    expect(isPublicEmailDomain('outlook.com')).toBe(true)
    expect(isPublicEmailDomain('GMAIL.com')).toBe(true)
  })

  it('does not flag company domains', () => {
    expect(isPublicEmailDomain('acme.com')).toBe(false)
    expect(isPublicEmailDomain('openside.com')).toBe(false)
  })

  it('denylist is maintained data, not code', () => {
    expect(Array.isArray(PUBLIC_EMAIL_DOMAINS)).toBe(true)
    expect(PUBLIC_EMAIL_DOMAINS.length).toBeGreaterThan(20)
  })
})

describe('applyDomainOverrides', () => {
  const org = (id: string) => ({ id, name: id, slug: id })

  it('unions derived and added', () => {
    const out = applyDomainOverrides({
      derived: [org('a')],
      added: [org('b')],
      suppressed: [],
    })
    expect(out.map((o) => o.id)).toEqual(['a', 'b'])
  })

  it('removes suppressed orgs even when derived', () => {
    const out = applyDomainOverrides({
      derived: [org('a'), org('b')],
      added: [],
      suppressed: ['b'],
    })
    expect(out.map((o) => o.id)).toEqual(['a'])
  })

  it('dedupes orgs appearing in both derived and added', () => {
    const out = applyDomainOverrides({
      derived: [org('a')],
      added: [org('a'), org('b')],
      suppressed: [],
    })
    expect(out.map((o) => o.id)).toEqual(['a', 'b'])
  })

  it('caps the result at MAX_DOMAIN_MATCHES (3) — design open question 1', () => {
    const out = applyDomainOverrides({
      derived: [org('a'), org('b'), org('c'), org('d')],
      added: [org('e')],
      suppressed: [],
    })
    expect(MAX_DOMAIN_MATCHES).toBe(3)
    expect(out).toHaveLength(3)
  })
})
