import { describe, it, expect } from 'vitest'
import { sanitizeReturnTo } from './return-to'

describe('sanitizeReturnTo', () => {
  it('accepts a plain absolute path', () => {
    expect(sanitizeReturnTo('/integrations')).toBe('/integrations')
  })

  it('accepts a path with query string', () => {
    expect(sanitizeReturnTo('/integrations?tab=airtable')).toBe(
      '/integrations?tab=airtable',
    )
  })

  it('accepts a nested path', () => {
    expect(sanitizeReturnTo('/spaces/abc/bases/xyz')).toBe(
      '/spaces/abc/bases/xyz',
    )
  })

  it('trims surrounding whitespace before validating', () => {
    expect(sanitizeReturnTo('  /integrations  ')).toBe('/integrations')
  })

  it('rejects null', () => {
    expect(sanitizeReturnTo(null)).toBeNull()
  })

  it('rejects undefined', () => {
    expect(sanitizeReturnTo(undefined)).toBeNull()
  })

  it('rejects the empty string', () => {
    expect(sanitizeReturnTo('')).toBeNull()
    expect(sanitizeReturnTo('   ')).toBeNull()
  })

  it('rejects paths that do not start with /', () => {
    expect(sanitizeReturnTo('integrations')).toBeNull()
    expect(sanitizeReturnTo('https://evil.com')).toBeNull()
    expect(sanitizeReturnTo('javascript:alert(1)')).toBeNull()
  })

  it('rejects protocol-relative URLs (open-redirect)', () => {
    expect(sanitizeReturnTo('//evil.com')).toBeNull()
    expect(sanitizeReturnTo('//evil.com/integrations')).toBeNull()
  })

  it('rejects backslash-after-slash (browser URL quirk)', () => {
    expect(sanitizeReturnTo('/\\evil.com')).toBeNull()
  })

  it('rejects paths containing a scheme separator', () => {
    expect(sanitizeReturnTo('/foo://bar')).toBeNull()
  })

  it('rejects paths to internal API routes', () => {
    expect(sanitizeReturnTo('/api/connections/airtable/start')).toBeNull()
    expect(sanitizeReturnTo('/api/anything')).toBeNull()
  })

  it('rejects values longer than 512 characters', () => {
    const long = '/' + 'a'.repeat(512)
    expect(long.length).toBe(513)
    expect(sanitizeReturnTo(long)).toBeNull()
  })

  it('rejects non-string inputs', () => {
    expect(sanitizeReturnTo(123 as unknown as string)).toBeNull()
    expect(sanitizeReturnTo({} as unknown as string)).toBeNull()
  })
})
