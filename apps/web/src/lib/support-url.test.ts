import { describe, expect, it } from 'vitest'
import { resolvePublicSupportUrl } from './support-url'

describe('resolvePublicSupportUrl', () => {
  it('returns null for empty input', () => {
    expect(resolvePublicSupportUrl(undefined)).toBeNull()
    expect(resolvePublicSupportUrl('')).toBeNull()
    expect(resolvePublicSupportUrl('   ')).toBeNull()
  })

  it('accepts http(s) origins and strips a trailing slash', () => {
    expect(resolvePublicSupportUrl('https://support.baseout.com/')).toBe(
      'https://support.baseout.com',
    )
    expect(resolvePublicSupportUrl('http://localhost:4342')).toBe('http://localhost:4342')
  })

  it('rejects non-http schemes and garbage', () => {
    expect(resolvePublicSupportUrl('javascript:alert(1)')).toBeNull()
    expect(resolvePublicSupportUrl('not a url')).toBeNull()
  })
})
