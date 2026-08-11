import { describe, expect, it } from 'vitest'
import { applyFrameAncestors, buildFrameAncestors } from './frame-headers'

describe('buildFrameAncestors', () => {
  it("renders 'self' plus configured ancestors", () => {
    expect(buildFrameAncestors('https://airtable.com, https://*.airtableblocks.com')).toBe(
      "frame-ancestors 'self' https://airtable.com https://*.airtableblocks.com",
    )
  })

  it("falls back to 'self' only when unset (framing disabled for third parties)", () => {
    expect(buildFrameAncestors(undefined)).toBe("frame-ancestors 'self'")
    expect(buildFrameAncestors('')).toBe("frame-ancestors 'self'")
  })
})

describe('applyFrameAncestors', () => {
  const value = "frame-ancestors 'self' https://airtable.com"

  it('sets the CSP header on HTML responses', () => {
    const res = applyFrameAncestors(
      new Response('<html></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }),
      value,
    )
    expect(res.headers.get('content-security-policy')).toBe(value)
  })

  it('leaves non-HTML responses untouched', () => {
    const res = applyFrameAncestors(
      new Response('{}', { headers: { 'content-type': 'application/json' } }),
      value,
    )
    expect(res.headers.get('content-security-policy')).toBeNull()
  })

  it('never clobbers an existing Content-Security-Policy', () => {
    const res = applyFrameAncestors(
      new Response('<html></html>', {
        headers: { 'content-type': 'text/html', 'content-security-policy': "default-src 'none'" },
      }),
      value,
    )
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'")
  })
})
