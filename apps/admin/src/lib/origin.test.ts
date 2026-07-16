import { describe, expect, it } from 'vitest'
import { checkOrigin } from './origin'

const SELF = 'https://baseout-admin-dev.openside.workers.dev'

describe('checkOrigin', () => {
  it('accepts a matching origin', () => {
    expect(checkOrigin(SELF, SELF)).toBe(true)
  })

  it('rejects a different origin', () => {
    expect(checkOrigin('https://evil.example', SELF)).toBe(false)
  })

  it('rejects a missing Origin header', () => {
    expect(checkOrigin(null, SELF)).toBe(false)
  })

  it('rejects an unparseable origin', () => {
    expect(checkOrigin('not a url', SELF)).toBe(false)
  })

  it('rejects same host on a different scheme', () => {
    expect(checkOrigin('http://baseout-admin-dev.openside.workers.dev', SELF)).toBe(false)
  })

  it('rejects same host on a different port', () => {
    expect(checkOrigin('http://baseout.local:4331', 'http://baseout.local:4332')).toBe(false)
  })

  it('normalizes trailing slashes via URL parsing', () => {
    expect(checkOrigin(`${SELF}/`, SELF)).toBe(true)
  })
})
