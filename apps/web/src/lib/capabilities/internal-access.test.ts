// Staff capability override — openside.com orgs get full (enterprise) access.
// Pure logic; the org-membership lookup that feeds `internal` is I/O in resolve.ts.

import { describe, expect, it } from 'vitest'
import { applyInternalAccess, isInternalEmail } from './internal-access'
import { getTierCapabilities } from './tier-capabilities'

describe('isInternalEmail', () => {
  it('matches @openside.com (case-insensitive, trimmed)', () => {
    expect(isInternalEmail('autumn@openside.com')).toBe(true)
    expect(isInternalEmail('Autumn@OpenSide.COM')).toBe(true)
    expect(isInternalEmail('  dan@openside.com  ')).toBe(true)
  })

  it('rejects other domains, look-alikes, and empties', () => {
    expect(isInternalEmail('autumn@gmail.com')).toBe(false)
    expect(isInternalEmail('autumn@notopenside.com')).toBe(false) // '@' anchors the suffix
    expect(isInternalEmail('autumn@sub.openside.com')).toBe(false)
    expect(isInternalEmail('')).toBe(false)
    expect(isInternalEmail(null)).toBe(false)
    expect(isInternalEmail(undefined)).toBe(false)
  })
})

describe('applyInternalAccess', () => {
  const base = {
    tier: 'starter' as const,
    hasSubscription: false,
    capabilities: getTierCapabilities('starter'),
  }

  it('passes the base through unchanged (plus internal:false) when not internal', () => {
    expect(applyInternalAccess(base, false)).toEqual({ ...base, internal: false })
  })

  it('upgrades an internal org to full enterprise capabilities', () => {
    const out = applyInternalAccess(base, true)
    expect(out.internal).toBe(true)
    expect(out.tier).toBe('enterprise')
    expect(out.hasSubscription).toBe(true)
    expect(out.capabilities).toEqual(getTierCapabilities('enterprise'))
    expect(out.capabilities.schemaDocs).toBe('manual_ai')
    expect(out.capabilities.basesPerSpace).toBeNull()
  })
})
