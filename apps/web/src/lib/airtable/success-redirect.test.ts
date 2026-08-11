// Locks down where a successful OAuth callback lands: first-time connects
// (no backup configuration for the Space yet) drop straight into Configure
// setup (?first=1) per the integrations redesign; returning users go back to
// the page they started from with the existing ?connected=1 toast.

import { describe, expect, it } from 'vitest'
import { appendQuery, resolveSuccessRedirect } from './success-redirect'

describe('resolveSuccessRedirect', () => {
  it('sends a first-time connect into Configure setup', () => {
    expect(
      resolveSuccessRedirect({ returnTo: '/integrations', hasBackupConfig: false }),
    ).toBe('/integrations/configure?first=1')
  })

  it('sends a returning user back to returnTo with the connected toast', () => {
    expect(
      resolveSuccessRedirect({ returnTo: '/integrations', hasBackupConfig: true }),
    ).toBe('/integrations?connected=1')
  })

  it('appends with & when returnTo already has a query string', () => {
    expect(
      resolveSuccessRedirect({ returnTo: '/integrations?tab=bases', hasBackupConfig: true }),
    ).toBe('/integrations?tab=bases&connected=1')
  })

  it('handles the root fallback returnTo', () => {
    expect(resolveSuccessRedirect({ returnTo: '/', hasBackupConfig: true })).toBe(
      '/?connected=1',
    )
  })
})

describe('appendQuery', () => {
  it('uses ? for the first param and & after', () => {
    expect(appendQuery('/a', 'k', 'v')).toBe('/a?k=v')
    expect(appendQuery('/a?x=1', 'k', 'v')).toBe('/a?x=1&k=v')
  })

  it('URL-encodes the value', () => {
    expect(appendQuery('/a', 'error', 'state mismatch')).toBe('/a?error=state%20mismatch')
  })
})
