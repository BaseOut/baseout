import { describe, expect, it } from 'vitest'
import { parseAirtableUrl } from '../src/parse-airtable-url.js'

describe('parseAirtableUrl', () => {
  it('parses a data-layer URL into base/table/view context', () => {
    expect(
      parseAirtableUrl('https://airtable.com/appHr3WJrQiMJu4P5/tblHr3WJrQiMJu4P5/viwAbCdEfGhIjKlM'),
    ).toEqual({
      host: 'chrome',
      url: 'https://airtable.com/appHr3WJrQiMJu4P5/tblHr3WJrQiMJu4P5/viwAbCdEfGhIjKlM',
      baseId: 'appHr3WJrQiMJu4P5',
      tableId: 'tblHr3WJrQiMJu4P5',
      viewId: 'viwAbCdEfGhIjKlM',
    })
  })

  it('parses an interface URL into base/page context', () => {
    const ctx = parseAirtableUrl('https://airtable.com/appHr3WJrQiMJu4P5/pagDbJfEBPEsMIqI6')
    expect(ctx.baseId).toBe('appHr3WJrQiMJu4P5')
    expect(ctx.pageId).toBe('pagDbJfEBPEsMIqI6')
    expect(ctx.tableId).toBeUndefined()
  })

  it('handles partial paths (base only)', () => {
    expect(parseAirtableUrl('https://airtable.com/appHr3WJrQiMJu4P5').baseId).toBe('appHr3WJrQiMJu4P5')
  })

  it('degrades non-Airtable and unparseable URLs to bare chrome context', () => {
    expect(parseAirtableUrl('https://example.com/appHr3WJrQiMJu4P5')).toEqual({
      host: 'chrome',
      url: 'https://example.com/appHr3WJrQiMJu4P5',
    })
    expect(parseAirtableUrl('not a url')).toEqual({ host: 'chrome' })
    expect(parseAirtableUrl(undefined)).toEqual({ host: 'chrome' })
  })

  it('ignores short/invalid id-shaped segments (e.g. marketing paths)', () => {
    const ctx = parseAirtableUrl('https://airtable.com/pricing/apple')
    expect(ctx.baseId).toBeUndefined()
    expect(ctx.pageId).toBeUndefined()
  })

  it('keeps the first occurrence when a prefix repeats', () => {
    const ctx = parseAirtableUrl('https://airtable.com/appFirst111111/appSecond22222')
    expect(ctx.baseId).toBe('appFirst111111')
  })

  it('accepts airtable.com subdomains', () => {
    expect(parseAirtableUrl('https://www.airtable.com/appHr3WJrQiMJu4P5').baseId).toBe(
      'appHr3WJrQiMJu4P5',
    )
  })
})
