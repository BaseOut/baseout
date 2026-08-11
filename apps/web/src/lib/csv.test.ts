import { describe, expect, it } from 'vitest'
import { UTF8_BOM, escapeCsvCell, exportFilename, formatCsv } from './csv'

describe('escapeCsvCell', () => {
  it('quotes every cell, even plain ones', () => {
    expect(escapeCsvCell('hello')).toBe('"hello"')
    expect(escapeCsvCell(42)).toBe('"42"')
  })

  it('renders null and undefined as an empty quoted cell', () => {
    expect(escapeCsvCell(null)).toBe('""')
    expect(escapeCsvCell(undefined)).toBe('""')
  })

  it('doubles embedded quotes per RFC-4180', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it.each([
    ['=', '=SUM(A1:A2)'],
    ['+', '+1234'],
    ['-', '-cmd'],
    ['@', '@import'],
    ['TAB', '\tpadded'],
    ['CR', '\rreturn'],
    ['LF', '\nnewline'],
  ])('neutralises a leading %s formula trigger with an apostrophe', (_name, raw) => {
    expect(escapeCsvCell(raw)).toBe(`"'${raw.replace(/"/g, '""')}"`)
  })

  it('leaves formula triggers alone when they are not leading', () => {
    expect(escapeCsvCell('a=b')).toBe('"a=b"')
    expect(escapeCsvCell('1+1')).toBe('"1+1"')
  })
})

describe('formatCsv', () => {
  it('quotes every cell and joins rows with CRLF, ending with CRLF', () => {
    const out = formatCsv(['a', 'b'], [['1', '2'], ['3', '=x']])
    expect(out).toBe('"a","b"\r\n"1","2"\r\n"3","\'=x"\r\n')
  })

  it('omits the BOM by default and prepends it on request', () => {
    expect(formatCsv(['a'], []).startsWith(UTF8_BOM)).toBe(false)
    expect(formatCsv(['a'], [], { bom: true }).startsWith(UTF8_BOM)).toBe(true)
    expect(formatCsv(['a'], [], { bom: true })).toBe(`${UTF8_BOM}"a"\r\n`)
  })
})

describe('exportFilename', () => {
  const date = new Date('2026-07-10T15:30:00Z')

  it('slugs the space and tab and uses the injected ISO date', () => {
    expect(exportFilename({ space: 'Core CRM', tab: 'browse', scope: 'filtered', ext: 'csv', date })).toBe(
      'baseout_core-crm_browse_2026-07-10_filtered.csv',
    )
  })

  it('collapses punctuation runs and trims leading/trailing dashes in slugs', () => {
    expect(exportFilename({ space: '  Ops / QA!! ', tab: 'Change Log', scope: 'all', ext: 'pdf', date })).toBe(
      'baseout_ops-qa_change-log_2026-07-10_all.pdf',
    )
  })

  it('encodes the scope in the filename', () => {
    expect(exportFilename({ space: 'S', tab: 'visualize', scope: 'all', ext: 'png', date })).toContain('_all.png')
  })
})
