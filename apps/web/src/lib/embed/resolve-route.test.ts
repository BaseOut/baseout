import { describe, expect, it } from 'vitest'
import { resolveEmbedRoute } from './resolve-route'

const BASES = [
  { atBaseId: 'appIncluded', isIncluded: true },
  { atBaseId: 'appExcluded', isIncluded: false },
]

describe('resolveEmbedRoute', () => {
  it('routes a backed-up base to its schema surface with context params', () => {
    expect(
      resolveEmbedRoute({ host: 'airtable-data', baseId: 'appIncluded', tableId: 'tbl1' }, BASES),
    ).toBe('/schema?baseId=appIncluded&tableId=tbl1')
  })

  it('routes a known-but-excluded base to sources with the not-backed-up affordance', () => {
    expect(resolveEmbedRoute({ host: 'airtable-data', baseId: 'appExcluded' }, BASES)).toBe(
      '/sources?unbackedBase=appExcluded',
    )
  })

  it('routes an unknown base the same way (host may see bases we cannot)', () => {
    expect(resolveEmbedRoute({ host: 'chrome', baseId: 'appStranger' }, BASES)).toBe(
      '/sources?unbackedBase=appStranger',
    )
  })

  it('routes contextless hosts to the dashboard', () => {
    expect(resolveEmbedRoute({ host: 'chrome', url: 'https://example.com' }, BASES)).toBe('/')
  })
})
