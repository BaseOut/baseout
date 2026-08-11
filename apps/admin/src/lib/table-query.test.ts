import { describe, it, expect } from 'vitest'
import {
  parseTableQuery,
  pageInfo,
  withParams,
  sortHref,
  pageHref,
  perHref,
  validateReturnPath,
  retParam,
  type TableSpec,
} from './table-query'

// A representative spec: newest-first default, a couple sort keys, one enum
// filter (status) and one free-form id filter (org), searchable.
const SPEC: TableSpec = {
  sortKeys: ['created', 'name'],
  defaultSort: 'created',
  defaultDir: 'desc',
  searchable: true,
  filters: [
    { key: 'status', allowed: ['failed', 'running', 'succeeded'] },
    { key: 'org' }, // free-form id filter (no enumerable allowed set)
  ],
}

const parse = (qs: string) => parseTableQuery(new URL(`https://a.dev/x${qs}`), SPEC)

describe('parseTableQuery', () => {
  it('returns whitelisted defaults for an empty query string', () => {
    const q = parse('')
    expect(q).toEqual({
      page: 1,
      per: 50,
      offset: 0,
      sort: 'created',
      dir: 'desc',
      q: null,
      filters: {},
    })
  })

  it('accepts a page-size only from the allowed set, else default', () => {
    expect(parse('?per=25').per).toBe(25)
    expect(parse('?per=100').per).toBe(100)
    expect(parse('?per=7').per).toBe(50) // not allowed → default
    expect(parse('?per=abc').per).toBe(50)
  })

  it('parses page and derives offset; invalid/low pages clamp to 1', () => {
    expect(parse('?page=3').page).toBe(3)
    expect(parse('?page=3').offset).toBe(100) // (3-1)*50
    expect(parse('?page=0').page).toBe(1)
    expect(parse('?page=-4').page).toBe(1)
    expect(parse('?page=abc').page).toBe(1)
    expect(parse('?page=2&per=25').offset).toBe(25)
  })

  it('falls back to the default sort for unknown / injection sort keys', () => {
    expect(parse('?sort=name').sort).toBe('name')
    expect(parse('?sort=bogus').sort).toBe('created')
    expect(parse('?sort=;drop table--').sort).toBe('created')
  })

  it('validates dir, defaulting to the spec default', () => {
    expect(parse('?dir=asc').dir).toBe('asc')
    expect(parse('?dir=desc').dir).toBe('desc')
    expect(parse('?dir=sideways').dir).toBe('desc')
  })

  it('trims q and treats blank/absent as null; only when searchable', () => {
    expect(parse('?q=acme').q).toBe('acme')
    expect(parse('?q=%20%20').q).toBeNull()
    expect(parse('').q).toBeNull()
    const notSearchable = parseTableQuery(new URL('https://a.dev/x?q=acme'), {
      ...SPEC,
      searchable: false,
    })
    expect(notSearchable.q).toBeNull()
  })

  it('keeps enum filters only when the value is in the allowed set', () => {
    expect(parse('?status=failed').filters).toEqual({ status: 'failed' })
    expect(parse('?status=bogus').filters).toEqual({}) // dropped
    expect(parse('?status=').filters).toEqual({})
  })

  it('accepts a free-form id filter (no allowed set) as a trimmed non-empty value', () => {
    expect(parse('?org=org_123').filters).toEqual({ org: 'org_123' })
    expect(parse('?org=%20').filters).toEqual({})
  })

  it('combines search + filters + sort + pagination', () => {
    const q = parse('?q=acme&status=running&org=org_9&sort=name&dir=asc&page=2&per=25')
    expect(q).toEqual({
      page: 2,
      per: 25,
      offset: 25,
      sort: 'name',
      dir: 'asc',
      q: 'acme',
      filters: { status: 'running', org: 'org_9' },
    })
  })

  it('ignores query params not declared in the spec', () => {
    expect(parse('?tier=growth').filters).toEqual({}) // tier not a declared filter
  })
})

