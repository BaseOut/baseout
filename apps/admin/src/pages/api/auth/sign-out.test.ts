// Route test for POST /api/auth/sign-out. The route imports only pure libs
// (no cloudflare:workers), so no module mock is needed.
import { describe, expect, it } from 'vitest'
import type { APIContext } from 'astro'
import { POST, GET, PUT, PATCH, DELETE } from './sign-out'

function ctx(origin: string | null, requestUrl = 'http://baseout.local:4332/api/auth/sign-out') {
  const headers = new Headers()
  if (origin) headers.set('origin', origin)
  return {
    request: new Request(requestUrl, { method: 'POST', headers }),
    url: new URL(requestUrl),
  } as unknown as APIContext
}

describe('POST /api/auth/sign-out', () => {
  it('rejects a cross-origin POST', async () => {
    const res = await POST(ctx('https://evil.example'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'bad_origin' })
  })

  it('rejects a missing Origin header', async () => {
    const res = await POST(ctx(null))
    expect(res.status).toBe(403)
  })

  it('clears cookies and 303s to the sign-in page', async () => {
    const res = await POST(ctx('http://baseout.local:4332'))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/auth/sign-in?reason=signed-out')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const cookies = res.headers.getSetCookie()
    expect(cookies.some((c) => c.startsWith('baseout_admin_session=;'))).toBe(true)
    expect(cookies.some((c) => c.startsWith('better-auth.session_token=;'))).toBe(true)
    // http request → no Secure variants
    expect(cookies.join()).not.toContain('__Secure-')
  })

  it('adds the __Secure- deletion on https', async () => {
    const res = await POST(ctx('https://admin.example', 'https://admin.example/api/auth/sign-out'))
    expect(res.status).toBe(303)
    const cookies = res.headers.getSetCookie()
    expect(cookies.some((c) => c.startsWith('__Secure-better-auth.session_token=;'))).toBe(true)
  })

  it('rejects other methods', async () => {
    for (const handler of [GET, PUT, PATCH, DELETE]) {
      const res = await handler(ctx('http://baseout.local:4332'))
      expect(res.status).toBe(405)
    }
  })
})
