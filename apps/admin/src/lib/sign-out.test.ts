import { describe, expect, it } from 'vitest'
import { signOutCookieHeaders } from './sign-out'

describe('signOutCookieHeaders', () => {
  it('deletes the admin + better-auth cookies over http', () => {
    const headers = signOutCookieHeaders(false)
    expect(headers).toHaveLength(2)
    expect(headers[0]).toBe('baseout_admin_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax')
    expect(headers[1]).toBe('better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax')
    expect(headers.join()).not.toContain('__Secure-')
  })

  it('adds the Secure variants and the __Secure- prod cookie over https', () => {
    const headers = signOutCookieHeaders(true)
    expect(headers).toHaveLength(3)
    for (const h of headers.slice(0, 2)) {
      expect(h).toContain('; Secure')
      expect(h).toContain('Max-Age=0')
    }
    expect(headers[2]).toBe(
      '__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure',
    )
  })
})