describe('pageInfo', () => {
  it('computes ranges, totals, and neighbor flags', () => {
    const info = pageInfo(4231, 2, 50)
    expect(info.total).toBe(4231)
    expect(info.totalPages).toBe(85)
    expect(info.clampedPage).toBe(2)
    expect(info.from).toBe(51)
    expect(info.to).toBe(100)
    expect(info.hasPrev).toBe(true)
    expect(info.hasNext).toBe(true)
    expect(info.offset).toBe(50)
  })

  it('clamps a page past the end to the last page', () => {
    const info = pageInfo(180, 999, 50) // 4 pages
    expect(info.totalPages).toBe(4)
    expect(info.clampedPage).toBe(4)
    expect(info.from).toBe(151)
    expect(info.to).toBe(180)
    expect(info.hasNext).toBe(false)
    expect(info.offset).toBe(150)
  })

  it('handles an empty result set', () => {
    const info = pageInfo(0, 1, 50)
    expect(info.totalPages).toBe(1)
    expect(info.clampedPage).toBe(1)
    expect(info.from).toBe(0)
    expect(info.to).toBe(0)
    expect(info.hasPrev).toBe(false)
    expect(info.hasNext).toBe(false)
    expect(info.offset).toBe(0)
  })

  it('reports the last-page partial range', () => {
    const info = pageInfo(132, 3, 50) // 3 pages, last has 32
    expect(info.totalPages).toBe(3)
    expect(info.from).toBe(101)
    expect(info.to).toBe(132)
  })
})

describe('href builders', () => {
  const cur = new URLSearchParams('status=active&q=acme&sort=created&dir=desc&page=3&per=25')

  it('withParams preserves siblings, sets, and deletes (null)', () => {
    expect(withParams(cur, { page: 5 })).toBe(
      '?status=active&q=acme&sort=created&dir=desc&page=5&per=25',
    )
    const dropped = withParams(cur, { q: null })
    expect(dropped).not.toContain('q=acme')
    expect(dropped).toContain('status=active')
  })

  it('withParams on an empty base yields empty string', () => {
    expect(withParams(new URLSearchParams(''), {})).toBe('')
  })

  it('sortHref toggles dir on the active column and resets page to 1', () => {
    // active column is "created" desc → clicking flips to asc, page resets
    expect(sortHref(cur, 'created', SPEC)).toBe(
      '?status=active&q=acme&sort=created&dir=asc&page=1&per=25',
    )
    // a different column → ascending first, page reset
    const other = sortHref(cur, 'name', SPEC)
    expect(other).toContain('sort=name')
    expect(other).toContain('dir=asc')
    expect(other).toContain('page=1')
    expect(other).toContain('status=active')
  })

  it('pageHref sets the target page, preserving everything else', () => {
    expect(pageHref(cur, 7)).toBe('?status=active&q=acme&sort=created&dir=desc&page=7&per=25')
  })

  it('perHref changes page size and resets page to 1', () => {
    const h = perHref(cur, 100)
    expect(h).toContain('per=100')
    expect(h).toContain('page=1')
    expect(h).toContain('status=active')
  })
})

describe('validateReturnPath', () => {
  const FB = '/organizations'
  it('accepts a same-app relative path with query', () => {
    expect(validateReturnPath('/organizations?status=trialing&page=2', FB)).toBe(
      '/organizations?status=trialing&page=2',
    )
    expect(validateReturnPath('/spaces', FB)).toBe('/spaces')
  })
  it('falls back on null/empty', () => {
    expect(validateReturnPath(null, FB)).toBe(FB)
    expect(validateReturnPath('', FB)).toBe(FB)
  })
  it('rejects absolute URLs, protocol-relative, backslash, and non-root paths', () => {
    expect(validateReturnPath('https://evil.example/phish', FB)).toBe(FB)
    expect(validateReturnPath('//evil.example', FB)).toBe(FB)
    expect(validateReturnPath('/\\evil.example', FB)).toBe(FB)
    expect(validateReturnPath('backups', FB)).toBe(FB)
    expect(validateReturnPath('javascript:alert(1)', FB)).toBe(FB)
  })
  it('rejects control characters', () => {
    expect(validateReturnPath('/a\nb', FB)).toBe(FB)
  })
})

describe('retParam', () => {
  it('encodes path + current query for a row link', () => {
    const params = new URLSearchParams('status=trialing&page=2')
    expect(retParam('/organizations', params)).toBe(
      encodeURIComponent('/organizations?status=trialing&page=2'),
    )
  })
  it('omits the query when there is none', () => {
    expect(retParam('/spaces', new URLSearchParams(''))).toBe(encodeURIComponent('/spaces'))
  })
})
