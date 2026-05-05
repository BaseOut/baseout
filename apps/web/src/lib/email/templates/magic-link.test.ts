import { describe, it, expect } from 'vitest'
import { renderMagicLinkEmail } from './magic-link'

describe('renderMagicLinkEmail', () => {
  const base = {
    url: 'https://app.baseout.com/api/auth/magic-link/verify?token=abc',
    email: 'user@example.com',
  }

  it('returns subject, html, and text with the link URL', () => {
    const rendered = renderMagicLinkEmail(base)
    expect(rendered.subject).toBe('Your sign-in link for Baseout')
    expect(rendered.html).toContain(base.url)
    expect(rendered.text).toContain(base.url)
    expect(rendered.text).toMatch(/expires in 5 minutes/)
  })

  it('uses productName override when provided', () => {
    const rendered = renderMagicLinkEmail({ ...base, productName: 'Acme' })
    expect(rendered.subject).toBe('Your sign-in link for Acme')
    expect(rendered.html).toContain('Sign in to Acme')
  })

  it('escapes HTML-dangerous characters in the URL', () => {
    const dangerousUrl = 'https://example.com/?x=<script>&y="a"'
    const rendered = renderMagicLinkEmail({ ...base, url: dangerousUrl })
    expect(rendered.html).not.toContain('<script>')
    expect(rendered.html).toContain('&lt;script&gt;')
    expect(rendered.html).toContain('&quot;a&quot;')
    expect(rendered.text).toBe(rendered.text)
    expect(rendered.text).toContain(dangerousUrl)
  })
})
