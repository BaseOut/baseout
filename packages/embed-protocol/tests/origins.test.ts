import { describe, expect, it } from 'vitest'
import { frameAncestorsValue, originMatches, parseAllowlist } from '../src/origins.js'

const LIST = 'https://airtable.com, https://*.airtableblocks.com, chrome-extension://abc123, chrome-extension://*'

describe('parseAllowlist', () => {
  it('parses exact, wildcard-subdomain, extension, and any-extension entries', () => {
    expect(parseAllowlist(LIST)).toEqual([
      { kind: 'exact', origin: 'https://airtable.com' },
      { kind: 'wildcard-subdomain', scheme: 'https', suffix: '.airtableblocks.com' },
      { kind: 'exact', origin: 'chrome-extension://abc123' },
      { kind: 'any-extension', scheme: 'chrome-extension' },
    ])
  })

  it('returns empty for unset/blank config and drops junk entries without throwing', () => {
    expect(parseAllowlist(undefined)).toEqual([])
    expect(parseAllowlist('')).toEqual([])
    expect(parseAllowlist('not-an-origin,,  ,https://ok.example')).toEqual([
      { kind: 'exact', origin: 'https://ok.example' },
    ])
  })

  it('ignores a bare * for non-extension schemes', () => {
    expect(parseAllowlist('https://*')).toEqual([])
  })
})

describe('originMatches', () => {
  const patterns = parseAllowlist(LIST)

  it.each([
    ['https://airtable.com', true],
    ['https://airtable.com:443', true], // default port normalizes away
    ['http://airtable.com', false], // scheme must match
    ['https://block-1.airtableblocks.com', true],
    ['https://airtableblocks.com', false], // wildcard never matches apex
    ['https://a.b.airtableblocks.com', false], // or multiple levels
    ['chrome-extension://abc123', true],
    ['chrome-extension://zzz', true], // any-extension entry
    ['https://evil.example', false],
    ['not a url', false],
  ])('%s → %s', (origin, expected) => {
    expect(originMatches(origin, patterns)).toBe(expected)
  })

  it('never matches on path — origins only', () => {
    expect(originMatches('https://evil.example/https://airtable.com', parseAllowlist('https://airtable.com'))).toBe(false)
  })
})

describe('frameAncestorsValue', () => {
  it("renders 'self' plus each pattern, mapping any-extension to a scheme source", () => {
    expect(frameAncestorsValue(parseAllowlist(LIST))).toBe(
      "frame-ancestors 'self' https://airtable.com https://*.airtableblocks.com chrome-extension://abc123 chrome-extension:",
    )
  })

  it("renders bare 'self' with no configuration", () => {
    expect(frameAncestorsValue([])).toBe("frame-ancestors 'self'")
  })
})
