import { describe, expect, it } from 'vitest'
import {
  resolvePostOAuthReturnLocation,
  rewriteLocalhostTrapUrl,
} from './canonical-dev-origin'

describe('rewriteLocalhostTrapUrl', () => {
  it('rewrites localhost:4331 to baseout.local:4331 in dev', () => {
    const input = new URL(
      'https://localhost:4331/api/connections/storage/onedrive/callback?code=x',
    )
    const out = rewriteLocalhostTrapUrl(input)
    expect(out?.hostname).toBe('baseout.local')
    expect(out?.port).toBe('4331')
    expect(out?.pathname).toBe('/api/connections/storage/onedrive/callback')
    expect(out?.search).toBe('?code=x')
  })

  it('leaves baseout.local unchanged', () => {
    const input = new URL('https://baseout.local:4331/backups')
    expect(rewriteLocalhostTrapUrl(input)).toBeNull()
  })
})

describe('resolvePostOAuthReturnLocation', () => {
  it('prefixes PUBLIC_AUTH_BASE_URL for relative paths', () => {
    expect(
      resolvePostOAuthReturnLocation(
        '/backups?connected=onedrive',
        'https://baseout.local:4331',
      ),
    ).toBe('https://baseout.local:4331/backups?connected=onedrive')
  })

  it('returns the path unchanged when base URL is absent', () => {
    expect(resolvePostOAuthReturnLocation('/backups', undefined)).toBe('/backups')
  })
})
